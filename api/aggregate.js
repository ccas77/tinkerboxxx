import { createClient } from "@supabase/supabase-js";
import { pbFetch } from "./analytics.js";

// Reads APP_REGISTRY (JSON array of { name, url, token }), fans out to each
// app's /api/status, then cross-checks every claimed post against Post Bridge
// directly. The delta between what an app claims and what Post Bridge confirms
// is the actual signal.

const FETCH_TIMEOUT_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const POSTBRIDGE_QUERY_CHUNK = 20; // multi-value post_id filter per request

// Ask Post Bridge for delivery results of a specific set of post IDs. Chunks
// the request so we don't blow the URL length limit, throttled + retried via
// pbFetch. Returns a Map keyed by post_id → array of post_result rows.
async function fetchPBResultsForPostIds(postIds) {
  const map = new Map();
  if (!postIds || postIds.size === 0) return map;
  const arr = [...postIds];
  const chunks = [];
  for (let i = 0; i < arr.length; i += POSTBRIDGE_QUERY_CHUNK) {
    chunks.push(arr.slice(i, i + POSTBRIDGE_QUERY_CHUNK));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      const qs = new URLSearchParams();
      qs.set("limit", "100");
      for (const id of chunk) qs.append("post_id", id);
      let r;
      try {
        r = await pbFetch(`/v1/post-results?${qs}`);
      } catch {
        return;
      }
      for (const row of r.data || []) {
        const pid = row.post_id;
        if (!pid) continue;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid).push(row);
      }
    })
  );
  return map;
}

// Paginate /v1/posts newest-first to build a lookup of parent posts. A post
// row includes its lifecycle status: scheduled → processing → posted. Without
// this an app-claimed post that is legitimately queued for later today would
// look identical to a genuinely lost post.
async function fetchPBRecentPosts(maxPages = 10) {
  const map = new Map();
  let offset = 0;
  const cutoff = Date.now() - 8 * DAY_MS;
  for (let page = 0; page < maxPages; page++) {
    let r;
    try {
      r = await pbFetch(`/v1/posts?limit=100&offset=${offset}`);
    } catch {
      break;
    }
    const rows = r.data || [];
    for (const row of rows) {
      if (row.id) map.set(row.id, row);
    }
    if (rows.length < 100) break;
    // Stop early if the oldest post in the page is past the horizon we care
    // about. Different apps may report differently-shaped created_at values.
    const oldest = rows[rows.length - 1];
    const oldestTs = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
    if (Number.isFinite(oldestTs) && oldestTs < cutoff) break;
    offset += 100;
  }
  return map;
}

function crossCheckApp(status, pbPostsMap, pbResultsMap) {
  const now = Date.now();
  const stats = {
    claimed24h: 0,
    claimed7d: 0,
    confirmed24h: 0,
    confirmed7d: 0,
    queuedAtPB24h: 0,
    rejectedByPB24h: 0,
    missingFromPB24h: 0,
    rejectedDetail: [],
    missingDetail: [],
    queuedDetail: [],
  };
  const claimed = status?.posts?.recent || [];
  for (const p of claimed) {
    if (!p.lastPostedAt) continue;
    const t = Date.parse(p.lastPostedAt);
    if (!Number.isFinite(t)) continue;
    const in24h = t > now - DAY_MS;
    const in7d = t > now - 7 * DAY_MS;
    if (in24h) stats.claimed24h += 1;
    if (in7d) stats.claimed7d += 1;

    const pbId = p.lastPostId;
    if (!pbId) continue;

    const pbPost = pbPostsMap.get(pbId);
    const results = pbResultsMap.get(pbId) || [];

    if (!pbPost && results.length === 0) {
      // Post Bridge has no record of this ID at all. This is the real
      // silent-failure signal: the app claims it posted but PB never saw the
      // request. Only counts if PB itself has recent posts (i.e., we know the
      // pagination window covered this timeframe).
      if (in24h) {
        stats.missingFromPB24h += 1;
        if (stats.missingDetail.length < 10) {
          stats.missingDetail.push({ id: pbId, postedAt: p.lastPostedAt, target: p.originHandle || null });
        }
      }
      continue;
    }

    const anySuccess = results.some((r) => r.success === true);
    const anyFailure = results.some((r) => r.success === false);
    const status_ = pbPost?.status;

    if (anySuccess) {
      if (in24h) stats.confirmed24h += 1;
      if (in7d) stats.confirmed7d += 1;
      continue;
    }

    if (results.length === 0 && (status_ === "scheduled" || status_ === "processing")) {
      // Queued at PB, waiting for scheduled_at. This is fine, not a failure.
      if (in24h) {
        stats.queuedAtPB24h += 1;
        if (stats.queuedDetail.length < 10) {
          stats.queuedDetail.push({
            id: pbId, postedAt: p.lastPostedAt, target: p.originHandle || null,
            fireAt: pbPost?.scheduled_at || null,
          });
        }
      }
      continue;
    }

    if (anyFailure) {
      if (in24h) {
        stats.rejectedByPB24h += 1;
        if (stats.rejectedDetail.length < 10) {
          const firstErr = results.find((r) => r.error);
          stats.rejectedDetail.push({
            id: pbId,
            postedAt: p.lastPostedAt,
            target: p.originHandle || null,
            error: firstErr?.error ? JSON.stringify(firstErr.error).slice(0, 200) : "unknown",
          });
        }
      }
    }
    // Any other case (posted, no results yet) is treated as processing.
  }
  return stats;
}

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

  if (!s.connections.kv.reachable) {
    return {
      severity: "error",
      headline: "KV unreachable",
      reasons: [s.connections.kv.error || "Upstash Redis returned an error."],
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
    if (y.attemptGap > 0) {
      reasons.push(`${y.attemptGap} scheduled slot${y.attemptGap === 1 ? "" : "s"} yesterday did not attempt a post. The cron did not fire, or the run was skipped.`);
      severity = "error";
      headline = "Cron missed slots";
    }
    if (y.confirmGap > 0) {
      reasons.push(`${y.confirmGap} attempted post${y.confirmGap === 1 ? "" : "s"} yesterday have no confirmed delivery in Post Bridge. Silent failure between the app and Post Bridge.`);
      if (severity !== "error") severity = "error";
      headline = severity === "error" ? headline : "Silent failure vs Post Bridge";
      if (headline === "Cron missed slots" && y.confirmGap > 0) {
        headline = "Cron misses + silent failures";
      } else if (!headline || headline === "Healthy") {
        headline = "Silent failure vs Post Bridge";
      }
    }
    if (y.planned === 0 && y.attempted === 0) {
      reasons.push("Nothing was planned or attempted yesterday.");
      if (severity === "healthy") { severity = "warn"; headline = "Idle yesterday"; }
    }
    return { severity, headline, reasons };
  }
  // Only warn about Post Bridge when the app actually uses it AND has a real
  // recent failure. Absence of a token means "app doesn't use it", not "broken".
  // Fallback for apps whose /api/status doesn't yet include a yesterday block.
  // Only surface honest signals: KV reachability above, and PB configuration.
  // Everything else is deferred to the yesterday-aware code path.
  if (s.counts && s.counts.automationsTotal > 0 && s.counts.automationsEnabled === 0) {
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
      // Cross-check + diagnosis are attached later in aggregateAll() once we
      // have all apps and can batch-query Post Bridge for their combined
      // claimed post IDs.
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

  // Each app now does its own Post Bridge cross-check server-side using its
  // own PB key (some app keys are marked sensitive in Vercel and can't be
  // exposed to the manager). The manager just surfaces status.crossCheck
  // and derives the diagnosis from it.
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
      postIdsChecked: totalChecked,
      postIdsMatchedInPB: totalConfirmed,
      mode: "per-app",
    },
  });
}
