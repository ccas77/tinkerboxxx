import { createClient } from "@supabase/supabase-js";

const PB_BASE = "https://api.post-bridge.com";

// Safety ceiling so a runaway loop can't hammer the API forever.
// 200 pages * 100 = 20,000 rows. Raise if you ever exceed that.
const MAX_PAGES = 200;

// Self-throttle to ~8 req/sec (Post Bridge cap is 10/sec) and auto-retry 429s
// using rate_limit.reset_ms from the response body, capped at 5s per wait.
const PB_MIN_GAP_MS = 125;
let pbChain = Promise.resolve();
let pbLastStart = 0;

export async function pbFetch(path, init = {}) {
  const run = async () => {
    const gap = pbLastStart + PB_MIN_GAP_MS - Date.now();
    if (gap > 0) await new Promise(r => setTimeout(r, gap));
    pbLastStart = Date.now();

    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(`${PB_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${process.env.POSTBRIDGE_API_KEY}`,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      if (res.status === 429) {
        let resetMs = 1000;
        try {
          const body = await res.clone().json();
          const r = Number(body?.rate_limit?.reset_ms);
          if (Number.isFinite(r) && r > 0) resetMs = r;
        } catch {}
        const wait = Math.min(Math.max(resetMs, 100), 5000);
        await new Promise(r => setTimeout(r, wait));
        pbLastStart = Date.now();
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`post-bridge ${path} ${res.status}: ${body.slice(0, 200)}`);
      }
      return res.json();
    }
    throw new Error(`post-bridge ${path} 429: exceeded retry attempts`);
  };
  const result = pbChain.then(run, run);
  pbChain = result.catch(() => {});
  return result;
}

// Generic paginator: walks limit/offset until a short page comes back
// (or the optional meta.total is reached, or the safety ceiling hits).
async function pbFetchAll(buildPath) {
  const all = [];
  let offset = 0;
  let total = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await pbFetch(buildPath(offset));
    const rows = r.data || [];
    all.push(...rows);

    if (total == null && r.meta && typeof r.meta.total === "number") {
      total = r.meta.total;
    }

    // Stop when the API gives us a short (final) page.
    if (rows.length < 100) break;
    // Stop if we've collected everything the API says exists.
    if (total != null && all.length >= total) break;

    offset += 100;
  }
  return all;
}

export async function fetchAllAccounts() {
  return pbFetchAll(
    (offset) => `/v1/social-accounts?limit=100&offset=${offset}`
  );
}

export async function fetchAllAnalytics(apiTimeframe, platform) {
  return pbFetchAll((offset) => {
    const params = new URLSearchParams({
      limit: "100",
      offset: String(offset),
      timeframe: apiTimeframe,
    });
    if (platform) params.set("platform", platform);
    return `/v1/analytics?${params}`;
  });
}

// Build a complete id -> post-result map by paging through ALL post-results,
// instead of bailing out after the first 1,000 rows.
export async function fetchPostResultsForIds(wantedIds) {
  const map = {};
  if (!wantedIds.size) return map;
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let r;
    try {
      r = await pbFetch(`/v1/post-results?limit=100&offset=${offset}`);
    } catch (e) {
      // Post Bridge occasionally 500s on deep pages. Degrade to a partial
      // username map instead of failing the whole analytics response.
      console.warn(`fetchPostResultsForIds: stopping at offset=${offset}: ${e.message}`);
      break;
    }
    const rows = r.data || [];
    for (const pr of rows) if (wantedIds.has(pr.id)) map[pr.id] = pr;
    if (rows.length < 100) break;
    // Early exit once every wanted id is found.
    if (Object.keys(map).length >= wantedIds.size) break;
    offset += 100;
  }
  return map;
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
  if (!process.env.POSTBRIDGE_API_KEY) {
    return res.status(500).json({ error: "POSTBRIDGE_API_KEY not configured" });
  }
  const auth = await authUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const action = req.query.action || "list";

  try {
    if (action === "list") {
      const timeframe = req.query.timeframe || "all";
      const platform = req.query.platform;
      const apiTimeframe = timeframe === "24h" ? "7d" : timeframe;

      // Page through the FULL analytics list instead of capping at 100.
      const items = await fetchAllAnalytics(apiTimeframe, platform);

      const accountsResp = await fetchAllAccounts();

      const wantedPrIds = new Set(items.map(p => p.post_result_id).filter(Boolean));
      const prMap = await fetchPostResultsForIds(wantedPrIds);
      const accById = Object.fromEntries(accountsResp.map(a => [a.id, a]));

      const withUsername = items.map(p => {
        const pr = prMap[p.post_result_id];
        const acc = pr ? accById[pr.social_account_id] : null;
        let username = acc?.username || null;
        if (!username && p.platform === "tiktok" && p.share_url) {
          const m = p.share_url.match(/tiktok\.com\/@([^/]+)/);
          if (m) username = m[1];
        }
        return { ...p, username };
      });

      if (timeframe !== "24h") {
        return res.status(200).json({ data: withUsername });
      }
      // Run /daily calls sequentially through the throttled pbFetch instead
      // of firing parallel batches of 8 (which tripped the 10 req/sec cap).
      const enriched = [];
      for (const p of withUsername) {
        try {
          const daily = await pbFetch(`/v1/analytics/${p.id}/daily`);
          const lastDelta = daily.deltas?.length ? daily.deltas[daily.deltas.length - 1] : null;
          enriched.push({ ...p, last24h: lastDelta });
        } catch {
          enriched.push({ ...p, last24h: null });
        }
      }
      return res.status(200).json({ data: enriched });
    }
    if (action === "daily") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id required" });
      const data = await pbFetch(`/v1/analytics/${id}/daily`);
      return res.status(200).json(data);
    }
    if (action === "sync") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const data = await pbFetch(`/v1/analytics/sync`, { method: "POST" });
      return res.status(200).json(data);
    }
    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
