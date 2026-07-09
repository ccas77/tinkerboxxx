# Tinkerboxxx

Your personal app launchpad. Two tabs — My Apps for quick links to your live web apps, and Ideas for saving specs and notes.

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "Add New Project" and import your repo
4. Vercel auto-detects Vite — just click Deploy
5. Once live, add your custom domain in Project Settings → Domains

## Run locally

```
npm install
npm run dev
```

## Notes

- Data is stored in your browser's localStorage — it stays on your device
- If you want data to sync across devices, you'll need to add a database (Supabase is a good free option — Claude Code can help set that up)

## Daily health alert (cron)

`api/cron/dead-account-check.js` runs once a day at 09:00 UTC (configured in `vercel.json`). It emails you only when there is something actionable, based on two signals:

- **Post Bridge failures (last 24h):** it pages recent posts, pulls their delivery results, groups failures by account, and classifies each error as *auth expired*, *permission / page error*, *transient*, or *other*. Auth and permission failures are the ones that need you to reconnect an account or fix a page; transient errors (uploads that "took too long") are listed separately as no-action-unless-repeating.
- **App schedule gaps (yesterday):** it reads each registered app's own `/api/status` `yesterday` block and reports `attemptGap` (a scheduled slot that never fired) and `confirmGap` (a post that was attempted but never confirmed delivered by Post Bridge). This mirrors what the Manager tab shows.

It does **not** use view counts to judge health. The previous version summed Post Bridge view deltas and alerted on zero, which produced false positives (a fine account whose older posts gained no new views looked "dead") and false negatives (a genuinely failing account produced no analytics rows at all and was invisible).

Add `?dry=1` to the URL to run the full scan and get the JSON report (including an `email.preview` of the text that would be sent) without actually emailing.

### Env vars

| Var | Required | What it does |
|---|---|---|
| `POSTBRIDGE_API_KEY` | yes | Already used by `api/analytics.js` |
| `APP_REGISTRY` | yes (for app gaps) | JSON array of `{ name, url, token }` for each monitored app. `token` is that app's `CRON_SECRET`, used to read its `/api/status`. Shared with the Manager tab. |
| `CRON_SECRET` | yes | Vercel sends this as `Authorization: Bearer <CRON_SECRET>`. Generate a random string and set it on the project. Without it the route returns 401. |
| `RESEND_API_KEY` | yes (for email) | From [resend.com](https://resend.com). The route still runs without it but skips sending. |
| `ALERT_EMAIL_TO` | yes (for email) | Where alerts go. With an unverified Resend domain this must be the email tied to your Resend account. |
| `ALERT_EMAIL_FROM` | optional | Defaults to `onboarding@resend.dev` (Resend's sandbox sender). Set to a verified address once you add a domain. |

### Trigger it manually

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-deployment>/api/cron/dead-account-check?dry=1"
```

Response shape: `{ ok, generatedAt, postBridge: { postsScanned, hardFailureCount, hardFailures: [...], transientOnlyCount }, apps: { checked, gapCount, gaps: [...], unreachable: [...] }, email: { sent, reason? } }`. An email is sent only when there is at least one hard Post Bridge failure, an app schedule gap, or an unreachable app. Drop `?dry=1` to let it actually send.
