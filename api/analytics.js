import { createClient } from "@supabase/supabase-js";

const PB_BASE = "https://api.post-bridge.com";

async function pbFetch(path, init = {}) {
  const res = await fetch(`${PB_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.POSTBRIDGE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`post-bridge ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllAccounts() {
  const all = [];
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const r = await pbFetch(`/v1/social-accounts?limit=100&offset=${offset}`);
    const rows = r.data || [];
    all.push(...rows);
    if (rows.length < 100) break;
    offset += 100;
  }
  return all;
}

async function fetchPostResultsForIds(wantedIds) {
  const map = {};
  if (!wantedIds.size) return map;
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const r = await pbFetch(`/v1/post-results?limit=100&offset=${offset}`);
    const rows = r.data || [];
    for (const pr of rows) if (wantedIds.has(pr.id)) map[pr.id] = pr;
    if (rows.length < 100) break;
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
      const params = new URLSearchParams({ limit: "100", timeframe: apiTimeframe });
      if (platform) params.set("platform", platform);

      const [analyticsResp, accountsResp] = await Promise.all([
        pbFetch(`/v1/analytics?${params}`),
        fetchAllAccounts(),
      ]);
      const items = analyticsResp.data || [];

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
        return res.status(200).json({ data: withUsername, meta: analyticsResp.meta });
      }
      const enriched = [];
      for (let i = 0; i < withUsername.length; i += 8) {
        const chunk = withUsername.slice(i, i + 8);
        const results = await Promise.all(chunk.map(async (p) => {
          try {
            const daily = await pbFetch(`/v1/analytics/${p.id}/daily`);
            const lastDelta = daily.deltas?.length ? daily.deltas[daily.deltas.length - 1] : null;
            return { ...p, last24h: lastDelta };
          } catch {
            return { ...p, last24h: null };
          }
        }));
        enriched.push(...results);
      }
      return res.status(200).json({ data: enriched, meta: analyticsResp.meta });
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
