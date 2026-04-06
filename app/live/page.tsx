'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { computeInningsState } from '@/lib/cricket/engine'
import type { BallEvent } from '@/lib/cricket/types'

interface LiveMatch {
  id: string
  match_date: string
  venue: string | null
  opponent: { canonical_name: string } | null
  competition: { name: string; overs_per_innings: number; match_format: string } | null
  innings: {
    id: string
    innings_number: number
    batting_side: string
    status: string
    target: number | null
  }[]
  score: { runs: number; wickets: number; overs: string; rr: string } | null
  chasing: { target: number; need: number; balls: number } | null
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function LivePage() {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function fetchLive() {
    // Query via innings status — works even if matches.status wasn't updated
    const { data: liveInnings } = await supabase
      .from('innings')
      .select('*, match:matches(*, opponent:opponents(canonical_name), competition:competitions(name, overs_per_innings, match_format))')
      .eq('status', 'in_progress')

    if (!liveInnings?.length) {
      setMatches([])
      setLoading(false)
      setLastUpdated(new Date())
      return
    }

    // Deduplicate by match id (a match can only have one in_progress innings at a time)
    const matchMap = new Map<string, any>()
    for (const inn of liveInnings) {
      if (inn.match) matchMap.set(inn.match.id, inn.match)
    }
    const matchData = Array.from(matchMap.values())

    const enriched: LiveMatch[] = await Promise.all(
      matchData.map(async (m) => {
        const { data: inningsData } = await supabase
          .from('innings')
          .select('*')
          .eq('match_id', m.id)
          .order('innings_number')

        const innings = inningsData ?? []
        const activeInnings = innings.find((i: any) => i.status === 'in_progress') ?? innings[innings.length - 1]

        let score = null
        let chasing = null

        if (activeInnings) {
          const { data: balls } = await supabase
            .from('ball_events')
            .select('*')
            .eq('innings_id', activeInnings.id)
            .order('sequence_number')

          const { data: mpData } = await supabase
            .from('match_players')
            .select('id, opposition_name, player_id')
            .eq('match_id', m.id)

          const nameMap = new Map((mpData ?? []).map((p: any) => [p.id, p.opposition_name ?? `Player`]))
          const state = computeInningsState((balls ?? []) as BallEvent[], nameMap)

          score = {
            runs: state.totalRuns,
            wickets: state.wickets,
            overs: state.oversDisplay,
            rr: state.legalBalls > 0 ? ((state.totalRuns / state.legalBalls) * 6).toFixed(2) : '0.00',
          }

          if (activeInnings.target) {
            const ovs = (m.competition?.overs_per_innings ?? 20) * 6
            chasing = {
              target: activeInnings.target,
              need: activeInnings.target - state.totalRuns,
              balls: ovs - state.legalBalls,
            }
          }
        }

        return { ...m, innings, score, chasing }
      })
    )

    setMatches(enriched)
    setLoading(false)
    setLastUpdated(new Date())
  }

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <style>{`
        .live-page {
          padding-top: var(--nav-h);
          min-height: 100vh;
          padding-bottom: 80px;
        }

        /* ── HERO ── */
        .live-hero {
          position: relative;
          overflow: hidden;
          padding: 52px 0 48px;
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid rgba(59,130,246,0.15);
        }
        .live-hero::before {
          content: '';
          position: absolute;
          top: -100px; right: -100px;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .live-hero::after {
          content: '';
          position: absolute;
          bottom: -1px; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent);
        }

        .live-hero-inner {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          position: relative; z-index: 1;
        }

        .live-eyebrow {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: #38bdf8;
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 10px;
        }
        .live-eyebrow-line {
          display: inline-block;
          width: 20px; height: 1px;
          background: linear-gradient(90deg, #38bdf8, transparent);
        }

        .live-hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 6vw, 60px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.03em;
          line-height: 1;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #fca5a5;
          vertical-align: middle;
        }
        .live-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px rgba(239,68,68,0.8);
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{ opacity:1; } 50%{ opacity:0.25; } }

        .live-hero-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          color: rgba(147,197,253,0.5);
          margin-top: 12px;
        }

        .live-updated {
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          color: rgba(147,197,253,0.3);
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .live-updated-label {
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 9px;
          color: rgba(147,197,253,0.25);
        }

        /* ── BODY ── */
        .live-body { padding: 44px 0; }

        /* ── MATCH CARD ── */
        .live-match-card {
          background: rgba(5,18,42,0.8);
          border: 1px solid rgba(59,130,246,0.16);
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 24px;
          position: relative;
          backdrop-filter: blur(12px);
        }
        .live-match-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #ef4444, #f97316, #ef4444);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer { 0%{ background-position: 200% 0; } 100%{ background-position: -200% 0; } }

        /* Card top: teams + score */
        .lmc-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: center;
          padding: 28px 28px 20px;
        }
        @media (max-width: 600px) {
          .lmc-top { grid-template-columns: 1fr; padding: 20px 20px 16px; }
          .lmc-score-panel { text-align: left; }
          .lmc-score-detail { justify-content: flex-start; }
          .lmc-footer { padding: 14px 20px; }
          .live-hero { padding: 36px 0 32px; }
        }
        @media (max-width: 480px) {
          .lmc-top { padding: 16px 16px 14px; }
          .lmc-footer { padding: 12px 16px; }
          .lmc-chase { margin: 0 16px 16px; padding: 10px 14px; font-size: 12px; }
          .lmc-watch-btn { padding: 10px 18px; font-size: 12px; }
          .live-body { padding: 28px 0; }
        }

        .lmc-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #fca5a5;
        }
        .lmc-status-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 6px rgba(239,68,68,0.8);
          animation: blink 1.2s ease-in-out infinite;
        }

        .lmc-teams {
          font-family: 'Syne', sans-serif;
          font-size: clamp(22px, 3.5vw, 32px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .lmc-vs {
          font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 600;
          color: #38bdf8;
          padding: 3px 10px; border-radius: 5px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.2);
        }

        .lmc-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          color: rgba(147,197,253,0.5);
        }
        .lmc-meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Score panel */
        .lmc-score-panel {
          text-align: right;
          flex-shrink: 0;
        }
        .lmc-score {
          font-family: 'Syne', sans-serif;
          font-size: clamp(44px, 7vw, 68px);
          font-weight: 800;
          color: #60a5fa;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .lmc-score-wkts {
          color: rgba(147,197,253,0.3);
          font-size: 0.6em;
        }
        .lmc-score-detail {
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          color: rgba(147,197,253,0.45);
          margin-top: 6px;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
        }
        .lmc-rr-pill {
          padding: 2px 8px; border-radius: 5px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.2);
          font-size: 11px; font-weight: 600;
          color: #93c5fd;
        }

        /* Chasing banner */
        .lmc-chase {
          margin: 0 20px 20px;
          padding: 12px 18px;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 13px; font-weight: 600;
          color: #fbbf24;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .lmc-chase-icon { font-size: 14px; }

        /* Card footer actions */
        .lmc-footer {
          border-top: 1px solid rgba(59,130,246,0.1);
          padding: 16px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: rgba(10,22,40,0.4);
          flex-wrap: wrap;
        }
        .lmc-footer-comp {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(147,197,253,0.3);
        }
        .lmc-watch-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          font-size: 13px; font-weight: 700;
          text-decoration: none;
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 4px 16px rgba(37,99,235,0.3);
          white-space: nowrap;
        }
        .lmc-watch-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── EMPTY STATE ── */
        .live-empty {
          text-align: center;
          padding: 80px 20px;
          position: relative;
        }
        .live-empty-ring {
          width: 120px; height: 120px;
          border-radius: 50%;
          border: 1px solid rgba(59,130,246,0.12);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 28px;
          position: relative;
        }
        .live-empty-ring::before {
          content: '';
          position: absolute;
          inset: 12px;
          border-radius: 50%;
          border: 1px solid rgba(59,130,246,0.07);
        }
        .live-empty-icon {
          font-size: 36px;
          opacity: 0.4;
        }
        .live-empty-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          color: rgba(147,197,253,0.25);
          letter-spacing: -0.01em;
          margin-bottom: 10px;
        }
        .live-empty-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          color: rgba(147,197,253,0.25);
          line-height: 1.6;
          margin-bottom: 28px;
        }

        /* ── LOADING ── */
        .live-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 20px;
          gap: 20px;
        }
        .live-spinner {
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(59,130,246,0.15);
          border-top-color: #3b82f6;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .live-loading-text {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          color: rgba(147,197,253,0.35);
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="live-page">
        {/* ── HERO ── */}
        <div className="live-hero">
          <div className="container">
            <div className="live-hero-inner">
              <div>
                <div className="live-eyebrow">
                  <span className="live-eyebrow-line" />
                  Bedfordview Cricket Club
                </div>
                <div className="live-hero-title">
                  Live Scores
                  {!loading && matches.length > 0 && (
                    <span className="live-badge">
                      <span className="live-badge-dot" />
                      {matches.length} live
                    </span>
                  )}
                </div>
                <div className="live-hero-sub">
                  Real-time scoring updated every 30 seconds.
                </div>
              </div>
              {lastUpdated && (
                <div className="live-updated">
                  <span className="live-updated-label">Last updated</span>
                  <span>{lastUpdated.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="live-body">
          <div className="container">
            {loading ? (
              <div className="live-loading">
                <div className="live-spinner" />
                <div className="live-loading-text">Checking for live matches…</div>
              </div>
            ) : matches.length === 0 ? (
              <div className="live-empty">
                <div className="live-empty-ring">
                  <span className="live-empty-icon">🏏</span>
                </div>
                <div className="live-empty-title">No matches live right now</div>
                <div className="live-empty-sub">
                  Check back on match day, or browse upcoming fixtures<br />to see what's coming up.
                </div>
                <Link href="/fixtures" className="btn btn-ghost">
                  View Fixtures
                </Link>
              </div>
            ) : (
              matches.map(m => (
                <div key={m.id} className="live-match-card">
                  <div className="lmc-top">
                    <div>
                      <div className="lmc-status">
                        <span className="lmc-status-dot" />
                        In progress
                      </div>
                      <div className="lmc-teams">
                        BCC
                        <span className="lmc-vs">vs</span>
                        {m.opponent?.canonical_name ?? 'Opposition'}
                      </div>
                      <div className="lmc-meta">
                        <span className="lmc-meta-item">📅 {formatDate(m.match_date)}</span>
                        {m.venue && <span className="lmc-meta-item">📍 {m.venue}</span>}
                        {m.competition && (
                          <span className="lmc-meta-item">
                            {m.competition.overs_per_innings} overs ·{' '}
                            {m.competition.match_format?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {m.score ? (
                      <div className="lmc-score-panel">
                        <div className="lmc-score">
                          {m.score.runs}
                          <span className="lmc-score-wkts">/{m.score.wickets}</span>
                        </div>
                        <div className="lmc-score-detail">
                          {m.score.overs} overs
                          <span className="lmc-rr-pill">RR {m.score.rr}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="lmc-score-panel" style={{ color: 'rgba(147,197,253,0.3)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>
                        Starting soon…
                      </div>
                    )}
                  </div>

                  {m.chasing && m.chasing.need > 0 && (
                    <div className="lmc-chase">
                      <span className="lmc-chase-icon">🎯</span>
                      Need <strong style={{ color: '#fde68a', margin: '0 4px' }}>{m.chasing.need}</strong> runs off{' '}
                      <strong style={{ color: '#fde68a', margin: '0 4px' }}>{m.chasing.balls}</strong> balls
                      (target {m.chasing.target})
                    </div>
                  )}

                  <div className="lmc-footer">
                    <span className="lmc-footer-comp">
                      {m.competition?.name ?? 'Match'}
                    </span>
                    <Link href={`/matches/${m.id}`} className="lmc-watch-btn">
                      Watch Live →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
