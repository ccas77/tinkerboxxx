import { createClient } from "@supabase/supabase-js";

// Reads APP_REGISTRY (JSON array of { name, url, token }), fans out to each
// app's /api/status, and derives a diagnosis. Each app cross-checks its own
// claimed posts against Post Bridge server-side and returns the result in
// status.crossCheck / status.yesterday; the manager surfaces and interprets it.

const FETCH_TIMEOUT_MS = 10_000;

// Classify a platform error string into an actionable bucket. Shared with the
// daily alert cron (api/cron/dead-account-check.js imports this).
export function classifyError(err) {
  const e = String(err || "").toLowerCase();
  if (!e) return "other";
  if (/(refresh|access) token|token (is )?(invalid|expired)|invalid or expired|re-?auth|reconnect|unauthor|\b401\b/.test(e)) return "auth";
  if (/permission|does not exist|cannot be loaded|not authorized|forbidden|\b403\b|disconnect/.test(e)) return "permission";
  if (/took too long|timed out|time out|temporar|rate limit|try again|still complete|could not download|please check/.test(e)) return "transient";
  return "other";
}

export function loadRegistry() {
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
        // Optional: GitHub repo (and subdirectory) holding this app's code, so
        // diagnostic consumers know where to investigate.
        repo: e.repo ? String(e.repo) : null,
        dir: e.dir ? String(e.dir) : null,
      }))
      .filter(e => e.name && e.url && e.token);
  } catch {
    return [];
  }
}

export async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

// Tally the error classes present in an app's unconfirmed-posts list. A
// missing error string means "attempted, not yet confirmed" (pending), which
// is softer than an explicit failure.
function summarizeFailureClasses(unconfirmed) {
  const classes = { auth: 0, permission: 0, transient: 0, other: 0, pending: 0 };
  for (const u of Array.isArray(unconfirmed) ? unconfirmed : []) {
    if (!u || !u.error) { classes.pending += 1; continue; }
    classes[classifyError(u.error)] += 1;
  }
  return classes;
}

function diagnose(s) {
  const reasons = [];
  let severity = "healthy";
  let headline = "Healthy";

  // Storage backends: whichever the app declares (kv / database / blob).
  const conns = s.connections || {};
  const storage = conns.kv || conns.database || conns.blob;
  if (storage && storage.reachable === false) {
    return {
      severity: "error",
      headline: "Storage unreachable",
      reasons: [storage.error || "Storage backend returned an error."],
    };
  }

  // Yesterday-based diagnosis. Planned vs attempted vs confirmed.
  if (s.yesterday) {
    const y = s.yesterday;
    if (y.error) {
      reasons.push(`Yesterday data unavailable: ${y.error}.`);
      severity = "warn";
      headline = "Yesterday data missing";
    }

    // A scheduled slot that never even attempted a post is a real cron miss.
    if (y.attemptGap > 0) {
      reasons.push(`${y.attemptGap} scheduled slot${y.attemptGap === 1 ? "" : "s"} yesterday did not attempt a post. The cron did not fire, or the run was skipped.`);
      severity = "error";
      headline = "Cron missed slots";
    } else if (y.planned === null || y.planned === undefined) {
      reasons.push("Planned count is not tracked by this app for past days (the schedule log expires overnight).");
    }

    // Attempted-but-unconfirmed: severity depends on WHY it is unconfirmed.
    // Auth/permission/other are real failures (error). Transient uploads and
    // still-pending confirmations self-heal, so they only warrant a warning.
    if (y.confirmGap > 0) {
      const c = summarizeFailureClasses(y.unconfirmed);
      const hard = c.auth + c.permission + c.other;
      const soft = c.transient + c.pending;

      if (hard > 0) {
        severity = "error";
        const parts = [];
        if (c.auth) parts.push(`${c.auth} auth-expired`);
        if (c.permission) parts.push(`${c.permission} permission`);
        if (c.other) parts.push(`${c.other} other`);
        const actions = [];
        if (c.auth) actions.push("Reconnect the account(s) in Post Bridge.");
        if (c.permission) actions.push("Fix the platform permissions / page access.");
        reasons.push(`${hard} post${hard === 1 ? "" : "s"} failed to deliver (${parts.join(", ")}). ${actions.join(" ")}`.trim());
        const primary = c.auth >= c.permission && c.auth >= c.other ? "Auth expired"
          : c.permission >= c.other ? "Permission errors"
          : "Delivery failures";
        headline = headline === "Cron missed slots" ? "Cron misses + delivery failures" : primary;
      } else if (soft > 0) {
        const bits = [];
        if (c.transient) bits.push(`${c.transient} transient upload issue${c.transient === 1 ? "" : "s"}`);
        if (c.pending) bits.push(`${c.pending} still awaiting confirmation`);
        reasons.push(`${y.confirmGap} post${y.confirmGap === 1 ? "" : "s"} not confirmed delivered (${bits.join(", ")}). Usually self-heals.`);
        if (severity !== "error") {
          severity = "warn";
          if (headline === "Healthy") headline = "Transient delivery issues";
        }
      } else {
        reasons.push(`${y.confirmGap} attempted post${y.confirmGap === 1 ? "" : "s"} yesterday have no confirmed delivery in Post Bridge.`);
        if (severity !== "error") {
          severity = "warn";
          if (headline === "Healthy") headline = "Unconfirmed deliveries";
        }
      }
    }

    if (y.planned === 0 && y.attempted === 0) {
      reasons.push("Nothing was planned or attempted yesterday.");
      if (severity === "healthy") { severity = "warn"; headline = "Idle yesterday"; }
    }
    return { severity, headline, reasons };
  }

  // Fallback for apps whose /api/status doesn't yet include a yesterday block.
  const counts = s.counts || {};
  if (counts.automationsTotal > 0 && counts.automationsEnabled === 0) {
    reasons.push("All automations on this app are disabled.");
    if (severity === "healthy") { severity = "warn"; headline = "All automations off"; }
  }
  reasons.push("Yesterday's planned/attempted/confirmed not yet reported by this app.");
  if (severity === "healthy") { severity = "warn"; headline = "Awaiting yesterday roll-out"; }
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
      reachable: true, httpStatus: 200, fetchMs, status,
      // Cross-check + diagnosis are attached later in the handler once we have
      // all apps.
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

export async function authUser(req) {
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

  // Each app does its own Post Bridge cross-check server-side using its own PB
  // key (some app keys are marked sensitive in Vercel and can't be exposed to
  // the manager). The manager surfaces status.crossCheck and derives the
  // diagnosis from status.yesterday.
  let totalChecked = 0;
  let totalConfirmed = 0;
  for (const a of apps) {
    if (a.reachable && a.status) {
      a.crossCheck = a.status.crossCheck || null;
      a.diagnosis = diagnose(a.status);
      if (a.crossCheck) {
        totalChecked += a.crossCheck.claimed24h || 0;
        totalConfirmed += a.crossCheck.confirmed24h || 0;
      }
    }
  }

  const summary = { total: apps.length, healthy: 0, warn: 0, error: 0 };
  for (const a of apps) summary[a.diagnosis.severity] += 1;

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    apps, platforms, summary,
    crossCheck: {
      claimedPosts24h: totalChecked,
      confirmedPosts24h: totalConfirmed,
      mode: "per-app",
    },
  });
}
