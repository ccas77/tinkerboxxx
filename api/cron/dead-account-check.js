import {
  pbFetch,
  fetchAllAccounts,
  fetchAllAnalytics,
  fetchPostResultsForIds,
} from "../analytics.js";

async function sendAlertEmail(deadAccounts) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM || "onboarding@resend.dev";
  if (!apiKey || !to) {
    console.warn("dead-account-check: alert skipped, RESEND_API_KEY or ALERT_EMAIL_TO not set");
    return { sent: false, reason: "email-not-configured" };
  }

  const lines = deadAccounts
    .map(a => `- @${a.username} (${a.platform}): 0 views across ${a.postCount} tracked post${a.postCount === 1 ? "" : "s"}`)
    .join("\n");
  const subject = `[tinkerboxxx] ${deadAccounts.length} account${deadAccounts.length === 1 ? "" : "s"} got 0 views in the last 24h`;
  const text =
    `These accounts had 0 views across all tracked posts in the last 24 hours.\n\n` +
    `${lines}\n\n` +
    `Worth checking for shadow bans, broken auth, paused queues, or platform outages.\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend ${res.status}: ${body.slice(0, 300)}`);
  }
  return { sent: true };
}

export default async function handler(req, res) {
  // Vercel Cron requests carry Authorization: Bearer <CRON_SECRET>.
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.POSTBRIDGE_API_KEY) {
    return res.status(500).json({ error: "POSTBRIDGE_API_KEY not configured" });
  }

  try {
    const [items, accounts] = await Promise.all([
      fetchAllAnalytics("7d", null),
      fetchAllAccounts(),
    ]);
    const wantedPrIds = new Set(items.map(p => p.post_result_id).filter(Boolean));
    const prMap = await fetchPostResultsForIds(wantedPrIds);
    const accById = Object.fromEntries(accounts.map(a => [a.id, a]));

    const perAccount = new Map();
    for (const p of items) {
      const pr = prMap[p.post_result_id];
      const acc = pr ? accById[pr.social_account_id] : null;
      let username = acc?.username || null;
      if (!username && p.platform === "tiktok" && p.share_url) {
        const m = p.share_url.match(/tiktok\.com\/@([^/]+)/);
        if (m) username = m[1];
      }
      if (!username) continue;

      let last24hViews = 0;
      try {
        const daily = await pbFetch(`/v1/analytics/${p.id}/daily`);
        const lastDelta = daily.deltas?.length ? daily.deltas[daily.deltas.length - 1] : null;
        last24hViews = Number(lastDelta?.views || 0);
      } catch {
        // Treat per-post fetch failures as 0; the cron should not fail the
        // whole run for one bad post.
      }

      const key = `${p.platform}:${username}`;
      const bucket = perAccount.get(key) || { username, platform: p.platform, postCount: 0, views: 0 };
      bucket.postCount += 1;
      bucket.views += last24hViews;
      perAccount.set(key, bucket);
    }

    const dead = [...perAccount.values()].filter(a => a.views === 0 && a.postCount > 0);
    let emailResult = { sent: false, reason: "no-dead-accounts" };
    if (dead.length) {
      emailResult = await sendAlertEmail(dead);
    }

    return res.status(200).json({
      ok: true,
      checkedAccounts: perAccount.size,
      deadCount: dead.length,
      dead: dead.map(d => ({ username: d.username, platform: d.platform, postCount: d.postCount })),
      email: emailResult,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
