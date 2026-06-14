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

## Dead-account alerts (daily cron)

`api/cron/dead-account-check.js` runs once a day at 09:00 UTC (configured in `vercel.json`). It pulls the last 24h of Post Bridge analytics, sums views per account, and emails you if any account scored 0 views across all its tracked posts.

### Env vars

| Var | Required | What it does |
|---|---|---|
| `POSTBRIDGE_API_KEY` | yes | Already used by `api/analytics.js` |
| `CRON_SECRET` | yes | Vercel sends this as `Authorization: Bearer <CRON_SECRET>`. Generate a random string and set it on the project. Without it the route returns 401. |
| `RESEND_API_KEY` | yes (for email) | From [resend.com](https://resend.com). The route still runs without it but skips sending. |
| `ALERT_EMAIL_TO` | yes (for email) | Where alerts go. With an unverified Resend domain this must be the email tied to your Resend account. |
| `ALERT_EMAIL_FROM` | optional | Defaults to `onboarding@resend.dev` (Resend's sandbox sender). Set to a verified address once you add a domain. |

### Trigger it manually

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-deployment>/api/cron/dead-account-check
```

Response shape: `{ ok, checkedAccounts, deadCount, dead: [...], email: { sent, reason? } }`. No email is sent when `deadCount` is 0.
