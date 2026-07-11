// Inbound report relay. Lets an automated investigator (which holds only the
// read-only DIAGNOSTIC_TOKEN) deliver a written report to the user's inbox via
// the project's existing Resend setup, without ever holding the email key.
//
// POST { subject, text } -> emails ALERT_EMAIL_TO.
// Auth: Bearer DIAGNOSTIC_TOKEN or CRON_SECRET.

const MAX_SUBJECT = 200;
const MAX_TEXT = 100_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const diagToken = process.env.DIAGNOSTIC_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  const authorized =
    (diagToken && provided === diagToken) ||
    (cronSecret && provided === cronSecret);
  if (!authorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM || "onboarding@resend.dev";
  if (!apiKey || !to) {
    return res.status(500).json({ error: "RESEND_API_KEY or ALERT_EMAIL_TO not configured" });
  }

  const subject = String(req.body?.subject || "").slice(0, MAX_SUBJECT).trim();
  const text = String(req.body?.text || "").slice(0, MAX_TEXT).trim();
  if (!subject || !text) {
    return res.status(400).json({ error: "subject and text are required" });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: `[tinkerboxxx] ${subject}`, text }),
    });
    if (!r.ok) {
      const body = await r.text();
      return res.status(502).json({ error: `resend ${r.status}: ${body.slice(0, 200)}` });
    }
    return res.status(200).json({ ok: true, sent: true });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
