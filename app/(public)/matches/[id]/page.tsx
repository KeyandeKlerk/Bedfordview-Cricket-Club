'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { BallEvent } from '@/lib/cricket/types'
import { computeInningsState, oversDisplay, totalBallRuns } from '@/lib/cricket/engine'
import { subscribeBallEvents } from '@/lib/supabase/realtime'
import OverDots from '@/components/scorer/OverDots'

export default function PublicMatchPage() {
  const { id: matchId } = useParams<{ id: string }>()

  const [match, setMatch]               = useState<any>(null)
  const [innings, setInnings]           = useState<any[]>([])
  const [balls, setBalls]               = useState<BallEvent[]>([])
  const [players, setPlayers]           = useState<any[]>([])
  const [registeredPlayers, setRegisteredPlayers] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)

  const lastKnownSeqRef = useRef(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const [matchRes, inningsRes, playersRes, registeredRes] = await Promise.all([
        supabase.from('matches').select('*').eq('id', matchId).single(),
        supabase.from('innings').select('*').eq('match_id', matchId).order('innings_number'),
        supabase.from('match_players').select('*').eq('match_id', matchId),
        supabase.from('players').select('id, first_name, last_name'),
      ])

      if (matchRes.data)        setMatch(matchRes.data)
      if (inningsRes.data)      setInnings(inningsRes.data)
      if (playersRes.data)      setPlayers(playersRes.data)
      if (registeredRes.data)   setRegisteredPlayers(registeredRes.data)

      // Load balls for the active innings
      const activeInnings = inningsRes.data?.find((i: any) => i.status === 'in_progress')
        ?? inningsRes.data?.[inningsRes.data.length - 1]

      if (activeInnings) {
        const { data: ballData } = await supabase
          .from('ball_events')
          .select('*')
          .eq('innings_id', activeInnings.id)
          .order('sequence_number')

        if (ballData) {
          setBalls(ballData as BallEvent[])
          lastKnownSeqRef.current = ballData.length > 0
            ? ballData[ballData.length - 1].sequence_number
            : 0
        }

        // Subscribe AFTER fetching initial data to avoid race conditions
        const channel = subscribeBallEvents(
          activeInnings.id,
          lastKnownSeqRef.current,
          (ball) => {
            setBalls(prev => {
              if (prev.some(b => b.id === ball.id)) return prev
              const merged = [...prev, ball].sort((a, b) => a.sequence_number - b.sequence_number)
              lastKnownSeqRef.current = merged[merged.length - 1].sequence_number
              return merged
            })
          },
          (ballId) => setBalls(prev => prev.filter(b => b.id !== ballId)),
          (_status) => {
            // Polling fallback on channel error
            if (!pollingRef.current) {
              pollingRef.current = setInterval(async () => {
                const { data } = await supabase
                  .from('ball_events')
                  .select('*')
                  .eq('innings_id', activeInnings.id)
                  .gt('sequence_number', lastKnownSeqRef.current)
                  .order('sequence_number')
                if (data?.length) {
                  setBalls(prev => {
                    const existing = new Set(prev.map(b => b.id))
                    const newBalls = (data as BallEvent[]).filter(b => !existing.has(b.id))
                    if (!newBalls.length) return prev
                    const merged = [...prev, ...newBalls].sort((a, b) => a.sequence_number - b.sequence_number)
                    lastKnownSeqRef.current = merged[merged.length - 1].sequence_number
                    return merged
                  })
                }
              }, 10000)
            }
          }
        )
        return () => {
          channel.unsubscribe()
          if (pollingRef.current) clearInterval(pollingRef.current)
        }
      }
    }

    load().then(() => setLoading(false))
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [matchId])

  if (loading) {
    return (
      <div style={{ paddingTop: 'var(--nav-h)', textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
        Loading...
      </div>
    )
  }

  if (!match) {
    return <div style={{ paddingTop: 'var(--nav-h)', textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>Match not found.</div>
  }

  const registeredNames = new Map(
    registeredPlayers.map((p: any) => [p.id, `${p.first_name} ${p.last_name}`.trim()])
  )
  const playerNameMap = new Map(
    players.map((p: any) => [
      p.id,
      p.opposition_name ?? registeredNames.get(p.player_id) ?? `Player ${p.batting_position ?? '?'}`,
    ])
  )

  const state = computeInningsState(balls, playerNameMap)
  const activeInnings = innings.find(i => i.status === 'in_progress') ?? innings[innings.length - 1]

  function exportCSV() {
    const rows = [
      ['Batter', 'R', 'B', '4s', '6s', 'SR'],
      ...Object.values(state.batterStats).map(b =>
        [b.name, b.runs, b.balls, b.fours, b.sixes, b.strikeRate]
      ),
      [],
      ['Bowler', 'O', 'R', 'W', 'Wd', 'NB', 'Econ'],
      ...Object.values(state.bowlerStats).map(b =>
        [b.name, b.overs, b.runs, b.wickets, b.wides, b.noBalls, b.economy]
      ),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `scorecard-${matchId}.csv`; a.click()
  }

  return (
    <>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white; color: black; }
        }
        .live-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }

        .score-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          padding: 36px 0;
          margin-bottom: 28px;
          position: relative; overflow: hidden;
        }
        .score-hero::before {
          content: '';
          position: absolute; top: -80px; right: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%);
          pointer-events: none;
        }

        .score-big {
          font-family: 'Syne', sans-serif;
          font-size: clamp(56px, 10vw, 80px);
          font-weight: 800;
          color: #60a5fa;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .score-big-wkts { color: rgba(147,197,253,0.35); }

        .score-status {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(147,197,253,0.4);
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .score-detail {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          color: rgba(147,197,253,0.5);
          margin-top: 10px;
        }
        .score-target {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          color: #fbbf24;
          margin-top: 6px;
          font-size: 14px;
        }

        .sc-block {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
          position: relative;
        }
        .sc-block::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);
        }
        .sc-block-header {
          padding: 12px 20px;
          background: rgba(10,22,40,0.5);
          border-bottom: 1px solid rgba(59,130,246,0.08);
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.18em;
          color: rgba(147,197,253,0.4);
        }

        .sc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sc-table th {
          font-family: 'Outfit', sans-serif;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.3);
          text-align: right; padding: 8px 12px;
          border-bottom: 1px solid rgba(59,130,246,0.08);
        }
        .sc-table th:first-child { text-align: left; }
        .sc-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(59,130,246,0.05);
          text-align: right;
          color: rgba(147,197,253,0.5);
          font-family: 'Outfit', sans-serif;
        }
        .sc-table td:first-child { text-align: left; color: #e2eeff; font-weight: 600; }
        .sc-table tbody tr:last-child td { border-bottom: none; }
        .sc-table tbody tr:hover { background: rgba(37,99,235,0.04); }

        .big-num { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: #60a5fa; }

        /* Hide less critical columns on small screens */
        @media (max-width: 500px) {
          .sc-hide { display: none; }
          .sc-table th, .sc-table td { padding: 9px 8px; font-size: 12px; }
          .live-page { padding-bottom: 40px; }
          .score-hero { padding: 24px 0; }
          .no-print { display: none; }
        }
      `}</style>

      <div className="live-page">
        <div className="score-hero">
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div className="score-status">
                  {match.status === 'in_progress' ? (
                    <><span className="live-dot" />Live</>
                  ) : match.status}
                </div>
                <div className="score-big">
                  {state.totalRuns}<span className="score-big-wkts">/{state.wickets}</span>
                </div>
                <div className="score-detail">
                  {state.oversDisplay} overs
                  {state.legalBalls > 0 && ` · RR ${((state.totalRuns / state.legalBalls) * 6).toFixed(2)}`}
                </div>
                {activeInnings?.target && (
                  <div className="score-target">
                    Need {activeInnings.target - state.totalRuns} off {((match.overs_per_innings * 6) - state.legalBalls)} balls
                  </div>
                )}
              </div>
              <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={exportCSV} style={{ fontSize: 12 }}>Export CSV</button>
                <button className="btn btn-ghost" onClick={() => window.print()} style={{ fontSize: 12 }}>Print</button>
              </div>
            </div>
          </div>
        </div>

        <div className="container">
          {/* Current over */}
          {state.currentOverBalls.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(147,197,253,0.4)', marginBottom: 8 }}>This over</div>
              <OverDots balls={state.currentOverBalls} />
            </div>
          )}

          {/* Batters */}
          {Object.values(state.batterStats).filter(b => !b.isOut).length > 0 && (
            <div className="sc-block">
              <div className="sc-block-header">At the crease</div>
              <table className="sc-table">
                <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th className="sc-hide">SR</th></tr></thead>
                <tbody>
                  {Object.values(state.batterStats)
                    .filter(b => !b.isOut && (b.matchPlayerId === state.currentStrikerId || b.matchPlayerId === state.currentNonStrikerId))
                    .map(b => (
                      <tr key={b.matchPlayerId}>
                        <td>{b.name}{b.matchPlayerId === state.currentStrikerId ? ' *' : ''}</td>
                        <td><span className="big-num">{b.runs}</span></td>
                        <td>{b.balls}</td>
                        <td>{b.fours}</td>
                        <td>{b.sixes}</td>
                        <td className="sc-hide">{b.strikeRate}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batting scorecard */}
          <div className="sc-block">
            <div className="sc-block-header">Batting</div>
            <table className="sc-table">
              <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th className="sc-hide">SR</th></tr></thead>
              <tbody>
                {Object.values(state.batterStats).map(b => (
                  <tr key={b.matchPlayerId}>
                    <td>
                      <div>{b.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(147,197,253,0.3)', marginTop: 2 }}>{b.isOut ? (b.dismissalType ?? 'out') : 'not out'}</div>
                    </td>
                    <td><span className="big-num">{b.runs}</span></td>
                    <td>{b.balls}</td>
                    <td>{b.fours}</td>
                    <td>{b.sixes}</td>
                    <td className="sc-hide">{b.strikeRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(59,130,246,0.08)', fontSize: 12, fontFamily: 'Outfit, sans-serif', display: 'flex', justifyContent: 'space-between', background: 'rgba(10,22,40,0.3)' }}>
              <span style={{ color: 'rgba(147,197,253,0.4)' }}>Extras</span>
              <span style={{ color: '#93c5fd', fontWeight: 600 }}>
                {state.extras.total} (b {state.extras.bye}, lb {state.extras.leg_bye}, wd {state.extras.wide}, nb {state.extras.no_ball})
              </span>
            </div>
          </div>

          {/* Bowling scorecard */}
          <div className="sc-block">
            <div className="sc-block-header">Bowling</div>
            <table className="sc-table">
              <thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th className="sc-hide">Wd</th><th className="sc-hide">NB</th><th>Econ</th></tr></thead>
              <tbody>
                {Object.values(state.bowlerStats).map(b => (
                  <tr key={b.matchPlayerId}>
                    <td>{b.name}</td>
                    <td>{b.overs}</td>
                    <td>{b.runs}</td>
                    <td><span className="big-num" style={{ color: '#fca5a5' }}>{b.wickets}</span></td>
                    <td className="sc-hide">{b.wides}</td>
                    <td className="sc-hide">{b.noBalls}</td>
                    <td>{b.economy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fall of wickets */}
          {state.fallOfWickets.length > 0 && (
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'rgba(147,197,253,0.45)', marginBottom: 24 }}>
              <strong style={{ color: 'rgba(147,197,253,0.3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10 }}>Fall of wickets: </strong>
              {state.fallOfWickets.map(f => (
                <span key={f.wicketNumber} style={{ marginRight: 12 }}>
                  {f.wicketNumber}/{f.runs} ({playerNameMap.get(f.matchPlayerId) ?? '?'}, {f.over} ov)
                </span>
              ))}
            </div>
          )}

          {/* Ball-by-ball commentary */}
          {balls.some(b => b.commentary) && (
            <div className="sc-block" style={{ marginBottom: 20 }}>
              <div className="sc-block-header">Ball by Ball</div>
              <div style={{ padding: '4px 0' }}>
                {[...balls].reverse().slice(0, 10).map(b => {
                  if (!b.commentary) return null
                  const overLabel = `${b.over_number}.${b.ball_in_over + 1}`
                  const isWicket = !!b.dismissal_type
                  const isBoundary = b.is_boundary_four || b.is_boundary_six
                  return (
                    <div key={b.id} style={{
                      display: 'flex',
                      gap: 14,
                      padding: '10px 16px',
                      borderBottom: '1px solid rgba(59,130,246,0.05)',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{
                        fontFamily: 'Outfit, monospace',
                        fontSize: 11,
                        color: 'rgba(147,197,253,0.3)',
                        flexShrink: 0,
                        paddingTop: 2,
                        minWidth: 32,
                      }}>
                        {overLabel}
                      </span>
                      <span style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: 13,
                        color: isWicket
                          ? '#fca5a5'
                          : isBoundary
                            ? '#60a5fa'
                            : 'rgba(147,197,253,0.65)',
                        lineHeight: 1.5,
                      }}>
                        {b.commentary}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
