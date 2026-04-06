import Link from 'next/link'
import { getMatches } from '@/lib/queries'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}

export default async function HomePage() {
  let upcoming: any[] = []
  let recent: any[] = []

  try {
    const [u, r] = await Promise.all([
      getMatches('upcoming'),
      getMatches('completed'),
    ])
    upcoming = u.slice(0, 3)
    recent = r.slice(0, 3)
  } catch (_) {}

  return (
    <>
      <style>{`
        /* ── HERO ── */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: var(--nav-h) 0 0;
          background: linear-gradient(180deg, #060f22 0%, #050c1a 60%);
        }

        /* Radial glows */
        .hero-glow-1 {
          position: absolute;
          top: -100px; right: -100px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 65%);
          pointer-events: none;
        }
        .hero-glow-2 {
          position: absolute;
          bottom: -80px; left: 5%;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 60%);
          pointer-events: none;
        }

        /* Animated ring decoration */
        .hero-ring {
          position: absolute;
          top: 50%; right: 8%;
          transform: translateY(-50%);
          width: 480px; height: 480px;
          border-radius: 50%;
          border: 1px solid rgba(59,130,246,0.1);
          pointer-events: none;
        }
        .hero-ring::before {
          content: '';
          position: absolute;
          inset: 48px;
          border-radius: 50%;
          border: 1px solid rgba(59,130,246,0.06);
        }
        .hero-ring::after {
          content: '';
          position: absolute;
          top: -4px; left: calc(50% - 4px);
          width: 8px; height: 8px; border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 20px 6px rgba(59,130,246,0.5);
          animation: orbit 10s linear infinite;
          transform-origin: 4px 244px;
        }
        @keyframes orbit { to { transform: rotate(360deg); } }

        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 24px 100px;
        }

        @media (max-width: 768px) {
          .hero-ring { display: none; }
          .hero-content { padding: 48px 16px 64px; }
          .hero-stat-num { font-size: 30px; }
          .hero-stat { padding-right: 28px; margin-right: 28px; }
          .hero-stats { margin-top: 52px; }
        }
        @media (max-width: 480px) {
          .hero-content { padding: 36px 0 52px; }
          .hero-stats { margin-top: 36px; padding-top: 24px; gap: 0; flex-wrap: nowrap; }
          .hero-stat { padding-right: 20px; margin-right: 20px; }
          .hero-stat-num { font-size: 24px; }
          .hero-stat-label { font-size: 9px; }
          .preview-section { padding: 48px 0 60px; }
          .footer-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
          .footer-links { flex-wrap: wrap; margin-left: -8px; }
          .cta-section { padding: 56px 20px; }
          .hero-sub { font-size: 15px; }
          .hero-actions { gap: 10px; }
          .hero-actions .btn { flex: 1; justify-content: center; min-width: 0; }
        }

        .hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }
        .hero-eyebrow-line {
          width: 28px; height: 1px;
          background: linear-gradient(90deg, #38bdf8, transparent);
        }
        .hero-eyebrow-text {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #38bdf8;
        }

        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(52px, 9vw, 108px);
          font-weight: 800;
          line-height: 0.92;
          letter-spacing: -0.03em;
          margin-bottom: 32px;
          color: #f0f8ff;
        }
        .hero-title .accent {
          background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 60%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-title .dim {
          color: rgba(147,197,253,0.35);
        }

        .hero-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 17px;
          color: rgba(147,197,253,0.65);
          max-width: 500px;
          margin-bottom: 44px;
          line-height: 1.7;
          font-weight: 400;
        }

        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }

        .hero-stats {
          display: flex;
          gap: 0;
          margin-top: 80px;
          padding-top: 36px;
          border-top: 1px solid rgba(59,130,246,0.12);
          flex-wrap: wrap;
        }
        .hero-stat {
          padding-right: 48px;
          margin-right: 48px;
          border-right: 1px solid rgba(59,130,246,0.12);
        }
        .hero-stat:last-child { border-right: none; padding-right: 0; margin-right: 0; }
        .hero-stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 40px;
          font-weight: 800;
          color: #93c5fd;
          line-height: 1;
          margin-bottom: 6px;
        }
        .hero-stat-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(147,197,253,0.4);
        }

        /* ── ABOUT SECTION ── */
        .about-section { border-bottom: 1px solid rgba(59,130,246,0.1); }
        .about-lead {
          font-family: 'Outfit', sans-serif; font-size: 17px;
          color: rgba(147,197,253,0.65); max-width: 620px;
          line-height: 1.75; margin-top: 20px;
        }
        .about-card { padding: 28px 24px; }
        .about-card-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(37,99,235,0.15); border: 1px solid rgba(59,130,246,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; margin-bottom: 18px;
        }
        .about-card-label {
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.01em; margin-bottom: 8px;
        }
        .about-card-text {
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(147,197,253,0.55); line-height: 1.6;
        }
        @media (max-width: 768px) {
          .about-lead { font-size: 15px; }
          .about-section { padding: 48px 0; }
        }

        /* ── MATCH PREVIEW SECTION ── */
        .preview-section {
          padding: 80px 0 90px;
        }
        .preview-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 768px) { .preview-grid { grid-template-columns: 1fr; } }

        .preview-col-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .preview-col-title {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #e2eeff;
          letter-spacing: -0.01em;
        }
        .preview-col-link {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #3b82f6;
          text-decoration: none;
          display: flex; align-items: center; gap: 4px;
          transition: color 0.15s, gap 0.15s;
        }
        .preview-col-link:hover { color: #60a5fa; gap: 8px; }

        .preview-card-list {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }
        .preview-card-list::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);
        }

        .match-row {
          display: flex;
          align-items: center;
          padding: 0;
          border-bottom: 1px solid rgba(59,130,246,0.08);
          text-decoration: none;
          transition: background 0.15s;
        }
        .match-row:last-child { border-bottom: none; }
        .match-row:hover { background: rgba(37,99,235,0.05); }
        .match-row-accent {
          width: 3px;
          align-self: stretch;
          background: linear-gradient(180deg, #2563eb, #38bdf8);
          flex-shrink: 0;
        }
        .match-row-body {
          flex: 1;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .match-vs {
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #e2eeff;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }
        .match-meta {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          color: rgba(147,197,253,0.5);
        }
        .match-badge {
          padding: 3px 9px; border-radius: 5px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.2);
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #60a5fa; white-space: nowrap;
        }
        .match-result {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          color: #38bdf8; white-space: nowrap;
          padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
        }

        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: rgba(147,197,253,0.35);
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          line-height: 1.6;
        }

        /* ── CTA ── */
        .cta-section {
          position: relative;
          overflow: hidden;
          padding: 80px 24px;
          text-align: center;
          background: linear-gradient(135deg, #0f2044 0%, #0a1a36 50%, #071428 100%);
          border-top: 1px solid rgba(59,130,246,0.15);
          border-bottom: 1px solid rgba(59,130,246,0.15);
        }
        .cta-section::before {
          content: '';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 600px; height: 400px;
          background: radial-gradient(ellipse, rgba(37,99,235,0.15) 0%, transparent 65%);
          pointer-events: none;
        }
        .cta-inner { position: relative; z-index: 1; }
        .cta-eyebrow {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: #38bdf8; margin-bottom: 20px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .cta-eyebrow::before, .cta-eyebrow::after {
          content: '';
          display: inline-block;
          width: 24px; height: 1px;
          background: #38bdf8;
        }
        .cta-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.02em;
          margin-bottom: 16px;
        }
        .cta-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          color: rgba(147,197,253,0.6);
          margin-bottom: 36px;
          font-weight: 400;
        }

        /* ── FOOTER ── */
        footer {
          background: #040a18;
          border-top: 1px solid rgba(59,130,246,0.1);
          padding: 40px 0;
        }
        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .footer-logo {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: #e2eeff;
          letter-spacing: -0.01em;
          display: flex; align-items: center; gap: 8px;
        }
        .footer-logo-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
        }
        .footer-links {
          display: flex;
          gap: 4px;
          list-style: none;
        }
        .footer-links a {
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: rgba(147,197,253,0.45);
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .footer-links a:hover { color: #93c5fd; background: rgba(37,99,235,0.08); }
        .footer-copy {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          color: rgba(147,197,253,0.3);
          letter-spacing: 0.05em;
        }
      `}</style>

      {/* HERO */}
      <section className="hero">
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
        <div className="hero-ring" />
        <div className="hero-content">
          <div className="hero-eyebrow fade-up fade-up-1">
            <div className="hero-eyebrow-line" />
            <span className="hero-eyebrow-text">Officially the best 50-over club in South Africa</span>
          </div>
          <div className="hero-title fade-up fade-up-1">
            <span className="dim">Bedfordview</span><br />
            <span className="accent">Cricket</span><br />
            Club
          </div>
          <p className="hero-sub fade-up fade-up-2">
            Competitive cricket in the heart of Bedfordview, Gauteng — proudly competing in the Easterns Cricket League.
          </p>
          <div className="hero-actions fade-up fade-up-3">
            <Link href="/register" className="btn btn-primary">Join the Club</Link>
            <Link href="/fixtures" className="btn btn-ghost">View Fixtures</Link>
          </div>
          <div className="hero-stats fade-up fade-up-3">
            {[
              { num: '50',   label: 'Over Format' },
              { num: 'Easterns', label: 'League' },
              { num: new Date().getFullYear().toString(), label: 'Season' },
            ].map(s => (
              <div key={s.label} className="hero-stat">
                <div className="hero-stat-num">{s.num}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section about-section">
        <div className="container">
          <div className="section-label">About BCC</div>
          <h2>More Than Just Cricket</h2>
          <p className="about-lead">
            Bedfordview Cricket Club is a competitive club based in Bedfordview, Gauteng,
            proudly competing in the Easterns Cricket League. We've established ourselves
            as South Africa's premier 50-over cricket club — a team that plays hard,
            wins together, and welcomes anyone who shares a passion for the game.
          </p>
          <div className="grid-3" style={{ marginTop: 40 }}>
            <div className="card about-card">
              <div className="about-card-icon">📍</div>
              <div className="about-card-label">Where We Play</div>
              <div className="about-card-text">Van Buuren Rd, Bedfordview Extensions, Gauteng</div>
            </div>
            <div className="card about-card">
              <div className="about-card-icon">🏆</div>
              <div className="about-card-label">Our League</div>
              <div className="about-card-text">Easterns Cricket League — South Africa</div>
            </div>
            <div className="card about-card">
              <div className="about-card-icon">🏏</div>
              <div className="about-card-label">Our Format</div>
              <div className="about-card-text">50-over cricket — officially the best in South Africa</div>
            </div>
          </div>
        </div>
      </section>

      {/* FIXTURES + RESULTS */}
      <section className="preview-section">
        <div className="container">
          <div className="preview-grid">
            {/* UPCOMING */}
            <div>
              <div className="preview-col-header">
                <div className="preview-col-title">Upcoming</div>
                <Link href="/fixtures" className="preview-col-link">All Fixtures →</Link>
              </div>
              <div className="preview-card-list">
                {upcoming.length === 0 ? (
                  <div className="empty-state">No upcoming fixtures scheduled.</div>
                ) : upcoming.map(m => (
                  <div key={m.id} className="match-row">
                    <div className="match-row-accent" />
                    <div className="match-row-body">
                      <div>
                        <div className="match-vs">{m.home_team} vs {m.away_team}</div>
                        <div className="match-meta">{formatDate(m.date)}{m.venue ? ` · ${m.venue}` : ''}</div>
                      </div>
                      <span className="match-badge">{m.overs === 20 ? 'T20' : `${m.overs}ov`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECENT RESULTS */}
            <div>
              <div className="preview-col-header">
                <div className="preview-col-title">Results</div>
                <Link href="/results" className="preview-col-link">All Results →</Link>
              </div>
              <div className="preview-card-list">
                {recent.length === 0 ? (
                  <div className="empty-state">No results recorded yet.</div>
                ) : recent.map(m => (
                  <Link href={`/results/${m.id}`} key={m.id} className="match-row">
                    <div className="match-row-accent" style={{ background: 'linear-gradient(180deg, #0ea5e9, #6366f1)' }} />
                    <div className="match-row-body">
                      <div>
                        <div className="match-vs">{m.home_team} vs {m.away_team}</div>
                        <div className="match-meta">{formatDate(m.date)} · {m.overs} overs</div>
                      </div>
                      {m.result && <div className="match-result">{m.result}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JOIN CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="cta-eyebrow">Get involved</div>
          <div className="cta-title">Ready to Join the Best?</div>
          <p className="cta-sub">Register today and become part of South Africa's finest 50-over club.</p>
          <Link href="/register" className="btn btn-primary">
            Register Now
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-logo">
            <div className="footer-logo-dot" />
            Bedfordview CC
          </div>
          <ul className="footer-links">
            {['Fixtures', 'Results', 'Stats', 'Gallery', 'Contact'].map(l => (
              <li key={l}><Link href={`/${l.toLowerCase()}`}>{l}</Link></li>
            ))}
          </ul>
          <div className="footer-copy">© {new Date().getFullYear()} Bedfordview Cricket Club. All rights reserved.</div>
        </div>
      </footer>
    </>
  )
}
