import { Link } from "react-router-dom";

const M = {
  bg: "#ffffff",
  ink: "#1c2b33",
  inkSoft: "#3d4a54",
  muted: "#65676b",
  divider: "#e4e6eb",
  card: "#f7f8fa",
  accent: "#0866FF",
  accentDark: "#0353c9",
};

const font = {
  display: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  body: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
};

const PRODUCTS = [
  { key: "reposterr", name: "Reposterr", tagline: "Repost across platforms in one pass.", grad: "linear-gradient(135deg, #0866FF 0%, #0353c9 100%)" },
  { key: "simplepostr", name: "SimplePostr", tagline: "Simple social publishing and scheduling.", grad: "linear-gradient(135deg, #7B47C7 0%, #5c2f9d 100%)" },
  { key: "socialato", name: "Socialato", tagline: "Your footage, polished for social media.", grad: "linear-gradient(135deg, #00A99D 0%, #00807a 100%)" },
];

const VALUES = [
  { title: "Small on purpose", body: "We stay small so we can move on instinct. No committees, no roadmap theatre, no shipping features to justify headcount." },
  { title: "Made for makers", body: "Every product starts as something the founder needed. If it isn't useful on day one, it doesn't get built." },
  { title: "Honest software", body: "No dark patterns, no manufactured urgency, no data sold. Tools that respect the person using them." },
];

function Nav() {
  const link = {
    color: M.inkSoft, textDecoration: "none", fontSize: 15, fontWeight: 500,
    padding: "8px 4px", fontFamily: font.body,
  };
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,0.92)",
      backdropFilter: "saturate(180%) blur(20px)", borderBottom: `1px solid ${M.divider}`,
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link to="/" style={{
          color: M.ink, fontFamily: font.display, fontWeight: 700, fontSize: 22,
          textDecoration: "none", letterSpacing: "-0.02em",
        }}>tinkerboxxx</Link>
        <nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <Link to="/products" style={link}>Products</Link>
          <Link to="/about" style={link}>About</Link>
          <Link to="/careers" style={link}>Careers</Link>
          <Link to="/contact" style={link}>Contact</Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const colTitle = { fontSize: 13, fontWeight: 700, color: M.ink, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 };
  const li = { fontSize: 14, color: M.muted, marginBottom: 10, listStyle: "none" };
  const a = { color: M.muted, textDecoration: "none", fontFamily: font.body };
  return (
    <footer style={{ background: M.card, borderTop: `1px solid ${M.divider}`, marginTop: 120 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 32px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 40, marginBottom: 40 }}>
          <div>
            <div style={colTitle}>Products</div>
            <ul style={{ margin: 0, padding: 0 }}>
              {PRODUCTS.map(p => (
                <li key={p.key} style={li}><Link to="/products" style={a}>{p.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div style={colTitle}>Company</div>
            <ul style={{ margin: 0, padding: 0 }}>
              <li style={li}><Link to="/about" style={a}>About</Link></li>
              <li style={li}><Link to="/careers" style={a}>Careers</Link></li>
              <li style={li}><Link to="/contact" style={a}>Contact</Link></li>
            </ul>
          </div>
          <div>
            <div style={colTitle}>Resources</div>
            <ul style={{ margin: 0, padding: 0 }}>
              <li style={li}><a href="mailto:hello@tinkerboxxx.com" style={a}>Support</a></li>
              <li style={li}><a href="#" style={a}>Status</a></li>
            </ul>
          </div>
          <div>
            <div style={colTitle}>Legal</div>
            <ul style={{ margin: 0, padding: 0 }}>
              <li style={li}><a href="#" style={a}>Privacy</a></li>
              <li style={li}><a href="#" style={a}>Terms</a></li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${M.divider}`, paddingTop: 24, fontSize: 13, color: M.muted, fontFamily: font.body }}>
          © {new Date().getFullYear()} Tinkerboxxx. An independent app studio.
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }) {
  return (
    <div style={{ background: M.bg, minHeight: "100vh", color: M.ink, fontFamily: font.body }}>
      <Nav />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Btn({ to, href, children, variant = "primary" }) {
  const base = {
    display: "inline-block", padding: "14px 26px", borderRadius: 999,
    fontSize: 15, fontWeight: 600, fontFamily: font.body,
    textDecoration: "none", cursor: "pointer", border: "none",
    transition: "opacity 0.15s",
  };
  const styles = variant === "primary"
    ? { ...base, background: M.accent, color: "#fff" }
    : { ...base, background: "transparent", color: M.ink, border: `1.5px solid ${M.divider}` };
  const Comp = to ? Link : "a";
  const props = to ? { to } : { href };
  return <Comp {...props} style={styles}>{children}</Comp>;
}

function ProductTile({ p, big = false }) {
  return (
    <div style={{
      background: p.grad, borderRadius: 20, padding: big ? "40px 32px" : "28px 24px",
      color: "#fff", position: "relative", overflow: "hidden",
      minHeight: big ? 260 : 200, display: "flex", flexDirection: "column",
      justifyContent: "space-between",
    }}>
      <div style={{
        fontSize: 12, fontWeight: 600, opacity: 0.85, letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>Product</div>
      <div>
        <div style={{
          fontSize: big ? 32 : 24, fontWeight: 700, fontFamily: font.display,
          letterSpacing: "-0.02em", marginBottom: 8, lineHeight: 1.1,
        }}>{p.name}</div>
        <div style={{ fontSize: big ? 16 : 14, opacity: 0.85, lineHeight: 1.4 }}>{p.tagline}</div>
      </div>
    </div>
  );
}

export function Home() {
  return (
    <Layout>
      <section style={{ padding: "120px 0 100px", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
          An independent app studio
        </div>
        <h1 style={{
          fontSize: "clamp(48px, 7vw, 88px)", fontFamily: font.display,
          fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05,
          margin: "0 auto 24px", maxWidth: 920,
        }}>
          Small tools that make big work possible.
        </h1>
        <p style={{
          fontSize: 20, color: M.muted, maxWidth: 640, margin: "0 auto 40px",
          lineHeight: 1.5,
        }}>
          Tinkerboxxx builds focused software for creators, writers, and the people who ship things without a team behind them.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn to="/products">See our products</Btn>
          <Btn to="/about" variant="ghost">Our story</Btn>
        </div>
      </section>

      <section style={{ padding: "60px 0" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}>
          {PRODUCTS.map(p => <ProductTile key={p.key} p={p} />)}
        </div>
      </section>

      <section style={{ padding: "100px 0", textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
          Our approach
        </div>
        <h2 style={{ fontSize: 40, fontFamily: font.display, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 20, lineHeight: 1.15 }}>
          We ship things we actually use.
        </h2>
        <p style={{ fontSize: 18, color: M.muted, lineHeight: 1.6 }}>
          Every product in the studio began as something we needed and couldn't buy off the shelf. If it doesn't earn its place in daily use, it doesn't ship.
        </p>
      </section>
    </Layout>
  );
}

export function Products() {
  return (
    <Layout>
      <section style={{ padding: "100px 0 60px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Products
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", fontFamily: font.display, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0, maxWidth: 820 }}>
          A studio of focused tools.
        </h1>
        <p style={{ fontSize: 19, color: M.muted, maxWidth: 640, marginTop: 20, lineHeight: 1.5 }}>
          Each product solves one problem well. Most began as internal tooling and grew from there.
        </p>
      </section>

      <section style={{ padding: "20px 0 40px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}>
          {PRODUCTS.map(p => <ProductTile key={p.key} p={p} />)}
        </div>
      </section>
    </Layout>
  );
}

export function About() {
  return (
    <Layout>
      <section style={{ padding: "100px 0 60px", maxWidth: 820 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          About
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", fontFamily: font.display, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
          Building software the way small studios used to.
        </h1>
        <p style={{ fontSize: 19, color: M.muted, marginTop: 24, lineHeight: 1.6 }}>
          Tinkerboxxx is an independent app studio. We build tools that started as things we needed ourselves and grew into products other makers use every day. No investors, no growth-at-all-costs mandate, no products we would not use.
        </p>
      </section>

      <section style={{ padding: "60px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 24 }}>
          What we believe
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {VALUES.map(v => (
            <div key={v.title} style={{
              background: M.card, borderRadius: 20, padding: "32px 28px",
              border: `1px solid ${M.divider}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: font.display, letterSpacing: "-0.01em", marginBottom: 12 }}>
                {v.title}
              </div>
              <div style={{ fontSize: 15, color: M.muted, lineHeight: 1.6 }}>
                {v.body}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}

export function Careers() {
  return (
    <Layout>
      <section style={{ padding: "100px 0 60px", maxWidth: 820 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Careers
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", fontFamily: font.display, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
          A studio of one, for now.
        </h1>
        <p style={{ fontSize: 19, color: M.muted, marginTop: 24, lineHeight: 1.6 }}>
          Tinkerboxxx currently runs as a solo studio. When that changes, open roles will appear on this page. In the meantime, here is what we look for in the people we work with.
        </p>
      </section>

      <section style={{ padding: "40px 0" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {[
            { title: "Range over specialisation", body: "We prize people who can ship end-to-end. Frontend, backend, design, and copy in the same afternoon." },
            { title: "Judgement over process", body: "We hire people we can trust to make the call, not people who need one." },
            { title: "Kind and direct", body: "We say the useful thing without dressing it up. And we do it with warmth." },
          ].map(v => (
            <div key={v.title} style={{
              background: "#fff", borderRadius: 20, padding: "32px 28px",
              border: `1px solid ${M.divider}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: font.display, letterSpacing: "-0.01em", marginBottom: 12 }}>
                {v.title}
              </div>
              <div style={{ fontSize: 15, color: M.muted, lineHeight: 1.6 }}>
                {v.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "40px 0 60px", maxWidth: 640 }}>
        <p style={{ fontSize: 16, color: M.muted, lineHeight: 1.6 }}>
          Recognise yourself in the above? Get in touch anyway. We keep a short list of people we would love to work with when the time is right.
        </p>
        <div style={{ marginTop: 24 }}>
          <Btn to="/contact">Say hello</Btn>
        </div>
      </section>
    </Layout>
  );
}

export function Contact() {
  return (
    <Layout>
      <section style={{ padding: "100px 0 60px", maxWidth: 720 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Contact
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", fontFamily: font.display, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
          Talk to us.
        </h1>
        <p style={{ fontSize: 19, color: M.muted, marginTop: 24, lineHeight: 1.6 }}>
          Product feedback, press, partnerships, or just a hello. Email is the quickest way to reach a human.
        </p>
      </section>

      <section style={{ padding: "20px 0 40px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {[
            { label: "General", value: "hello@tinkerboxxx.com", href: "mailto:hello@tinkerboxxx.com" },
            { label: "Support", value: "support@tinkerboxxx.com", href: "mailto:support@tinkerboxxx.com" },
            { label: "Press", value: "press@tinkerboxxx.com", href: "mailto:press@tinkerboxxx.com" },
          ].map(c => (
            <a key={c.label} href={c.href} style={{
              display: "block", background: M.card, borderRadius: 20, padding: "28px 24px",
              border: `1px solid ${M.divider}`, textDecoration: "none",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: M.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: M.ink, fontFamily: font.body }}>
                {c.value}
              </div>
            </a>
          ))}
        </div>
      </section>
    </Layout>
  );
}

export function NotFound() {
  return (
    <Layout>
      <section style={{ padding: "160px 0", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: M.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
          Page not found
        </div>
        <h1 style={{ fontSize: 56, fontFamily: font.display, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
          We could not find that page.
        </h1>
        <p style={{ fontSize: 17, color: M.muted, marginBottom: 32 }}>The link may be stale or the page may have moved.</p>
        <Btn to="/">Back to home</Btn>
      </section>
    </Layout>
  );
}
