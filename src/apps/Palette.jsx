import { useCallback, useEffect, useState } from "react";
import { AppShell, useStored, uid } from "./AppShell";

const CSS = `
.pl-strip { display: grid; grid-template-columns: repeat(5, 1fr); border-radius: 16px; overflow: hidden;
  border: 1px solid var(--line); min-height: 320px; }
.pl-swatch { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  gap: 8px; padding: 18px 8px; cursor: pointer; border: none; font: inherit; transition: flex 0.2s; }
.pl-hex { font-size: 16px; font-weight: 700; letter-spacing: 0.04em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.pl-hint { font-size: 12px; opacity: 0.75; }
.pl-lock { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 8px; border: none;
  cursor: pointer; display: grid; place-items: center; font-size: 15px; background: rgba(255,255,255,0.25); }
.pl-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 20px 0 8px; }
.pl-saved { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.pl-mini { display: flex; height: 44px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); cursor: pointer; }
.pl-mini span { flex: 1; }
.pl-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: var(--ink); color: #fff;
  padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; z-index: 50; }
@media (max-width: 640px) {
  .pl-strip { grid-template-columns: 1fr; min-height: 0; }
  .pl-swatch { flex-direction: row; justify-content: space-between; padding: 22px 60px 22px 18px; }
  .pl-lock { top: 50%; transform: translateY(-50%); }
}
`;

const SCHEMES = ["analogous", "complementary", "triadic", "monochrome", "split"];

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111827" : "#ffffff";
}

function rand(min, max) { return min + Math.random() * (max - min); }

function generate(scheme) {
  const base = Math.floor(Math.random() * 360);
  const hues = {
    analogous: [-40, -20, 0, 20, 40],
    complementary: [0, 0, 180, 180, 15],
    triadic: [0, 120, 240, 0, 120],
    monochrome: [0, 0, 0, 0, 0],
    split: [0, 150, 210, 0, 150],
  }[scheme];
  const lights = scheme === "monochrome" ? [20, 35, 50, 68, 85] : [25, 42, 55, 68, 82].sort(() => Math.random() - 0.5);
  return hues.map((d, i) => hslToHex((base + d + 360) % 360, Math.round(rand(45, 80)), lights[i]));
}

export default function Palette() {
  const [scheme, setScheme] = useState("analogous");
  const [colors, setColors] = useState(() => generate("analogous"));
  const [locked, setLocked] = useState([false, false, false, false, false]);
  const [saved, setSaved] = useStored("tbx.palette.saved", []);
  const [toast, setToast] = useState("");

  const regen = useCallback(() => {
    const fresh = generate(scheme);
    setColors(cs => cs.map((c, i) => (locked[i] ? c : fresh[i])));
  }, [scheme, locked]);

  useEffect(() => {
    const onKey = e => {
      if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName)) {
        e.preventDefault();
        regen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [regen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); setToast(`Copied ${text}`); }
    catch { setToast(text); }
  };

  const isSaved = saved.some(p => p.colors.join() === colors.join());

  return (
    <AppShell appKey="palette">
      <style>{CSS}</style>
      <div className="pl-strip">
        {colors.map((c, i) => (
          <div key={i} className="pl-swatch" style={{ background: c, color: textOn(c) }} onClick={() => copy(c)}
            role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && copy(c)} aria-label={`Copy ${c}`}>
            <button className="pl-lock" style={{ color: textOn(c) }} aria-label={locked[i] ? "Unlock colour" : "Lock colour"}
              onClick={e => { e.stopPropagation(); setLocked(l => l.map((v, j) => (j === i ? !v : v))); }}>
              {locked[i] ? "🔒" : "🔓"}
            </button>
            <span className="pl-hex">{c}</span>
            <span className="pl-hint">click to copy</span>
          </div>
        ))}
      </div>

      <div className="pl-bar">
        <button className="ap-btn" onClick={regen}>Generate</button>
        <select className="ap-input" style={{ width: "auto" }} value={scheme} onChange={e => setScheme(e.target.value)} aria-label="Colour scheme">
          {SCHEMES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button className="ap-btn ap-btn-ghost" disabled={isSaved}
          onClick={() => setSaved(s => [{ id: uid(), colors }, ...s].slice(0, 30))}>
          {isSaved ? "Saved" : "Save palette"}
        </button>
        <button className="ap-btn ap-btn-ghost" onClick={() => copy(colors.join(", "))}>Copy all</button>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Tip: press the space bar to generate.</span>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "36px 0 14px" }}>Saved palettes</h2>
      {saved.length === 0
        ? <div className="ap-panel ap-empty">Palettes you save will appear here.</div>
        : (
          <div className="pl-saved">
            {saved.map(p => (
              <div key={p.id}>
                <div className="pl-mini" onClick={() => setColors(p.colors)} title="Load palette">
                  {p.colors.map((c, i) => <span key={i} style={{ background: c }} />)}
                </div>
                <button onClick={() => setSaved(s => s.filter(x => x.id !== p.id))}
                  style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", padding: "6px 0" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      {toast && <div className="pl-toast" role="status">{toast}</div>}
    </AppShell>
  );
}
