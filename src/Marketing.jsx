import { Link, NavLink } from "react-router-dom";

const CSS = `
.st {
  --bg: #ffffff;
  --bg-soft: #f6f7f9;
  --ink: #111827;
  --ink-soft: #374151;
  --muted: #6b7280;
  --line: #e5e7eb;
  --accent: #4f46e5;
  --accent-dark: #4338ca;
  --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  min-height: 100vh; background: var(--bg); color: var(--ink); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}
.st a { color: inherit; }
.st-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

.st-header { position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,0.9);
  backdrop-filter: saturate(180%) blur(16px); border-bottom: 1px solid var(--line); }
.st-header .st-wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px;
  height: 64px; }
.st-logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 700;
  font-size: 18px; letter-spacing: -0.02em; }
.st-logo-mark { width: 28px; height: 28px; border-radius: 8px; background: var(--accent); display: grid;
  place-items: center; color: #fff; font-size: 15px; font-weight: 800; }
.st-nav { display: flex; gap: 4px; }
.st-nav a { text-decoration: none; color: var(--ink-soft); font-size: 15px; font-weight: 500;
  padding: 8px 12px; border-radius: 8px; }
.st-nav a:hover { background: var(--bg-soft); color: var(--ink); }
.st-nav a.active { color: var(--accent); }

.st-eyebrow { font-size: 13px; font-weight: 600; color: var(--accent); text-transform: uppercase;
  letter-spacing: 0.08em; margin-bottom: 14px; }
.st-h1 { font-size: clamp(38px, 6vw, 64px); font-weight: 800; letter-spacing: -0.035em; line-height: 1.05;
  margin: 0 0 20px; }
.st-h2 { font-size: clamp(28px, 4vw, 38px); font-weight: 750; letter-spacing: -0.025em; line-height: 1.15;
  margin: 0 0 14px; }
.st-lede { font-size: clamp(17px, 2vw, 19px); line-height: 1.6; color: var(--muted); max-width: 620px; margin: 0; }

.st-hero { padding: 96px 0 72px; }
.st-page { padding: 80px 0 40px; max-width: 760px; }
.st-section { padding: 48px 0; }

.st-btns { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 32px; }
.st-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 10px;
  font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid transparent; cursor: pointer;
  font-family: var(--font); transition: background 0.15s, border-color 0.15s; }
.st-btn-primary { background: var(--accent); color: #fff !important; }
.st-btn-primary:hover { background: var(--accent-dark); }
.st-btn-ghost { background: #fff; color: var(--ink); border-color: var(--line); }
.st-btn-ghost:hover { border-color: #cbd5e1; }

.st-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
.st-app { display: flex; flex-direction: column; gap: 14px; padding: 24px; border: 1px solid var(--line);
  border-radius: 16px; background: #fff; text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
.st-app:hover { border-color: #c7d2fe; box-shadow: 0 10px 30px -12px rgba(79,70,229,0.25); transform: translateY(-2px); }
.st-app-icon { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
.st-app-name { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
.st-app-desc { font-size: 15px; line-height: 1.55; color: var(--muted); flex: 1; }
.st-app-cta { font-size: 14px; font-weight: 600; color: var(--accent); }

.st-card { padding: 28px; border: 1px solid var(--line); border-radius: 16px; background: var(--bg-soft); }
.st-card-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.st-card-body { font-size: 15px; line-height: 1.6; color: var(--muted); }

.st-band { background: var(--bg-soft); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  padding: 64px 0; margin-top: 48px; }
.st-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 24px; }
.st-stat-num { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; }
.st-stat-label { font-size: 14px; color: var(--muted); margin-top: 4px; }

.st-footer { border-top: 1px solid var(--line); margin-top: 96px; }
.st-footer .st-wrap { padding-top: 40px; padding-bottom: 48px; display: flex; flex-wrap: wrap; gap: 32px;
  justify-content: space-between; }
.st-foot-col h4 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  margin: 0 0 12px; }
.st-foot-col a { display: block; font-size: 14px; color: var(--muted); text-decoration: none; margin-bottom: 8px; }
.st-foot-col a:hover { color: var(--ink); }
.st-foot-col a.st-logo { display: inline-flex; color: var(--ink); font-size: 18px; }
.st-copy { width: 100%; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 20px; }

@media (max-width: 640px) {
  .st-header .st-wrap { height: auto; padding-top: 12px; padding-bottom: 12px; flex-direction: column; gap: 8px; }
  .st-nav a { padding: 6px 8px; font-size: 14px; }
  .st-hero { padding: 56px 0 40px; }
  .st-page { padding: 48px 0 24px; }
}
`;

const ICONS = {
  tally: <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />,
  jotpad: <path d="M6 4h9l4 4v12H6zM9 12h7M9 16h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  palette: <path d="M12 3a9 9 0 100 18c1.1 0 1.6-.8 1.3-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 004-4c0-5-4-10-9-10zM7.5 12a1.2 1.2 0 110-.01M10 7.5a1.2 1.2 0 110-.01M15 7.5a1.2 1.2 0 110-.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};

export const APPS = [
  { key: "tally", name: "Tally", path: "/apps/tally", color: "#10b981", desc: "A simple habit tracker. Check off each day and watch your streaks grow." },
  { key: "jotpad", name: "Jotpad", path: "/apps/jotpad", color: "#f59e0b", desc: "Quick notes with tags and instant search. Nothing to set up." },
  { key: "qr", name: "QR Studio", path: "/apps/qr-studio", color: "#4f46e5", desc: "Create QR codes for any link or text, in your colours, ready to download." },
  { key: "palette", name: "Palette", path: "/apps/palette", color: "#ec4899", desc: "Generate harmonious colour palettes and copy hex codes in one click." },
];

export function AppIcon({ app, size = 48 }) {
  return (
    <div className="st-app-icon" style={{ background: app.color, width: size, height: size }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" aria-hidden="true">{ICONS[app.key]}</svg>
    </div>
  );
}

function Header() {
  return (
    <header className="st-header">
      <div className="st-wrap">
        <Link to="/" className="st-logo"><span className="st-logo-mark">t</span>tinkerboxxx</Link>
        <nav className="st-nav">
          <NavLink to="/products">Apps</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/careers">Careers</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="st-footer">
      <div className="st-wrap">
        <div className="st-foot-col">
          <Link to="/" className="st-logo" style={{ marginBottom: 12 }}><span className="st-logo-mark">t</span>tinkerboxxx</Link>
          <div style={{ fontSize: 14, color: "var(--muted)", maxWidth: 260, lineHeight: 1.6 }}>
            Simple, useful web apps for everyday tasks.
          </div>
        </div>
        <div className="st-foot-col">
          <h4>Apps</h4>
          {APPS.map(a => <Link key={a.key} to={a.path}>{a.name}</Link>)}
        </div>
        <div className="st-foot-col">
          <h4>Company</h4>
          <Link to="/about">About</Link>
          <Link to="/careers">Careers</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div className="st-copy">© {new Date().getFullYear()} Tinkerboxxx. All rights reserved.</div>
      </div>
    </footer>
  );
}

export function Layout({ children }) {
  return (
    <div className="st">
      <style>{CSS}</style>
      <Header />
      <main className="st-wrap">{children}</main>
      <Footer />
    </div>
  );
}

function Btn({ to, href, children, variant = "primary" }) {
  const className = `st-btn ${variant === "primary" ? "st-btn-primary" : "st-btn-ghost"}`;
  return to
    ? <Link to={to} className={className}>{children}</Link>
    : <a href={href} className={className}>{children}</a>;
}

function AppGrid() {
  return (
    <div className="st-grid">
      {APPS.map(a => (
        <Link key={a.key} to={a.path} className="st-app">
          <AppIcon app={a} />
          <div className="st-app-name">{a.name}</div>
          <div className="st-app-desc">{a.desc}</div>
          <div className="st-app-cta">Open app →</div>
        </Link>
      ))}
    </div>
  );
}

export function Home() {
  return (
    <Layout>
      <section className="st-hero">
        <div className="st-eyebrow">App development studio</div>
        <h1 className="st-h1" style={{ maxWidth: 820 }}>Simple apps that do one thing well.</h1>
        <p className="st-lede">
          Tinkerboxxx designs and builds lightweight web apps for everyday tasks. Fast to load, easy to use,
          and free of clutter.
        </p>
        <div className="st-btns">
          <Btn to="/products">Browse our apps</Btn>
          <Btn to="/contact" variant="ghost">Get in touch</Btn>
        </div>
      </section>

      <section className="st-section">
        <div className="st-eyebrow">Our apps</div>
        <h2 className="st-h2" style={{ marginBottom: 28 }}>Made by Tinkerboxxx</h2>
        <AppGrid />
      </section>

      <section className="st-section">
        <div className="st-grid">
          <div className="st-card">
            <div className="st-card-title">Focused</div>
            <div className="st-card-body">Each app solves one problem clearly, without menus full of features nobody uses.</div>
          </div>
          <div className="st-card">
            <div className="st-card-title">Fast</div>
            <div className="st-card-body">Built for the web, so there's nothing to install. Open a link and get going.</div>
          </div>
          <div className="st-card">
            <div className="st-card-title">Private</div>
            <div className="st-card-body">Your data stays on your device. No sign-ups required.</div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function Products() {
  return (
    <Layout>
      <section className="st-page">
        <div className="st-eyebrow">Apps</div>
        <h1 className="st-h1">Our apps</h1>
        <p className="st-lede">Everyday tools that work right in your browser. Free to use, no account needed.</p>
      </section>
      <section className="st-section" style={{ paddingTop: 16 }}>
        <AppGrid />
      </section>
    </Layout>
  );
}

export function About() {
  return (
    <Layout>
      <section className="st-page">
        <div className="st-eyebrow">About</div>
        <h1 className="st-h1">A small studio building useful software.</h1>
        <p className="st-lede">
          Tinkerboxxx is an independent app development studio. We design, build and maintain web apps that
          help people get small, everyday jobs done quickly.
        </p>
      </section>
      <section className="st-section">
        <div className="st-grid">
          <div className="st-card">
            <div className="st-card-title">What we do</div>
            <div className="st-card-body">Product design, front-end and back-end development, hosting and ongoing maintenance of our own apps.</div>
          </div>
          <div className="st-card">
            <div className="st-card-title">How we work</div>
            <div className="st-card-body">Small releases, fast feedback, and careful attention to the details that make software pleasant to use.</div>
          </div>
          <div className="st-card">
            <div className="st-card-title">What's next</div>
            <div className="st-card-body">We're growing our catalogue with more lightweight tools for productivity and creativity.</div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function Careers() {
  return (
    <Layout>
      <section className="st-page">
        <div className="st-eyebrow">Careers</div>
        <h1 className="st-h1">Join us</h1>
        <p className="st-lede">
          We don't have any open roles right now. If you're a designer or developer who enjoys building simple,
          well-made products, we'd still love to hear from you.
        </p>
        <div className="st-btns"><Btn to="/contact">Contact us</Btn></div>
      </section>
    </Layout>
  );
}

export function Contact() {
  const rows = [
    { label: "General enquiries", value: "hello@tinkerboxxx.com" },
    { label: "App support", value: "support@tinkerboxxx.com" },
  ];
  return (
    <Layout>
      <section className="st-page">
        <div className="st-eyebrow">Contact</div>
        <h1 className="st-h1">Get in touch</h1>
        <p className="st-lede">Questions, feedback or partnership enquiries. We usually reply within one business day.</p>
      </section>
      <section className="st-grid">
        {rows.map(r => (
          <a key={r.value} href={`mailto:${r.value}`} className="st-card" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>{r.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, wordBreak: "break-word" }}>{r.value}</div>
          </a>
        ))}
      </section>
    </Layout>
  );
}

export function NotFound() {
  return (
    <Layout>
      <section className="st-page" style={{ textAlign: "center", margin: "0 auto", paddingTop: 120 }}>
        <div className="st-eyebrow">404</div>
        <h1 className="st-h1">Page not found</h1>
        <p className="st-lede" style={{ margin: "0 auto" }}>The page you're looking for doesn't exist or has moved.</p>
        <div className="st-btns" style={{ justifyContent: "center" }}><Btn to="/">Back to home</Btn></div>
      </section>
    </Layout>
  );
}
