'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Season      { id: string; name: string; is_active: boolean }
interface Competition { id: string; name: string; season_id: string; type: string }

type Tab     = 'batting' | 'bowling' | 'fielding'
type SortDir = 'asc' | 'desc'

const BATTING_COLS = [
  { key: 'matches',       label: 'M',    title: 'Matches' },
  { key: 'innings',       label: 'Inn',  title: 'Innings batted' },
  { key: 'not_outs',      label: 'NO',   title: 'Not outs' },
  { key: 'total_runs',    label: 'Runs', title: 'Total runs', primary: true },
  { key: 'highest_score', label: 'HS',   title: 'Highest score' },
  { key: 'average',       label: 'Avg',  title: 'Batting average (runs per dismissal)' },
  { key: 'strike_rate',   label: 'SR',   title: 'Strike rate (runs per 100 balls)' },
  { key: 'fifties',       label: '50s',  title: 'Half centuries' },
  { key: 'hundreds',      label: '100s', title: 'Centuries' },
  { key: 'ducks',         label: '0s',   title: 'Dismissed for a duck' },
  { key: 'fours',         label: '4s',   title: 'Fours hit' },
  { key: 'sixes',         label: '6s',   title: 'Sixes hit' },
  { key: 'balls_faced',   label: 'BF',   title: 'Balls faced' },
]

const BOWLING_COLS = [
  { key: 'matches',              label: 'M',    title: 'Matches' },
  { key: 'legal_balls',          label: 'O',    title: 'Overs bowled' },
  { key: 'maidens',              label: 'Mdns', title: 'Maiden overs' },
  { key: 'wickets',              label: 'Wkts', title: 'Wickets', primary: true },
  { key: 'runs_conceded',        label: 'Runs', title: 'Runs conceded' },
  { key: 'best_bowling',         label: 'Best', title: 'Best bowling figures in an innings' },
  { key: 'bowling_avg',          label: 'Avg',  title: 'Bowling average (runs per wicket)' },
  { key: 'economy',              label: 'Econ', title: 'Economy rate (runs per over)' },
  { key: 'wides',                label: 'Wd',   title: 'Wides bowled' },
  { key: 'no_balls',             label: 'NB',   title: 'No balls bowled' },
]

const FIELDING_COLS = [
  { key: 'matches',          label: 'M',     title: 'Matches' },
  { key: 'total_dismissals', label: 'Total', title: 'Total dismissals (catches + stumpings + run outs)', primary: true },
  { key: 'catches',          label: 'Ct',    title: 'Catches taken' },
  { key: 'caught_bowled',    label: 'C&B',   title: 'Caught and bowled (bowler takes own catch)' },
  { key: 'stumpings',        label: 'St',    title: 'Stumpings (keeper)' },
  { key: 'run_outs',         label: 'RO',    title: 'Run outs' },
]

function overs(legalBalls: number | null) {
  if (legalBalls == null) return '—'
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

function fmt(val: any, dp = 2): string {
  if (val == null || val === '') return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(dp)
}

function bestFigures(wkts: any, runs: any): string {
  if (wkts == null || Number(wkts) === 0) return '—'
  if (runs == null) return `${wkts}/—`
  return `${wkts}/${runs}`
}

const TAB_DEFAULTS: Record<Tab, string> = {
  batting:  'total_runs',
  bowling:  'wickets',
  fielding: 'total_dismissals',
}

export default function StatsContent({ category }: { category: 'senior' | 'junior' }) {
  const [seasons, setSeasons]           = useState<Season[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | 'career'>('career')
  const [selectedCompId, setSelectedCompId]     = useState<string | null>(null)

  const [tab, setTab]           = useState<Tab>('batting')
  const [batting, setBatting]   = useState<any[]>([])
  const [bowling, setBowling]   = useState<any[]>([])
  const [fielding, setFielding] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState<string>('total_runs')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Load seasons + competitions once
  useEffect(() => {
    async function init() {
      const [{ data: sData }, { data: cData }] = await Promise.all([
        supabase.from('seasons').select('id, name, is_active').order('start_date', { ascending: false }),
        supabase.from('competitions').select('id, name, season_id, type').order('name'),
      ])
      const sList = sData ?? []
      setSeasons(sList)
      setCompetitions(cData ?? [])
      const active = sList.find((s: Season) => s.is_active)
      setSelectedSeasonId(active ? active.id : 'career')
    }
    init()
  }, [])

  // Reset competition when season changes
  useEffect(() => { setSelectedCompId(null) }, [selectedSeasonId])

  // Reset sort when tab changes
  useEffect(() => {
    setSortKey(TAB_DEFAULTS[tab])
    setSortDir('desc')
  }, [tab])

  // Fetch stats whenever the active filter or category changes
  useEffect(() => {
    setLoading(true)
    async function load() {
      if (selectedCompId) {
        const [bRes, wRes, fRes] = await Promise.all([
          supabase.from('competition_batting_stats').select('*').eq('competition_id', selectedCompId).eq('team_category', category).order('total_runs', { ascending: false }),
          supabase.from('competition_bowling_stats').select('*').eq('competition_id', selectedCompId).eq('team_category', category).order('wickets', { ascending: false }),
          supabase.from('competition_fielding_stats').select('*').eq('competition_id', selectedCompId).eq('team_category', category).order('total_dismissals', { ascending: false }),
        ])
        setBatting(bRes.data ?? [])
        setBowling(wRes.data ?? [])
        setFielding(fRes.data ?? [])
      } else if (selectedSeasonId === 'career') {
        const [bRes, wRes, fRes] = await Promise.all([
          supabase.from('career_batting_stats').select('*').eq('team_category', category).order('total_runs', { ascending: false }),
          supabase.from('career_bowling_stats').select('*').eq('team_category', category).order('wickets', { ascending: false }),
          supabase.from('career_fielding_stats').select('*').eq('team_category', category).order('total_dismissals', { ascending: false }),
        ])
        setBatting(bRes.data ?? [])
        setBowling(wRes.data ?? [])
        setFielding(fRes.data ?? [])
      } else {
        const [bRes, wRes, fRes] = await Promise.all([
          supabase.from('season_batting_stats').select('*').eq('season_id', selectedSeasonId).eq('team_category', category).order('total_runs', { ascending: false }),
          supabase.from('season_bowling_stats').select('*').eq('season_id', selectedSeasonId).eq('team_category', category).order('wickets', { ascending: false }),
          supabase.from('season_fielding_stats').select('*').eq('season_id', selectedSeasonId).eq('team_category', category).order('total_dismissals', { ascending: false }),
        ])
        setBatting(bRes.data ?? [])
        setBowling(wRes.data ?? [])
        setFielding(fRes.data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [selectedSeasonId, selectedCompId, category])

  const visibleComps = useMemo(() => {
    if (selectedSeasonId === 'career') return []
    return competitions.filter(c => c.season_id === selectedSeasonId)
  }, [competitions, selectedSeasonId])

  const rows = useMemo(() => {
    const rawMap: Record<Tab, any[]> = { batting, bowling, fielding }
    const raw = rawMap[tab]

    const augmented = tab === 'bowling'
      ? raw.map(r => ({
          ...r,
          bowling_avg:  r.wickets > 0 && r.runs_conceded != null
            ? +(r.runs_conceded / r.wickets).toFixed(2)
            : null,
          best_bowling: Number(r.best_bowling_wickets) > 0
            ? r.best_bowling_wickets * 10000 - (r.best_bowling_runs ?? 9999)
            : -1,
        }))
      : raw

    const q = search.trim().toLowerCase()
    const filtered = q
      ? augmented.filter((r: any) => r.player_name?.toLowerCase().includes(q))
      : augmented

    return [...filtered].sort((a: any, b: any) => {
      const av = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
      const bv = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [tab, batting, bowling, fielding, search, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const cols = tab === 'batting' ? BATTING_COLS : tab === 'bowling' ? BOWLING_COLS : FIELDING_COLS
  const label = category === 'junior' ? 'Junior' : 'Senior'

  return (
    <>
      <style>{`
        .stats-page { padding-top: var(--nav-h); min-height: 100vh; }

        /* ── TABS ── */
        .stats-tabs-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-bottom: 28px;
        }
        .stats-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid rgba(59,130,246,0.12);
          min-width: max-content;
        }
        .stats-tab {
          padding: 14px 28px;
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 800;
          color: rgba(147,197,253,0.4);
          border: none; background: none; cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
          display: flex; align-items: center; gap: 8px;
          letter-spacing: -0.01em;
          touch-action: manipulation;
        }
        .stats-tab:hover { color: rgba(147,197,253,0.75); }
        .stats-tab.active { color: #60a5fa; border-bottom-color: #3b82f6; }
        .stats-tab-icon {
          width: 26px; height: 26px; border-radius: 7px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
        }
        .stats-tab.active .stats-tab-icon {
          background: rgba(37,99,235,0.25);
          border-color: rgba(59,130,246,0.4);
        }

        /* ── FILTERS ── */
        .stats-filters { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
        .stats-filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .filter-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          flex-shrink: 0; width: 80px;
        }
        .season-tab, .comp-tab {
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid rgba(59,130,246,0.18);
          background: transparent; color: rgba(147,197,253,0.5);
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; min-height: 32px;
          touch-action: manipulation; white-space: nowrap;
        }
        .season-tab:hover, .comp-tab:hover {
          border-color: rgba(59,130,246,0.4); color: rgba(147,197,253,0.8);
        }
        .season-tab.active {
          background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); color: #93c5fd;
        }
        .comp-tab.active {
          background: rgba(14,165,233,0.12); border-color: rgba(14,165,233,0.4); color: #38bdf8;
        }

        /* ── SEARCH ── */
        .stats-search-wrap { position: relative; max-width: 320px; width: 100%; }
        .stats-search-icon {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%);
          color: rgba(147,197,253,0.35); font-size: 14px; pointer-events: none;
        }
        .stats-search {
          width: 100%; padding: 9px 14px 9px 36px;
          background: rgba(5,18,42,0.7); border: 1px solid rgba(59,130,246,0.18);
          border-radius: 8px; color: #e2eeff;
          font-family: 'Outfit', sans-serif; font-size: 13px;
          outline: none; transition: border-color 0.15s; box-sizing: border-box;
        }
        .stats-search::placeholder { color: rgba(147,197,253,0.3); }
        .stats-search:focus { border-color: rgba(59,130,246,0.45); }

        /* ── SUMMARY CARDS ── */
        .stats-summary {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 24px;
        }
        .summary-card {
          background: rgba(5,18,42,0.6); border: 1px solid rgba(59,130,246,0.1);
          border-radius: 10px; padding: 16px; text-align: center;
        }
        .summary-val {
          font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800;
          color: #93c5fd; line-height: 1; margin-bottom: 5px;
        }
        .summary-lbl {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
        }

        /* ── TABLE ── */
        .stats-panel {
          background: rgba(5,18,42,0.7); border: 1px solid rgba(59,130,246,0.12);
          border-radius: 14px; overflow: hidden; position: relative; margin-bottom: 60px;
        }
        .stats-panel::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent);
        }
        .stats-panel-header {
          padding: 16px 22px; border-bottom: 1px solid rgba(59,130,246,0.1);
          display: flex; align-items: center; justify-content: space-between;
        }
        .stats-panel-title {
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.01em;
          display: flex; align-items: center; gap: 8px;
        }
        .stats-panel-count {
          font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(147,197,253,0.4);
        }

        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .stats-table th {
          font-family: 'Outfit', sans-serif;
          font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(147,197,253,0.4); text-align: right;
          padding: 10px 14px; border-bottom: 1px solid rgba(59,130,246,0.1);
          white-space: nowrap; cursor: pointer; user-select: none; transition: color 0.15s;
        }
        .stats-table th:hover { color: rgba(147,197,253,0.7); }
        .stats-table th.sorted { color: #60a5fa; }
        .stats-table th:first-child { text-align: center; cursor: default; }
        .stats-table th.player-col { text-align: left; cursor: default; }
        .sort-arrow { margin-left: 3px; opacity: 0.7; }

        .stats-table td {
          padding: 11px 14px; border-bottom: 1px solid rgba(59,130,246,0.06);
          font-family: 'Outfit', sans-serif; color: rgba(147,197,253,0.65);
          text-align: right; vertical-align: middle; white-space: nowrap;
        }
        .stats-table td:first-child { text-align: center; }
        .stats-table td.player-col { text-align: left; }
        .stats-table tbody tr:last-child td { border-bottom: none; }
        .stats-table tbody tr:hover { background: rgba(37,99,235,0.04); }

        .rank-cell {
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 800; width: 32px;
        }
        .rank-1 { color: #fbbf24; }
        .rank-2 { color: rgba(200,215,240,0.7); }
        .rank-3 { color: #cd7f32; }
        .rank-n { color: rgba(147,197,253,0.2); }

        .player-name-cell {
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          color: #e2eeff; letter-spacing: -0.01em; min-width: 130px;
        }
        .key-stat {
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800; color: #60a5fa;
        }
        .best-figures {
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: #93c5fd;
        }

        .player-link {
          color: #e2eeff; text-decoration: none; transition: color 0.15s;
        }
        .player-link:hover {
          color: #60a5fa; text-decoration: underline;
          text-decoration-color: rgba(96,165,250,0.4); text-underline-offset: 3px;
        }

        .empty-stats {
          padding: 56px 20px; text-align: center;
          font-family: 'Outfit', sans-serif; font-size: 14px; line-height: 1.7;
          color: rgba(147,197,253,0.35);
        }

        /* ── FIELDING NOTE ── */
        .fielding-note {
          font-family: 'Outfit', sans-serif; font-size: 12px;
          color: rgba(147,197,253,0.4); line-height: 1.6;
          padding: 12px 16px; border-radius: 8px;
          background: rgba(37,99,235,0.05); border: 1px solid rgba(59,130,246,0.1);
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .stats-tabs-scroll { margin-bottom: 20px; }
          .stats-tab { padding: 12px 16px; font-size: 14px; }
          .filter-label { display: none; }
          .stats-summary { grid-template-columns: repeat(2, 1fr); }
          .stats-table { font-size: 12px; }
          .stats-table th { padding: 8px 10px; font-size: 8px; }
          .stats-table td { padding: 9px 10px; }
          .key-stat { font-size: 14px; }
          .player-name-cell { font-size: 12px; min-width: 100px; }
          .summary-val { font-size: 22px; }
        }
        @media (max-width: 480px) {
          .stats-tab { padding: 10px 12px; font-size: 13px; }
          .stats-table { font-size: 11px; }
          .stats-table th { font-size: 8px; padding: 7px 8px; letter-spacing: 0.08em; }
          .stats-table td { padding: 8px 8px; }
          .key-stat { font-size: 13px; }
          .stats-summary { gap: 8px; }
        }
      `}</style>

      <div className="stats-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">{label} Statistics</div>
            <h1>{label} Stats</h1>
            <p style={{ marginTop: 14, fontSize: 16, color: 'rgba(147,197,253,0.55)', fontFamily: 'Outfit, sans-serif' }}>
              Batting, bowling, and fielding figures for all {label.toLowerCase()} players.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingBottom: 80 }}>

          {/* Tabs */}
          <div className="stats-tabs-scroll">
            <div className="stats-tabs">
              <button className={`stats-tab${tab === 'batting'  ? ' active' : ''}`} onClick={() => setTab('batting')}>
                <span className="stats-tab-icon">🏏</span> Batting
              </button>
              <button className={`stats-tab${tab === 'bowling'  ? ' active' : ''}`} onClick={() => setTab('bowling')}>
                <span className="stats-tab-icon">⚾</span> Bowling
              </button>
              <button className={`stats-tab${tab === 'fielding' ? ' active' : ''}`} onClick={() => setTab('fielding')}>
                <span className="stats-tab-icon">🧤</span> Fielding
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="stats-filters">
            <div className="stats-filter-row">
              <span className="filter-label">Season</span>
              <button
                className={`season-tab${selectedSeasonId === 'career' ? ' active' : ''}`}
                onClick={() => setSelectedSeasonId('career')}
              >All Time</button>
              {seasons.map(s => (
                <button
                  key={s.id}
                  className={`season-tab${selectedSeasonId === s.id ? ' active' : ''}`}
                  onClick={() => setSelectedSeasonId(s.id)}
                >
                  {s.name}{s.is_active ? ' ★' : ''}
                </button>
              ))}
            </div>

            {visibleComps.length > 0 && (
              <div className="stats-filter-row">
                <span className="filter-label">League</span>
                {visibleComps.map(c => (
                  <button
                    key={c.id}
                    className={`comp-tab${selectedCompId === c.id ? ' active' : ''}`}
                    onClick={() => setSelectedCompId(p => p === c.id ? null : c.id)}
                    title={c.type}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <div className="stats-filter-row">
              <span className="filter-label">Player</span>
              <div className="stats-search-wrap">
                <span className="stats-search-icon">🔍</span>
                <input
                  type="text"
                  className="stats-search"
                  placeholder="Search player…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'rgba(147,197,253,0.35)', fontFamily: 'Outfit, sans-serif', fontSize: 14 }}>
              Loading stats…
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {tab === 'batting' && batting.length > 0 && (
                <div className="stats-summary">
                  <div className="summary-card">
                    <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.total_runs) || 0), 0)}</div>
                    <div className="summary-lbl">Total Runs</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-val">{Math.max(0, ...rows.map(r => Number(r.highest_score) || 0)) || '—'}</div>
                    <div className="summary-lbl">High Score</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.fifties) || 0), 0)}</div>
                    <div className="summary-lbl">Half Centuries</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.hundreds) || 0), 0)}</div>
                    <div className="summary-lbl">Centuries</div>
                  </div>
                </div>
              )}

              {tab === 'bowling' && bowling.length > 0 && (
                <div className="stats-summary">
                  <div className="summary-card">
                    <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.wickets) || 0), 0)}</div>
                    <div className="summary-lbl">Total Wickets</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-val">{overs(rows.reduce((s, r) => s + (Number(r.legal_balls) || 0), 0))}</div>
                    <div className="summary-lbl">Overs Bowled</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.maidens) || 0), 0)}</div>
                    <div className="summary-lbl">Maidens</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.wides) || 0) + (Number(r.no_balls) || 0), 0)}</div>
                    <div className="summary-lbl">Extras (Wd+NB)</div>
                  </div>
                </div>
              )}

              {tab === 'fielding' && fielding.length > 0 && (
                <>
                  <div className="stats-summary">
                    <div className="summary-card">
                      <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.total_dismissals) || 0), 0)}</div>
                      <div className="summary-lbl">Total Dismissals</div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.catches) || 0), 0)}</div>
                      <div className="summary-lbl">Catches</div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.stumpings) || 0), 0)}</div>
                      <div className="summary-lbl">Stumpings</div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-val">{rows.reduce((s, r) => s + (Number(r.run_outs) || 0), 0)}</div>
                      <div className="summary-lbl">Run Outs</div>
                    </div>
                  </div>
                  <div className="fielding-note">
                    <strong>Note:</strong> Fielding stats only include dismissals where the fielder was explicitly recorded during scoring. Ct = outfield catches &nbsp;·&nbsp; C&B = caught &amp; bowled &nbsp;·&nbsp; St = stumpings &nbsp;·&nbsp; RO = run outs.
                  </div>
                </>
              )}

              {/* Table */}
              <div className="stats-panel">
                <div className="stats-panel-header">
                  <div className="stats-panel-title">
                    {tab === 'batting' ? '🏏 Batting' : tab === 'bowling' ? '⚾ Bowling' : '🧤 Fielding'}
                    {selectedCompId && visibleComps.find(c => c.id === selectedCompId) && (
                      <span style={{ fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, color: '#38bdf8', marginLeft: 8 }}>
                        · {visibleComps.find(c => c.id === selectedCompId)!.name}
                      </span>
                    )}
                  </div>
                  <div className="stats-panel-count">
                    {rows.length} player{rows.length !== 1 ? 's' : ''}{search && ` matching "${search}"`}
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="empty-stats">
                    {search
                      ? `No players found matching "${search}"`
                      : 'No data yet. Stats appear once matches are scored.'}
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th className="player-col">Player</th>
                          {cols.map(c => (
                            <th
                              key={c.key}
                              className={sortKey === c.key ? 'sorted' : ''}
                              onClick={() => toggleSort(c.key)}
                              title={c.title}
                            >
                              {c.label}
                              {sortKey === c.key && (
                                <span className="sort-arrow">{sortDir === 'desc' ? '↓' : '↑'}</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p: any, i: number) => (
                          <tr key={p.player_id ?? i}>
                            <td>
                              <span className={`rank-cell ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="player-col player-name-cell">
                              <Link href={`/stats/${p.player_id}`} className="player-link">
                                {p.player_name}
                              </Link>
                            </td>

                            {tab === 'batting' && <>
                              <td>{fmt(p.matches, 0)}</td>
                              <td>{fmt(p.innings, 0)}</td>
                              <td>{fmt(p.not_outs, 0)}</td>
                              <td><span className="key-stat">{fmt(p.total_runs, 0)}</span></td>
                              <td>{fmt(p.highest_score, 0)}</td>
                              <td>{fmt(p.average)}</td>
                              <td>{fmt(p.strike_rate)}</td>
                              <td>{fmt(p.fifties, 0)}</td>
                              <td>{fmt(p.hundreds, 0)}</td>
                              <td>{fmt(p.ducks, 0)}</td>
                              <td>{fmt(p.fours, 0)}</td>
                              <td>{fmt(p.sixes, 0)}</td>
                              <td>{fmt(p.balls_faced, 0)}</td>
                            </>}

                            {tab === 'bowling' && <>
                              <td>{fmt(p.matches, 0)}</td>
                              <td>{overs(p.legal_balls)}</td>
                              <td>{fmt(p.maidens, 0)}</td>
                              <td><span className="key-stat">{fmt(p.wickets, 0)}</span></td>
                              <td>{fmt(p.runs_conceded, 0)}</td>
                              <td><span className="best-figures">{bestFigures(p.best_bowling_wickets, p.best_bowling_runs)}</span></td>
                              <td>{fmt(p.bowling_avg)}</td>
                              <td>{fmt(p.economy)}</td>
                              <td>{fmt(p.wides, 0)}</td>
                              <td>{fmt(p.no_balls, 0)}</td>
                            </>}

                            {tab === 'fielding' && <>
                              <td>{fmt(p.matches, 0)}</td>
                              <td><span className="key-stat">{fmt(p.total_dismissals, 0)}</span></td>
                              <td>{fmt(p.catches, 0)}</td>
                              <td>{fmt(p.caught_bowled, 0)}</td>
                              <td>{fmt(p.stumpings, 0)}</td>
                              <td>{fmt(p.run_outs, 0)}</td>
                            </>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
