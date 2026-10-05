import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AppShell } from "./AppShell";

const CSS = `
.qr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.qr-preview { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.qr-canvas-wrap { padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--bg-soft);
  width: 100%; display: grid; place-items: center; }
.qr-canvas-wrap canvas { width: 100%; max-width: 300px; height: auto !important; border-radius: 6px; }
.qr-row { display: flex; gap: 14px; flex-wrap: wrap; }
.qr-row > div { flex: 1; min-width: 120px; }
.qr-color { display: flex; align-items: center; gap: 8px; }
.qr-color input[type=color] { width: 44px; height: 42px; border: 1px solid var(--line); border-radius: 10px; padding: 3px; background: #fff; cursor: pointer; }
.qr-field { margin-bottom: 18px; }
.qr-warn { font-size: 13px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: 8px; }
@media (max-width: 760px) { .qr-grid { grid-template-columns: 1fr; } }
`;

function contrastRatio(a, b) {
  const lum = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255]
      .map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export default function QrStudio() {
  const [text, setText] = useState("https://tinkerboxxx.com");
  const [dark, setDark] = useState("#111827");
  const [light, setLight] = useState("#ffffff");
  const [level, setLevel] = useState("M");
  const [error, setError] = useState("");
  const canvasRef = useRef(null);

  const opts = { errorCorrectionLevel: level, margin: 2, width: 600, color: { dark, light } };

  useEffect(() => {
    if (!text.trim()) { setError("Enter a link or some text to make a QR code."); return; }
    QRCode.toCanvas(canvasRef.current, text, opts)
      .then(() => setError(""))
      .catch(() => setError("That's too much text for a single QR code. Try something shorter."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dark, light, level]);

  const download = (href, ext) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = `qr-code.${ext}`;
    a.click();
  };

  const downloadPng = () => download(canvasRef.current.toDataURL("image/png"), "png");
  const downloadSvg = async () => {
    const svg = await QRCode.toString(text, { ...opts, type: "svg" });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    download(url, "svg");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const lowContrast = contrastRatio(dark, light) < 3;

  return (
    <AppShell appKey="qr">
      <style>{CSS}</style>
      <div className="qr-grid">
        <div className="ap-panel">
          <div className="qr-field">
            <label className="ap-label" htmlFor="qr-text">Link or text</label>
            <textarea id="qr-text" className="ap-input" rows={4} value={text} onChange={e => setText(e.target.value)}
              placeholder="https://example.com" style={{ resize: "vertical" }} />
          </div>
          <div className="qr-row qr-field">
            <div>
              <label className="ap-label">Foreground</label>
              <div className="qr-color">
                <input type="color" value={dark} onChange={e => setDark(e.target.value)} aria-label="Foreground colour" />
                <code style={{ fontSize: 14 }}>{dark.toUpperCase()}</code>
              </div>
            </div>
            <div>
              <label className="ap-label">Background</label>
              <div className="qr-color">
                <input type="color" value={light} onChange={e => setLight(e.target.value)} aria-label="Background colour" />
                <code style={{ fontSize: 14 }}>{light.toUpperCase()}</code>
              </div>
            </div>
          </div>
          <div className="qr-field">
            <label className="ap-label" htmlFor="qr-level">Error correction</label>
            <select id="qr-level" className="ap-input" value={level} onChange={e => setLevel(e.target.value)}>
              <option value="L">Low (7%) — smallest code</option>
              <option value="M">Medium (15%) — recommended</option>
              <option value="Q">Quartile (25%)</option>
              <option value="H">High (30%) — survives damage best</option>
            </select>
          </div>
          {lowContrast && <div className="qr-warn">These colours are close together, so some phones may not scan the code.</div>}
        </div>

        <div className="qr-preview">
          <div className="qr-canvas-wrap">
            <canvas ref={canvasRef} style={{ display: error ? "none" : "block" }} />
            {error && <div className="ap-empty">{error}</div>}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="ap-btn" onClick={downloadPng} disabled={!!error}>Download PNG</button>
            <button className="ap-btn ap-btn-ghost" onClick={downloadSvg} disabled={!!error}>Download SVG</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
