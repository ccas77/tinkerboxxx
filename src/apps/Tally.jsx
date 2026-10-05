import { useState } from "react";
import { AppShell, useStored, uid } from "./AppShell";

const CSS = `
.tl-add { display: flex; gap: 10px; margin-bottom: 20px; }
.tl-list { display: grid; gap: 14px; }
.tl-habit { border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; background: #fff; }
.tl-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.tl-name { font-size: 17px; font-weight: 700; }
.tl-meta { display: flex; gap: 16px; font-size: 13px; color: var(--muted); }
.tl-meta b { color: var(--ink); }
.tl-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.tl-day { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.tl-check { width: 100%; max-width: 48px; aspect-ratio: 1; border-radius: 12px; border: 1.5px solid var(--line);
  background: #fff; cursor: pointer; display: grid; place-items: center; font-size: 18px; color: #fff; transition: background 0.15s, border-color 0.15s; }
.tl-check:hover { border-color: #10b981; }
.tl-check.on { background: #10b981; border-color: #10b981; }
.tl-today { font-weight: 700; color: var(--ink); }
.tl-heat { display: grid; grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 3px; margin-top: 16px; justify-content: start; }
.tl-heat span { width: 11px; height: 11px; border-radius: 3px; background: #eef0f3; }
.tl-heat span.on { background: #10b981; }
.tl-del { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 4px; }
.tl-del:hover { color: #dc2626; }
`;

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBack(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(d);
  }
  return out;
}

// Consecutive done days ending today, or ending yesterday if today isn't ticked yet.
function streak(done) {
  const today = new Date();
  let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!done[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (done[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const SUGGESTIONS = ["Drink water", "Read 10 pages", "Walk", "Stretch"];

export default function Tally() {
  const [habits, setHabits] = useStored("tbx.tally.habits", []);
  const [name, setName] = useState("");
  const week = daysBack(7);
  const heat = daysBack(84);
  const todayKey = dayKey(new Date());

  const add = n => {
    const v = n.trim();
    if (!v) return;
    setHabits(h => [...h, { id: uid(), name: v, done: {} }]);
    setName("");
  };

  const toggle = (id, key) => setHabits(hs => hs.map(h => {
    if (h.id !== id) return h;
    const done = { ...h.done };
    if (done[key]) delete done[key]; else done[key] = true;
    return { ...h, done };
  }));

  return (
    <AppShell appKey="tally">
      <style>{CSS}</style>
      <form className="tl-add" onSubmit={e => { e.preventDefault(); add(name); }}>
        <input className="ap-input" value={name} onChange={e => setName(e.target.value)} placeholder="Add a habit, e.g. Meditate" aria-label="New habit" maxLength={60} />
        <button className="ap-btn" type="submit">Add</button>
      </form>

      {habits.length === 0 ? (
        <div className="ap-panel ap-empty">
          <div style={{ marginBottom: 14 }}>No habits yet. Add one above, or start with:</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {SUGGESTIONS.map(s => <button key={s} className="ap-btn ap-btn-ghost" onClick={() => add(s)}>{s}</button>)}
          </div>
        </div>
      ) : (
        <div className="tl-list">
          {habits.map(h => (
            <div key={h.id} className="tl-habit">
              <div className="tl-top">
                <div className="tl-name">{h.name}</div>
                <div className="tl-meta">
                  <span>Streak <b>{streak(h.done)}</b></span>
                  <span>Total <b>{Object.keys(h.done).length}</b></span>
                  <button className="tl-del" onClick={() => setHabits(hs => hs.filter(x => x.id !== h.id))} aria-label={`Delete ${h.name}`}>Delete</button>
                </div>
              </div>
              <div className="tl-week">
                {week.map(d => {
                  const k = dayKey(d);
                  return (
                    <div key={k} className={`tl-day ${k === todayKey ? "tl-today" : ""}`}>
                      <button className={`tl-check ${h.done[k] ? "on" : ""}`} onClick={() => toggle(h.id, k)}
                        aria-pressed={!!h.done[k]} aria-label={`${h.name} on ${d.toDateString()}`}>
                        {h.done[k] ? "✓" : ""}
                      </button>
                      {k === todayKey ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                  );
                })}
              </div>
              <div className="tl-heat" aria-hidden="true">
                {heat.map(d => { const k = dayKey(d); return <span key={k} className={h.done[k] ? "on" : ""} title={d.toDateString()} />; })}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
