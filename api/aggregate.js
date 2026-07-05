import { createClient } from "@supabase/supabase-js";

// Reads APP_REGISTRY (JSON array of { name, url, token }), fans out to each
// app's /api/status, aggregates + diagnoses, and independently probes Post
// Bridge and Apify reachability from tinkerboxxx.

const FETCH_TIMEOUT_MS = 10_000;
const STALE_HOURS = 24;

function loadRegistry() {
  const raw = process.env.APP_REGISTRY;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e === "object")
      .map(e => ({
        name: String(e.name || ""),
        url: String(e.url || "").replace(/\/$/, ""),
        token: String(e.token || ""),
      }))
      .filter(e => e.name && e.url && e.token);
  } catch {
    return [];
  }
}

async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function humanAgo(iso) {
  if (!iso) return "never";
  const delta = Date.now() - Date.parse(iso);
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function diagnose(s) {
  const reasons = [];
  let severity = "healthy";
  let headline = "Healthy";
  const now = Date.now();
  const staleCutoff = now - STALE_HOURS * 60 * 60 * 1000;

  if (!s.connections.kv.reachable) {
    return {
      severity: "error",
      headline: "KV unreachable",
      reasons: [s.connections.kv.error || "Upstash Redis returned an error."],
    };
  }
  // Only warn about Post Bridge when the app actually uses it AND has a real
  // recent failure. Absence of a token means "app doesn't use it", not "broken".
  if (s.connections.postBridge.configured) {
    const lastSuccess = s.connections.postBridge.lastSuccessAt
      ? Date.parse(s.connections.postBridge.lastSuccessAt) : 0;
    const lastFailure = s.connections.postBridge.lastFailureAt
      ? Date.parse(s.connections.postBridge.lastFailureAt) : 0;
    if (lastFailure > lastSuccess && lastFailure > now - 30 * 60 * 1000) {
      reasons.push(
        `Post Bridge last failed ${humanAgo(s.connections.postBridge.lastFailureAt)} and hasn't succeeded since${
          s.connections.postBridge.lastErrorMessage
            ? `: ${String(s.connections.postBridge.lastErrorMessage).slice(0, 120)}`
            : "."
        }`
      );
      severity = "error";
      headline = "Post Bridge failing";
    } else if (lastSuccess && lastSuccess < staleCutoff) {
      reasons.push(`Post Bridge last succeeded ${humanAgo(s.connections.postBridge.lastSuccessAt)}, over 24h ago.`);
      if (severity === "healthy") { severity = "warn"; headline = "Post Bridge quiet"; }
    }
  }
  // Apify: "not configured" ≠ "broken". Many apps genuinely don't use Apify,
  // so absence of APIFY_TOKEN is not a warning signal. Only real failures
  // surfaced by the app (in future via a lastFailureAt) should downgrade.

  if (s.counts.silentMissCount > 0) {
    reasons.push(`${s.counts.silentMissCount} automation${s.counts.silentMissCount === 1 ? "" : "s"} missed a scheduled fire.`);
    if (severity === "healthy") { severity = "warn"; headline = "Cron missed slots"; }
    else if (severity !== "error") headline = "Cron missed slots";
  }
  if (s.counts.failingCount > 0) {
    reasons.push(`${s.counts.failingCount} recent post${s.counts.failingCount === 1 ? "" : "s"} failed and not yet recovered.`);
    if (severity === "healthy") { severity = "warn"; headline = "Recent post failures"; }
  }
  if (s.counts.automationsEnabled === 0) {
    reasons.push("No automations are enabled on this app.");
    if (severity === "healthy") { severity = "warn"; headline = "Nothing scheduled"; }
  }
  return { severity, headline, reasons };
}

async function fetchOneApp(entry) {
  const started = Date.now();
  const url = `${entry.url}/api/status`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${entry.token}` },
    }, FETCH_TIMEOUT_MS);
    const fetchMs = Date.now() - started;
    if (!res.ok) {
      return {
        name: entry.name, url: entry.url, fetchedAt: new Date().toISOString(),
        reachable: false, httpStatus: res.status, fetchMs,
        fetchErrorMessage: `HTTP ${res.status}`,
        diagnosis: {
          severity: "error",
          headline: res.status === 401 ? "Manager token rejected"
            : res.status >= 500 ? "App crashed"
            : `App returned HTTP ${res.status}`,
          reasons: [
            res.status === 401
              ? "The bearer token in APP_REGISTRY does not match the app's CRON_SECRET."
              : `Non-2xx response from ${url}.`,
          ],
        },
      };
    }
    const status = await res.json();
    return {
      name: entry.name, url: entry.url, fetchedAt: new Date().toISOString(),
      reachable: true, httpStatus: 200, fetchMs, status, diagnosis: diagnose(status),
    };
  } catch (e) {
    const timedOut = e.name === "AbortError";
    return {
      name: entry.name, url: entry.url, fetchedAt: new Date().toISOString(),
      reachable: false, fetchMs: Date.now() - started,
      fetchErrorMessage: timedOut ? "Timed out" : e.message,
      diagnosis: {
        severity: "error",
        headline: timedOut ? "App not responding" : "App unreachable",
        reasons: [timedOut ? `No response from ${url} within ${FETCH_TIMEOUT_MS}ms.` : e.message],
      },
    };
  }
}

async function probe(name, url, timeoutMs = 6000) {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
    return { name, ok: res.status < 500, latencyMs: Date.now() - started, detail: `HTTP ${res.status}` };
  } catch (e) {
    return {
      name, ok: false, latencyMs: Date.now() - started,
      detail: e.name === "AbortError" ? "Timed out" : e.message,
    };
  }
}

async function authUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Missing auth token", status: 401 };
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { error: "Server misconfigured", status: 500 };
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { error: "Invalid token", status: 401 };
  return { user: data.user };
}

export default async function handler(req, res) {
  const auth = await authUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const registry = loadRegistry();
  const [apps, platforms] = await Promise.all([
    Promise.all(registry.map(fetchOneApp)),
    Promise.all([
      probe("Post Bridge", "https://api.post-bridge.com/v1/social-accounts?limit=1"),
      probe("Apify", "https://api.apify.com/v2/acts?limit=1"),
    ]),
  ]);
  const summary = { total: apps.length, healthy: 0, warn: 0, error: 0 };
  for (const a of apps) summary[a.diagnosis.severity] += 1;

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    apps, platforms, summary,
  });
}
