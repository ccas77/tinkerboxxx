import { Link } from "react-router-dom";

// The public face of the site: deliberately whimsical and vague. Nothing here
// names a product or an app — the dashboard lives at /app and is untouched.

const CSS = `
.tb {
  --paper: #fbf5ea;
  --paper-deep: #f4ead8;
  --ink: #2b2140;
  --ink-soft: #5a4f6e;
  --muted: #877c97;
  --coral: #e5685a;
  --lilac: #9a86d8;
  --mint: #6fbfa5;
  --honey: #e9b04a;
  --line: rgba(43, 33, 64, 0.14);
  --display: "Fraunces", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --body: "Nunito", ui-rounded, -apple-system, "Segoe UI", Roboto, sans-serif;
  --hand: "Caveat", "Bradley Hand", "Segoe Print", cursive;

  position: relative; min-height: 100vh; overflow-x: hidden;
  background:
    radial-gradient(40vw 40vw at 8% 12%, rgba(154, 134, 216, 0.20), transparent 70%),
    radial-gradient(45vw 45vw at 95% 30%, rgba(229, 104, 90, 0.14), transparent 70%),
    radial-gradient(50vw 50vw at 30% 95%, rgba(111, 191, 165, 0.16), transparent 70%),
    var(--paper);
  color: var(--ink); font-family: var(--body);
}
.tb a { color: inherit; }
.tb ::selection { background: var(--honey); color: var(--ink); }

/* nav */
.tb-nav { position: relative; z-index: 5; max-width: 1100px; margin: 0 auto;
  padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.tb-mark { display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
  font-family: var(--display); font-style: italic; font-weight: 600; font-size: 24px; letter-spacing: -0.01em; }
.tb-mark svg { transition: transform 0.6s cubic-bezier(.3,1.6,.5,1); }
.tb-mark:hover svg { transform: rotate(-14deg) scale(1.08); }
.tb-links { display: flex; gap: 6px; flex-wrap: wrap; }
.tb-links a { font-family: var(--hand); font-size: 22px; text-decoration: none; color: var(--ink-soft);
  padding: 2px 12px; border-radius: 999px; transition: background 0.2s, color 0.2s, transform 0.2s; }
.tb-links a:hover { background: rgba(255,255,255,0.7); color: var(--ink); transform: rotate(-2deg); }

.tb-main { position: relative; z-index: 2; max-width: 1100px; margin: 0 auto; padding: 0 24px; }

/* type */
.tb-eyebrow { font-family: var(--hand); font-size: 24px; color: var(--coral); margin-bottom: 12px;
  display: inline-block; transform: rotate(-2deg); }
.tb-h1 { font-family: var(--display); font-weight: 500; font-size: clamp(44px, 8vw, 96px);
  line-height: 1.0; letter-spacing: -0.03em; margin: 0 0 24px; font-variation-settings: "SOFT" 100, "WONK" 1; }
.tb-h1 em { font-style: italic; color: var(--lilac); }
.tb-h2 { font-family: var(--display); font-weight: 500; font-size: clamp(30px, 4.5vw, 46px);
  line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 16px; font-variation-settings: "SOFT" 100, "WONK" 1; }
.tb-h2 em { font-style: italic; color: var(--coral); }
.tb-lede { font-size: clamp(17px, 2.2vw, 20px); line-height: 1.65; color: var(--ink-soft); max-width: 580px; }

/* hero */
.tb-hero { display: grid; grid-template-columns: 1.15fr 0.85fr; align-items: center; gap: 32px;
  padding: 72px 0 96px; }
.tb-hero-art { position: relative; aspect-ratio: 1; max-width: 420px; width: 100%; justify-self: center; }
.tb-page { padding: 88px 0 48px; max-width: 760px; }
.tb-center { text-align: center; margin-left: auto; margin-right: auto; }
.tb-center .tb-lede { margin-left: auto; margin-right: auto; }

/* buttons */
.tb-btns { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 32px; }
.tb-center .tb-btns { justify-content: center; }
.tb-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 26px; border-radius: 999px;
  font-family: var(--body); font-weight: 700; font-size: 16px; text-decoration: none; cursor: pointer;
  transition: transform 0.25s cubic-bezier(.3,1.6,.5,1), box-shadow 0.25s; }
.tb-btn-primary { background: var(--ink); color: var(--paper) !important; box-shadow: 4px 4px 0 var(--coral); }
.tb-btn-primary:hover { transform: translate(-2px, -2px) rotate(-1deg); box-shadow: 7px 7px 0 var(--coral); }
.tb-btn-ghost { background: rgba(255,255,255,0.6); color: var(--ink); border: 1.5px dashed var(--ink-soft); }
.tb-btn-ghost:hover { transform: rotate(1.5deg); background: #fff; }

/* jars / cards */
.tb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 22px; }
.tb-card { position: relative; background: rgba(255,255,255,0.72); border: 1.5px solid var(--line);
  border-radius: 28px 28px 22px 22px; padding: 30px 26px 28px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 40px -24px rgba(43,33,64,0.35);
  transition: transform 0.4s cubic-bezier(.3,1.6,.5,1); }
.tb-card:nth-child(3n+1) { transform: rotate(-1.2deg); }
.tb-card:nth-child(3n+2) { transform: rotate(0.8deg) translateY(10px); }
.tb-card:nth-child(3n+3) { transform: rotate(-0.4deg); }
.tb-card:hover { transform: rotate(0deg) translateY(-6px); }
.tb-card-title { font-family: var(--display); font-style: italic; font-weight: 600; font-size: 26px; margin: 14px 0 8px; }
.tb-card-body { color: var(--ink-soft); line-height: 1.6; font-size: 15.5px; }
.tb-tag { display: inline-block; font-family: var(--hand); font-size: 20px; padding: 0 12px; border-radius: 6px;
  color: var(--ink); transform: rotate(-3deg); }

/* notes */
.tb-notes { list-style: none; padding: 0; margin: 28px 0 0; display: grid; gap: 14px; }
.tb-notes li { display: flex; gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1.5px dashed var(--line);
  font-family: var(--display); font-size: clamp(19px, 2.6vw, 24px); line-height: 1.35; }
.tb-notes li span { font-family: var(--hand); color: var(--coral); font-size: 22px; flex: 0 0 auto; min-width: 54px; }

.tb-section { padding: 56px 0; }
.tb-quiet { font-family: var(--hand); font-size: 26px; color: var(--muted); text-align: center; padding: 64px 0 24px; transform: rotate(-1deg); }

/* contact envelopes */
.tb-env { display: block; text-decoration: none; }
.tb-env .tb-card-title { font-size: 20px; font-style: normal; font-family: var(--body); font-weight: 700; word-break: break-word; }

/* footer */
.tb-foot { position: relative; z-index: 2; margin-top: 96px; border-top: 1.5px dashed var(--line); }
.tb-foot-in { max-width: 1100px; margin: 0 auto; padding: 36px 24px 44px; display: flex; flex-wrap: wrap;
  gap: 20px; align-items: center; justify-content: space-between; color: var(--muted); font-size: 14px; }
.tb-foot-links { display: flex; gap: 18px; flex-wrap: wrap; }
.tb-foot-links a { text-decoration: none; color: var(--ink-soft); }
.tb-foot-links a:hover { color: var(--coral); }
.tb-foot-hand { font-family: var(--hand); font-size: 20px; color: var(--ink-soft); }

/* floating doodles */
.tb-sky { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
.tb-float { position: absolute; animation: tb-bob 7s ease-in-out infinite; }
.tb-spin { animation: tb-spin 22s linear infinite; transform-origin: center; transform-box: fill-box; }
.tb-twinkle { animation: tb-twinkle 2.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.tb-rise { animation: tb-rise 5s ease-in infinite; }
.tb-lid { animation: tb-lid 4.5s ease-in-out infinite; transform-origin: 30% 100%; transform-box: fill-box; }
@keyframes tb-bob { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-16px) rotate(6deg); } }
@keyframes tb-spin { to { transform: rotate(360deg); } }
@keyframes tb-twinkle { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }
@keyframes tb-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-120px); opacity: 0; } }
@keyframes tb-lid { 0%,100% { transform: rotate(-14deg); } 50% { transform: rotate(-24deg); } }

@media (max-width: 760px) {
  .tb-hero { grid-template-columns: 1fr; padding: 40px 0 64px; text-align: center; }
  .tb-hero .tb-lede { margin-left: auto; margin-right: auto; }
  .tb-hero .tb-btns { justify-content: center; }
  .tb-hero-art { max-width: 280px; order: -1; }
  .tb-page { padding: 56px 0 32px; }
  .tb-nav { justify-content: center; }
  .tb-links a { font-size: 20px; padding: 2px 8px; }
  .tb-foot-in { justify-content: center; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .tb *, .tb *::before, .tb *::after { animation: none !important; transition: none !important; }
}
`;

function Star({ size = 18, color = "var(--honey)", className = "tb-twinkle", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      <path className={className} d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1 Z" fill={color} />
    </svg>
  );
}

function Spiral({ size = 46, color = "var(--lilac)", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" style={style} aria-hidden="true">
      <path className="tb-spin" d="M25 25 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 0 1 5 -5 a8 8 0 0 1 8 8 a11 11 0 0 1 -11 11 a14 14 0 0 1 -14 -14 a17 17 0 0 1 17 -17"
        fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// A scatter of drifting doodles behind every page.
function Sky() {
  const bits = [
    { el: <Star size={22} />, top: "14%", left: "4%", delay: "0s" },
    { el: <Spiral />, top: "8%", left: "88%", delay: "-2s" },
    { el: <Star size={14} color="var(--coral)" />, top: "46%", left: "93%", delay: "-1s" },
    { el: <Star size={12} color="var(--lilac)" />, top: "62%", left: "3%", delay: "-3s" },
    { el: <Spiral size={34} color="var(--mint)" />, top: "82%", left: "8%", delay: "-4s" },
    { el: <Star size={18} color="var(--mint)" />, top: "88%", left: "90%", delay: "-5s" },
  ];
  return (
    <div className="tb-sky">
      {bits.map((b, i) => (
        <div key={i} className="tb-float" style={{ top: b.top, left: b.left, animationDelay: b.delay }}>{b.el}</div>
      ))}
    </div>
  );
}

function BoxMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="17" width="28" height="18" rx="4" fill="var(--coral)" />
      <rect x="4" y="10" width="32" height="7" rx="3" fill="var(--ink)" transform="rotate(-12 6 17)" />
      <path d="M27 5 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2z" fill="var(--honey)" />
    </svg>
  );
}

// The hero illustration: a little box, lid ajar, with things drifting out of it.
function BoxScene() {
  return (
    <div className="tb-hero-art">
      <svg viewBox="0 0 400 400" width="100%" height="100%" role="img" aria-label="A small box with its lid ajar and sparks drifting out">
        <ellipse cx="200" cy="330" rx="130" ry="18" fill="rgba(43,33,64,0.08)" />
        {/* glow */}
        <circle cx="200" cy="200" r="120" fill="url(#tbglow)" />
        <defs>
          <radialGradient id="tbglow">
            <stop offset="0%" stopColor="#ffe7a8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffe7a8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* escaping bits */}
        <g className="tb-rise" style={{ animationDelay: "0s" }}><circle cx="170" cy="190" r="6" fill="var(--lilac)" /></g>
        <g className="tb-rise" style={{ animationDelay: "-1.6s" }}><circle cx="232" cy="180" r="4.5" fill="var(--mint)" /></g>
        <g className="tb-rise" style={{ animationDelay: "-3.2s" }}><circle cx="205" cy="200" r="5" fill="var(--coral)" /></g>
        <g className="tb-rise" style={{ animationDelay: "-2.4s" }}>
          <path d="M190 170 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="var(--honey)" />
        </g>
        <g className="tb-rise" style={{ animationDelay: "-4.1s" }}>
          <path d="M245 200 q8 -10 16 0 t16 0" fill="none" stroke="var(--lilac)" strokeWidth="3" strokeLinecap="round" />
        </g>
        {/* box body */}
        <path d="M110 215 L290 215 L278 320 Q276 330 266 330 L134 330 Q124 330 122 320 Z" fill="var(--coral)" />
        <path d="M110 215 L290 215 L287 240 L113 240 Z" fill="rgba(0,0,0,0.10)" />
        <path d="M150 260 q20 14 40 0 t40 0 t40 0" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
        <circle cx="200" cy="292" r="8" fill="var(--honey)" />
        {/* lid */}
        <g className="tb-lid">
          <rect x="100" y="190" width="200" height="28" rx="8" fill="var(--ink)" />
          <rect x="185" y="180" width="30" height="12" rx="6" fill="var(--ink)" />
        </g>
        {/* stars around */}
        <path className="tb-twinkle" d="M80 120 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="var(--honey)" />
        <path className="tb-twinkle" style={{ animationDelay: "-1.2s" }} d="M320 90 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="var(--coral)" />
        <path className="tb-twinkle" style={{ animationDelay: "-2s" }} d="M330 250 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="var(--lilac)" />
        <circle className="tb-twinkle" style={{ animationDelay: "-0.6s" }} cx="70" cy="260" r="4" fill="var(--mint)" />
      </svg>
    </div>
  );
}

function Nav() {
  return (
    <header className="tb-nav">
      <Link to="/" className="tb-mark"><BoxMark />tinkerboxxx</Link>
      <nav className="tb-links">
        <Link to="/about">wander</Link>
        <Link to="/products">the shelf</Link>
        <Link to="/contact">say hello</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="tb-foot">
      <div className="tb-foot-in">
        <div className="tb-foot-hand">made slowly, by lamplight ✶</div>
        <div className="tb-foot-links">
          <Link to="/about">wander</Link>
          <Link to="/products">the shelf</Link>
          <Link to="/careers">apprentices</Link>
          <Link to="/contact">say hello</Link>
        </div>
        <div>© {new Date().getFullYear()} Tinkerboxxx</div>
      </div>
    </footer>
  );
}

export function Layout({ children }) {
  return (
    <div className="tb">
      <style>{CSS}</style>
      <Sky />
      <Nav />
      <main className="tb-main">{children}</main>
      <Footer />
    </div>
  );
}

function Btn({ to, href, children, variant = "primary" }) {
  const className = `tb-btn ${variant === "primary" ? "tb-btn-primary" : "tb-btn-ghost"}`;
  return to
    ? <Link to={to} className={className}>{children}</Link>
    : <a href={href} className={className}>{children}</a>;
}

function Card({ tag, tagColor, title, children }) {
  return (
    <div className="tb-card">
      {tag && <span className="tb-tag" style={{ background: tagColor }}>{tag}</span>}
      <div className="tb-card-title">{title}</div>
      <div className="tb-card-body">{children}</div>
    </div>
  );
}

const JARS = [
  { tag: "jar no. 1", color: "#f3d6f0", title: "Odds", body: "Bits of string, half-thoughts, a small bolt that fits nothing in particular. Yet." },
  { tag: "jar no. 2", color: "#d7f0e6", title: "Ends", body: "The pieces that only make sense once everything else is finished. We keep them close." },
  { tag: "jar no. 3", color: "#fde9c2", title: "Maybes", body: "Kept in a drawer, taken out on quiet afternoons, held up to the window to see what they do." },
];

const NOTES = [
  "Small things are allowed to be wonderful.",
  "Curiosity first. Explanations later, possibly never.",
  "If it hums when you switch it on, keep it.",
  "Leave a little room for the unexpected to sit down.",
];

export function Home() {
  return (
    <Layout>
      <section className="tb-hero">
        <div>
          <div className="tb-eyebrow">somewhere between a Tuesday and a daydream…</div>
          <h1 className="tb-h1">Something is being <em>tinkered.</em></h1>
          <p className="tb-lede">
            Behind this door there's a workbench, a jar of loose ideas, and a lamp that stays on later than it
            should. We can't tell you what's on the bench just yet. Honestly, we're still finding out ourselves.
          </p>
          <div className="tb-btns">
            <Btn to="/about">Peek inside</Btn>
            <Btn to="/contact" variant="ghost">Leave a note ✎</Btn>
          </div>
        </div>
        <BoxScene />
      </section>

      <section className="tb-section">
        <div className="tb-center" style={{ maxWidth: 640, marginBottom: 40 }}>
          <div className="tb-eyebrow">on the workbench, roughly</div>
          <h2 className="tb-h2">A few jars, <em>loosely labelled.</em></h2>
        </div>
        <div className="tb-grid">
          {JARS.map(j => (
            <Card key={j.title} tag={j.tag} tagColor={j.color} title={j.title}>{j.body}</Card>
          ))}
        </div>
      </section>

      <section className="tb-section" style={{ maxWidth: 760 }}>
        <div className="tb-eyebrow">scribbled in the margins</div>
        <h2 className="tb-h2">Field notes.</h2>
        <ul className="tb-notes">
          {NOTES.map((n, i) => <li key={i}><span>no. {i + 1}</span>{n}</li>)}
        </ul>
      </section>

      <div className="tb-quiet">psst — keep an eye on this space. ✶</div>
    </Layout>
  );
}

export function Products() {
  return (
    <Layout>
      <section className="tb-page tb-center">
        <div className="tb-eyebrow">the shelf</div>
        <h1 className="tb-h1">Still being <em>dusted.</em></h1>
        <p className="tb-lede">
          There's nothing on display quite yet. Things are being sanded, wound up, and occasionally talked to
          in an encouraging voice. Come back when the lamp is a little brighter.
        </p>
        <div className="tb-btns">
          <Btn to="/">Back to the bench</Btn>
          <Btn to="/contact" variant="ghost">Ask to be told</Btn>
        </div>
      </section>
      <div style={{ display: "flex", justifyContent: "center", gap: 28, padding: "24px 0" }}>
        <Star size={20} />
        <Star size={14} color="var(--coral)" />
        <Star size={20} color="var(--lilac)" />
      </div>
    </Layout>
  );
}

export function About() {
  return (
    <Layout>
      <section className="tb-page">
        <div className="tb-eyebrow">wander in, mind the cables</div>
        <h1 className="tb-h1">A small workshop with a <em>large imagination.</em></h1>
        <p className="tb-lede">
          Tinkerboxxx is a place where ideas are allowed to be strange for a while before anyone asks them to
          be useful. Some of them grow up. Some of them stay odd forever. We love them equally.
        </p>
      </section>

      <section className="tb-section">
        <div className="tb-eyebrow">things we hold dear</div>
        <div className="tb-grid" style={{ marginTop: 16 }}>
          <Card tag="✶" tagColor="#fde9c2" title="Small, on purpose">
            Small enough to follow a hunch down a side street and still be home for tea.
          </Card>
          <Card tag="✶" tagColor="#d7f0e6" title="Wonder, then work">
            Every good thing here started as a "what if…?" muttered at an inconvenient hour.
          </Card>
          <Card tag="✶" tagColor="#f3d6f0" title="Gentle by nature">
            No tricks, no hurry, no shouting. Things that are kind to the people who find them.
          </Card>
        </div>
      </section>
    </Layout>
  );
}

export function Careers() {
  return (
    <Layout>
      <section className="tb-page">
        <div className="tb-eyebrow">wanted: no one (yet)</div>
        <h1 className="tb-h1">Apprentices of <em>wonder.</em></h1>
        <p className="tb-lede">
          The workshop has exactly one stool, and it's currently occupied. But if you're the sort of person who
          collects interesting pebbles and takes apart clocks just to see, we'd like to know you exist.
        </p>
        <div className="tb-btns">
          <Btn to="/contact">Slip a note under the door</Btn>
        </div>
      </section>
    </Layout>
  );
}

export function Contact() {
  const envelopes = [
    { tag: "general wonderings", color: "#fde9c2", value: "hello@tinkerboxxx.com" },
    { tag: "something's gone wobbly", color: "#d7f0e6", value: "support@tinkerboxxx.com" },
    { tag: "ink & paper", color: "#f3d6f0", value: "press@tinkerboxxx.com" },
  ];
  return (
    <Layout>
      <section className="tb-page">
        <div className="tb-eyebrow">fold it into a paper plane</div>
        <h1 className="tb-h1">Say <em>hello.</em></h1>
        <p className="tb-lede">
          Questions, curiosities, a nice thing you saw today. Letters are read by a human, usually with a cup
          of something warm nearby.
        </p>
      </section>
      <section className="tb-grid">
        {envelopes.map(e => (
          <a key={e.value} href={`mailto:${e.value}`} className="tb-card tb-env">
            <span className="tb-tag" style={{ background: e.color }}>{e.tag}</span>
            <div className="tb-card-title">{e.value}</div>
          </a>
        ))}
      </section>
    </Layout>
  );
}

export function NotFound() {
  return (
    <Layout>
      <section className="tb-page tb-center" style={{ paddingTop: 120 }}>
        <div className="tb-eyebrow">here be dragons (probably)</div>
        <h1 className="tb-h1">You've wandered <em>off the map.</em></h1>
        <p className="tb-lede">This corner hasn't been drawn yet. Perhaps it never will be. Perhaps that's the charm.</p>
        <div className="tb-btns">
          <Btn to="/">Find your way back</Btn>
        </div>
      </section>
    </Layout>
  );
}
