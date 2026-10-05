import { useMemo, useState } from "react";
import { AppShell, useStored, uid } from "./AppShell";

const CSS = `
.jp { display: grid; grid-template-columns: 300px 1fr; gap: 20px; min-height: 520px; }
.jp-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.jp-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.jp-tag { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line);
  background: #fff; color: var(--ink-soft); cursor: pointer; }
.jp-tag.on { background: #f59e0b; border-color: #f59e0b; color: #fff; }
.jp-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; max-height: 520px; }
.jp-item { text-align: left; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: #fff;
  cursor: pointer; font: inherit; }
.jp-item.on { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
.jp-item-title { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jp-item-snip { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.jp-item-date { font-size: 11px; color: var(--muted); margin-top: 6px; }
.jp-editor { display: flex; flex-direction: column; gap: 12px; }
.jp-title { font-size: 22px; font-weight: 700; border: none; outline: none; padding: 4px 0; font-family: inherit; color: var(--ink); width: 100%; }
.jp-body { flex: 1; min-height: 340px; border: none; outline: none; resize: none; font: inherit; font-size: 16px;
  line-height: 1.65; color: var(--ink-soft); width: 100%; }
.jp-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
  border-top: 1px solid var(--line); padding-top: 12px; font-size: 13px; color: var(--muted); }
@media (max-width: 760px) {
  .jp { grid-template-columns: 1fr; }
  .jp-list { max-height: 240px; }
}
`;

function parseTags(s) {
  return [...new Set(s.split(",").map(t => t.trim().toLowerCase()).filter(Boolean))];
}

const WELCOME = {
  title: "Welcome to Jotpad",
  body: "Jot down anything here. Notes save automatically as you type.\n\nAdd tags below to group notes, then use the search box or tag filters to find them again.",
  tags: ["getting-started"],
};

export default function Jotpad() {
  const [notes, setNotes] = useStored("tbx.jotpad.notes", () => [{ id: uid(), ...WELCOME, updated: Date.now() }]);
  const [activeId, setActiveId] = useState(() => notes[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState(null);
  const [tagDraft, setTagDraft] = useState(null);

  const allTags = useMemo(() => [...new Set(notes.flatMap(n => n.tags))].sort(), [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => b.updated - a.updated)
      .filter(n => !tagFilter || n.tags.includes(tagFilter))
      .filter(n => !q || (n.title + " " + n.body + " " + n.tags.join(" ")).toLowerCase().includes(q));
  }, [notes, query, tagFilter]);

  const active = notes.find(n => n.id === activeId) || null;

  const update = patch => setNotes(ns => ns.map(n => (n.id === activeId ? { ...n, ...patch, updated: Date.now() } : n)));

  const create = () => {
    const n = { id: uid(), title: "", body: "", tags: tagFilter ? [tagFilter] : [], updated: Date.now() };
    setNotes(ns => [n, ...ns]);
    setActiveId(n.id);
    setTagDraft(null);
    setQuery("");
  };

  const remove = () => {
    const rest = notes.filter(n => n.id !== activeId);
    setNotes(rest);
    setActiveId(rest[0]?.id ?? null);
    setTagDraft(null);
  };

  const select = id => { setActiveId(id); setTagDraft(null); };

  return (
    <AppShell appKey="jotpad">
      <style>{CSS}</style>
      <div className="jp">
        <div className="jp-side">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="ap-input" placeholder="Search notes" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search notes" />
            <button className="ap-btn" onClick={create} style={{ background: "#f59e0b" }}>New</button>
          </div>
          {allTags.length > 0 && (
            <div className="jp-tags">
              {allTags.map(t => (
                <button key={t} className={`jp-tag ${tagFilter === t ? "on" : ""}`} onClick={() => setTagFilter(f => (f === t ? null : t))}>#{t}</button>
              ))}
            </div>
          )}
          <div className="jp-list">
            {visible.length === 0 && <div className="ap-empty" style={{ padding: 20 }}>No matching notes.</div>}
            {visible.map(n => (
              <button key={n.id} className={`jp-item ${n.id === activeId ? "on" : ""}`} onClick={() => select(n.id)}>
                <div className="jp-item-title">{n.title || "Untitled"}</div>
                <div className="jp-item-snip">{n.body.split("\n")[0] || "No content"}</div>
                <div className="jp-item-date">{new Date(n.updated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="ap-panel jp-editor">
          {active ? (
            <>
              <input className="jp-title" value={active.title} onChange={e => update({ title: e.target.value })} placeholder="Title" aria-label="Note title" />
              <textarea className="jp-body" value={active.body} onChange={e => update({ body: e.target.value })} placeholder="Start writing…" aria-label="Note body" />
              <div>
                <label className="ap-label" htmlFor="jp-tags">Tags (comma separated)</label>
                <input id="jp-tags" className="ap-input" placeholder="work, ideas"
                  value={tagDraft ?? active.tags.join(", ")}
                  onChange={e => setTagDraft(e.target.value)}
                  onBlur={() => { if (tagDraft != null) { update({ tags: parseTags(tagDraft) }); setTagDraft(null); } }} />
              </div>
              <div className="jp-foot">
                <span>{active.body.trim() ? active.body.trim().split(/\s+/).length : 0} words · saved</span>
                <button className="ap-btn ap-btn-ghost" onClick={remove} style={{ color: "#dc2626" }}>Delete note</button>
              </div>
            </>
          ) : (
            <div className="ap-empty" style={{ margin: "auto" }}>
              <div style={{ marginBottom: 14 }}>No note selected.</div>
              <button className="ap-btn" onClick={create} style={{ background: "#f59e0b" }}>Create a note</button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
