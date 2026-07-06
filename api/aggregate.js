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

function diagnose(s, xcheck) {
  const reasons = [];
  let severity = "healthy";
  let headline = "Healthy";
  const now = Date.now();
  const staleCutoff = now - 24 * 60 * 60 * 1000;

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
  // Only warn about "nothing scheduled" when the app explicitly reports
  // automations exist but they're all disabled. An empty automations array
  // means the endpoint hasn't populated it, not that the app is idle.
  if (s.counts.automationsTotal > 0 && s.counts.automationsEnabled === 0) {
    reasons.push("All automations on this app are disabled.");
    if (severity === "healthy") { severity = "warn"; headline = "All automations off"; }
  }

  // Post Bridge cross-check signals. These compare what the app claims
  // against what Post Bridge actually holds — the honest signal.
  if (xcheck) {
    if (xcheck.rejectedByPB24h > 0) {
      reasons.unshift(
        `${xcheck.rejectedByPB24h} post${xcheck.rejectedByPB24h === 1 ? "" : "s"} rejected at delivery by Post Bridge in the last 24h.`
      );
      severity = "error";
      headline = "Post Bridge rejected posts";
    }
    if (xcheck.missingFromPB24h > 0) {
      reasons.unshift(
        `${xcheck.missingFromPB24h} claim${xcheck.missingFromPB24h === 1 ? "" : "s"} in the last 24h have no matching post in Post Bridge (real silent failure).`
      );
      if (severity !== "error") {
        severity = "error";
        headline = "Silent failure vs Post Bridge";
      }
    }
    if (xcheck.queuedAtPB24h > 0) {
      reasons.push(
        `${xcheck.queuedAtPB24h} post${xcheck.queuedAtPB24h === 1 ? "" : "s"} queued at Post Bridge, waiting for scheduled_at.`
      );
    }
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

  // Post Bridge cross-check. Gather every claimed post ID across every
  // reachable app, batch-query Post Bridge in one go (throttled and retried
  // by pbFetch), then compute per-app reconciliation.
  const wantedIds = new Set();
  for (const a of apps) {
    if (!a.reachable || !a.status?.posts?.recent) continue;
    for (const p of a.status.posts.recent) {
      if (p.lastPostId) wantedIds.add(p.lastPostId);
    }
  }

  let pbResultsMap = new Map();
  let pbPostsMap = new Map();
  let pbCrossCheckError = null;
  if (wantedIds.size > 0 && process.env.POSTBRIDGE_API_KEY) {
    try {
      [pbResultsMap, pbPostsMap] = await Promise.all([
        fetchPBResultsForPostIds(wantedIds),
        fetchPBRecentPosts(),
      ]);
    } catch (e) {
      pbCrossCheckError = e.message;
    }
  } else if (!process.env.POSTBRIDGE_API_KEY) {
    pbCrossCheckError = "POSTBRIDGE_API_KEY not set on tinkerboxxx";
  }

  // Attach cross-check + diagnosis to each app now that we can reconcile.
  for (const a of apps) {
    if (a.reachable && a.status) {
      a.crossCheck = crossCheckApp(a.status, pbPostsMap, pbResultsMap);
      a.diagnosis = diagnose(a.status, a.crossCheck);
    }
  }

  const summary = { total: apps.length, healthy: 0, warn: 0, error: 0 };
  for (const a of apps) summary[a.diagnosis.severity] += 1;

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    apps, platforms, summary,
    crossCheck: {
      postIdsChecked: wantedIds.size,
      postIdsMatchedInPB: pbResultsMap.size,
      pbPostsIndexed: pbPostsMap.size,
      error: pbCrossCheckError,
    },
  });
}
