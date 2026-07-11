import { loadRegistry, authUser } from "./aggregate.js";
import { scanPostBridgeFailures, scanAppGaps } from "./cron/dead-account-check.js";

// Machine-readable diagnostic feed for automated investigators (e.g. a
// scheduled Claude Code routine). Returns the same two signals as the daily
// alert cron - Post Bridge delivery failures (24h) and per-app schedule gaps
// (yesterday) - plus where each app's code lives, so a consumer can go from
// "book-video-bot missed 4 slots" straight to the right repo.
//
// Auth: Bearer DIAGNOSTIC_TOKEN (a read-only token; safe to hand to an
// external investigator), CRON_SECRET, or a logged-in dashboard user's
// Supabase token (so the Manager tab can render the same findings).
// Never returns registry tokens.

export default async function handler(req, res) {
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const diagToken = process.env.DIAGNOSTIC_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  let authorized =
    (diagToken && provided === diagToken) ||
    (cronSecret && provided === cronSecret);
  if (!authorized && provided) {
    const auth = await authUser(req);
    authorized = !auth.error;
  }
  if (!authorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.POSTBRIDGE_API_KEY) {
    return res.status(500).json({ error: "POSTBRIDGE_API_KEY not configured" });
  }

  try {
    const [pb, apps] = await Promise.all([scanPostBridgeFailures(), scanAppGaps()]);

    // Registry metadata WITHOUT tokens: names, live URLs, code locations.
    const registry = loadRegistry().map(({ name, url, repo, dir }) => ({
      name, url, repo, dir,
    }));

    const findings = [];
    for (const a of pb.hardFailures) {
      findings.push({
        kind: "account-failure",
        fixable: a.worstClass === "auth" || a.worstClass === "permission" ? "user" : "investigate",
        platform: a.platform,
        username: a.username,
        class: a.worstClass,
        failed: a.failed,
        total: a.total,
        sampleError: a.sampleError,
      });
    }
    for (const g of apps.gaps) {
      findings.push({
        kind: "app-gap",
        fixable: "investigate",
        app: g.app,
        repo: registry.find(r => r.name === g.app)?.repo || null,
        date: g.date,
        attemptGap: g.attemptGap,
        confirmGap: g.confirmGap,
        unattempted: g.unattempted,
        unconfirmed: g.unconfirmed,
      });
    }
    for (const u of apps.unreachable) {
      findings.push({
        kind: "app-unreachable",
        fixable: "investigate",
        app: u.app,
        repo: registry.find(r => r.name === u.app)?.repo || null,
        detail: u.unreachable,
      });
    }

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      healthy: findings.length === 0,
      findings,
      registry,
      raw: { postBridge: pb, apps },
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
