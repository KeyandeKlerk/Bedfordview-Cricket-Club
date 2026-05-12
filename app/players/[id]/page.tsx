import { anonSupabase as supabase } from '@/lib/supabase/server'
import { fmt, overs } from '@/lib/stats/formatters'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const revalidate = 60

// ── Types ──────────────────────────────────────────────────────────────────────

interface Player {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  batting_style: string | null
  bowling_style: string | null
  is_active: boolean
  jersey_number: number | null
}

interface CareerBatting {
  player_id: string
  innings: number
  not_outs: number
  total_runs: number
  highest_score: number | null
  fifties: number
  hundreds: number
  average: number | null
  strike_rate: number | null
}

interface CareerBowling {
  player_id: string
  legal_balls: number
  runs_conceded: number
  wickets: number
  economy: number | null
}

interface BattingScorecard {
  player_id: string
  player_name: string
  runs: number | null
  balls_faced: number | null
  fours: number | null
  sixes: number | null
  dismissal_type: string | null
  innings_id: string
}

interface BowlingScorecard {
  player_id: string
  player_name: string
  legal_balls: number
  runs_conceded: number
  wickets: number
  wides: number
  no_balls: number
  innings_id: string
}

/** Compute best figures (most wickets, fewest runs on tie) from bowling rows */
function computeBestFigures(rows: BowlingScorecard[]): string {
  if (!rows.length) return '—'
  let best: BowlingScorecard | null = null
  for (const r of rows) {
    if (!best) { best = r; continue }
    if (r.wickets > best.wickets) { best = r; continue }
    if (r.wickets === best.wickets && r.runs_conceded < best.runs_conceded) { best = r }
  }
  return best ? `${best.wickets}/${best.runs_conceded}` : '—'
}


// ── Score chip color ───────────────────────────────────────────────────────────

function scoreChipStyle(runs: number | null): { bg: string; color: string } {
  if (runs == null) return { bg: 'rgba(59,130,246,0.08)', color: 'rgba(147,197,253,0.5)' }
  if (runs >= 50) return { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' }
  if (runs >= 25) return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
  if (runs < 10)  return { bg: 'rgba(239,68,68,0.13)', color: '#f87171' }
  return { bg: 'rgba(59,130,246,0.10)', color: 'rgba(147,197,253,0.75)' }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: playerId } = await params

  const [
    { data: playerData },
    { data: careerBat },
    { data: careerBowl },
    { data: battingRows },
    { data: bowlingRows },
  ] = await Promise.all([
    supabase
      .from('players')
      .select('id, first_name, last_name, nickname, batting_style, bowling_style, is_active, jersey_number')
      .eq('id', playerId)
      .single(),
    supabase
      .from('career_batting_stats')
      .select('player_id, innings, not_outs, total_runs, highest_score, fifties, hundreds, average, strike_rate')
      .eq('player_id', playerId)
      .maybeSingle(),
    supabase
      .from('career_bowling_stats')
      .select('player_id, legal_balls, runs_conceded, wickets, economy')
      .eq('player_id', playerId)
      .maybeSingle(),
    supabase
      .from('batting_scorecard')
      .select('player_id, player_name, runs, balls_faced, fours, sixes, dismissal_type, innings_id')
      .eq('player_id', playerId)
      .order('innings_id', { ascending: false })
      .limit(10),
    supabase
      .from('bowling_scorecard')
      .select('player_id, player_name, legal_balls, runs_conceded, wickets, wides, no_balls, innings_id')
      .eq('player_id', playerId)
      .order('innings_id', { ascending: false })
      .limit(10),
  ])

  if (!playerData) notFound()

  const player = playerData as Player
  const bat = careerBat as CareerBatting | null
  const bowl = careerBowl as CareerBowling | null
  const batLog = (battingRows ?? []) as BattingScorecard[]
  const bowlLog = (bowlingRows ?? []) as BowlingScorecard[]

  const hasBatting = bat && (bat.innings ?? 0) > 0
  const hasBowling = bowl && (bowl.wickets ?? 0) > 0

  const recentBat = batLog.slice(0, 5)
  const recentBowlWithWickets = bowlLog.filter(r => r.wickets > 0).slice(0, 5)

  const initials =
    (player.first_name?.[0] ?? '') + (player.last_name?.[0] ?? '')

  return (
    <>
      <style>{`
        .pp-page {
          padding-top: var(--nav-h);
          min-height: 100vh;
          padding-bottom: 80px;
        }

        /* ── Hero ── */
        .pp-hero {
          padding: 56px 0 48px;
          border-bottom: 1px solid var(--border);
        }
        .pp-hero-inner {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        @media (min-width: 640px) {
          .pp-hero-inner {
            flex-direction: row;
            align-items: flex-start;
            gap: 36px;
          }
        }
        .pp-avatar {
          flex-shrink: 0;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.25), 0 8px 32px rgba(37,99,235,0.3);
        }
        @media (min-width: 640px) {
          .pp-avatar {
            width: 120px;
            height: 120px;
            font-size: 44px;
          }
        }
        .pp-hero-info { flex: 1; min-width: 0; }
        .pp-nav-links {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .pp-nav-back {
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: color 0.15s;
        }
        .pp-nav-back:hover { color: var(--text); }
        .pp-nav-sep { color: var(--border-bright); font-size: 11px; }
        .pp-name {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 52px);
          font-weight: 800;
          line-height: 1.0;
          letter-spacing: -0.02em;
          color: var(--text);
          margin-bottom: 6px;
        }
        .pp-nickname {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--muted);
          margin-bottom: 14px;
          font-style: italic;
        }
        .pp-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        }
        .pp-jersey {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--sky);
          padding: 3px 10px;
          border-radius: 5px;
          background: rgba(56,189,248,0.10);
          border: 1px solid rgba(56,189,248,0.25);
        }
        .pp-stats-link {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #60a5fa;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: color 0.15s;
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid rgba(96,165,250,0.25);
          background: rgba(37,99,235,0.06);
          margin-top: 4px;
        }
        .pp-stats-link:hover {
          color: var(--sky);
          border-color: rgba(56,189,248,0.4);
          background: rgba(37,99,235,0.12);
        }

        /* ── Highlights grid ── */
        .pp-highlights {
          padding: 48px 0 0;
        }
        .pp-section-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: var(--sky);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .pp-section-label::before {
          content: '';
          display: inline-block;
          width: 20px;
          height: 1px;
          background: var(--sky);
        }
        .pp-cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .pp-cards-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .pp-stat-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 28px 24px;
          position: relative;
          overflow: hidden;
        }
        .pp-stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent);
        }
        .pp-card-label {
          font-family: var(--font-display);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 14px;
        }
        .pp-big-stat {
          font-family: var(--font-display);
          font-size: clamp(44px, 7vw, 64px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.03em;
          color: var(--text);
          margin-bottom: 4px;
        }
        .pp-big-label {
          font-size: 11px;
          color: var(--muted);
          margin-bottom: 20px;
          font-family: var(--font-display);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .pp-sub-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          border-top: 1px solid var(--border);
          padding-top: 16px;
          margin-bottom: 12px;
        }
        .pp-sub-stat { text-align: center; }
        .pp-sub-val {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.1;
        }
        .pp-sub-key {
          font-size: 10px;
          font-family: var(--font-display);
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 2px;
        }
        .pp-milestones {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        /* ── Recent form ── */
        .pp-form {
          padding-top: 40px;
        }
        .pp-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }
        .pp-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          height: 36px;
          border-radius: 8px;
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          padding: 0 12px;
          letter-spacing: 0.01em;
        }
        .pp-chip-bowling {
          min-width: 52px;
          background: rgba(56,189,248,0.10);
          color: var(--sky);
          border: 1px solid rgba(56,189,248,0.22);
        }

        /* ── No data ── */
        .pp-empty {
          padding: 56px 0;
          text-align: center;
        }
        .pp-empty-icon {
          font-size: 40px;
          margin-bottom: 16px;
          opacity: 0.3;
        }
        .pp-empty-text {
          font-family: var(--font-display);
          font-size: 15px;
          color: var(--muted);
        }
      `}</style>

      <div className="pp-page">
        <div className="container">

          {/* ── Hero ── */}
          <div className="pp-hero">
            <div className="pp-hero-inner">

              {/* Avatar */}
              <div className="pp-avatar">{initials}</div>

              {/* Info */}
              <div className="pp-hero-info">
                <div className="pp-nav-links">
                  <Link href="/squad" className="pp-nav-back">
                    ← Squad
                  </Link>
                </div>

                <h1 className="pp-name">
                  {player.first_name} {player.last_name}
                </h1>

                {player.nickname && (
                  <div className="pp-nickname">"{player.nickname}"</div>
                )}

                <div className="pp-meta">
                  {player.jersey_number != null && (
                    <span className="pp-jersey">#{player.jersey_number}</span>
                  )}
                  {player.batting_style && (
                    <span className="badge badge-blue">{player.batting_style}</span>
                  )}
                  {player.bowling_style && (
                    <span className="badge badge-sky">{player.bowling_style}</span>
                  )}
                  {!player.is_active && (
                    <span className="badge badge-muted">Inactive</span>
                  )}
                </div>

                <Link href={`/stats/${player.id}`} className="pp-stats-link">
                  View Full Stats →
                </Link>
              </div>
            </div>
          </div>

          {/* ── Career Highlights ── */}
          {(hasBatting || hasBowling) ? (
            <div className="pp-highlights">
              <div className="pp-section-label">Career Highlights</div>

              <div className="pp-cards-grid">

                {/* Batting card */}
                {hasBatting && bat && (
                  <div className="pp-stat-card">
                    <div className="pp-card-label">Batting</div>
                    <div className="pp-big-stat">{bat.total_runs ?? 0}</div>
                    <div className="pp-big-label">Runs</div>

                    <div className="pp-sub-stats">
                      <div className="pp-sub-stat">
                        <div className="pp-sub-val">{fmt(bat.average, 1)}</div>
                        <div className="pp-sub-key">Average</div>
                      </div>
                      <div className="pp-sub-stat">
                        <div className="pp-sub-val">{fmt(bat.strike_rate, 1)}</div>
                        <div className="pp-sub-key">S/R</div>
                      </div>
                      <div className="pp-sub-stat">
                        <div className="pp-sub-val">
                          {bat.highest_score != null ? bat.highest_score : '—'}
                        </div>
                        <div className="pp-sub-key">Best</div>
                      </div>
                    </div>

                    {((bat.fifties ?? 0) > 0 || (bat.hundreds ?? 0) > 0) && (
                      <div className="pp-milestones">
                        {(bat.fifties ?? 0) > 0 && (
                          <span className="badge badge-gold">{bat.fifties} × 50+</span>
                        )}
                        {(bat.hundreds ?? 0) > 0 && (
                          <span className="badge badge-gold">{bat.hundreds} × 100</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Bowling card */}
                {hasBowling && bowl && (
                  <div className="pp-stat-card">
                    <div className="pp-card-label">Bowling</div>
                    <div className="pp-big-stat">{bowl.wickets ?? 0}</div>
                    <div className="pp-big-label">Wickets</div>

                    <div className="pp-sub-stats">
                      <div className="pp-sub-stat">
                        <div className="pp-sub-val">
                          {bowl.wickets && bowl.runs_conceded
                            ? (bowl.runs_conceded / bowl.wickets).toFixed(1)
                            : '—'}
                        </div>
                        <div className="pp-sub-key">Average</div>
                      </div>
                      <div className="pp-sub-stat">
                        <div className="pp-sub-val">{fmt(bowl.economy, 1)}</div>
                        <div className="pp-sub-key">Economy</div>
                      </div>
                      <div className="pp-sub-stat">
                        <div className="pp-sub-val">{computeBestFigures(bowlLog)}</div>
                        <div className="pp-sub-key">Best</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="pp-empty">
              <div className="pp-empty-icon">🏏</div>
              <div className="pp-empty-text">No match data recorded yet</div>
            </div>
          )}

          {/* ── Recent Batting Form ── */}
          {recentBat.length > 0 && (
            <div className="pp-form">
              <div className="pp-section-label">Recent Batting</div>
              <div className="pp-chips">
                {recentBat.map((inning, i) => {
                  const runs = inning.runs
                  const style = scoreChipStyle(runs)
                  return (
                    <span
                      key={inning.innings_id ?? i}
                      className="pp-chip"
                      style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}33` }}
                      title={inning.dismissal_type ?? 'not out'}
                    >
                      {runs == null ? '—' : runs}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Recent Bowling Form ── */}
          {recentBowlWithWickets.length > 0 && (
            <div className="pp-form">
              <div className="pp-section-label">Recent Wicket Hauls</div>
              <div className="pp-chips">
                {recentBowlWithWickets.map((inning, i) => (
                  <span
                    key={inning.innings_id ?? i}
                    className="pp-chip pp-chip-bowling"
                    title={`${overs(inning.legal_balls)} overs`}
                  >
                    {inning.wickets}/{inning.runs_conceded}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
