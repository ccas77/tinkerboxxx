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
