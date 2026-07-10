import { pbFetch, fetchAllAccounts } from "../analytics.js";
import { loadRegistry, fetchWithTimeout, classifyError } from "../aggregate.js";

// Daily health alert. The old version summed Post Bridge *view deltas* per
// account and emailed when the sum was 0. That signal was inverted: a fine
// account whose older posts simply gained no new views yesterday looked
// "dead", while an account whose posts genuinely failed produced no analytics
// rows at all (failed posts never enter /v1/analytics) and so was invisible.
//
// This version reads failure evidence directly:
//   Signal A - Post Bridge post-results in the last 24h, grouped by account,
//              classified (expired auth / permission / transient / other).
//   Signal B - each registered app's own /api/status "yesterday" block, which
//              already cross-checks Post Bridge (attemptGap = cron missed a
//              slot, confirmGap = attempted but never confirmed delivered).
// Both are the same signals the dashboard shows, so the email finally matches
// the Manager tab.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POST_PAGES = 60;      // ~6,000 posts back-stop
const RESULTS_CHUNK = 20;       // multi-value post_id filter per request
const APP_TIMEOUT_MS = 10_000;

// Order matters: higher rank wins when an account has mixed failure types.
const SEVERITY_RANK = { permission: 3, auth: 3, other: 2, transient: 1 };
const HARD_CLASSES = new Set(["auth", "permission", "other"]);

const CLASS_LABEL = {
  auth: "Auth expired",
  permission: "Permission / page error",
  transient: "Transient (may self-heal)",
  other: "Platform error",
};
const CLASS_ACTION = {
  auth: "Reconnect this account in Post Bridge - its token is invalid or expired.",
  permission: "Fix this account's platform permissions or page access.",
  transient: "Usually self-heals; only worth a look if it keeps repeating.",
  other: "Investigate the platform error text.",
};

// Page /v1/posts newest-first into a Map keyed by id. Stops once a full page
// is older than the scan horizon (2 days of margin around the 24h window).
async function fetchRecentPosts() {
  const posts = new Map();
  const cutoff = Date.now() - 2 * DAY_MS;
  let offset = 0;
  for (let page = 0; page < MAX_POST_PAGES; page++) {
    let r;
    try {
      r = await pbFetch(`/v1/posts?limit=100&offset=${offset}`);
    } catch (e) {
      console.warn(`fetchRecentPosts: stopping at offset=${offset}: ${e.message}`);
      break;
    }
    const rows = r.data || [];
    for (const row of rows) if (row.id) posts.set(row.id, row);
    if (rows.length < 100) break;
    const oldest = rows[rows.length - 1];
    const ts = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
    if (Number.isFinite(ts) && ts < cutoff) break;
    offset += 100;
  }
  return posts;
}

// A post counts as "acted on in the last 24h" if it was created, scheduled, or
// last updated within the window (and not in the future).
function actedInLast24h(post) {
  const now = Date.now();
  for (const k of ["created_at", "scheduled_at", "updated_at"]) {
    const t = post[k] ? Date.parse(post[k]) : NaN;
    if (Number.isFinite(t) && t > now - DAY_MS && t <= now + 60_000) return true;
  }
  return false;
}

async function fetchResultsForPostIds(postIds) {
  const byPost = new Map();
  const ids = [...postIds];
  for (let i = 0; i < ids.length; i += RESULTS_CHUNK) {
    const chunk = ids.slice(i, i + RESULTS_CHUNK);
    const qs = new URLSearchParams();
    qs.set("limit", "100");
    for (const id of chunk) qs.append("post_id", id);
    let r;
    try {
      r = await pbFetch(`/v1/post-results?${qs}`);
    } catch (e) {
      console.warn(`fetchResultsForPostIds: chunk failed: ${e.message}`);
      continue;
    }
    for (const row of r.data || []) {
      const pid = row.post_id;
      if (!pid) continue;
      if (!byPost.has(pid)) byPost.set(pid, []);
      byPost.get(pid).push(row);
    }
  }
  return byPost;
}

async function scanPostBridgeFailures() {
  const posts = await fetchRecentPosts();
  const windowIds = new Set(
    [...posts.values()].filter(actedInLast24h).map(p => p.id)
  );
  const [resultsByPost, accounts] = await Promise.all([
    fetchResultsForPostIds(windowIds),
    fetchAllAccounts(),
  ]);
  const accById = new Map(accounts.map(a => [a.id, a]));

  const perAccount = new Map();
  for (const pid of windowIds) {
    for (const res of resultsByPost.get(pid) || []) {
      const accId = res.social_account_id ?? "unknown";
      let b = perAccount.get(accId);
      if (!b) {
        const acc = accById.get(accId);
        b = {
          accountId: accId,
          platform: acc?.platform || res.platform_data?.url?.match(/(tiktok|instagram|facebook|youtube|bluesky|threads)/i)?.[1]?.toLowerCase() || "unknown",
          username: acc?.username || res.platform_data?.username || null,
          total: 0, success: 0,
          classes: { auth: 0, permission: 0, transient: 0, other: 0 },
          worstClass: null, sampleError: null,
        };
        perAccount.set(accId, b);
      }
      b.total += 1;
      if (res.success === true) { b.success += 1; continue; }
      if (res.success === false) {
        const cls = classifyError(res.error);
        b.classes[cls] += 1;
        if (!b.sampleError && res.error) b.sampleError = res.error;
        if (!b.worstClass || SEVERITY_RANK[cls] > SEVERITY_RANK[b.worstClass]) {
          b.worstClass = cls;
        }
      }
    }
  }

  const accountsList = [...perAccount.values()].map(a => ({
    accountId: a.accountId,
    platform: a.platform,
    username: a.username || `#${a.accountId}`,
    total: a.total,
    success: a.success,
    failed: a.total - a.success,
    worstClass: a.worstClass,
    classes: a.classes,
    sampleError: a.sampleError ? String(a.sampleError).slice(0, 200) : null,
  }));

  const hardFailures = accountsList
    .filter(a => a.worstClass && HARD_CLASSES.has(a.worstClass))
    .sort((x, y) => SEVERITY_RANK[y.worstClass] - SEVERITY_RANK[x.worstClass] || y.failed - x.failed);
  const transientOnly = accountsList
    .filter(a => a.worstClass === "transient");

  return {
    windowHours: 24,
    postsScanned: windowIds.size,
    accountsSeen: accountsList.length,
    hardFailures,
    transientOnly,
  };
}

async function scanAppGaps() {
  const registry = loadRegistry();
  const results = await Promise.all(registry.map(async (app) => {
    try {
      const res = await fetchWithTimeout(`${app.url}/api/status`, {
        headers: { Authorization: `Bearer ${app.token}` },
      }, APP_TIMEOUT_MS);
      if (!res.ok) return { app: app.name, unreachable: `HTTP ${res.status}` };
      const status = await res.json();
      const y = status?.yesterday;
      if (!y) return { app: app.name, yesterday: null };
      return {
        app: app.name,
        date: y.date || null,
        attemptGap: Number(y.attemptGap || 0),
        confirmGap: Number(y.confirmGap || 0),
        unattempted: Array.isArray(y.unattempted) ? y.unattempted.slice(0, 10) : [],
        unconfirmed: Array.isArray(y.unconfirmed) ? y.unconfirmed.slice(0, 10) : [],
      };
    } catch (e) {
      return { app: app.name, unreachable: e.name === "AbortError" ? "timeout" : e.message };
    }
  }));

  return {
    checked: results.length,
    gaps: results.filter(r => (r.attemptGap > 0 || r.confirmGap > 0)),
    unreachable: results.filter(r => r.unreachable),
  };
}

function buildEmail(pb, apps) {
  const sections = [];

  if (pb.hardFailures.length) {
    const byClass = new Map();
    for (const a of pb.hardFailures) {
      if (!byClass.has(a.worstClass)) byClass.set(a.worstClass, []);
      byClass.get(a.worstClass).push(a);
    }
    const lines = [];
    for (const cls of ["auth", "permission", "other"]) {
      const group = byClass.get(cls);
      if (!group || !group.length) continue;
      lines.push(`${CLASS_LABEL[cls]} - ${CLASS_ACTION[cls]}`);
      for (const a of group) {
        lines.push(`  - @${a.username} (${a.platform}): ${a.failed}/${a.total} post${a.total === 1 ? "" : "s"} failed. ${a.sampleError || ""}`);
      }
      lines.push("");
    }
    sections.push(`ACCOUNTS FAILING TO POST (last 24h)\n\n${lines.join("\n").trimEnd()}`);
  }

  if (apps.gaps.length) {
    const lines = [];
    for (const g of apps.gaps) {
      const bits = [];
      if (g.attemptGap > 0) bits.push(`${g.attemptGap} scheduled slot${g.attemptGap === 1 ? "" : "s"} never fired`);
      if (g.confirmGap > 0) bits.push(`${g.confirmGap} attempted post${g.confirmGap === 1 ? "" : "s"} never confirmed delivered`);
      lines.push(`  - ${g.app} (${g.date || "yesterday"}): ${bits.join("; ")}.`);
      for (const u of g.unconfirmed) {
        lines.push(`      unconfirmed: ${u.target || "?"}${u.error ? ` - ${String(u.error).slice(0, 140)}` : ""}`);
      }
      for (const u of g.unattempted) {
        lines.push(`      never fired: ${u.target || "?"}${u.slot ? ` (${u.slot})` : ""}`);
      }
    }
    sections.push(`APP SCHEDULE GAPS (yesterday)\n\n${lines.join("\n")}`);
  }

  if (apps.unreachable.length) {
    const lines = apps.unreachable.map(u => `  - ${u.app}: ${u.unreachable}`);
    sections.push(`APPS UNREACHABLE\n\n${lines.join("\n")}`);
  }

  if (pb.transientOnly.length) {
    const lines = pb.transientOnly.map(a => `  - @${a.username} (${a.platform}): ${a.failed}/${a.total} - ${a.sampleError || "transient"}`);
    sections.push(`TRANSIENT ONLY (no action needed unless repeating)\n\n${lines.join("\n")}`);
  }

  return sections.join("\n\n\n");
}

async function sendAlertEmail(subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM || "onboarding@resend.dev";
  if (!apiKey || !to) {
    console.warn("dead-account-check: alert skipped, RESEND_API_KEY or ALERT_EMAIL_TO not set");
    return { sent: false, reason: "email-not-configured" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: body }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`resend ${res.status}: ${t.slice(0, 300)}`);
  }
  return { sent: true };
}

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.POSTBRIDGE_API_KEY) {
    return res.status(500).json({ error: "POSTBRIDGE_API_KEY not configured" });
  }
  // ?dry=1 runs the full scan and returns the report without emailing.
  const dry = req.query?.dry === "1" || req.query?.dry === "true";

  try {
    const [pb, apps] = await Promise.all([scanPostBridgeFailures(), scanAppGaps()]);

    const alertWorthy =
      pb.hardFailures.length > 0 || apps.gaps.length > 0 || apps.unreachable.length > 0;

    const emailBody = alertWorthy ? buildEmail(pb, apps) : null;
    let email = { sent: false, reason: "nothing-to-report" };
    if (alertWorthy && !dry) {
      const parts = [];
      if (pb.hardFailures.length) parts.push(`${pb.hardFailures.length} account${pb.hardFailures.length === 1 ? "" : "s"} failing`);
      if (apps.gaps.length) parts.push(`${apps.gaps.length} app gap${apps.gaps.length === 1 ? "" : "s"}`);
      if (apps.unreachable.length) parts.push(`${apps.unreachable.length} app${apps.unreachable.length === 1 ? "" : "s"} down`);
      const subject = `[tinkerboxxx] ${parts.join(", ")}`;
      email = await sendAlertEmail(subject, emailBody);
    } else if (alertWorthy && dry) {
      email = { sent: false, reason: "dry-run", preview: emailBody };
    }

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      postBridge: {
        windowHours: pb.windowHours,
        postsScanned: pb.postsScanned,
        accountsSeen: pb.accountsSeen,
        hardFailureCount: pb.hardFailures.length,
        transientOnlyCount: pb.transientOnly.length,
        hardFailures: pb.hardFailures,
      },
      apps: {
        checked: apps.checked,
        gapCount: apps.gaps.length,
        gaps: apps.gaps,
        unreachable: apps.unreachable,
      },
      email,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
