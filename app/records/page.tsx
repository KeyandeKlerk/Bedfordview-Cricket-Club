import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const revalidate = 300

// ── Types ─────────────────────────────────────────────────────────────────────

interface BattingRecord {
  player_id: string
  player_name: string
  total_runs: number
  average: number | null
  highest_score: number | null
  hundreds: number
  fifties: number
  innings: number
}

interface BowlingRecord {
  player_id: string
  player_name: string
  wickets: number
  average: number | null
  economy: number | null
  legal_balls: number
}

interface BowlingInningsRecord {
  player_id: string
  player_name: string
  wickets: number
  runs_conceded: number
  legal_balls: number
  innings_id: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, dp = 1): string {
  if (n == null || !isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(dp)
}

function overs(balls: number): string {
  const ov = Math.floor(balls / 6)
  const rem = balls % 6
  return rem === 0 ? String(ov) : `${ov}.${rem}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const cat = category === 'senior' || category === 'junior' ? category : null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withCat(q: any) { return cat ? q.eq('team_category', cat) : q }

  const [
    { data: runScorers },
    { data: highestScores },
    { data: wicketTakers },
    { data: bestBowling },
  ] = await Promise.all([
    withCat(supabase
      .from('career_batting_stats')
      .select('player_id, player_name, total_runs, average, highest_score, hundreds, fifties, innings'))
      .order('total_runs', { ascending: false })
      .limit(10),
    withCat(supabase
      .from('career_batting_stats')
      .select('player_id, player_name, total_runs, average, highest_score, hundreds, fifties, innings'))
      .order('highest_score', { ascending: false, nullsFirst: false })
      .limit(5),
    withCat(supabase
      .from('career_bowling_stats')
      .select('player_id, player_name, wickets, average, economy, legal_balls'))
      .order('wickets', { ascending: false })
      .limit(10),
    withCat(supabase
      .from('bowling_scorecard')
      .select('player_id, player_name, wickets, runs_conceded, legal_balls, innings_id')
      .not('player_id', 'is', null))
      .order('wickets', { ascending: false })
      .order('runs_conceded', { ascending: true })
      .limit(10),
  ])

  const rs = (runScorers ?? []) as BattingRecord[]
  const hs = (highestScores ?? []) as BattingRecord[]
  const wt = (wicketTakers ?? []) as BowlingRecord[]
  const bb = (bestBowling ?? []) as BowlingInningsRecord[]

  return (
    <>
      <style>{`
        /* ── PAGE ── */
        .records-page {
          padding-top: var(--nav-h);
          min-height: 100vh;
          padding-bottom: 80px;
        }

        /* ── HERO ── */
        .records-hero {
          padding: 56px 0 48px;
          border-bottom: 1px solid var(--border);
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
        }
        .records-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 65% 40%, rgba(37,99,235,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .records-hero::after {
          content: '';
          position: absolute;
          bottom: -1px; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent);
        }
        .records-hero-inner { position: relative; z-index: 1; }
        .records-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky);
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 10px;
        }
        .records-eyebrow::before {
          content: '';
          display: inline-block;
          width: 20px; height: 1px;
          background: var(--sky);
        }
        .records-hero-title {
          font-family: var(--font-display);
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.03em;
          line-height: 1;
          margin-bottom: 14px;
        }
        .records-hero-sub {
          font-family: var(--font-body);
          font-size: 15px;
          color: rgba(147,197,253,0.5);
          max-width: 480px;
          margin-bottom: 28px;
        }
        .cat-tabs {
          display: inline-flex;
          gap: 6px;
          background: rgba(6,15,34,0.6);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 10px;
          padding: 4px;
        }
        .cat-tab {
          padding: 7px 18px;
          border-radius: 7px;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.02em;
          text-decoration: none;
          color: rgba(147,197,253,0.5);
          transition: color 0.15s, background 0.15s;
        }
        .cat-tab:hover { color: #e2eeff; background: rgba(37,99,235,0.1); }
        .cat-tab.active {
          background: rgba(37,99,235,0.25);
          color: #93c5fd;
          border: 1px solid rgba(59,130,246,0.3);
        }
        .cat-tab.active-junior {
          background: rgba(16,185,129,0.18);
          color: #6ee7b7;
          border: 1px solid rgba(16,185,129,0.3);
        }

        /* ── BODY ── */
        .records-body { padding: 52px 0; }

        /* ── GRID ── */
        .records-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .records-grid { grid-template-columns: 1fr; }
        }

        /* ── CARD ── */
        .rec-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.14);
          border-radius: 14px;
          overflow: hidden;
          position: relative;
        }
        .rec-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent);
          pointer-events: none;
        }

        /* ── CARD HEADER ── */
        .rec-header {
          padding: 16px 22px;
          background: rgba(6,15,34,0.7);
          border-bottom: 1px solid rgba(59,130,246,0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .rec-header-left { display: flex; flex-direction: column; gap: 2px; }
        .rec-header-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
        }
        .rec-header-title {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 800;
          color: #e2eeff;
          letter-spacing: -0.01em;
        }
        .rec-header-icon {
          font-size: 22px;
          opacity: 0.6;
          flex-shrink: 0;
        }

        /* ── LEADERBOARD ROW ── */
        .rec-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 22px;
          border-bottom: 1px solid rgba(59,130,246,0.07);
          transition: background 0.15s;
        }
        .rec-row:last-child { border-bottom: none; }
        .rec-row:hover { background: rgba(37,99,235,0.05); }

        /* Gold highlight for top row */
        .rec-row--top {
          background: rgba(245,158,11,0.05);
          border-bottom: 1px solid rgba(245,158,11,0.1);
        }
        .rec-row--top:hover { background: rgba(245,158,11,0.09); }

        .rec-rank {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          color: rgba(147,197,253,0.3);
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }
        .rec-row--top .rec-rank { color: #f59e0b; }

        .rec-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: #e2eeff;
          letter-spacing: -0.01em;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rec-row--top .rec-name { color: #fff; }

        .rec-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-shrink: 0;
        }

        .rec-stat {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }
        .rec-stat-val {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 800;
          color: #60a5fa;
          line-height: 1;
        }
        .rec-row--top .rec-stat-val { color: #fbbf24; }
        .rec-stat-lbl {
          font-family: var(--font-body);
          font-size: 9px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(147,197,253,0.3);
        }

        /* Secondary stats (avg, hs) — slightly dimmer */
        .rec-stat--secondary .rec-stat-val {
          font-size: 13px;
          color: rgba(147,197,253,0.65);
          font-weight: 700;
        }
        .rec-row--top .rec-stat--secondary .rec-stat-val {
          color: rgba(251,191,36,0.7);
        }

        /* ── FEATURED ROW (Highest Score card) ── */
        .rec-featured {
          padding: 20px 22px 16px;
          border-bottom: 1px solid rgba(59,130,246,0.07);
          background: rgba(56,189,248,0.04);
          position: relative;
        }
        .rec-featured::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, var(--sky), rgba(56,189,248,0.3));
          border-radius: 0 2px 2px 0;
        }
        .rec-featured-name {
          font-family: var(--font-display);
          font-size: 20px; font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .rec-featured-score {
          font-family: var(--font-display);
          font-size: 48px; font-weight: 800;
          color: var(--sky);
          line-height: 1;
          letter-spacing: -0.03em;
          margin-bottom: 6px;
        }
        .rec-featured-meta {
          font-family: var(--font-body);
          font-size: 11px;
          color: rgba(147,197,253,0.4);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
        }

        /* ── COMPACT HS ROW (entries 2-5) ── */
        .rec-hs-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 11px 22px;
          border-bottom: 1px solid rgba(59,130,246,0.07);
          transition: background 0.15s;
        }
        .rec-hs-row:last-child { border-bottom: none; }
        .rec-hs-row:hover { background: rgba(37,99,235,0.05); }

        .rec-hs-rank {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          color: rgba(147,197,253,0.3);
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }
        .rec-hs-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: #e2eeff;
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rec-hs-score {
          font-family: var(--font-display);
          font-size: 18px; font-weight: 800;
          color: #38bdf8;
          flex-shrink: 0;
        }
        .rec-hs-avg {
          font-family: var(--font-body);
          font-size: 12px;
          color: rgba(147,197,253,0.45);
          flex-shrink: 0;
          min-width: 52px;
          text-align: right;
        }

        /* ── FIGURES row (Best Bowling) ── */
        .rec-bowl-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 11px 22px;
          border-bottom: 1px solid rgba(59,130,246,0.07);
          transition: background 0.15s;
        }
        .rec-bowl-row:last-child { border-bottom: none; }
        .rec-bowl-row:hover { background: rgba(37,99,235,0.05); }
        .rec-bowl-row--top {
          background: rgba(245,158,11,0.05);
          border-bottom: 1px solid rgba(245,158,11,0.1);
        }
        .rec-bowl-row--top:hover { background: rgba(245,158,11,0.09); }

        .rec-bowl-rank {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          color: rgba(147,197,253,0.3);
          width: 20px; text-align: center; flex-shrink: 0;
        }
        .rec-bowl-row--top .rec-bowl-rank { color: #f59e0b; }

        .rec-bowl-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: #e2eeff;
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rec-bowl-row--top .rec-bowl-name { color: #fff; }

        .rec-bowl-figures {
          font-family: var(--font-display);
          font-size: 18px; font-weight: 800;
          color: #60a5fa;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }
        .rec-bowl-row--top .rec-bowl-figures { color: #fbbf24; }

        .rec-bowl-detail {
          font-family: var(--font-body);
          font-size: 11px;
          color: rgba(147,197,253,0.35);
          flex-shrink: 0;
          text-align: right;
          min-width: 52px;
        }

        /* ── EMPTY STATE ── */
        .rec-empty {
          padding: 40px 22px;
          text-align: center;
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(147,197,253,0.3);
        }

        /* ── MOBILE ── */
        @media (max-width: 540px) {
          .records-hero { padding: 36px 0 28px; }
          .records-body { padding: 32px 0; }
          .records-grid { gap: 16px; }
          .rec-row { padding: 12px 16px; gap: 10px; }
          .rec-featured { padding: 16px 16px 14px; }
          .rec-hs-row { padding: 10px 16px; gap: 10px; }
          .rec-bowl-row { padding: 10px 16px; gap: 10px; }
          .rec-header { padding: 14px 16px; }
          .rec-stats { gap: 10px; }
          .rec-featured-score { font-size: 40px; }
        }
        @media (max-width: 380px) {
          .rec-stats { gap: 8px; }
          .rec-stat-val { font-size: 13px; }
          .rec-stat--secondary .rec-stat-val { font-size: 12px; }
        }
      `}</style>

      <div className="records-page">

        {/* ── HERO ── */}
        <div className="records-hero">
          <div className="container">
            <div className="records-hero-inner">
              <div className="records-eyebrow">Records</div>
              <h1 className="records-hero-title">Club Records</h1>
              <p className="records-hero-sub">All-time bests for Bedfordview Cricket Club</p>
              <div className="cat-tabs">
                <Link href="/records" className={`cat-tab${!cat ? ' active' : ''}`}>All</Link>
                <Link href="/records?category=senior" className={`cat-tab${cat === 'senior' ? ' active' : ''}`}>Senior</Link>
                <Link href="/records?category=junior" className={`cat-tab${cat === 'junior' ? ' active-junior' : ''}`}>Junior</Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="records-body">
          <div className="container">
            <div className="records-grid">

              {/* ── 1. Top Run Scorers ── */}
              <div className="rec-card">
                <div className="rec-header">
                  <div className="rec-header-left">
                    <span className="rec-header-label">Batting</span>
                    <span className="rec-header-title">Run Scorers</span>
                  </div>
                  <span className="rec-header-icon">🏏</span>
                </div>

                {rs.length === 0 ? (
                  <div className="rec-empty">No batting records yet.</div>
                ) : (
                  rs.map((p, i) => (
                    <Link
                      key={p.player_id}
                      href={`/stats/${p.player_id}`}
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      <div className={`rec-row${i === 0 ? ' rec-row--top' : ''}`}>
                        <span className="rec-rank">{i + 1}</span>
                        <span className="rec-name">{p.player_name}</span>
                        <div className="rec-stats">
                          <div className="rec-stat">
                            <span className="rec-stat-val">{p.total_runs}</span>
                            <span className="rec-stat-lbl">Runs</span>
                          </div>
                          <div className="rec-stat rec-stat--secondary">
                            <span className="rec-stat-val">{fmt(p.average)}</span>
                            <span className="rec-stat-lbl">Avg</span>
                          </div>
                          <div className="rec-stat rec-stat--secondary">
                            <span className="rec-stat-val">{p.highest_score ?? '—'}</span>
                            <span className="rec-stat-lbl">HS</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {/* ── 2. Highest Individual Scores ── */}
              <div className="rec-card">
                <div className="rec-header">
                  <div className="rec-header-left">
                    <span className="rec-header-label">Batting</span>
                    <span className="rec-header-title">Highest Scores</span>
                  </div>
                  <span className="rec-header-icon">⭐</span>
                </div>

                {hs.length === 0 ? (
                  <div className="rec-empty">No batting records yet.</div>
                ) : (
                  <>
                    {/* Featured top score */}
                    <Link
                      href={`/stats/${hs[0].player_id}`}
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      <div className="rec-featured">
                        <div className="rec-featured-name">{hs[0].player_name}</div>
                        <div className="rec-featured-score">{hs[0].highest_score ?? '—'}</div>
                        <div className="rec-featured-meta">
                          Career avg {fmt(hs[0].average)} &nbsp;&middot;&nbsp; {hs[0].innings} inns
                        </div>
                      </div>
                    </Link>

                    {/* Remaining entries */}
                    {hs.slice(1).map((p, i) => (
                      <Link
                        key={p.player_id}
                        href={`/stats/${p.player_id}`}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <div className="rec-hs-row">
                          <span className="rec-hs-rank">{i + 2}</span>
                          <span className="rec-hs-name">{p.player_name}</span>
                          <span className="rec-hs-score">{p.highest_score ?? '—'}</span>
                          <span className="rec-hs-avg">avg {fmt(p.average)}</span>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>

              {/* ── 3. Wicket Takers ── */}
              <div className="rec-card">
                <div className="rec-header">
                  <div className="rec-header-left">
                    <span className="rec-header-label">Bowling</span>
                    <span className="rec-header-title">Wicket Takers</span>
                  </div>
                  <span className="rec-header-icon">🎯</span>
                </div>

                {wt.length === 0 ? (
                  <div className="rec-empty">No bowling records yet.</div>
                ) : (
                  wt.map((p, i) => (
                    <Link
                      key={p.player_id}
                      href={`/stats/${p.player_id}`}
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      <div className={`rec-row${i === 0 ? ' rec-row--top' : ''}`}>
                        <span className="rec-rank">{i + 1}</span>
                        <span className="rec-name">{p.player_name}</span>
                        <div className="rec-stats">
                          <div className="rec-stat">
                            <span className="rec-stat-val">{p.wickets}</span>
                            <span className="rec-stat-lbl">Wkts</span>
                          </div>
                          <div className="rec-stat rec-stat--secondary">
                            <span className="rec-stat-val">{fmt(p.average)}</span>
                            <span className="rec-stat-lbl">Avg</span>
                          </div>
                          <div className="rec-stat rec-stat--secondary">
                            <span className="rec-stat-val">{fmt(p.economy)}</span>
                            <span className="rec-stat-lbl">Econ</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {/* ── 4. Best Bowling Figures ── */}
              <div className="rec-card">
                <div className="rec-header">
                  <div className="rec-header-left">
                    <span className="rec-header-label">Bowling</span>
                    <span className="rec-header-title">Best Figures</span>
                  </div>
                  <span className="rec-header-icon">🔥</span>
                </div>

                {bb.length === 0 ? (
                  <div className="rec-empty">No bowling records yet.</div>
                ) : (
                  bb.map((p, i) => (
                    <Link
                      key={`${p.innings_id}-${i}`}
                      href={`/stats/${p.player_id}`}
                      style={{ textDecoration: 'none', display: 'block' }}
                    >
                      <div className={`rec-bowl-row${i === 0 ? ' rec-bowl-row--top' : ''}`}>
                        <span className="rec-bowl-rank">{i + 1}</span>
                        <span className="rec-bowl-name">{p.player_name}</span>
                        <span className="rec-bowl-figures">
                          {p.wickets}/{p.runs_conceded}
                        </span>
                        <span className="rec-bowl-detail">
                          {overs(p.legal_balls)} ov
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </>
  )
}
