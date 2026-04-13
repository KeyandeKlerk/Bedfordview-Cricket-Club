'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import RunRateChart from '@/components/analytics/charts/RunRateChart'
import ResultsTrajectory from '@/components/analytics/charts/ResultsTrajectory'
import AnalyticsBarChart from '@/components/analytics/charts/AnalyticsBarChart'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | 'career'>('career')
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | 'all'>('all')
  const [seasons, setSeasons] = useState<any[]>([])
  const [competitions, setCompetitions] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [innings, setInnings] = useState<any[]>([])
  const [batting, setBatting] = useState<any[]>([])
  const [overBalls, setOverBalls] = useState<any[]>([])
  const [opponents, setOpponents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Init: load seasons, all completed matches, all innings
  useEffect(() => {
    async function init() {
      const [seasonsRes, allMatchesRes, allInningsRes, competitionsRes] = await Promise.all([
        supabase.from('seasons').select('id, name, is_active').order('start_date', { ascending: false }),
        supabase
          .from('matches')
          .select('id, season_id, competition_id, opponent_id, match_date, status, result_text, our_team_side')
          .eq('status', 'completed')
          .order('match_date'),
        supabase.from('innings').select('id, match_id, innings_number, batting_side, target'),
        supabase.from('competitions').select('id, name').order('name'),
      ])
      setSeasons(seasonsRes.data ?? [])
      setMatches(allMatchesRes.data ?? [])
      setInnings(allInningsRes.data ?? [])
      setCompetitions(competitionsRes.data ?? [])
      const active = (seasonsRes.data ?? []).find((s: any) => s.is_active)
      setSelectedSeasonId(active ? active.id : 'career')
    }
    init()
  }, [])

  // Load analytics data when season/competition or matches change
  useEffect(() => {
    if (matches.length === 0) return
    setLoading(true)
    async function load() {
      let filtered = selectedSeasonId === 'career'
        ? matches
        : matches.filter((m: any) => m.season_id === selectedSeasonId)
      if (selectedCompetitionId !== 'all')
        filtered = filtered.filter((m: any) => m.competition_id === selectedCompetitionId)
      const matchIds = filtered.map((m: any) => m.id)
      if (matchIds.length === 0) {
        setLoading(false)
        return
      }

      const [battingRes, overBallsRes, opponentsRes] = await Promise.all([
        supabase
          .from('batting_scorecard')
          .select('innings_id, match_id, player_id, player_name, actual_batting_position, runs, balls_faced, dismissal_type')
          .in('match_id', matchIds)
          .not('player_id', 'is', null),
        supabase
          .from('ball_events')
          .select('innings_id, match_id, over_number, runs_off_bat, extras_type, extras_runs, dismissed_player_id')
          .in('match_id', matchIds),
        supabase.from('opponents').select('id, canonical_name, short_name'),
      ])

      setBatting(battingRes.data ?? [])
      setOverBalls(overBallsRes.data ?? [])
      setOpponents(opponentsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [selectedSeasonId, selectedCompetitionId, matches])

  // ── Computed Data ──────────────────────────────────────────────────────────

  const filteredMatches = useMemo(() => {
    let ms = selectedSeasonId === 'career' ? matches : matches.filter(m => m.season_id === selectedSeasonId)
    if (selectedCompetitionId !== 'all') ms = ms.filter(m => m.competition_id === selectedCompetitionId)
    return ms
  }, [matches, selectedSeasonId, selectedCompetitionId])

  const opponentMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const o of opponents) map[o.id] = o.canonical_name ?? o.short_name ?? 'Unknown'
    return map
  }, [opponents])

  // Section 1: Results Timeline
  const results = useMemo(
    () =>
      filteredMatches.map(m => ({
        ...m,
        isWin: (m.result_text ?? '').toLowerCase().includes('won'),
        isTie:
          (m.result_text ?? '').toLowerCase().includes('tie') ||
          (m.result_text ?? '').toLowerCase().includes('no result'),
        opponentName: opponentMap[m.opponent_id] ?? 'Unknown',
        dateStr: new Date(m.match_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
      })),
    [filteredMatches, opponentMap]
  )

  const wins = results.filter(r => r.isWin).length
  const losses = results.filter(r => !r.isWin && !r.isTie).length
  const ties = results.filter(r => r.isTie).length
  const winRate = results.length > 0 ? Math.round((wins / results.length) * 100) : 0

  // BCC batting innings IDs
  const bccBattingInningsIds = useMemo(() => {
    const set = new Set<string>()
    for (const m of filteredMatches) {
      const mInnings = innings.filter(i => i.match_id === m.id)
      for (const inn of mInnings) {
        if (inn.batting_side === m.our_team_side) set.add(inn.id)
      }
    }
    return set
  }, [filteredMatches, innings])

  // Section 2: Batting Order Contribution
  const battingOrderContrib = useMemo(() => {
    const bccBat = batting.filter(b => bccBattingInningsIds.has(b.innings_id))
    const totalRuns = bccBat.reduce((s, b) => s + (b.runs ?? 0), 0) || 1
    const tiers = [
      { label: 'Top 3', min: 1, max: 3, color: '#38bdf8' },
      { label: 'Middle Order (4-7)', min: 4, max: 7, color: '#3b82f6' },
      { label: 'Lower Order (8-11)', min: 8, max: 11, color: '#6366f1' },
    ]
    return tiers.map(t => {
      const rows = bccBat.filter(
        b =>
          (b.actual_batting_position ?? 99) >= t.min &&
          (b.actual_batting_position ?? 99) <= t.max
      )
      const runs = rows.reduce((s, b) => s + (b.runs ?? 0), 0)
      const dismissed = rows.filter(b => b.dismissal_type).length
      return {
        ...t,
        runs,
        pct: Math.round((runs / totalRuns) * 100),
        innings: rows.length,
        avg: dismissed > 0 ? (runs / dismissed).toFixed(1) : '—',
      }
    })
  }, [batting, bccBattingInningsIds])

  // Section 3: Chasing vs Defending
  const chasingDefending = useMemo(() => {
    const chasing: any[] = []
    const defending: any[] = []
    for (const m of filteredMatches) {
      const mInnings = innings.filter(i => i.match_id === m.id)
      const bccInn = mInnings.find(i => i.batting_side === m.our_team_side)
      if (!bccInn) continue
      const isChasing = bccInn.innings_number === 2
      const group = isChasing ? chasing : defending
      group.push(m)
    }
    const calc = (arr: any[]) => {
      const w = arr.filter(m => (m.result_text ?? '').toLowerCase().includes('won')).length
      return {
        total: arr.length,
        wins: w,
        winRate: arr.length > 0 ? Math.round((w / arr.length) * 100) : 0,
      }
    }
    return { chasing: calc(chasing), defending: calc(defending) }
  }, [filteredMatches, innings])

  // Section 4: Run Rate by Over
  const runRateByOver = useMemo(() => {
    const bccBallsMap: Record<number, { totalRuns: number; innings: Set<string> }> = {}
    for (const b of overBalls) {
      if (!bccBattingInningsIds.has(b.innings_id)) continue
      const ov = b.over_number
      if (!bccBallsMap[ov]) bccBallsMap[ov] = { totalRuns: 0, innings: new Set() }
      bccBallsMap[ov].totalRuns += (b.runs_off_bat ?? 0) + (b.extras_runs ?? 0)
      bccBallsMap[ov].innings.add(b.innings_id)
    }
    return Array.from({ length: 20 }, (_, i) => {
      const data = bccBallsMap[i]
      if (!data) return { over: i + 1, avgRuns: 0 }
      return { over: i + 1, avgRuns: Number((data.totalRuns / data.innings.size).toFixed(1)) }
    }).filter(d => d.avgRuns > 0 || Object.keys(bccBallsMap).length > 0)
  }, [overBalls, bccBattingInningsIds])

  // Section 5: Opening Partnerships
  const openingPartnerships = useMemo(() => {
    const inningsMap: Record<string, any[]> = {}
    for (const b of batting) {
      if (!bccBattingInningsIds.has(b.innings_id)) continue
      if (!inningsMap[b.innings_id]) inningsMap[b.innings_id] = []
      inningsMap[b.innings_id].push(b)
    }
    const pairMap: Record<
      string,
      { p1: string; p2: string; innings: number; totalRuns: number; best: number }
    > = {}
    for (const [, rows] of Object.entries(inningsMap)) {
      const op1 = rows.find(r => r.actual_batting_position === 1)
      const op2 = rows.find(r => r.actual_batting_position === 2)
      if (!op1 || !op2 || !op1.player_id || !op2.player_id) continue
      const key = [op1.player_id, op2.player_id].sort().join('|')
      const combined = (op1.runs ?? 0) + (op2.runs ?? 0)
      if (!pairMap[key])
        pairMap[key] = { p1: op1.player_name, p2: op2.player_name, innings: 0, totalRuns: 0, best: 0 }
      pairMap[key].innings += 1
      pairMap[key].totalRuns += combined
      pairMap[key].best = Math.max(pairMap[key].best, combined)
    }
    return Object.values(pairMap)
      .map(p => ({ ...p, avg: p.innings > 0 ? (p.totalRuns / p.innings).toFixed(1) : '—' }))
      .sort((a, b) => b.totalRuns - a.totalRuns)
  }, [batting, bccBattingInningsIds])

  // Section 6: Player Utilisation
  const playerUtilisation = useMemo(() => {
    const matchMap: Record<string, { name: string; matches: Set<string> }> = {}
    for (const b of batting) {
      if (!b.player_id || !b.player_name) continue
      if (!matchMap[b.player_id]) matchMap[b.player_id] = { name: b.player_name, matches: new Set() }
      matchMap[b.player_id].matches.add(b.match_id)
    }
    const total = filteredMatches.length || 1
    return Object.entries(matchMap)
      .map(([, { name, matches }]) => ({
        name,
        count: matches.size,
        pct: Math.round((matches.size / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  }, [batting, filteredMatches])

  // Section 7: Head-to-Head
  const headToHead = useMemo(() => {
    const oppMap: Record<
      string,
      { name: string; matches: number; wins: number; lastResult: string; lastDate: string }
    > = {}
    for (const m of filteredMatches) {
      const oppId = m.opponent_id
      const name = opponentMap[oppId] ?? 'Unknown'
      if (!oppMap[oppId]) oppMap[oppId] = { name, matches: 0, wins: 0, lastResult: '', lastDate: '' }
      oppMap[oppId].matches += 1
      if ((m.result_text ?? '').toLowerCase().includes('won')) oppMap[oppId].wins += 1
      oppMap[oppId].lastResult = m.result_text ?? ''
      oppMap[oppId].lastDate = m.match_date
    }
    return Object.values(oppMap)
      .map(o => ({ ...o, winRate: Math.round((o.wins / o.matches) * 100) }))
      .sort((a, b) => b.matches - a.matches)
  }, [filteredMatches, opponentMap])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .analytics-page { padding-top: var(--nav-h); min-height: 100vh; }

        /* Season filter */
        .stats-filters { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
        .stats-filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .filter-label {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35); flex-shrink: 0; width: 80px;
        }
        .season-tab {
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid rgba(59,130,246,0.18);
          background: transparent; color: rgba(147,197,253,0.5);
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; min-height: 32px;
          touch-action: manipulation; white-space: nowrap;
        }
        .season-tab:hover { border-color: rgba(59,130,246,0.4); color: rgba(147,197,253,0.8); }
        .season-tab.active { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); color: #93c5fd; }

        /* Analytics sections */
        .analytics-section { margin-bottom: 52px; }
        .section-header { margin-bottom: 18px; }
        .section-title {
          font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.02em;
        }
        .section-subtitle {
          font-family: 'Outfit', sans-serif; font-size: 13px;
          color: rgba(147,197,253,0.4); margin-top: 5px;
        }

        /* Summary cards */
        .an-cards {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 20px;
        }
        .an-cards-2 {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 16px; margin-bottom: 0;
        }
        .an-card {
          background: rgba(5,18,42,0.6); border: 1px solid rgba(59,130,246,0.1);
          border-radius: 10px; padding: 18px 14px; text-align: center; position: relative;
        }
        .an-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent);
        }
        .an-val {
          font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800;
          color: #60a5fa; line-height: 1; margin-bottom: 7px;
        }
        .an-val.sky { color: #38bdf8; }
        .an-val.green { color: #4ade80; }
        .an-val.red { color: #f87171; }
        .an-lbl {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: rgba(147,197,253,0.35);
        }

        /* Panels */
        .profile-panel {
          background: rgba(5,18,42,0.7); border: 1px solid rgba(59,130,246,0.12);
          border-radius: 14px; overflow: hidden; position: relative; margin-bottom: 16px;
        }
        .profile-panel::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent);
        }
        .panel-header { padding: 16px 22px; border-bottom: 1px solid rgba(59,130,246,0.1); }
        .panel-title {
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.01em;
        }

        /* Result strip */
        .result-strip {
          display: flex; gap: 8px; flex-wrap: wrap; padding: 16px 22px;
        }
        .result-chip {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 8px 10px; border-radius: 8px; cursor: default; min-width: 56px;
        }
        .result-chip.win { background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); }
        .result-chip.loss { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.15); }
        .result-chip.tie { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.15); }
        .result-chip-wl {
          font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; line-height: 1;
        }
        .result-chip.win .result-chip-wl { color: #4ade80; }
        .result-chip.loss .result-chip-wl { color: #f87171; }
        .result-chip.tie .result-chip-wl { color: #fbbf24; }
        .result-chip-opp {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 600;
          color: rgba(147,197,253,0.55); white-space: nowrap;
          max-width: 60px; overflow: hidden; text-overflow: ellipsis; text-align: center;
        }
        .result-chip-date {
          font-family: 'Outfit', sans-serif; font-size: 8px;
          color: rgba(147,197,253,0.3); white-space: nowrap;
        }

        /* Bar chart */
        .bar-chart { padding: 16px 22px; display: flex; flex-direction: column; gap: 10px; }
        .bar-row { display: flex; align-items: center; gap: 12px; }
        .bar-label {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(147,197,253,0.65); min-width: 130px; flex-shrink: 0;
        }
        .bar-track {
          flex: 1; height: 8px; background: rgba(37,99,235,0.1);
          border-radius: 4px; overflow: hidden;
        }
        .bar-fill {
          height: 100%; background: linear-gradient(90deg, #2563eb, #38bdf8);
          border-radius: 4px; transition: width 0.4s ease;
        }
        .bar-value {
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          color: #93c5fd; min-width: 48px; text-align: right; flex-shrink: 0;
        }

        /* Chart */
        .chart-wrap { padding: 16px 22px 12px; }
        .chart-label-top {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35); margin-bottom: 12px;
        }

        /* Table */
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .season-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .season-table th {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(147,197,253,0.4); text-align: right;
          padding: 10px 14px; border-bottom: 1px solid rgba(59,130,246,0.1); white-space: nowrap;
        }
        .season-table th:first-child { text-align: left; }
        .season-table td {
          padding: 10px 14px; font-family: 'Outfit', sans-serif;
          color: rgba(147,197,253,0.65); text-align: right; white-space: nowrap; vertical-align: middle;
        }
        .season-table td:first-child { text-align: left; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; color: #e2eeff; }
        .season-table tbody tr:last-child td { border-bottom: none; }
        .season-table tbody tr:hover { background: rgba(37,99,235,0.04); }
        .key-val { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800; color: #60a5fa; }

        /* Empty / loading */
        .empty-profile {
          padding: 56px 20px; text-align: center;
          font-family: 'Outfit', sans-serif; font-size: 14px;
          color: rgba(147,197,253,0.35); line-height: 1.7;
        }
        .profile-loading {
          text-align: center; padding: 80px 0;
          font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(147,197,253,0.35);
        }

        @media (max-width: 768px) {
          .an-cards { grid-template-columns: repeat(2, 1fr); }
          .an-cards-2 { grid-template-columns: 1fr; }
          .filter-label { display: none; }
          .bar-label { min-width: 90px; font-size: 11px; }
          .section-title { font-size: 18px; }
        }
        @media (max-width: 480px) {
          .an-cards { gap: 8px; grid-template-columns: 1fr 1fr; }
          .an-val { font-size: 26px; }
          .result-strip { gap: 6px; }
          .result-chip { min-width: 48px; padding: 6px 8px; }
        }
        @media (max-width: 360px) {
          .an-cards { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="analytics-page">
        {/* Hero */}
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Team Analytics</div>
            <h1>Analytics</h1>
            <p style={{ marginTop: 14, fontSize: 16, color: 'rgba(147,197,253,0.55)', fontFamily: 'Outfit,sans-serif' }}>
              Performance insights, trends, and team statistics.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingBottom: 80 }}>
          {/* Filters */}
          <div className="stats-filters" style={{ marginBottom: 32, marginTop: 0 }}>
            <div className="stats-filter-row">
              <span className="filter-label">Season</span>
              <button
                className={`season-tab${selectedSeasonId === 'career' ? ' active' : ''}`}
                onClick={() => setSelectedSeasonId('career')}
              >
                All Time
              </button>
              {seasons.map((s: any) => (
                <button
                  key={s.id}
                  className={`season-tab${selectedSeasonId === s.id ? ' active' : ''}`}
                  onClick={() => setSelectedSeasonId(s.id)}
                >
                  {s.name}{s.is_active ? ' \u2605' : ''}
                </button>
              ))}
            </div>
            {competitions.length > 0 && (
              <div className="stats-filter-row">
                <span className="filter-label">League</span>
                <button
                  className={`season-tab${selectedCompetitionId === 'all' ? ' active' : ''}`}
                  onClick={() => setSelectedCompetitionId('all')}
                >
                  All Leagues
                </button>
                {competitions.map((c: any) => (
                  <button
                    key={c.id}
                    className={`season-tab${selectedCompetitionId === c.id ? ' active' : ''}`}
                    onClick={() => setSelectedCompetitionId(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="profile-loading">Loading analytics\u2026</div>
          ) : filteredMatches.length === 0 ? (
            <div className="empty-profile">No completed matches found for this period.</div>
          ) : (
            <>
              {/* Section 1: Results Timeline */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">Season Results</div>
                  <div className="section-subtitle">Match-by-match record and cumulative performance</div>
                </div>

                <div className="an-cards">
                  <div className="an-card">
                    <div className="an-val green">{wins}</div>
                    <div className="an-lbl">Wins</div>
                  </div>
                  <div className="an-card">
                    <div className="an-val red">{losses}</div>
                    <div className="an-lbl">Losses</div>
                  </div>
                  <div className="an-card">
                    <div className="an-val">{ties}</div>
                    <div className="an-lbl">Ties / NR</div>
                  </div>
                  <div className="an-card">
                    <div className="an-val sky">{winRate}%</div>
                    <div className="an-lbl">Win Rate</div>
                  </div>
                </div>

                <div className="profile-panel">
                  <div className="panel-header">
                    <div className="panel-title">Match Results</div>
                  </div>
                  <div className="result-strip">
                    {results.map((r, i) => (
                      <div
                        key={i}
                        className={`result-chip ${r.isWin ? 'win' : r.isTie ? 'tie' : 'loss'}`}
                        title={`${r.dateStr} vs ${r.opponentName} \u2014 ${r.result_text}`}
                      >
                        <div className="result-chip-wl">{r.isWin ? 'W' : r.isTie ? 'T' : 'L'}</div>
                        <div className="result-chip-opp">{(r.opponentName ?? '').slice(0, 10)}</div>
                        <div className="result-chip-date">{r.dateStr}</div>
                      </div>
                    ))}
                  </div>
                  {results.length >= 2 && (
                    <div style={{ borderTop: '1px solid rgba(59,130,246,0.08)' }}>
                      <ResultsTrajectory results={results} />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Chasing vs Defending */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">Chasing vs Defending</div>
                  <div className="section-subtitle">Win rate when batting first vs batting second</div>
                </div>
                <div className="an-cards-2">
                  {[
                    { label: 'Batting First (Defending)', data: chasingDefending.defending, icon: '\uD83C\uDFCF' },
                    { label: 'Batting Second (Chasing)', data: chasingDefending.chasing, icon: '\uD83C\uDFAF' },
                  ].map(({ label, data, icon }) => (
                    <div key={label} className="profile-panel" style={{ marginBottom: 0 }}>
                      <div className="panel-header">
                        <div className="panel-title">{icon} {label}</div>
                      </div>
                      <div style={{ padding: '20px 22px' }}>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', marginBottom: 16 }}>
                          <div>
                            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 48, fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>
                              {data.winRate}%
                            </div>
                            <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(147,197,253,0.35)', marginTop: 6 }}>
                              Win Rate
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
                            <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 13, color: 'rgba(147,197,253,0.65)' }}>
                              <span style={{ color: '#4ade80', fontFamily: 'Syne,sans-serif', fontWeight: 700 }}>{data.wins}</span> won / {data.total} played
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 8, background: 'rgba(37,99,235,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${data.winRate}%`, background: 'linear-gradient(90deg, #2563eb, #4ade80)', borderRadius: 4 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Batting Order Contribution */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">Batting Order Contribution</div>
                  <div className="section-subtitle">Where do BCC&apos;s runs come from?</div>
                </div>
                <div className="profile-panel">
                  <div className="panel-header">
                    <div className="panel-title">Runs by Batting Tier</div>
                  </div>
                  <div style={{ padding: '20px 22px' }}>
                    {/* Stacked bar */}
                    <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                      {battingOrderContrib.map(t => (
                        <div
                          key={t.label}
                          title={`${t.label}: ${t.runs} runs (${t.pct}%)`}
                          style={{ width: `${t.pct}%`, background: t.color, minWidth: t.pct > 0 ? 2 : 0 }}
                        />
                      ))}
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                      {battingOrderContrib.map(t => (
                        <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: 11, color: 'rgba(147,197,253,0.6)' }}>{t.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Table */}
                    <div className="table-scroll">
                      <table className="season-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Tier</th>
                            <th>Inn</th>
                            <th>Runs</th>
                            <th>% of Total</th>
                            <th>Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {battingOrderContrib.map(t => (
                            <tr key={t.label}>
                              <td style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: 0 }} />
                                {t.label}
                              </td>
                              <td>{t.innings}</td>
                              <td><span className="key-val">{t.runs}</span></td>
                              <td>{t.pct}%</td>
                              <td>{t.avg}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Run Rate by Over */}
              {runRateByOver.some(d => d.avgRuns > 0) && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">Run Rate by Over</div>
                    <div className="section-subtitle">Average runs scored per over across all BCC batting innings</div>
                  </div>
                  <div className="profile-panel">
                    <div className="panel-header">
                      <div className="panel-title">Scoring Pattern</div>
                    </div>
                    <RunRateChart data={runRateByOver.filter(d => d.avgRuns > 0)} />
                  </div>
                </div>
              )}

              {/* Section 5: Opening Partnerships */}
              {openingPartnerships.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">Opening Partnerships</div>
                    <div className="section-subtitle">Combined run contribution from openers</div>
                  </div>
                  <div className="profile-panel">
                    <div className="panel-header">
                      <div className="panel-title">Opener Pairs</div>
                    </div>
                    <div className="table-scroll">
                      <table className="season-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Pair</th>
                            <th>Inn Together</th>
                            <th>Avg Combined</th>
                            <th>Best Combined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openingPartnerships.map((p, i) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'left' }}>
                                <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 12, color: '#e2eeff' }}>{p.p1}</div>
                                <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 11, color: 'rgba(147,197,253,0.45)' }}>&amp; {p.p2}</div>
                              </td>
                              <td>{p.innings}</td>
                              <td><span className="key-val">{p.avg}</span></td>
                              <td>{p.best}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 6: Player Appearances */}
              {playerUtilisation.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">Player Appearances</div>
                    <div className="section-subtitle">
                      Who plays most often? (out of {filteredMatches.length} matches)
                    </div>
                  </div>
                  <div className="profile-panel">
                    <div className="panel-header">
                      <div className="panel-title">Appearances</div>
                    </div>
                    <AnalyticsBarChart
                      items={playerUtilisation.map(p => ({
                        label: p.name,
                        value: p.count,
                        sublabel: `(${p.pct}%)`,
                      }))}
                      maxVal={Math.max(...playerUtilisation.map(p => p.count), 1)}
                    />
                  </div>
                </div>
              )}

              {/* Section 7: Head-to-Head Records */}
              {headToHead.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">Head-to-Head Records</div>
                    <div className="section-subtitle">BCC performance against each opponent</div>
                  </div>
                  <div className="profile-panel">
                    <div className="panel-header">
                      <div className="panel-title">vs Opponents</div>
                    </div>
                    <div className="table-scroll">
                      <table className="season-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Opponent</th>
                            <th>P</th>
                            <th>W</th>
                            <th>L</th>
                            <th>Win %</th>
                            <th style={{ textAlign: 'left' }}>Last Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {headToHead.map((h, i) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'left' }}>{h.name}</td>
                              <td>{h.matches}</td>
                              <td style={{ color: '#4ade80' }}>{h.wins}</td>
                              <td style={{ color: '#f87171' }}>{h.matches - h.wins}</td>
                              <td>
                                <span className="key-val" style={{ color: h.winRate >= 50 ? '#4ade80' : '#f87171' }}>
                                  {h.winRate}%
                                </span>
                              </td>
                              <td style={{ textAlign: 'left', color: 'rgba(147,197,253,0.5)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {h.lastResult || '\u2014'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
