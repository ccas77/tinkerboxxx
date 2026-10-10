import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout, APPS, AppIcon } from "../Marketing";

const CSS = `
.ap-head { display: flex; align-items: center; gap: 16px; padding: 40px 0 28px; flex-wrap: wrap; }
.ap-back { font-size: 14px; color: var(--muted); text-decoration: none; display: inline-block; margin-top: 28px; }
.ap-back:hover { color: var(--ink); }
.ap-title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.ap-sub { font-size: 15px; color: var(--muted); margin: 2px 0 0; }
.ap-panel { border: 1px solid var(--line); border-radius: 16px; background: #fff; padding: 24px; }
.ap-input { width: 100%; padding: 11px 14px; border: 1px solid var(--line); border-radius: 10px; font: inherit;
  font-size: 15px; color: var(--ink); background: #fff; outline: none; }
.ap-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }
.ap-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px; }
.ap-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 18px;
  border-radius: 10px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent;
  background: var(--accent); color: #fff; white-space: nowrap; }
.ap-btn:hover { background: var(--accent-dark); }
.ap-btn:disabled { opacity: 0.5; cursor: default; }
.ap-btn-ghost { background: #fff; color: var(--ink); border-color: var(--line); }
.ap-btn-ghost:hover { background: var(--bg-soft); }
.ap-empty { text-align: center; color: var(--muted); padding: 40px 16px; font-size: 15px; }
`;

export function AppShell({ appKey, children }) {
  const app = APPS.find(a => a.key === appKey);
  useEffect(() => { document.title = `${app.name} · Tinkerbox`; return () => { document.title = "Tinkerbox"; }; }, [app.name]);
  return (
    <Layout>
      <style>{CSS}</style>
      <Link to="/products" className="ap-back">← All apps</Link>
      <div className="ap-head">
        <AppIcon app={app} size={52} />
        <div>
          <h1 className="ap-title">{app.name}</h1>
          <p className="ap-sub">{app.desc}</p>
        </div>
      </div>
      {children}
    </Layout>
  );
}

// useState that persists to localStorage. Storage can be unavailable (private
// mode, blocked site data), so every access is guarded and the app still works
// in memory.
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    const fallback = typeof initial === "function" ? initial : () => initial;
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback() : JSON.parse(raw);
    } catch {
      return fallback();
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
