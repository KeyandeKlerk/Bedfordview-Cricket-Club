import { notFound } from 'next/navigation'
import Link from 'next/link'
import { anonSupabase as supabase } from '@/lib/supabase/server'
import { computeInningsState } from '@/lib/cricket/engine'
import { computePartnerships } from '@/lib/cricket/partnerships'
import { labelDismissal, overs } from '@/lib/stats/formatters'
import type { BallEvent, MatchPlayer } from '@/lib/cricket/types'
import MatchRunRateChart from '@/components/analytics/charts/MatchRunRateChart'
import FallOfWicketsTimeline from '@/components/analytics/charts/FallOfWicketsTimeline'
import WagonWheel from '@/components/analytics/charts/WagonWheel'
import LengthHeatmap from '@/components/analytics/charts/LengthHeatmap'
import ShotTypeBreakdown from '@/components/analytics/charts/ShotTypeBreakdown'
import QualityScorePanel from '@/components/analytics/charts/QualityScorePanel'
import InningsTabSwitcher from './InningsTabSwitcher'
import PressureIndicatorPanel from './PressureIndicatorPanel'

export const revalidate = 30

export default async function MatchAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params

  const [matchRes, inningsRes, mpRes, ballsRes] = await Promise.all([
    supabase
      .from('matches')
      .select('id, match_date, result_text, overs_per_innings, our_team_side, opponent:opponents(canonical_name), competition:competitions(name,category), ground:grounds(name)')
      .eq('id', matchId)
      .single(),
    supabase.from('innings').select('*').eq('match_id', matchId).order('innings_number'),
    supabase
      .from('match_players')
      .select('id, player_id, opposition_name, side, players(first_name, last_name)')
      .eq('match_id', matchId),
    supabase
      .from('ball_events')
      .select('id, innings_id, over_number, ball_in_over, sequence_number, batter_id, non_striker_id, bowler_id, runs_off_bat, extras_type, extras_runs, is_boundary_four, is_boundary_six, dismissal_type, dismissed_player_id, created_at, wagon_x, wagon_y, pitch_length, pitch_line, shot_type, bowling_type, execution_quality, decision_quality')
      .eq('match_id', matchId)
      .order('sequence_number'),
  ])

  if (!matchRes.data) notFound()

  const match = matchRes.data
  const allInnings: any[] = inningsRes.data ?? []
  const matchPlayers: any[] = mpRes.data ?? []
  const allBalls: BallEvent[] = (ballsRes.data ?? []) as BallEvent[]

  // Build player name map (match_players.id → name)
  const playerNameMap = new Map<string, string>()
  for (const mp of matchPlayers) {
    const name = mp.players
      ? `${mp.players.first_name} ${mp.players.last_name}`
      : (mp.opposition_name ?? 'Unknown')
    playerNameMap.set(mp.id, name)
  }

  // Per-innings computed data
  const inningsData = allInnings.map(inn => {
    const balls = allBalls.filter(b => b.innings_id === inn.id)
    const state = computeInningsState(balls, playerNameMap)
    const partnerships = computePartnerships(balls, playerNameMap)

    // Per-over breakdown for run rate chart
    const overMap = new Map<number, { runs: number; wickets: number }>()
    for (const b of balls) {
      const key = b.over_number
      const cur = overMap.get(key) ?? { runs: 0, wickets: 0 }
      cur.runs += b.runs_off_bat + b.extras_runs
      if (b.dismissal_type) cur.wickets++
      overMap.set(key, cur)
    }
    const maxOver = balls.length > 0 ? Math.max(...balls.map(b => b.over_number)) : -1
    const overData = Array.from({ length: maxOver + 1 }, (_, i) => ({
      over: i + 1,
      runs: overMap.get(i)?.runs ?? 0,
      wickets: overMap.get(i)?.wickets ?? 0,
    }))

    // Phase breakdown
    const phases = { powerplay: { runs: 0, wickets: 0, balls: 0 }, middle: { runs: 0, wickets: 0, balls: 0 }, death: { runs: 0, wickets: 0, balls: 0 } }
    for (const b of balls) {
      const phase = b.over_number <= 5 ? 'powerplay' : b.over_number <= 14 ? 'middle' : 'death'
      phases[phase].runs += b.runs_off_bat + b.extras_runs
      if (b.dismissal_type) phases[phase].wickets++
      if (b.extras_type !== 'wide' && b.extras_type !== 'no_ball') phases[phase].balls++
    }

    // Fall of wickets
    let cumRuns = 0
    const fow: Array<{ score: number; over: string; player: string; how: string }> = []
    for (const b of balls) {
      cumRuns += b.runs_off_bat + b.extras_runs
      if (b.dismissal_type) {
        const overStr = `${b.over_number}.${b.ball_in_over}`
        fow.push({
          score: cumRuns,
          over: overStr,
          player: playerNameMap.get(b.dismissed_player_id ?? '') ?? '?',
          how: labelDismissal(b.dismissal_type),
        })
      }
    }

    const battingSide = inn.batting_side === match.our_team_side
      ? ((match.competition as any)?.category === 'junior' ? 'Junior XI' : 'BCC')
      : ((match.opponent as any)?.canonical_name ?? 'Opponents')

    return { inn, state, partnerships, overData, phases, fow, balls, battingSide }
  })

  const opponent = (match.opponent as any)?.canonical_name ?? 'Opponents'
  const competition = (match.competition as any)?.name ?? ''
  const matchDate = match.match_date
    ? new Date(match.match_date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <>
      <style>{`
        .ma-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 60px; }
        .ma-section { margin-bottom: 32px; }
        .ma-section-title { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; color: var(--muted); margin-bottom: 12px; }
        .ma-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
        .ma-phase-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .ma-phase-cell { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px; text-align: center; }
        .ma-phase-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .ma-phase-score { font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--text); }
        .ma-phase-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .ma-ps-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid rgba(51,65,85,0.4); }
        .ma-ps-row:last-child { border-bottom: none; }
        .ma-ps-num { font-size: 10px; color: var(--dim); width: 20px; }
        .ma-ps-names { flex: 1; font-size: 12px; color: var(--text); }
        .ma-ps-runs { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--highlight); }
        .ma-ps-balls { font-size: 11px; color: var(--muted); }
        .ma-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        @media (min-width: 640px) { .ma-summary-grid { grid-template-columns: repeat(4, 1fr); } }
        .ma-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 14px; text-align: center; }
        .ma-stat-val { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--text); }
        .ma-stat-label { font-size: 11px; color: var(--muted); margin-top: 2px; }
      `}</style>

      <div className="ma-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">
              <Link href="/analytics" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Analytics</Link>
              {' '}/ Match
            </div>
            <h1>BCC vs {opponent}</h1>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
              {matchDate}{competition ? ` · ${competition}` : ''}{(match.ground as any)?.name ? ` · ${(match.ground as any).name}` : ''}
            </div>
            {match.result_text && (
              <div style={{ marginTop: 8, fontSize: 14, color: 'var(--highlight)', fontWeight: 600 }}>
                {match.result_text}
              </div>
            )}
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 900 }}>
          {inningsData.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 60 }}>No innings data available yet.</div>
          )}

          <InningsTabSwitcher
            labels={inningsData.map(d => `${d.battingSide} Innings`)}
          >
            {inningsData.map(({ inn, state, partnerships, overData, phases, fow, balls }, idx) => (
              <div key={inn.id}>
                {/* Summary stats */}
                <div className="ma-summary-grid">
                  <div className="ma-stat-card">
                    <div className="ma-stat-val">{state.totalRuns}/{state.wickets}</div>
                    <div className="ma-stat-label">Score</div>
                  </div>
                  <div className="ma-stat-card">
                    <div className="ma-stat-val">{state.oversDisplay}</div>
                    <div className="ma-stat-label">Overs</div>
                  </div>
                  <div className="ma-stat-card">
                    <div className="ma-stat-val">
                      {state.legalBalls > 0 ? ((state.totalRuns / state.legalBalls) * 6).toFixed(2) : '—'}
                    </div>
                    <div className="ma-stat-label">Run Rate</div>
                  </div>
                  <div className="ma-stat-card">
                    <div className="ma-stat-val">
                      {inn.target ? `${inn.target}` : '—'}
                    </div>
                    <div className="ma-stat-label">Target</div>
                  </div>
                </div>

                {/* Run rate chart */}
                {overData.length > 0 && (
                  <div className="ma-card">
                    <MatchRunRateChart data={overData} title={`${state.totalRuns} runs in ${state.oversDisplay} overs`} />
                  </div>
                )}

                {/* Phase breakdown */}
                <div className="ma-section">
                  <div className="ma-section-title">Phase Breakdown</div>
                  <div className="ma-phase-grid">
                    {(['powerplay', 'middle', 'death'] as const).map(ph => {
                      const p = phases[ph]
                      const econ = p.balls > 0 ? ((p.runs / p.balls) * 6).toFixed(1) : '—'
                      return (
                        <div key={ph} className="ma-phase-cell">
                          <div className="ma-phase-label">{ph === 'powerplay' ? 'Powerplay' : ph === 'middle' ? 'Middle' : 'Death'}</div>
                          <div className="ma-phase-score">{p.runs}/{p.wickets}</div>
                          <div className="ma-phase-sub">{overs(p.balls)} ov · {econ} RR</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Fall of wickets */}
                {fow.length > 0 && (
                  <div className="ma-card">
                    <FallOfWicketsTimeline wickets={fow} totalRuns={state.totalRuns} />
                  </div>
                )}

                {/* Partnerships */}
                {partnerships.length > 0 && (
                  <div className="ma-section">
                    <div className="ma-section-title">Partnerships</div>
                    <div className="ma-card" style={{ padding: '12px 20px' }}>
                      {partnerships.map((p, i) => (
                        <div key={i} className="ma-ps-row">
                          <div className="ma-ps-num">{p.wicket === 0 ? '★' : `${p.wicket}w`}</div>
                          <div className="ma-ps-names">{p.batter1} & {p.batter2}</div>
                          <div className="ma-ps-runs">{p.runs}</div>
                          <div className="ma-ps-balls">({p.balls}b)</div>
                          <div className="ma-ps-sub" style={{ fontSize: 11, color: 'var(--muted)', minWidth: 36, textAlign: 'right' }}>
                            {p.balls > 0 ? `${((p.runs / p.balls) * 100).toFixed(0)}` : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pressure indicator (chasing innings only) */}
                {inn.target && balls.length > 0 && (
                  <div className="ma-card">
                    <PressureIndicatorPanel
                      balls={balls}
                      target={inn.target}
                      overs_per_innings={match.overs_per_innings}
                    />
                  </div>
                )}

                {/* Professional Data */}
                {balls.some((b: any) => b.wagon_x != null || b.pitch_length != null || b.shot_type != null || b.execution_quality != null) && (
                  <div className="ma-section">
                    <div className="ma-section-title">Professional Data</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
                      <div className="ma-card">
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wagon Wheel</div>
                        <WagonWheel balls={balls as any[]} size={240} />
                      </div>
                      <div className="ma-card">
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pitch Map</div>
                        <LengthHeatmap balls={balls as any[]} />
                      </div>
                    </div>

                    {balls.some((b: any) => b.shot_type != null) && (
                      <div className="ma-card">
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shot Types</div>
                        <ShotTypeBreakdown balls={balls as any[]} />
                      </div>
                    )}

                    {balls.some((b: any) => b.execution_quality != null || b.decision_quality != null) && (
                      <div className="ma-card">
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality Scores</div>
                        <QualityScorePanel balls={balls as any[]} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </InningsTabSwitcher>
        </div>
      </div>
    </>
  )
}
