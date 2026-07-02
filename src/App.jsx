import { useState, useEffect, useRef, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "./supabase";
import { Home, About, Products, Careers, Contact, NotFound } from "./Marketing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/app/*" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const STAGE = {
  wip: { label: "WIP", color: "#c2650a", bg: "#fef3e2" },
  complete: { label: "Complete", color: "#1a7a4c", bg: "#ecfdf5" },
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram", color: "#E1306C", bg: "#fdf2f8" },
  { id: "tiktok", label: "TikTok", color: "#18181b", bg: "#f4f4f5" },
  { id: "youtube", label: "YouTube", color: "#FF0000", bg: "#fef2f2" },
  { id: "twitter", label: "X / Twitter", color: "#1DA1F2", bg: "#eff6ff" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", bg: "#eff6ff" },
  { id: "threads", label: "Threads", color: "#18181b", bg: "#f4f4f5" },
  { id: "multi", label: "Multi-platform", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "general", label: "General", color: "#71717a", bg: "#f4f4f5" },
];

const appFromRow = (r) => ({ id: r.id, name: r.name, desc: r.description, icon: r.icon, url: r.url, platform: r.platform, iconUrl: r.icon_url, notes: r.notes || "", createdAt: new Date(r.created_at).getTime() });
const ideaFromRow = (r) => ({ id: r.id, name: r.name, desc: r.description, spec: r.spec, stage: r.stage, attachments: r.attachments || [], createdAt: new Date(r.created_at).getTime() });

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function IdeaAttachments({ idea, userId, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  async function handleUpload(e) {
    e.stopPropagation();
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true); setErr("");

    const added = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${idea.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("idea-attachments").upload(path, file);
      if (upErr) { setErr(upErr.message); continue; }
      const { data: pub } = supabase.storage.from("idea-attachments").getPublicUrl(path);
      added.push({
        name: file.name,
        path,
        size: file.size,
        type: file.type || "application/octet-stream",
        url: pub.publicUrl,
        uploadedAt: Date.now(),
      });
    }
    const updated = [...(idea.attachments || []), ...added];
    await supabase.from("ideas").update({ attachments: updated }).eq("id", idea.id);
    onChange(updated);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(att, e) {
    e.stopPropagation();
    await supabase.storage.from("idea-attachments").remove([att.path]);
    const updated = (idea.attachments || []).filter(a => a.path !== att.path);
    await supabase.from("ideas").update({ attachments: updated }).eq("id", idea.id);
    onChange(updated);
  }

  const attachments = idea.attachments || [];

  return (
    <div style={{ marginBottom: 14 }}>
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {attachments.map(a => {
            const isImg = (a.type || "").startsWith("image/");
            return (
              <div key={a.path} style={S.attachCard}>
                {isImg ? (
                  <a href={a.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title={a.name}>
                    <img src={a.url} alt={a.name} style={S.attachThumb} />
                  </a>
                ) : (
                  <a href={a.url} target="_blank" rel="noreferrer" style={S.fileChip} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 18 }}>📄</span>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={S.fileName}>{a.name}</div>
                      <div style={S.fileSize}>{fmtSize(a.size)}</div>
                    </div>
                  </a>
                )}
                <button style={S.attachDel} onClick={e => handleDelete(a, e)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <button
        style={S.actBtn}
        onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
        disabled={busy}
      >
        {busy ? "Uploading…" : "📎 Attach files"}
      </button>
      {err && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>{err}</div>}
      <input
        ref={fileRef}
        type="file"
        multiple
        onChange={handleUpload}
        onClick={e => e.stopPropagation()}
        style={{ display: "none" }}
      />
    </div>
  );
}

function AppIcon({ url, emoji, iconUrl, busy }) {
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  if (busy) {
    return (
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 18, height: 18, border: "2px solid #d4d4d8", borderTopColor: "#d97706", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }
  if (iconUrl) {
    return <img src={iconUrl} alt="" width={44} height={44} style={{ borderRadius: 10, display: "block", objectFit: "cover" }} />;
  }
  if (!url || failed) return <span style={{ fontSize: 32 }}>{emoji}</span>;
  const domain = url.replace(/^https?:\/\//, "").split("/")[0];
  const sources = [
    `https://icon.horse/icon/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
  return (
    <img
      src={sources[srcIdx]}
      alt=""
      width={32}
      height={32}
      style={{ borderRadius: 6, display: "block", objectFit: "contain" }}
      onError={() => srcIdx < sources.length - 1 ? setSrcIdx(srcIdx + 1) : setFailed(true)}
    />
  );
}

function Dashboard() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authChecked) return <div style={S.page}><p style={S.loading}>Loading…</p></div>;
  if (!session) return <SignIn />;
  return <Main session={session} />;
}

function SignIn() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function signInGoogle() {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setErr(error.message); setBusy(false); }
  }

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ ...S.form, marginTop: 80, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🛠️</div>
        <div style={{ ...S.formTitle, textAlign: "center", marginBottom: 24 }}>Sign in to Tinkerbox</div>
        <button onClick={signInGoogle} disabled={busy} style={S.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>
        {err && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

function Main({ session }) {
  const userId = session.user.id;
  const [tab, setTab] = useState("apps");
  const [apps, setApps] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedIdea, setExpandedIdea] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [genError, setGenError] = useState("");
  const [notesAppId, setNotesAppId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState("🔗");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("general");
  const [spec, setSpec] = useState("");
  const [stage, setStage] = useState("wip");
  const nameRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [a, i] = await Promise.all([
        supabase.from("apps").select("*").order("created_at", { ascending: true }),
        supabase.from("ideas").select("*").order("created_at", { ascending: true }),
      ]);
      if (a.data) setApps(a.data.map(appFromRow));
      if (i.data) setIdeas(i.data.map(ideaFromRow));
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (formOpen && nameRef.current) nameRef.current.focus(); }, [formOpen]);

  function reset() {
    setName(""); setDesc(""); setIcon("🔗"); setUrl(""); setPlatform("general"); setSpec(""); setStage("wip");
    setFormOpen(false); setEditId(null);
  }

  function openAdd() { reset(); setFormOpen(true); }

  function editApp(a, e) {
    e.stopPropagation();
    setEditId(a.id); setName(a.name); setDesc(a.desc || ""); setIcon(a.icon); setUrl(a.url || ""); setPlatform(a.platform || "general");
    setFormOpen(true);
  }
  async function saveApp() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: desc.trim(), icon, url: url.trim(), platform };
    if (editId) {
      setApps(apps.map(a => a.id === editId ? { ...a, ...payload, desc: payload.description } : a));
      await supabase.from("apps").update(payload).eq("id", editId);
    } else {
      const { data } = await supabase.from("apps").insert({ ...payload, user_id: userId }).select().single();
      if (data) setApps([...apps, appFromRow(data)]);
    }
    reset();
  }
  async function delApp(aid, e) {
    e.stopPropagation();
    setApps(apps.filter(a => a.id !== aid));
    await supabase.from("apps").delete().eq("id", aid);
  }
  function openApp(a) { if (a.url) { const u = a.url.startsWith("http") ? a.url : `https://${a.url}`; window.open(u, "_blank"); } }

  function editIdea(idea, e) {
    e.stopPropagation();
    setEditId(idea.id); setName(idea.name); setDesc(idea.desc || ""); setSpec(idea.spec || ""); setStage(idea.stage || "wip");
    setFormOpen(true);
  }
  async function saveIdea() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: desc.trim(), spec, stage };
    if (editId) {
      setIdeas(ideas.map(i => i.id === editId ? { ...i, ...payload, desc: payload.description } : i));
      await supabase.from("ideas").update(payload).eq("id", editId);
    } else {
      const { data } = await supabase.from("ideas").insert({ ...payload, user_id: userId }).select().single();
      if (data) setIdeas([...ideas, ideaFromRow(data)]);
    }
    reset();
  }
  async function delIdea(iid, e) {
    e.stopPropagation();
    setIdeas(ideas.filter(i => i.id !== iid));
    if (expandedIdea === iid) setExpandedIdea(null);
    await supabase.from("ideas").delete().eq("id", iid);
  }
  async function promoteToApp(idea) {
    const payload = {
      name: idea.name,
      description: idea.desc || "",
      icon: "🔗",
      url: "",
      platform: "general",
      notes: idea.spec || "",
      user_id: userId,
    };
    const { data, error } = await supabase.from("apps").insert(payload).select().single();
    if (error) return;
    setApps([...apps, appFromRow(data)]);
    setIdeas(ideas.filter(i => i.id !== idea.id));
    await supabase.from("ideas").delete().eq("id", idea.id);
    setTab("apps");
    setExpandedIdea(null);
  }

  async function generateIcon(app, e) {
    e.stopPropagation();
    if (generatingId) return;
    setGeneratingId(app.id); setGenError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ appId: app.id, name: app.name, description: app.desc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setApps(apps.map(a => a.id === app.id ? { ...a, iconUrl: data.iconUrl } : a));
    } catch (err) {
      setGenError(err.message);
      setTimeout(() => setGenError(""), 4000);
    } finally {
      setGeneratingId(null);
    }
  }

  function openNotes(app, e) {
    e.stopPropagation();
    setNotesAppId(app.id);
    setNotesDraft(app.notes || "");
  }
  function closeNotes() {
    setNotesAppId(null);
    setNotesDraft("");
  }
  async function saveNotes() {
    if (!notesAppId) return;
    setNotesSaving(true);
    await supabase.from("apps").update({ notes: notesDraft }).eq("id", notesAppId);
    setApps(apps.map(a => a.id === notesAppId ? { ...a, notes: notesDraft } : a));
    setNotesSaving(false);
    closeNotes();
  }

  async function signOut() { await supabase.auth.signOut(); }

  if (loading) return <div style={S.page}><p style={S.loading}>Loading…</p></div>;

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={S.userBar}>
        <span style={S.userEmail}>{session.user.email}</span>
        <button style={S.signOut} onClick={signOut}>Sign out</button>
      </div>

      <div style={S.tabs}>
        <button onClick={() => { setTab("apps"); reset(); }} style={{ ...S.tabBtn, ...(tab === "apps" ? S.tabActive : {}) }}>
          Apps{apps.length > 0 ? ` (${apps.length})` : ""}
        </button>
        <button onClick={() => { setTab("ideas"); reset(); }} style={{ ...S.tabBtn, ...(tab === "ideas" ? S.tabActive : {}) }}>
          Ideas{ideas.length > 0 ? ` (${ideas.length})` : ""}
        </button>
        <button onClick={() => { setTab("stats"); reset(); }} style={{ ...S.tabBtn, ...(tab === "stats" ? S.tabActive : {}) }}>
          Stats
        </button>
        <button onClick={() => { setTab("prompt"); reset(); }} style={{ ...S.tabBtn, ...(tab === "prompt" ? S.tabActive : {}) }}>
          Prompt
        </button>
      </div>

      {tab === "stats" && <Stats session={session} />}
      {tab === "prompt" && <PromptTool session={session} />}

      {tab === "apps" && (
        <div style={S.fadeIn}>
          {!formOpen && (
            <button style={S.addBtn} onClick={openAdd}>+ Add App</button>
          )}

          {formOpen && tab === "apps" && (
            <div style={S.form}>
              <div style={S.formTitle}>{editId ? "Edit App" : "Add App"}</div>
              <input ref={nameRef} style={S.input} placeholder="App name" value={name} onChange={e => setName(e.target.value)} />
              <input style={S.input} placeholder="Short description" value={desc} onChange={e => setDesc(e.target.value)} />
              <input style={S.input} placeholder="URL (e.g. my-app.vercel.app)" value={url} onChange={e => setUrl(e.target.value)} />
              <div style={{ marginBottom: 14 }}>
                <div style={S.lbl}>Platform</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => setPlatform(p.id)} style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
                      border: platform === p.id ? `1.5px solid ${p.color}` : "1.5px solid #e4e4e7",
                      background: platform === p.id ? p.bg : "#fff",
                      color: platform === p.id ? p.color : "#a1a1aa",
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div style={S.formBtns}>
                <button style={S.cancel} onClick={reset}>Cancel</button>
                <button style={{ ...S.save, opacity: name.trim() ? 1 : 0.4 }} onClick={saveApp}>{editId ? "Update" : "Add"}</button>
              </div>
            </div>
          )}

          {apps.length === 0 && !formOpen && (
            <div style={S.empty}>
              <span style={{ fontSize: 44 }}>🌐</span>
              <p style={S.emptyTitle}>No apps yet</p>
              <p style={S.emptySub}>Add your web apps here for quick access.</p>
            </div>
          )}

          <div style={S.appGrid}>
            {apps.map(a => (
              <div key={a.id} style={S.appCard} onClick={() => openApp(a)}>
                <div style={S.appTop}>
                  <AppIcon url={a.url} emoji={a.icon} iconUrl={a.iconUrl} busy={generatingId === a.id} />
                  <div style={S.appActions}>
                    <button style={S.tinyBtn} title={a.iconUrl ? "Regenerate icon" : "Generate icon"} onClick={e => generateIcon(a, e)} disabled={!!generatingId}>✨</button>
                    <button style={S.tinyBtn} title="Notes" onClick={e => openNotes(a, e)}>📝</button>
                    <button style={S.tinyBtn} onClick={e => editApp(a, e)}>✏️</button>
                    <button style={S.tinyBtn} onClick={e => delApp(a.id, e)}>✕</button>
                  </div>
                </div>
                <div style={S.appName}>{a.name}</div>
                {(() => { const p = PLATFORMS.find(p => p.id === a.platform); return p && p.id !== "general" ? (
                  <div style={{ fontSize: 10, fontWeight: 600, color: p.color, background: p.bg, padding: "2px 8px", borderRadius: 10, display: "inline-block", marginBottom: 6 }}>{p.label}</div>
                ) : null; })()}
                {a.desc && <div style={S.appDesc}>{a.desc}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ideas" && (
        <div style={S.fadeIn}>
          {!formOpen && (
            <button style={S.addBtn} onClick={openAdd}>+ Add Idea</button>
          )}

          {formOpen && tab === "ideas" && (
            <div style={S.form}>
              <div style={S.formTitle}>{editId ? "Edit Idea" : "New Idea"}</div>
              <input ref={nameRef} style={S.input} placeholder="Idea name" value={name} onChange={e => setName(e.target.value)} />
              <input style={S.input} placeholder="One-line description" value={desc} onChange={e => setDesc(e.target.value)} />
              <div style={{ marginBottom: 14 }}>
                <div style={S.lbl}>Status</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(STAGE).map(([k, v]) => (
                    <button key={k} onClick={() => setStage(k)} style={{
                      ...S.stageBtn,
                      borderColor: stage === k ? v.color : "#e4e4e7",
                      background: stage === k ? v.bg : "#fff",
                      color: stage === k ? v.color : "#a1a1aa",
                    }}>{v.label}</button>
                  ))}
                </div>
              </div>
              <div style={S.lbl}>Full Spec / Notes</div>
              <textarea
                style={S.specInput}
                placeholder="Paste your full spec, Claude conversation notes, feature list — anything you want to save..."
                value={spec}
                onChange={e => setSpec(e.target.value)}
              />
              <div style={S.formBtns}>
                <button style={S.cancel} onClick={reset}>Cancel</button>
                <button style={{ ...S.save, opacity: name.trim() ? 1 : 0.4 }} onClick={saveIdea}>{editId ? "Update" : "Save"}</button>
              </div>
            </div>
          )}

          {ideas.length === 0 && !formOpen && (
            <div style={S.empty}>
              <span style={{ fontSize: 44 }}>💡</span>
              <p style={S.emptyTitle}>No ideas yet</p>
              <p style={S.emptySub}>Save your app specs and ideas here. When you build one, promote it to My Apps.</p>
            </div>
          )}

          {ideas.map(idea => {
            const s = STAGE[idea.stage] || STAGE.wip;
            const open = expandedIdea === idea.id;
            return (
              <div key={idea.id} style={S.ideaCard} onClick={() => setExpandedIdea(open ? null : idea.id)}>
                <div style={S.ideaTop}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={S.ideaName}>{idea.name}</span>
                      <span style={{ ...S.stageBadge, background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                    {idea.desc && <div style={S.ideaDesc}>{idea.desc}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: "#d4d4d8", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
                </div>

                {open && (
                  <div style={S.ideaExpanded}>
                    {idea.spec ? (
                      <pre style={S.specBlock}>{idea.spec}</pre>
                    ) : (
                      <p style={{ fontSize: 13, color: "#a1a1aa", margin: "0 0 14px", fontStyle: "italic" }}>No spec saved yet. Edit to add one.</p>
                    )}
                    <IdeaAttachments
                      idea={idea}
                      userId={userId}
                      onChange={(next) => setIdeas(ideas.map(i => i.id === idea.id ? { ...i, attachments: next } : i))}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={S.actBtn} onClick={e => { e.stopPropagation(); promoteToApp(idea); }}>🚀 Promote to App</button>
                      <button style={S.actBtn} onClick={e => editIdea(idea, e)}>✏️ Edit</button>
                      <button style={{ ...S.actBtn, color: "#dc2626" }} onClick={e => delIdea(idea.id, e)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {notesAppId && (() => {
        const a = apps.find(x => x.id === notesAppId);
        return (
          <div style={S.modalBackdrop} onClick={closeNotes}>
            <div style={S.modal} onClick={e => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>📝 Notes · {a?.name}</div>
                <button style={S.closeBtn} onClick={closeNotes}>✕</button>
              </div>
              <textarea
                autoFocus
                style={S.notesInput}
                placeholder="Future features, bugs, rough ideas, next steps..."
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
              />
              <div style={S.formBtns}>
                <button style={S.cancel} onClick={closeNotes}>Close</button>
                <button style={{ ...S.save, opacity: notesSaving ? 0.5 : 1 }} onClick={saveNotes} disabled={notesSaving}>
                  {notesSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {genError && <div style={S.toast}>{genError}</div>}

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const PLATFORM_META = {
  tiktok: { label: "TikTok", color: "#18181b", bg: "#f4f4f5", icon: "🎵" },
  instagram: { label: "Instagram", color: "#E1306C", bg: "#fdf2f8", icon: "📷" },
  youtube: { label: "YouTube", color: "#FF0000", bg: "#fef2f2", icon: "▶️" },
  facebook: { label: "Facebook", color: "#1877F2", bg: "#eff6ff", icon: "f" },
};

const TIMEFRAMES = [
  { id: "24h", label: "24h" },
  { id: "7d",  label: "7d"  },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "all", label: "All" },
];

const SORTS = [
  { id: "views",    label: "Views"    },
  { id: "likes",    label: "Likes"    },
  { id: "comments", label: "Comments" },
  { id: "shares",   label: "Shares"   },
  { id: "recent",   label: "Recent"   },
];

const METRIC_KEY = { views: "view_count", likes: "like_count", comments: "comment_count", shares: "share_count" };

function fmtNum(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtWatchTime(seconds) {
  if (!seconds || seconds <= 0) return "0";
  const days = seconds / 86400;
  if (days >= 1) return `${days.toFixed(1)}d`;
  const h = seconds / 3600;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = seconds / 60;
  if (m >= 1) return `${Math.round(m)}m`;
  return `${Math.round(seconds)}s`;
}

function captionText(p) {
  return p.video_description || p.caption || "(no caption)";
}

function MiniChart({ daily, metric }) {
  if (!daily?.snapshots?.length) return <div style={S.chartEmpty}>No daily data yet</div>;
  const snaps = daily.snapshots;
  const key = METRIC_KEY[metric];
  const vals = snaps.map(s => Number(s[key]) || 0);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = Math.max(max - min, 1);
  const W = 480, H = 140, PX = 8, PY = 16;
  const xStep = vals.length > 1 ? (W - 2 * PX) / (vals.length - 1) : 0;
  const yFor = v => PY + (1 - (v - min) / range) * (H - 2 * PY);
  const pts = vals.map((v, i) => `${PX + i * xStep},${yFor(v)}`).join(" ");
  const areaPts = `${PX},${H - PY} ${pts} ${PX + (vals.length - 1) * xStep},${H - PY}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }}>
      <polyline points={areaPts} fill="rgba(217,119,6,0.08)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#d97706" strokeWidth="2" />
      {vals.map((v, i) => (
        <circle key={i} cx={PX + i * xStep} cy={yFor(v)} r="3" fill="#d97706" />
      ))}
    </svg>
  );
}

function PromptTool({ session }) {
  const [mode, setMode] = useState("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const preview = imageDataUrl || imageUrl;

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      setError("Image too large (max 5MB)");
      return;
    }
    setError("");
    setFileName(file.name);
    setImageUrl("");
    const r = new FileReader();
    r.onload = () => setImageDataUrl(String(r.result || ""));
    r.readAsDataURL(file);
  }

  function clearImage() {
    setImageUrl("");
    setImageDataUrl("");
    setFileName("");
    setPrompt("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function generate() {
    if (!preview) return;
    setLoading(true);
    setError("");
    setPrompt("");
    try {
      const body = imageDataUrl ? { imageDataUrl } : { imageUrl };
      const res = await fetch("/api/image-to-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Generation failed");
      setPrompt(j.prompt);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div style={S.fadeIn}>
      <div style={S.form}>
        <div style={S.formTitle}>Image → Gemini prompt</div>

        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "#f4f4f5", borderRadius: 10, padding: 3 }}>
          <button
            onClick={() => { setMode("upload"); setImageUrl(""); }}
            style={{
              ...S.tabBtn,
              fontSize: 12, padding: "8px 0",
              ...(mode === "upload" ? S.tabActive : {}),
            }}
          >Upload</button>
          <button
            onClick={() => { setMode("url"); setImageDataUrl(""); setFileName(""); }}
            style={{
              ...S.tabBtn,
              fontSize: 12, padding: "8px 0",
              ...(mode === "url" ? S.tabActive : {}),
            }}
          >Paste URL</button>
        </div>

        {mode === "upload" ? (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                ...S.addBtn,
                marginBottom: 12,
              }}
            >{fileName ? `📎 ${fileName}` : "+ Choose image"}</button>
          </div>
        ) : (
          <input
            style={S.input}
            type="url"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={e => { setImageUrl(e.target.value); setPrompt(""); }}
          />
        )}

        {preview && (
          <div style={{ marginBottom: 14, borderRadius: 12, overflow: "hidden", border: "1px solid #e4e4e7", background: "#fafaf9" }}>
            <img
              src={preview}
              alt="preview"
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
              onError={() => setError("Could not load image from URL")}
            />
          </div>
        )}

        <div style={S.formBtns}>
          {preview && (
            <button style={S.cancel} onClick={clearImage} disabled={loading}>Clear</button>
          )}
          <button
            style={{ ...S.save, opacity: (!preview || loading) ? 0.5 : 1, cursor: (!preview || loading) ? "not-allowed" : "pointer" }}
            onClick={generate}
            disabled={!preview || loading}
          >{loading ? "Reading image…" : "Generate prompt"}</button>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {prompt && (
        <div style={{ ...S.form, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={S.formTitle}>Prompt</div>
            <button
              onClick={copyPrompt}
              style={{
                ...S.cancel,
                padding: "6px 14px", fontSize: 12,
                color: copied ? "#d97706" : "#71717a",
                borderColor: copied ? "#fcd34d" : "#e4e4e7",
              }}
            >{copied ? "Copied" : "Copy"}</button>
          </div>
          <div style={{
            background: "#fafaf9", border: "1.5px solid #e4e4e7", borderRadius: 12,
            padding: "12px 14px", fontSize: 14, lineHeight: 1.55, color: "#18181b",
            fontFamily: "'Instrument Sans', sans-serif", whiteSpace: "pre-wrap",
          }}>{prompt}</div>
        </div>
      )}
    </div>
  );
}

function Stats({ session }) {
  const [timeframe, setTimeframe] = useState("24h");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dailyById, setDailyById] = useState({});
  const [chartMetric, setChartMetric] = useState("views");
  const [sortBy, setSortBy] = useState("views");

  async function fetchList(tf = timeframe) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/analytics?action=list&timeframe=${tf}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setData(j.data || []);
      const latest = (j.data || []).reduce((max, p) => {
        const t = p.last_synced_at ? new Date(p.last_synced_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      if (latest) setLastSyncedAt(latest);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(timeframe); /* eslint-disable-line */ }, [timeframe]);

  async function sync() {
    setSyncing(true); setError("");
    try {
      const res = await fetch(`/api/analytics?action=sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Sync failed");
      }
      setDailyById({});
      await fetchList(timeframe);
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!dailyById[id]) {
      try {
        const res = await fetch(`/api/analytics?action=daily&id=${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const j = await res.json();
        if (res.ok) setDailyById(d => ({ ...d, [id]: j }));
      } catch {}
    }
  }

  const visible = useMemo(() => {
    let list = [...data];
    if (timeframe === "24h") {
      list = list.filter(p => p.last24h && (p.last24h.views || p.last24h.likes || p.last24h.comments || p.last24h.shares));
    }
    list.sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.platform_created_at || 0) - new Date(a.platform_created_at || 0);
      }
      if (timeframe === "24h") {
        const k = sortBy === "views" ? "views" : sortBy === "likes" ? "likes" : sortBy === "comments" ? "comments" : "shares";
        return (b.last24h?.[k] || 0) - (a.last24h?.[k] || 0);
      }
      const k = METRIC_KEY[sortBy];
      return (b[k] || 0) - (a[k] || 0);
    });
    return list;
  }, [data, timeframe, sortBy]);

  const totals = useMemo(() => {
    const cutoffMs = {
      "24h": 24 * 60 * 60 * 1000,
      "7d":  7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
      "all": Infinity,
    }[timeframe];
    const now = Date.now();
    const posts = data.filter(p => {
      if (!p.platform_created_at) return false;
      return now - new Date(p.platform_created_at).getTime() <= cutoffMs;
    }).length;
    if (timeframe === "24h") {
      return data.reduce((acc, p) => ({
        views:     acc.views     + (p.last24h?.views    || 0),
        likes:     acc.likes     + (p.last24h?.likes    || 0),
        comments:  acc.comments  + (p.last24h?.comments || 0),
        shares:    acc.shares    + (p.last24h?.shares   || 0),
        watchTime: acc.watchTime + (p.last24h?.views || 0) * (Number(p.duration) || 0),
        posts,
      }), { views: 0, likes: 0, comments: 0, shares: 0, watchTime: 0, posts });
    }
    return data.reduce((acc, p) => ({
      views:     acc.views     + (p.view_count    || 0),
      likes:     acc.likes     + (p.like_count    || 0),
      comments:  acc.comments  + (p.comment_count || 0),
      shares:    acc.shares    + (p.share_count   || 0),
      watchTime: acc.watchTime + (p.view_count || 0) * (Number(p.duration) || 0),
      posts,
    }), { views: 0, likes: 0, comments: 0, shares: 0, watchTime: 0, posts });
  }, [data, timeframe]);

  const tfLabel = timeframe === "24h" ? "Last 24h" : timeframe === "all" ? "All time" : `Last ${timeframe}`;

  return (
    <div style={S.fadeIn}>
      <div style={S.timeBar}>
        {TIMEFRAMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTimeframe(t.id)}
            style={{ ...S.timeBtn, ...(timeframe === t.id ? S.timeBtnActive : {}) }}
          >{t.label}</button>
        ))}
      </div>

      <div style={S.statSummary}>
        {[
          { k: "posts",     label: "Posts",      icon: "📤" },
          { k: "views",     label: "Views",      icon: "👁" },
          { k: "likes",     label: "Likes",      icon: "❤️" },
          { k: "comments",  label: "Comments",   icon: "💬" },
          { k: "shares",    label: "Shares",     icon: "↗" },
          { k: "watchTime", label: "Watch time", icon: "⏱" },
        ].map(c => (
          <div key={c.k} style={S.statCard}>
            <div style={S.statLabel}>{c.icon} {c.label}</div>
            <div style={S.statValue}>{c.k === "watchTime" ? fmtWatchTime(totals[c.k]) : fmtNum(totals[c.k])}</div>
            <div style={S.statSub}>{tfLabel}</div>
          </div>
        ))}
      </div>

      <div style={S.statsActions}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SORTS.map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)} style={{ ...S.sortBtn, ...(sortBy === s.id ? S.sortBtnActive : {}) }}>{s.label}</button>
          ))}
        </div>
        <button onClick={sync} disabled={syncing} style={{ ...S.syncBtn, opacity: syncing ? 0.6 : 1 }}>
          {syncing ? "Syncing…" : "↻ Sync"}
        </button>
      </div>

      {error && <div style={S.errBox}>{error}</div>}

      {loading && <p style={S.loading}>Loading…</p>}

      {!loading && visible.length === 0 && (
        <div style={S.empty}>
          <span style={{ fontSize: 44 }}>📊</span>
          <p style={S.emptyTitle}>No posts {timeframe === "24h" ? "with activity in the last 24h" : "in this timeframe"}</p>
          <p style={S.emptySub}>{timeframe === "24h" ? "Try a longer window, or hit Sync to refresh metrics." : "Hit Sync to refresh metrics from the platforms."}</p>
        </div>
      )}

      {!loading && visible.map(p => {
        const platform = PLATFORM_META[p.platform] || { label: p.platform, color: "#71717a", bg: "#f4f4f5", icon: "📌" };
        const open = expandedId === p.id;
        const d24 = p.last24h;
        const has24 = d24 && (d24.views || d24.likes || d24.comments || d24.shares);
        return (
          <div key={p.id} style={S.postCard} onClick={() => toggleExpand(p.id)}>
            <div style={S.postRow}>
              {p.cover_image_url ? (
                <img src={p.cover_image_url} alt="" style={S.postThumb} />
              ) : (
                <div style={{ ...S.postThumb, display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f5", fontSize: 22 }}>{platform.icon}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.postHeader}>
                  <span style={S.postUsername}>{p.username ? `@${p.username}` : "Unknown account"}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: platform.color, background: platform.bg, padding: "2px 8px", borderRadius: 10 }}>{platform.label}</span>
                  {p.share_url && (
                    <a
                      href={p.share_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={S.postLink}
                    >↗ Open</a>
                  )}
                </div>
                {p.platform_created_at && (
                  <div style={S.postDate}>
                    {new Date(p.platform_created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                )}
                <div style={S.postCaption}>{captionText(p)}</div>
                <div style={S.postStats}>
                  <span>👁 {fmtNum(p.view_count)}</span>
                  <span>❤️ {fmtNum(p.like_count)}</span>
                  <span>💬 {fmtNum(p.comment_count)}</span>
                  <span>↗ {fmtNum(p.share_count)}</span>
                </div>
                {has24 && (
                  <div style={S.delta}>
                    +{fmtNum(d24.views)} views · +{fmtNum(d24.likes)} likes · +{fmtNum(d24.comments)} comments today
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#d4d4d8", flexShrink: 0, alignSelf: "center" }}>{open ? "▲" : "▼"}</span>
            </div>

            {open && (
              <div style={S.postExpanded} onClick={e => e.stopPropagation()}>
                <div style={S.metricToggle}>
                  {["views", "likes", "comments", "shares"].map(m => (
                    <button key={m} onClick={() => setChartMetric(m)} style={{ ...S.metricBtn, ...(chartMetric === m ? S.metricBtnActive : {}) }}>{m}</button>
                  ))}
                </div>
                <MiniChart daily={dailyById[p.id]} metric={chartMetric} />
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {p.share_url && (
                    <a href={p.share_url} target="_blank" rel="noreferrer" style={S.viewBtn}>↗ View on {platform.label}</a>
                  )}
                  {p.comment_count > 0 && p.share_url && (
                    <a href={p.share_url} target="_blank" rel="noreferrer" style={S.viewBtn}>💬 Read {p.comment_count} comments</a>
                  )}
                </div>
                {p.last_synced_at && (
                  <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 10 }}>Synced {new Date(p.last_synced_at).toLocaleString()}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {lastSyncedAt && !loading && (
        <div style={{ fontSize: 11, color: "#a1a1aa", textAlign: "center", marginTop: 16 }}>
          Last synced: {new Date(lastSyncedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#fafaf9",
    padding: "28px 18px 80px",
    fontFamily: "'Instrument Sans', sans-serif",
    maxWidth: 540,
    margin: "0 auto",
  },
  loading: { textAlign: "center", padding: 80, color: "#a1a1aa" },
  userBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16, fontSize: 12,
  },
  userEmail: { color: "#a1a1aa", fontFamily: "'IBM Plex Mono', monospace" },
  signOut: {
    background: "transparent", border: "none", color: "#a1a1aa",
    fontSize: 12, cursor: "pointer", padding: 4, fontFamily: "'Instrument Sans', sans-serif",
  },
  tabs: {
    display: "flex", gap: 4, marginBottom: 24,
    background: "#f4f4f5", borderRadius: 14, padding: 4,
  },
  tabBtn: {
    flex: 1, border: "none", padding: "11px 0", fontSize: 14, fontWeight: 600,
    cursor: "pointer", borderRadius: 11, color: "#a1a1aa", background: "transparent",
    fontFamily: "'Instrument Sans', sans-serif", transition: "all .2s",
  },
  tabActive: {
    color: "#18181b", background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  fadeIn: { animation: "fadeUp .25s ease" },
  addBtn: {
    width: "100%", padding: "13px 0", marginBottom: 18,
    background: "#fff", border: "2px dashed #e4e4e7", borderRadius: 14,
    fontSize: 14, fontWeight: 600, color: "#a1a1aa", cursor: "pointer",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  form: {
    background: "#fff", borderRadius: 18, padding: 22,
    border: "1px solid #e4e4e7", marginBottom: 20,
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  },
  formTitle: { fontSize: 17, fontWeight: 600, color: "#18181b", marginBottom: 18 },
  lbl: {
    fontSize: 11, fontWeight: 600, color: "#a1a1aa", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  input: {
    width: "100%", background: "#fafaf9", border: "1.5px solid #e4e4e7",
    borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#18181b",
    marginBottom: 12, outline: "none", fontFamily: "'Instrument Sans', sans-serif",
    boxSizing: "border-box",
  },
  specInput: {
    width: "100%", background: "#fafaf9", border: "1.5px solid #e4e4e7",
    borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#18181b",
    marginBottom: 14, outline: "none", fontFamily: "'IBM Plex Mono', monospace",
    boxSizing: "border-box", minHeight: 160, resize: "vertical", lineHeight: 1.6,
  },
  stageBtn: {
    padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600,
    cursor: "pointer", border: "1.5px solid #e4e4e7",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  formBtns: { display: "flex", justifyContent: "flex-end", gap: 10 },
  cancel: {
    background: "#fff", color: "#71717a", border: "1.5px solid #e4e4e7",
    borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
  },
  save: {
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    color: "#fff", border: "none", borderRadius: 12,
    padding: "10px 22px", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
    boxShadow: "0 2px 8px rgba(217,119,6,0.2)",
  },
  appGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
  },
  appCard: {
    background: "#fff", borderRadius: 16, padding: 18,
    border: "1px solid #e4e4e7", cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    position: "relative",
  },
  appTop: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 12,
  },
  appActions: { display: "flex", gap: 4 },
  tinyBtn: {
    width: 26, height: 26, border: "none", background: "#f4f4f5",
    borderRadius: 8, fontSize: 12, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#a1a1aa",
  },
  appName: { fontSize: 15, fontWeight: 600, color: "#18181b", marginBottom: 4 },
  appDesc: { fontSize: 12, color: "#71717a", lineHeight: 1.4, marginBottom: 8 },
  appUrl: {
    fontSize: 11, color: "#d97706", fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  ideaCard: {
    background: "#fff", borderRadius: 16, padding: "16px 18px",
    border: "1px solid #e4e4e7", marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    cursor: "pointer", borderLeft: "3px solid #fcd34d",
  },
  ideaTop: { display: "flex", alignItems: "flex-start", gap: 10 },
  ideaName: { fontSize: 15, fontWeight: 600, color: "#18181b" },
  stageBadge: {
    fontSize: 11, fontWeight: 600, padding: "3px 10px",
    borderRadius: 20, letterSpacing: "0.2px",
  },
  ideaDesc: { fontSize: 13, color: "#71717a", marginTop: 4, lineHeight: 1.4 },
  ideaExpanded: { marginTop: 16, paddingTop: 16, borderTop: "1px solid #f4f4f5" },
  specBlock: {
    background: "#fafaf9", border: "1px solid #f4f4f5", borderRadius: 12,
    padding: 16, fontSize: 12.5, color: "#3f3f46", lineHeight: 1.65,
    fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "pre-wrap",
    wordBreak: "break-word", margin: "0 0 14px", maxHeight: 400,
    overflow: "auto",
  },
  actBtn: {
    background: "#fff", border: "1.5px solid #e4e4e7", color: "#71717a",
    fontSize: 12, fontWeight: 500, cursor: "pointer", padding: "7px 14px",
    borderRadius: 10, fontFamily: "'Instrument Sans', sans-serif",
  },
  googleBtn: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    gap: 10, padding: "12px 18px", background: "#fff",
    border: "1.5px solid #e4e4e7", borderRadius: 12,
    fontSize: 14, fontWeight: 600, color: "#18181b", cursor: "pointer",
    fontFamily: "'Instrument Sans', sans-serif",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  attachCard: {
    position: "relative", display: "inline-flex",
    borderRadius: 10, overflow: "hidden",
    border: "1px solid #e4e4e7", background: "#fff",
  },
  attachThumb: {
    width: 80, height: 80, objectFit: "cover", display: "block",
  },
  fileChip: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 12px", minWidth: 140, maxWidth: 220,
    textDecoration: "none", color: "#18181b",
  },
  fileName: {
    fontSize: 12, fontWeight: 500, color: "#18181b",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  fileSize: { fontSize: 10, color: "#a1a1aa", marginTop: 2 },
  attachDel: {
    position: "absolute", top: 4, right: 4,
    width: 20, height: 20, borderRadius: "50%",
    border: "none", background: "rgba(0,0,0,0.6)", color: "#fff",
    fontSize: 10, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 0,
  },
  modalBackdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 200, padding: 16,
  },
  modal: {
    background: "#fff", borderRadius: 18, padding: 22,
    width: "100%", maxWidth: 520, maxHeight: "85vh",
    display: "flex", flexDirection: "column",
    boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16, fontWeight: 600, color: "#18181b",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  closeBtn: {
    background: "#f4f4f5", border: "none", borderRadius: 8,
    width: 28, height: 28, cursor: "pointer", fontSize: 14,
    color: "#71717a", flexShrink: 0,
  },
  notesInput: {
    width: "100%", background: "#fafaf9", border: "1.5px solid #e4e4e7",
    borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#18181b",
    marginBottom: 14, outline: "none", fontFamily: "'IBM Plex Mono', monospace",
    boxSizing: "border-box", minHeight: 240, resize: "vertical", lineHeight: 1.6,
    flex: 1,
  },
  toast: {
    position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
    background: "#18181b", color: "#fff", padding: "10px 18px", borderRadius: 10,
    fontSize: 13, maxWidth: 400, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 100,
  },
  empty: { textAlign: "center", padding: "52px 20px" },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: "#18181b", margin: "12px 0 4px" },
  emptySub: { fontSize: 14, color: "#a1a1aa", lineHeight: 1.5, margin: 0 },

  timeBar: {
    display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap",
  },
  timeBtn: {
    flex: 1, minWidth: 56, padding: "8px 0", borderRadius: 10,
    border: "1.5px solid #e4e4e7", background: "#fff", color: "#a1a1aa",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  timeBtnActive: {
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    color: "#fff", border: "1.5px solid #d97706",
  },
  statSummary: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10, marginBottom: 14,
  },
  statCard: {
    background: "#fff", border: "1px solid #e4e4e7", borderRadius: 14,
    padding: "14px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  statLabel: {
    fontSize: 11, fontWeight: 600, color: "#a1a1aa",
    textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6,
  },
  statValue: {
    fontSize: 22, fontWeight: 700, color: "#18181b",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  statSub: { fontSize: 11, color: "#a1a1aa", marginTop: 2 },
  statsActions: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 10, marginBottom: 14, flexWrap: "wrap",
  },
  sortBtn: {
    padding: "5px 10px", borderRadius: 14, fontSize: 11, fontWeight: 600,
    cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
    border: "1.5px solid #e4e4e7", background: "#fff", color: "#a1a1aa",
  },
  sortBtnActive: {
    border: "1.5px solid #18181b", background: "#18181b", color: "#fff",
  },
  syncBtn: {
    padding: "7px 14px", borderRadius: 10,
    border: "1.5px solid #e4e4e7", background: "#fff", color: "#18181b",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  errBox: {
    background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
    padding: "10px 14px", borderRadius: 10, fontSize: 12, marginBottom: 12,
  },
  postCard: {
    background: "#fff", border: "1px solid #e4e4e7", borderRadius: 14,
    padding: 12, marginBottom: 10, cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  postRow: { display: "flex", gap: 12, alignItems: "stretch" },
  postThumb: {
    width: 72, height: 72, borderRadius: 10, objectFit: "cover",
    flexShrink: 0, background: "#f4f4f5",
  },
  postHeader: {
    display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap",
  },
  postUsername: {
    fontSize: 13, fontWeight: 700, color: "#18181b",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200,
  },
  postDate: {
    fontSize: 11, color: "#a1a1aa", fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: 6,
  },
  postCaption: {
    fontSize: 13, color: "#18181b", lineHeight: 1.4, marginBottom: 6,
    overflow: "hidden", textOverflow: "ellipsis",
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
  },
  postStats: {
    display: "flex", gap: 10, fontSize: 12, color: "#71717a", flexWrap: "wrap",
  },
  delta: {
    fontSize: 11, color: "#1a7a4c", background: "#ecfdf5",
    padding: "3px 8px", borderRadius: 8, marginTop: 6,
    display: "inline-block", fontWeight: 600,
  },
  postExpanded: {
    marginTop: 14, paddingTop: 14, borderTop: "1px solid #f4f4f5",
  },
  metricToggle: {
    display: "flex", gap: 4, marginBottom: 10,
  },
  metricBtn: {
    padding: "5px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
    cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
    border: "1.5px solid #e4e4e7", background: "#fff", color: "#a1a1aa",
    textTransform: "capitalize",
  },
  metricBtnActive: {
    border: "1.5px solid #d97706", background: "#fef3e2", color: "#d97706",
  },
  chartEmpty: {
    fontSize: 12, color: "#a1a1aa", textAlign: "center",
    padding: 30, background: "#fafaf9", borderRadius: 10,
  },
  viewBtn: {
    padding: "8px 14px", background: "#fff", border: "1.5px solid #e4e4e7",
    borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#18181b",
    cursor: "pointer", textDecoration: "none",
    fontFamily: "'Instrument Sans', sans-serif", display: "inline-block",
  },
  postLink: {
    fontSize: 10, fontWeight: 600, color: "#18181b",
    background: "#fafaf9", border: "1px solid #e4e4e7",
    padding: "2px 8px", borderRadius: 10, textDecoration: "none",
    fontFamily: "'Instrument Sans', sans-serif",
  },
};
