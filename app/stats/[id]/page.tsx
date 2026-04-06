'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlayerInfo {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  batting_style: string | null
  bowling_style: string | null
  is_active: boolean
}

interface CareerBatting {
  player_id: string
  player_name: string
  matches: number
  innings: number
  not_outs: number
  total_runs: number
  highest_score: number | null
  fifties: number
  hundreds: number
  ducks: number
  fours: number
  sixes: number
  balls_faced: number
  dismissals: number
  average: number | null
  strike_rate: number | null
}

interface CareerBowling {
  player_id: string
  player_name: string
  matches: number
  legal_balls: number
  runs_conceded: number
  wickets: number
  maidens: number
  best_bowling_wickets: number | null
  best_bowling_runs: number | null
  wides: number
  no_balls: number
  economy: number | null
}

interface CareerFielding {
  player_id: string
  player_name: string
  matches: number
  catches: number
  caught_bowled: number
  stumpings: number
  run_outs: number
  total_dismissals: number
}

interface SeasonBatting extends CareerBatting {
  season_id: string
  seasons: { name: string } | null
}

interface SeasonBowling extends CareerBowling {
  season_id: string
  seasons: { name: string } | null
}

interface SeasonFielding extends CareerFielding {
  season_id: string
  seasons: { name: string } | null
}

interface BattingInning {
  runs: number | null
  balls_faced: number | null
  fours: number | null
  sixes: number | null
  strike_rate: number | null
  dismissal_type: string | null
  actual_batting_position: number | null
  opposition_name: string | null
  match_id: string | null
  match_date?: string | null
}

interface BowlingInning {
  legal_balls: number | null
  runs_conceded: number | null
  wickets: number | null
  wides: number | null
  no_balls: number | null
  maidens: number | null
  economy: number | null
  opposition_name: string | null
  match_id: string | null
  match_date?: string | null
}

type ProfileTab = 'batting' | 'bowling' | 'fielding'

// ── Helpers ───────────────────────────────────────────────────────────────────

function overs(legalBalls: number | null): string {
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

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function labelDismissal(type: string | null): string {
  if (!type) return 'Not Out'
  const map: Record<string, string> = {
    bowled: 'Bowled', caught: 'Caught', lbw: 'LBW',
    run_out: 'Run Out', stumped: 'Stumped', hit_wicket: 'Hit Wicket',
    caught_bowled: 'C&B', retired_hurt: 'Retired', retired_out: 'Retired Out',
    timed_out: 'Timed Out', handled_ball: 'Handled Ball',
    obstructing_field: 'Obstruction',
  }
  return map[type] ?? type
}

function bowlingAvgFmt(runs: number | null, wickets: number | null): string {
  if (!wickets || wickets === 0 || runs == null) return '—'
  return (runs / wickets).toFixed(2)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CSSBarChart({ items, maxVal }: {
  items: Array<{ label: string; value: number; sublabel?: string }>
  maxVal: number
}) {
  return (
    <div className="bar-chart">
      {items.map(item => (
        <div key={item.label} className="bar-row">
          <div className="bar-label">{item.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%' }}
            />
          </div>
          <div className="bar-value">
            {item.value}{item.sublabel ? ` ${item.sublabel}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

function ColorBarChart({ items, maxVal }: {
  items: Array<{ label: string; value: number; sublabel?: string; color?: string }>
  maxVal: number
}) {
  return (
    <div className="bar-chart">
      {items.map(item => (
        <div key={item.label} className="bar-row">
          <div className="bar-label">{item.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{
              width: maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%',
              background: item.color
                ? `linear-gradient(90deg, ${item.color}cc, ${item.color})`
                : 'linear-gradient(90deg, #2563eb, #38bdf8)',
            }} />
          </div>
          <div className="bar-value">{item.value}{item.sublabel ? ` ${item.sublabel}` : ''}</div>
        </div>
      ))}
    </div>
  )
}

function SVGLineChart({ data, valueKey, label }: {
  data: SeasonBatting[]
  valueKey: 'total_runs' | 'average' | 'strike_rate'
  label: string
}) {
  if (data.length < 2) return null

  const values = data.map(d => Number((d as any)[valueKey]) || 0)
  const maxVal = Math.max(...values, 1)
  const W = 480, H = 130
  const PAD = { top: 18, bottom: 28, left: 8, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW),
    y: PAD.top + (1 - (Number((d as any)[valueKey]) || 0) / maxVal) * innerH,
    val: Number((d as any)[valueKey]) || 0,
    season: d.seasons?.name ?? d.season_id,
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(pct => (
          <line
            key={pct}
            x1={PAD.left} y1={PAD.top + (1 - pct) * innerH}
            x2={W - PAD.right} y2={PAD.top + (1 - pct) * innerH}
            stroke="rgba(59,130,246,0.1)" strokeWidth="1"
          />
        ))}
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${polyline} ${W - PAD.right},${PAD.top + innerH}`}
          fill={`url(#grad-${valueKey})`}
          opacity="0.2"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="#050c1a" strokeWidth="2" />
            <text
              x={p.x} y={p.y - 9}
              textAnchor="middle"
              fill="#93c5fd"
              fontSize="9"
              fontFamily="Syne, sans-serif"
              fontWeight="700"
            >
              {p.val}
            </text>
            <text
              x={p.x} y={H - 4}
              textAnchor="middle"
              fill="rgba(147,197,253,0.4)"
              fontSize="8"
              fontFamily="Outfit, sans-serif"
            >
              {p.season}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// Form guide — last N innings as bars
function FormGuide({ innings, average }: { innings: BattingInning[], average: number | null }) {
  const shown = [...innings].slice(0, 10).reverse()
  if (!shown.length) return null
  const maxRuns = Math.max(...shown.map(i => i.runs ?? 0), 1)
  return (
    <div className="form-guide">
      <div className="form-guide-bars">
        {shown.map((inn, i) => {
          const runs = inn.runs ?? 0
          const isOut = !!inn.dismissal_type
          const color = (runs === 0 && isOut) ? '#ef4444'
            : runs >= 100 ? '#fbbf24'
            : runs >= 50 ? '#38bdf8'
            : (average && runs >= Number(average)) ? '#4ade80'
            : 'rgba(59,130,246,0.55)'
          const height = Math.max((runs / maxRuns) * 84, runs === 0 ? 6 : 3)
          return (
            <div key={i} className="form-bar-wrap" title={`${runs}${!isOut ? '*' : ''} vs ${inn.opposition_name ?? '?'} — ${inn.match_date ? new Date(inn.match_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : ''}`}>
              <div className="form-bar-runs">{runs}{!isOut ? '*' : ''}</div>
              <div className="form-bar-body" style={{ height, background: color }} />
              <div className="form-bar-opp">{(inn.opposition_name ?? '?').slice(0, 8)}</div>
            </div>
          )
        })}
      </div>
      <div className="form-legend">
        <span style={{ color: '#fbbf24' }}>■</span> 100+&nbsp;&nbsp;
        <span style={{ color: '#38bdf8' }}>■</span> 50+&nbsp;&nbsp;
        <span style={{ color: '#4ade80' }}>■</span> Above avg&nbsp;&nbsp;
        <span style={{ color: 'rgba(59,130,246,0.55)' }}>■</span> Below avg&nbsp;&nbsp;
        <span style={{ color: '#ef4444' }}>■</span> Duck
      </div>
    </div>
  )
}

// Scatter plot — runs vs balls
function ScatterPlot({ innings }: { innings: BattingInning[] }) {
  const valid = innings.filter(i => i.balls_faced != null && i.runs != null && i.balls_faced > 0)
  if (valid.length < 3) return null
  const maxBalls = Math.max(...valid.map(i => i.balls_faced!), 10)
  const maxRuns = Math.max(...valid.map(i => i.runs!), 10)
  const W = 380, H = 200
  const PAD = { top: 10, bottom: 32, left: 38, right: 10 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom
  const toX = (b: number) => PAD.left + (b / maxBalls) * iW
  const toY = (r: number) => PAD.top + (1 - r / maxRuns) * iH
  const diagEnd = Math.min(maxBalls, maxRuns)

  const yTicks = [0, Math.round(maxRuns * 0.5), maxRuns]
  const xTicks = [0, Math.round(maxBalls * 0.5), maxBalls]

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">Runs vs Balls Faced — dots above diagonal = SR &gt; 100</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={PAD.left + iW} y2={toY(v)} stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
            <text x={PAD.left - 4} y={toY(v) + 3} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">{v}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={v}>
            <line x1={toX(v)} y1={PAD.top} x2={toX(v)} y2={PAD.top + iH} stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
            <text x={toX(v)} y={H - 14} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">{v}</text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + iH} stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH} stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1={toX(0)} y1={toY(0)} x2={toX(diagEnd)} y2={toY(diagEnd)} stroke="rgba(56,189,248,0.25)" strokeWidth="1" strokeDasharray="4,3" />
        <text x={toX(diagEnd)} y={toY(diagEnd) - 5} fill="rgba(56,189,248,0.4)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">SR=100</text>
        <text x={8} y={PAD.top + iH / 2} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle" transform={`rotate(-90,8,${PAD.top + iH / 2})`}>Runs</text>
        <text x={PAD.left + iW / 2} y={H - 2} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Balls</text>
        {valid.map((inn, i) => {
          const x = toX(inn.balls_faced!)
          const y = toY(inn.runs!)
          const big = (inn.runs ?? 0) >= 50
          const notOut = !inn.dismissal_type
          return (
            <circle key={i} cx={x} cy={y} r={big ? 5 : 3}
              fill={big ? '#fbbf24' : notOut ? 'rgba(74,222,128,0.75)' : 'rgba(59,130,246,0.65)'}
              stroke={big ? 'rgba(245,158,11,0.5)' : 'none'} strokeWidth="1.5" />
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, padding: '6px 0 0', fontSize: 10, fontFamily: 'Outfit,sans-serif', color: 'rgba(147,197,253,0.4)' }}>
        <span><span style={{ color: '#fbbf24' }}>●</span> 50+</span>
        <span><span style={{ color: 'rgba(74,222,128,0.75)' }}>●</span> Not out</span>
        <span><span style={{ color: 'rgba(59,130,246,0.65)' }}>●</span> Dismissed</span>
      </div>
    </div>
  )
}

// Win/loss comparison table
function WinLossPanel({ rows, statCols }: {
  rows: Array<{ label: string; color: string; innings: number; [k: string]: any }>
  statCols: Array<{ key: string; label: string }>
}) {
  return (
    <div className="table-scroll">
      <table className="season-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Result</th>
            <th>Inn</th>
            {statCols.map(c => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td style={{ textAlign: 'left' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8, verticalAlign: 'middle' }} />
                {row.label}
              </td>
              <td>{row.innings || '—'}</td>
              {statCols.map(c => <td key={c.key}>{row[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlayerProfilePage() {
  const params = useParams()
  const playerId = params.id as string

  const [tab, setTab] = useState<ProfileTab>('batting')
  const [player, setPlayer] = useState<PlayerInfo | null>(null)
  const [careerBat, setCareerBat] = useState<CareerBatting | null>(null)
  const [careerBowl, setCareerBowl] = useState<CareerBowling | null>(null)
  const [careerField, setCareerField] = useState<CareerFielding | null>(null)
  const [seasonBat, setSeasonBat] = useState<SeasonBatting[]>([])
  const [seasonBowl, setSeasonBowl] = useState<SeasonBowling[]>([])
  const [seasonField, setSeasonField] = useState<SeasonFielding[]>([])
  const [battingLog, setBattingLog] = useState<BattingInning[]>([])
  const [bowlingLog, setBowlingLog] = useState<BowlingInning[]>([])
  const [bowlingWickets, setBowlingWickets] = useState<{ dismissal_type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showAllBat, setShowAllBat] = useState(false)
  const [showAllBowl, setShowAllBowl] = useState(false)

  // Wave 3 state
  const [batBalls, setBatBalls] = useState<any[]>([])
  const [bowlBalls, setBowlBalls] = useState<any[]>([])
  const [matchResultMap, setMatchResultMap] = useState<Record<string, string>>({})
  const [matchOpponentMap, setMatchOpponentMap] = useState<Record<string, string>>({})
  const [mpBatPosMap, setMpBatPosMap] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!playerId) return
    setLoading(true)
    setNotFound(false)

    async function load() {
      // Wave 1 — all parallel
      const [
        playerRes,
        careerBatRes,
        careerBowlRes,
        careerFieldRes,
        seasonBatRes,
        seasonBowlRes,
        seasonFieldRes,
        battingInningsRes,
        bowlingInningsRes,
      ] = await Promise.all([
        supabase.from('players').select('*').eq('id', playerId).maybeSingle(),
        supabase.from('career_batting_stats').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('career_bowling_stats').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('career_fielding_stats').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('season_batting_stats').select('*, seasons(name)').eq('player_id', playerId).order('season_id'),
        supabase.from('season_bowling_stats').select('*, seasons(name)').eq('player_id', playerId).order('season_id'),
        supabase.from('season_fielding_stats').select('*, seasons(name)').eq('player_id', playerId).order('season_id'),
        supabase.from('batting_scorecard')
          .select('runs, balls_faced, fours, sixes, strike_rate, dismissal_type, actual_batting_position, opposition_name, match_id')
          .eq('player_id', playerId),
        supabase.from('bowling_scorecard')
          .select('legal_balls, runs_conceded, wickets, wides, no_balls, maidens, economy, opposition_name, match_id')
          .eq('player_id', playerId),
      ])

      if (!playerRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setPlayer(playerRes.data)
      setCareerBat(careerBatRes.data ?? null)
      setCareerBowl(careerBowlRes.data ?? null)
      setCareerField(careerFieldRes.data ?? null)
      setSeasonBat((seasonBatRes.data ?? []) as SeasonBatting[])
      setSeasonBowl((seasonBowlRes.data ?? []) as SeasonBowling[])
      setSeasonField((seasonFieldRes.data ?? []) as SeasonFielding[])

      const rawBatLog = battingInningsRes.data ?? []
      const rawBowlLog = bowlingInningsRes.data ?? []

      // Wave 2 — match dates + bowling wicket types
      const allMatchIds = [...new Set([
        ...rawBatLog.map((i: any) => i.match_id).filter(Boolean),
        ...rawBowlLog.map((i: any) => i.match_id).filter(Boolean),
      ])]

      const [matchesRes, matchPlayersRes] = await Promise.all([
        allMatchIds.length > 0
          ? supabase.from('matches').select('id, match_date').in('id', allMatchIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('match_players').select('id').eq('player_id', playerId),
      ])

      const matchDateMap: Record<string, string> = {}
      for (const m of (matchesRes.data ?? [])) {
        matchDateMap[m.id] = m.match_date
      }

      const enriched = (arr: any[]) =>
        arr
          .map(i => ({ ...i, match_date: i.match_id ? matchDateMap[i.match_id] ?? null : null }))
          .sort((a, b) => {
            if (!a.match_date || !b.match_date) return 0
            return new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
          })

      setBattingLog(enriched(rawBatLog))
      setBowlingLog(enriched(rawBowlLog))

      const mpIds = (matchPlayersRes.data ?? []).map((mp: any) => mp.id)
      if (mpIds.length > 0) {
        const { data: wkData } = await supabase
          .from('ball_events')
          .select('dismissal_type')
          .in('bowler_id', mpIds)
          .not('dismissal_type', 'is', null)
          .not('dismissal_type', 'in', '(run_out,retired_hurt,retired_out,timed_out,handled_ball,obstructing_field)')
        setBowlingWickets(wkData ?? [])
      }

      // Wave 3 — ball-level analytics + match context
      const [batBallsRes, bowlBallsRes, matchInfoRes, matchPlayersForImpactRes] = await Promise.all([
        mpIds.length > 0
          ? supabase.from('ball_events')
              .select('over_number, runs_off_bat, extras_type, dismissed_player_id, match_id')
              .in('batter_id', mpIds)
          : Promise.resolve({ data: [] as any[] }),
        mpIds.length > 0
          ? supabase.from('ball_events')
              .select('over_number, runs_off_bat, extras_type, extras_runs, dismissal_type, dismissed_player_id, match_id')
              .in('bowler_id', mpIds)
          : Promise.resolve({ data: [] as any[] }),
        allMatchIds.length > 0
          ? supabase.from('matches').select('id, result_text, opponent_id').in('id', allMatchIds)
          : Promise.resolve({ data: [] as any[] }),
        allMatchIds.length > 0
          ? supabase.from('match_players').select('id, actual_batting_position')
              .in('match_id', allMatchIds).not('player_id', 'is', null)
          : Promise.resolve({ data: [] as any[] }),
      ])

      // Fetch opponent names
      const opponentIds = [...new Set((matchInfoRes.data ?? []).map((m: any) => m.opponent_id).filter(Boolean))]
      const { data: oppData } = opponentIds.length > 0
        ? await supabase.from('opponents').select('id, canonical_name').in('id', opponentIds)
        : { data: [] as any[] }

      const oppNameMap: Record<string, string> = {}
      for (const o of (oppData ?? [])) oppNameMap[o.id] = o.canonical_name

      const resMap: Record<string, string> = {}
      const oppMatchMap: Record<string, string> = {}
      for (const m of (matchInfoRes.data ?? [])) {
        resMap[m.id] = m.result_text ?? ''
        oppMatchMap[m.id] = oppNameMap[m.opponent_id] ?? 'Unknown'
      }

      const bpMap: Record<string, number> = {}
      for (const mp of (matchPlayersForImpactRes.data ?? [])) {
        if (mp.actual_batting_position) bpMap[mp.id] = mp.actual_batting_position
      }

      setBatBalls(batBallsRes.data ?? [])
      setBowlBalls(bowlBallsRes.data ?? [])
      setMatchResultMap(resMap)
      setMatchOpponentMap(oppMatchMap)
      setMpBatPosMap(bpMap)

      setLoading(false)
    }

    load()
  }, [playerId])

  // Auto-switch tab if no batting data but has bowling
  useEffect(() => {
    if (!loading && !careerBat && careerBowl) setTab('bowling')
  }, [loading, careerBat, careerBowl])

  // ── Derived data ──────────────────────────────────────────────────────────

  const dismissalCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const inn of battingLog) {
      const key = inn.dismissal_type ?? 'not_out'
      counts[key] = (counts[key] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        label: type === 'not_out' ? 'Not Out' : labelDismissal(type),
        count,
      }))
      .filter(d => d.type !== 'not_out')
      .sort((a, b) => b.count - a.count)
  }, [battingLog])

  const positionData = useMemo(() => {
    const posMap: Record<number, { total: number; count: number }> = {}
    for (const inn of battingLog) {
      if (inn.actual_batting_position == null || inn.runs == null) continue
      const pos = inn.actual_batting_position
      if (!posMap[pos]) posMap[pos] = { total: 0, count: 0 }
      posMap[pos].total += inn.runs
      posMap[pos].count += 1
    }
    return Object.entries(posMap)
      .map(([pos, { total, count }]) => ({
        position: Number(pos),
        avg: count > 0 ? total / count : 0,
        innings: count,
      }))
      .sort((a, b) => a.position - b.position)
  }, [battingLog])

  const wicketTypes = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of bowlingWickets) {
      const key = ev.dismissal_type
      counts[key] = (counts[key] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => ({ type, label: labelDismissal(type), count }))
      .sort((a, b) => b.count - a.count)
  }, [bowlingWickets])

  const visibleBatLog = showAllBat ? battingLog : battingLog.slice(0, 30)
  const visibleBowlLog = showAllBowl ? bowlingLog : bowlingLog.slice(0, 30)

  // ── Wave 3 computed stats ─────────────────────────────────────────────────

  // 1. Boundary rate
  const boundaryRate = useMemo(() => {
    if (!careerBat?.total_runs) return null
    const br = (Number(careerBat.fours) * 4 + Number(careerBat.sixes) * 6)
    return Math.round((br / Number(careerBat.total_runs)) * 100)
  }, [careerBat])

  // 2. Consistency score (% of innings at/above own average)
  const consistencyScore = useMemo(() => {
    if (!careerBat?.average || !battingLog.length) return null
    const avg = Number(careerBat.average)
    const above = battingLog.filter(i => (i.runs ?? 0) >= avg).length
    return Math.round((above / battingLog.length) * 100)
  }, [careerBat, battingLog])

  // 3. Conversion rate (50s converted to 100s)
  const conversionRate = useMemo(() => {
    const f = Number(careerBat?.fifties ?? 0)
    const h = Number(careerBat?.hundreds ?? 0)
    if (f + h === 0) return null
    return Math.round((h / (f + h)) * 100)
  }, [careerBat])

  // 4. Batting dot ball %
  const batDotPct = useMemo(() => {
    const legal = batBalls.filter(b => b.extras_type !== 'wide')
    if (!legal.length) return null
    const dots = legal.filter(b => (b.runs_off_bat ?? 0) === 0).length
    return Math.round((dots / legal.length) * 100)
  }, [batBalls])

  // 5. Batting phase analysis
  const battingPhase = useMemo(() => {
    if (!batBalls.length) return []
    return [
      { label: 'Powerplay (1-6)', min: 0, max: 5 },
      { label: 'Middle (7-15)', min: 6, max: 14 },
      { label: 'Death (16+)', min: 15, max: 99 },
    ].map(ph => {
      const balls = batBalls.filter(b => b.over_number >= ph.min && b.over_number <= ph.max)
      const legal = balls.filter(b => b.extras_type !== 'wide')
      const runs = balls.reduce((s: number, b: any) => s + (b.runs_off_bat ?? 0), 0)
      const wkts = balls.filter((b: any) => b.dismissed_player_id).length
      const sr = legal.length > 0 ? ((runs / legal.length) * 100).toFixed(1) : '—'
      return { label: ph.label, balls: legal.length, runs, wickets: wkts, sr }
    }).filter(ph => ph.balls > 0)
  }, [batBalls])

  // 6. Scoring breakdown
  const scoringBreakdown = useMemo(() => {
    const legal = batBalls.filter(b => b.extras_type !== 'wide')
    if (!legal.length) return []
    const total = legal.length
    const cnt: Record<string, number> = {}
    for (const b of legal) {
      const r = String(b.runs_off_bat ?? 0)
      const key = ['0', '1', '2', '3', '4', '6'].includes(r) ? r : 'other'
      cnt[key] = (cnt[key] ?? 0) + 1
    }
    return [
      { label: 'Dot balls', key: '0', color: '#ef4444' },
      { label: 'Singles',   key: '1', color: '#3b82f6' },
      { label: 'Twos',      key: '2', color: '#6366f1' },
      { label: 'Threes',    key: '3', color: '#8b5cf6' },
      { label: 'Fours',     key: '4', color: '#38bdf8' },
      { label: 'Sixes',     key: '6', color: '#fbbf24' },
    ].map(x => ({ ...x, count: cnt[x.key] ?? 0, pct: Math.round(((cnt[x.key] ?? 0) / total) * 100) }))
     .filter(x => x.count > 0)
  }, [batBalls])

  // 7. Performance vs opponent (batting)
  const oppPerformance = useMemo(() => {
    if (!battingLog.length || !Object.keys(matchOpponentMap).length) return []
    const map: Record<string, { runs: number; innings: number; dismissals: number }> = {}
    for (const inn of battingLog) {
      const opp = inn.match_id ? matchOpponentMap[inn.match_id] : null
      if (!opp) continue
      if (!map[opp]) map[opp] = { runs: 0, innings: 0, dismissals: 0 }
      map[opp].runs += inn.runs ?? 0
      map[opp].innings += 1
      if (inn.dismissal_type) map[opp].dismissals += 1
    }
    return Object.entries(map)
      .map(([opp, { runs, innings, dismissals }]) => ({
        opponent: opp, innings, runs,
        avg: dismissals > 0 ? (runs / dismissals).toFixed(1) : runs > 0 ? '∞' : '—',
      }))
      .sort((a, b) => b.runs - a.runs)
  }, [battingLog, matchOpponentMap])

  // 8. Batting win/loss
  const batWinLoss = useMemo(() => {
    const isWin = (id: string | null) => id ? (matchResultMap[id] ?? '').toLowerCase().includes('won') : false
    const wins = battingLog.filter(i => isWin(i.match_id))
    const losses = battingLog.filter(i => !isWin(i.match_id) && i.match_id)
    const calc = (arr: typeof battingLog) => {
      const dismissed = arr.filter(i => i.dismissal_type).length
      const runs = arr.reduce((s, i) => s + (i.runs ?? 0), 0)
      const balls = arr.reduce((s, i) => s + (i.balls_faced ?? 0), 0)
      return {
        innings: arr.length,
        avg: dismissed > 0 ? (runs / dismissed).toFixed(1) : '—',
        sr: balls > 0 ? ((runs / balls) * 100).toFixed(1) : '—',
      }
    }
    return [
      { label: 'Wins',   color: '#4ade80', ...calc(wins) },
      { label: 'Losses', color: '#f87171', ...calc(losses) },
    ]
  }, [battingLog, matchResultMap])

  // 9. Bowling phase
  const bowlingPhase = useMemo(() => {
    if (!bowlBalls.length) return []
    const BOWLER_WKTS = ['run_out', 'retired_hurt', 'retired_out', 'timed_out', 'handled_ball', 'obstructing_field']
    return [
      { label: 'Powerplay (1-6)', min: 0, max: 5 },
      { label: 'Middle (7-15)',   min: 6, max: 14 },
      { label: 'Death (16+)',     min: 15, max: 99 },
    ].map(ph => {
      const balls = bowlBalls.filter((b: any) => b.over_number >= ph.min && b.over_number <= ph.max)
      const legal = balls.filter((b: any) => b.extras_type !== 'wide' && b.extras_type !== 'no_ball')
      const runs = balls.reduce((s: number, b: any) =>
        s + (b.runs_off_bat ?? 0) + (['wide', 'no_ball'].includes(b.extras_type ?? '') ? (b.extras_runs ?? 0) : 0), 0)
      const wkts = balls.filter((b: any) => b.dismissal_type && !BOWLER_WKTS.includes(b.dismissal_type)).length
      const econ = legal.length > 0 ? (runs / (legal.length / 6)).toFixed(2) : '—'
      return { label: ph.label, legalBalls: legal.length, runs, wickets: wkts, economy: econ }
    }).filter(ph => ph.legalBalls > 0)
  }, [bowlBalls])

  // 10. Bowling dot ball %
  const bowlDotPct = useMemo(() => {
    const legal = bowlBalls.filter((b: any) => b.extras_type !== 'wide' && b.extras_type !== 'no_ball')
    if (!legal.length) return null
    const dots = legal.filter((b: any) => (b.runs_off_bat ?? 0) === 0).length
    return Math.round((dots / legal.length) * 100)
  }, [bowlBalls])

  // 11. Wicket over distribution
  const wicketOvers = useMemo(() => {
    const BOWLER_WKTS = ['run_out', 'retired_hurt', 'retired_out', 'timed_out', 'handled_ball', 'obstructing_field']
    const wktBalls = bowlBalls.filter((b: any) => b.dismissal_type && !BOWLER_WKTS.includes(b.dismissal_type))
    const map: Record<number, number> = {}
    for (const b of wktBalls) {
      const ov = (b.over_number ?? 0) + 1
      map[ov] = (map[ov] ?? 0) + 1
    }
    return Object.entries(map).map(([ov, count]) => ({ over: Number(ov), count })).sort((a, b) => a.over - b.over)
  }, [bowlBalls])

  // 12. Impact wickets
  const impactWickets = useMemo(() => {
    const BOWLER_WKTS = ['run_out', 'retired_hurt', 'retired_out', 'timed_out', 'handled_ball', 'obstructing_field']
    const wktBalls = bowlBalls.filter((b: any) => b.dismissal_type && !BOWLER_WKTS.includes(b.dismissal_type) && b.dismissed_player_id)
    let top = 0, mid = 0, tail = 0
    for (const b of wktBalls) {
      const pos = mpBatPosMap[b.dismissed_player_id] ?? 99
      if (pos <= 3) top++
      else if (pos <= 7) mid++
      else tail++
    }
    return [
      { label: 'Top Order (1-3)', count: top, color: '#38bdf8' },
      { label: 'Middle (4-7)', count: mid, color: '#3b82f6' },
      { label: 'Tail (8-11)', count: tail, color: '#6366f1' },
    ].filter(x => x.count > 0)
  }, [bowlBalls, mpBatPosMap])

  // 13. Bowling win/loss
  const bowlWinLoss = useMemo(() => {
    const isWin = (id: string | null) => id ? (matchResultMap[id] ?? '').toLowerCase().includes('won') : false
    const wins = bowlingLog.filter(i => isWin(i.match_id))
    const losses = bowlingLog.filter(i => !isWin(i.match_id) && i.match_id)
    const calc = (arr: typeof bowlingLog) => {
      const balls = arr.reduce((s, i) => s + (i.legal_balls ?? 0), 0)
      const runs = arr.reduce((s, i) => s + (i.runs_conceded ?? 0), 0)
      return {
        innings: arr.length,
        wickets: arr.reduce((s, i) => s + (i.wickets ?? 0), 0),
        economy: balls > 0 ? (runs / (balls / 6)).toFixed(2) : '—',
      }
    }
    return [
      { label: 'Wins',   color: '#4ade80', ...calc(wins) },
      { label: 'Losses', color: '#f87171', ...calc(losses) },
    ]
  }, [bowlingLog, matchResultMap])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .player-profile-page { padding-top: var(--nav-h); min-height: 100vh; }

        /* ── BACK LINK ── */
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          color: rgba(147,197,253,0.5); text-decoration: none;
          margin-bottom: 18px; transition: color 0.15s;
        }
        .back-link:hover { color: #60a5fa; }

        /* ── PLAYER HERO ── */
        .player-meta {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin-top: 14px;
        }
        .player-nickname {
          font-family: 'Outfit', sans-serif; font-size: 16px;
          color: rgba(147,197,253,0.55); margin-top: 4px;
        }
        .player-style-badge {
          display: inline-flex; align-items: center;
          padding: 4px 12px; border-radius: 20px;
          border: 1px solid rgba(59,130,246,0.2);
          background: rgba(37,99,235,0.1);
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          color: rgba(147,197,253,0.7); white-space: nowrap;
        }
        .active-badge {
          padding: 3px 10px; border-radius: 5px; font-size: 10px; font-weight: 700;
          font-family: 'Syne', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
          background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.25);
        }
        .inactive-badge {
          padding: 3px 10px; border-radius: 5px; font-size: 10px; font-weight: 700;
          font-family: 'Syne', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
          background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2);
        }

        /* ── TABS ── */
        .profile-tabs {
          display: flex; gap: 0;
          border-bottom: 1px solid rgba(59,130,246,0.12);
          margin: 32px 0 28px;
        }
        .profile-tab {
          padding: 14px 28px;
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
          color: rgba(147,197,253,0.4);
          border: none; background: none; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
          display: flex; align-items: center; gap: 8px;
          letter-spacing: -0.01em; touch-action: manipulation;
        }
        .profile-tab:hover { color: rgba(147,197,253,0.75); }
        .profile-tab.active { color: #60a5fa; border-bottom-color: #3b82f6; }
        .profile-tab-icon {
          width: 26px; height: 26px; border-radius: 7px;
          background: rgba(37,99,235,0.12); border: 1px solid rgba(59,130,246,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 13px;
        }
        .profile-tab.active .profile-tab-icon {
          background: rgba(37,99,235,0.25); border-color: rgba(59,130,246,0.4);
        }

        /* ── CAREER CARDS ── */
        .career-cards {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 14px;
        }
        .career-cards-secondary {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 28px;
        }
        .career-card {
          background: rgba(5,18,42,0.6); border: 1px solid rgba(59,130,246,0.1);
          border-radius: 10px; padding: 18px 14px; text-align: center; position: relative;
        }
        .career-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent);
        }
        .career-card.highlight-card::before {
          background: linear-gradient(90deg, transparent, rgba(56,189,248,0.35), transparent);
        }
        .career-card-val {
          font-family: 'Syne', sans-serif; font-size: 30px; font-weight: 800;
          color: #60a5fa; line-height: 1; margin-bottom: 7px;
        }
        .career-card-val.sky { color: #38bdf8; }
        .career-card-val.sm { font-size: 22px; }
        .career-card-lbl {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
        }

        /* ── PANELS ── */
        .profile-panel {
          background: rgba(5,18,42,0.7); border: 1px solid rgba(59,130,246,0.12);
          border-radius: 14px; overflow: hidden; position: relative; margin-bottom: 24px;
        }
        .profile-panel::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent);
        }
        .panel-header {
          padding: 16px 22px; border-bottom: 1px solid rgba(59,130,246,0.1);
        }
        .panel-title {
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.01em;
        }

        /* ── TABLES ── */
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .season-table {
          width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .season-table th {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(147,197,253,0.4); text-align: right;
          padding: 10px 14px; border-bottom: 1px solid rgba(59,130,246,0.1);
          white-space: nowrap;
        }
        .season-table th:first-child { text-align: left; }
        .season-table td {
          padding: 10px 14px; border-bottom: 1px solid rgba(59,130,246,0.06);
          font-family: 'Outfit', sans-serif; color: rgba(147,197,253,0.65);
          text-align: right; white-space: nowrap; vertical-align: middle;
        }
        .season-table td:first-child {
          text-align: left; font-family: 'Syne', sans-serif; font-weight: 700;
          font-size: 12px; color: #e2eeff;
        }
        .season-table tbody tr:last-child td { border-bottom: none; }
        .season-table tbody tr:hover { background: rgba(37,99,235,0.04); }
        .key-val {
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 800; color: #60a5fa;
        }

        /* ── INNINGS TABLE ── */
        .innings-table th { font-size: 8px; padding: 8px 12px; }
        .innings-table td { padding: 8px 12px; font-size: 12px; }
        .innings-table td:first-child { font-size: 11px; }
        .dismissal-chip {
          display: inline-block; padding: 2px 7px; border-radius: 4px;
          font-size: 10px; font-weight: 700; font-family: 'Syne', sans-serif;
          background: rgba(37,99,235,0.1); color: rgba(147,197,253,0.7);
          border: 1px solid rgba(59,130,246,0.15); white-space: nowrap;
        }
        .dismissal-chip.not-out {
          background: rgba(34,197,94,0.08); color: #4ade80;
          border-color: rgba(34,197,94,0.2);
        }
        .show-all-btn {
          display: block; width: 100%; padding: 12px;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(147,197,253,0.5); background: none;
          border: none; border-top: 1px solid rgba(59,130,246,0.08);
          cursor: pointer; transition: color 0.15s; text-align: center;
        }
        .show-all-btn:hover { color: #60a5fa; background: rgba(37,99,235,0.04); }

        /* ── BAR CHART ── */
        .bar-chart { padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
        .bar-row { display: flex; align-items: center; gap: 12px; }
        .bar-label {
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(147,197,253,0.65); min-width: 110px; flex-shrink: 0;
        }
        .bar-track {
          flex: 1; height: 8px; background: rgba(37,99,235,0.1);
          border-radius: 4px; overflow: hidden; min-width: 60px;
        }
        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #38bdf8);
          border-radius: 4px; transition: width 0.5s ease;
        }
        .bar-value {
          font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700;
          color: #93c5fd; min-width: 54px; text-align: right; flex-shrink: 0;
        }

        /* ── SVG CHART ── */
        .chart-wrap { padding: 16px 22px 12px; }
        .chart-label-top {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35); margin-bottom: 12px;
        }

        /* ── FORM GUIDE ── */
        .form-guide {
          padding: 20px 22px 14px; display: flex; flex-direction: column; gap: 10px;
        }
        .form-guide-bars {
          display: flex; gap: 8px; align-items: flex-end; overflow-x: auto;
          -webkit-overflow-scrolling: touch; padding-bottom: 4px;
        }
        .form-bar-wrap {
          display: flex; flex-direction: column; align-items: center;
          gap: 3px; flex-shrink: 0; min-width: 40px; cursor: default;
        }
        .form-bar-runs {
          font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700;
          color: #93c5fd; white-space: nowrap;
        }
        .form-bar-body {
          width: 28px; border-radius: 3px 3px 0 0; min-height: 4px; transition: opacity 0.15s;
        }
        .form-bar-wrap:hover .form-bar-body { opacity: 0.75; }
        .form-bar-opp {
          font-family: 'Outfit', sans-serif; font-size: 8px;
          color: rgba(147,197,253,0.35); white-space: nowrap; max-width: 42px;
          overflow: hidden; text-overflow: ellipsis; text-align: center;
        }
        .form-legend {
          font-family: 'Outfit', sans-serif; font-size: 10px;
          color: rgba(147,197,253,0.35); display: flex; flex-wrap: wrap; gap: 6px;
        }

        /* ── STAT CHIPS ── */
        .stat-chips {
          display: flex; gap: 10px; flex-wrap: wrap; padding: 16px 22px 20px;
        }
        .stat-chip {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 12px 18px; border-radius: 10px;
          background: rgba(37,99,235,0.07); border: 1px solid rgba(59,130,246,0.12);
          min-width: 88px;
        }
        .stat-chip-val {
          font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #60a5fa;
        }
        .stat-chip-val.sky { color: #38bdf8; }
        .stat-chip-val.green { color: #4ade80; }
        .stat-chip-val.amber { color: #fbbf24; }
        .stat-chip-val.red { color: #f87171; }
        .stat-chip-lbl {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(147,197,253,0.35); text-align: center; line-height: 1.4;
        }

        /* ── PHASE TABLE ── */
        .phase-wrap { padding: 0; }
        .phase-table { width: 100%; border-collapse: collapse; }
        .phase-table th {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(147,197,253,0.4);
          text-align: right; padding: 10px 14px; border-bottom: 1px solid rgba(59,130,246,0.1);
        }
        .phase-table th:first-child { text-align: left; }
        .phase-table td {
          padding: 11px 14px; font-family: 'Outfit', sans-serif;
          color: rgba(147,197,253,0.65); text-align: right; font-size: 13px;
          border-bottom: 1px solid rgba(59,130,246,0.06);
        }
        .phase-table td:first-child {
          text-align: left; font-family: 'Syne', sans-serif; font-weight: 700;
          color: #e2eeff; font-size: 12px;
        }
        .phase-table tr:last-child td { border-bottom: none; }

        /* ── OPP TABLE ── */
        .opp-scroll { max-height: 300px; overflow-y: auto; }

        /* ── EMPTY & LOADING ── */
        .empty-profile {
          padding: 48px 20px; text-align: center;
          font-family: 'Outfit', sans-serif; font-size: 14px;
          color: rgba(147,197,253,0.35); line-height: 1.7;
        }
        .profile-loading {
          text-align: center; padding: 80px 0;
          font-family: 'Outfit', sans-serif; font-size: 14px;
          color: rgba(147,197,253,0.35);
        }
        .not-found-box {
          text-align: center; padding: 80px 20px;
          font-family: 'Outfit', sans-serif;
        }
        .not-found-box h2 {
          font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800;
          color: #e2eeff; margin-bottom: 12px;
        }
        .not-found-box p {
          color: rgba(147,197,253,0.45); font-size: 14px; margin-bottom: 24px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .career-cards,
          .career-cards-secondary { grid-template-columns: repeat(2, 1fr); }
          .profile-tab { padding: 12px 16px; font-size: 14px; }
          .career-card-val { font-size: 24px; }
          .career-card-val.sm { font-size: 18px; }
          .bar-label { min-width: 80px; font-size: 11px; }
          .stat-chips { gap: 8px; }
          .stat-chip { min-width: 72px; padding: 10px 12px; }
          .stat-chip-val { font-size: 18px; }
        }
        @media (max-width: 480px) {
          .career-cards,
          .career-cards-secondary { gap: 8px; }
          .career-card { padding: 14px 10px; }
          .career-card-val { font-size: 20px; }
          .career-card-val.sm { font-size: 16px; }
          .profile-tab { padding: 10px 12px; font-size: 13px; }
          .bar-label { min-width: 66px; }
        }
      `}</style>

      <div className="player-profile-page">

        {/* Hero */}
        <div className="page-hero">
          <div className="container">
            <Link href="/stats" className="back-link">← Back to Stats</Link>
            <div className="section-label">Player Profile</div>
            {loading ? (
              <h1 style={{ color: 'rgba(147,197,253,0.3)' }}>Loading…</h1>
            ) : notFound ? (
              <h1 style={{ color: 'rgba(147,197,253,0.3)' }}>Player Not Found</h1>
            ) : player ? (
              <>
                <h1>{player.first_name} {player.last_name}</h1>
                {player.nickname && (
                  <div className="player-nickname">"{player.nickname}"</div>
                )}
                <div className="player-meta">
                  {player.batting_style && (
                    <span className="player-style-badge">🏏 {player.batting_style}</span>
                  )}
                  {player.bowling_style && (
                    <span className="player-style-badge">⚾ {player.bowling_style}</span>
                  )}
                  <span className={player.is_active ? 'active-badge' : 'inactive-badge'}>
                    {player.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="profile-loading">Loading player stats…</div>
        ) : notFound ? (
          <div className="container">
            <div className="not-found-box">
              <h2>Player Not Found</h2>
              <p>No player exists with this ID.</p>
              <Link href="/stats" className="btn btn-outline">← Back to Stats</Link>
            </div>
          </div>
        ) : (
          <div className="container" style={{ paddingBottom: 80 }}>

            {/* Tabs */}
            <div className="profile-tabs">
              <button
                className={`profile-tab${tab === 'batting' ? ' active' : ''}`}
                onClick={() => setTab('batting')}
              >
                <span className="profile-tab-icon">🏏</span> Batting
              </button>
              <button
                className={`profile-tab${tab === 'bowling' ? ' active' : ''}`}
                onClick={() => setTab('bowling')}
              >
                <span className="profile-tab-icon">⚾</span> Bowling
              </button>
              <button
                className={`profile-tab${tab === 'fielding' ? ' active' : ''}`}
                onClick={() => setTab('fielding')}
              >
                <span className="profile-tab-icon">🧤</span> Fielding
              </button>
            </div>

            {/* ── BATTING TAB ── */}
            {tab === 'batting' && (
              <>
                {!careerBat ? (
                  <div className="empty-profile">No batting data recorded yet.</div>
                ) : (
                  <>
                    {/* Primary career cards */}
                    <div className="career-cards">
                      <div className="career-card highlight-card">
                        <div className="career-card-val sky">{fmt(careerBat.total_runs, 0)}</div>
                        <div className="career-card-lbl">Career Runs</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">{fmt(careerBat.average)}</div>
                        <div className="career-card-lbl">Average</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">{fmt(careerBat.strike_rate)}</div>
                        <div className="career-card-lbl">Strike Rate</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">{fmt(careerBat.highest_score, 0)}</div>
                        <div className="career-card-lbl">High Score</div>
                      </div>
                    </div>

                    {/* Secondary career cards */}
                    <div className="career-cards-secondary">
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBat.fifties, 0)}</div>
                        <div className="career-card-lbl">Half Centuries</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBat.hundreds, 0)}</div>
                        <div className="career-card-lbl">Centuries</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBat.ducks, 0)}</div>
                        <div className="career-card-lbl">Ducks</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBat.balls_faced, 0)}</div>
                        <div className="career-card-lbl">Balls Faced</div>
                      </div>
                    </div>

                    {/* Batting Metrics chips */}
                    <div className="profile-panel">
                      <div className="panel-header"><div className="panel-title">Batting Metrics</div></div>
                      <div className="stat-chips">
                        {boundaryRate != null && (
                          <div className="stat-chip">
                            <div className="stat-chip-val sky">{boundaryRate}%</div>
                            <div className="stat-chip-lbl">Boundary Rate</div>
                          </div>
                        )}
                        {consistencyScore != null && (
                          <div className="stat-chip">
                            <div className="stat-chip-val green">{consistencyScore}%</div>
                            <div className="stat-chip-lbl">Consistency</div>
                          </div>
                        )}
                        {conversionRate != null && (
                          <div className="stat-chip">
                            <div className="stat-chip-val amber">{conversionRate}%</div>
                            <div className="stat-chip-lbl">50→100 Conv.</div>
                          </div>
                        )}
                        {batDotPct != null && (
                          <div className="stat-chip">
                            <div className={`stat-chip-val${batDotPct > 50 ? ' red' : ''}`}>{batDotPct}%</div>
                            <div className="stat-chip-lbl">Dot Ball %</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Form */}
                    {battingLog.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">Recent Form</div></div>
                        <FormGuide innings={battingLog} average={careerBat?.average ?? null} />
                      </div>
                    )}

                    {/* Season-by-season table */}
                    {seasonBat.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Season by Season</div>
                        </div>
                        <div className="table-scroll">
                          <table className="season-table">
                            <thead>
                              <tr>
                                <th>Season</th>
                                <th>M</th><th>Inn</th><th>NO</th>
                                <th>Runs</th><th>HS</th><th>Avg</th><th>SR</th>
                                <th>50s</th><th>100s</th>
                              </tr>
                            </thead>
                            <tbody>
                              {seasonBat.map(s => (
                                <tr key={s.season_id}>
                                  <td>{s.seasons?.name ?? s.season_id}</td>
                                  <td>{fmt(s.matches, 0)}</td>
                                  <td>{fmt(s.innings, 0)}</td>
                                  <td>{fmt(s.not_outs, 0)}</td>
                                  <td><span className="key-val">{fmt(s.total_runs, 0)}</span></td>
                                  <td>{fmt(s.highest_score, 0)}</td>
                                  <td>{fmt(s.average)}</td>
                                  <td>{fmt(s.strike_rate)}</td>
                                  <td>{fmt(s.fifties, 0)}</td>
                                  <td>{fmt(s.hundreds, 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Runs progression chart */}
                    {seasonBat.length >= 2 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Runs Progression</div>
                        </div>
                        <SVGLineChart data={seasonBat} valueKey="total_runs" label="Runs per season" />
                      </div>
                    )}

                    {/* Phase analysis */}
                    {battingPhase.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">Batting by Phase</div></div>
                        <div className="phase-wrap table-scroll">
                          <table className="phase-table">
                            <thead><tr><th>Phase</th><th>Balls</th><th>Runs</th><th>Wkts Lost</th><th>SR</th></tr></thead>
                            <tbody>
                              {battingPhase.map(ph => (
                                <tr key={ph.label}>
                                  <td>{ph.label}</td><td>{ph.balls}</td>
                                  <td><span className="key-val">{ph.runs}</span></td>
                                  <td>{ph.wickets}</td><td>{ph.sr}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Scoring profile */}
                    {scoringBreakdown.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">Scoring Profile</div></div>
                        <ColorBarChart
                          items={scoringBreakdown.map(x => ({ label: `${x.label} (${x.pct}%)`, value: x.count, color: x.color }))}
                          maxVal={Math.max(...scoringBreakdown.map(x => x.count), 1)}
                        />
                      </div>
                    )}

                    {/* Batting position chart */}
                    {positionData.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Average Runs by Batting Position</div>
                        </div>
                        <CSSBarChart
                          items={positionData.map(p => ({
                            label: `No. ${p.position}`,
                            value: Number(p.avg.toFixed(1)),
                            sublabel: `(${p.innings} inn)`,
                          }))}
                          maxVal={Math.max(...positionData.map(p => p.avg), 1)}
                        />
                      </div>
                    )}

                    {/* Dismissal breakdown */}
                    {dismissalCounts.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">How Dismissed</div>
                        </div>
                        <CSSBarChart
                          items={dismissalCounts.map(d => ({ label: d.label, value: d.count }))}
                          maxVal={Math.max(...dismissalCounts.map(d => d.count), 1)}
                        />
                      </div>
                    )}

                    {/* Innings profile scatter */}
                    {battingLog.length >= 3 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">Innings Profile</div></div>
                        <div className="chart-wrap">
                          <ScatterPlot innings={battingLog} />
                        </div>
                      </div>
                    )}

                    {/* vs Each Opponent */}
                    {oppPerformance.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">vs Each Opponent</div></div>
                        <div className="opp-scroll table-scroll">
                          <table className="season-table innings-table">
                            <thead><tr><th style={{ textAlign: 'left' }}>Opponent</th><th>Inn</th><th>Runs</th><th>Avg</th></tr></thead>
                            <tbody>
                              {oppPerformance.map(o => (
                                <tr key={o.opponent}>
                                  <td style={{ textAlign: 'left' }}>{o.opponent}</td>
                                  <td>{o.innings}</td>
                                  <td><span className="key-val">{o.runs}</span></td>
                                  <td>{o.avg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Batting by Result */}
                    <div className="profile-panel">
                      <div className="panel-header"><div className="panel-title">Batting by Result</div></div>
                      <WinLossPanel rows={batWinLoss} statCols={[{ key: 'avg', label: 'Avg' }, { key: 'sr', label: 'SR' }]} />
                    </div>

                    {/* Innings log */}
                    {battingLog.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Innings Log</div>
                        </div>
                        <div className="table-scroll">
                          <table className="season-table innings-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Date</th>
                                <th style={{ textAlign: 'left' }}>vs</th>
                                <th>Pos</th>
                                <th>Runs</th>
                                <th>Balls</th>
                                <th>SR</th>
                                <th>4s</th>
                                <th>6s</th>
                                <th>How Out</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleBatLog.map((inn, i) => (
                                <tr key={i}>
                                  <td style={{ textAlign: 'left' }}>{formatDate(inn.match_date)}</td>
                                  <td style={{ textAlign: 'left', color: 'rgba(147,197,253,0.55)' }}>
                                    {inn.opposition_name ?? '—'}
                                  </td>
                                  <td>{inn.actual_batting_position ?? '—'}</td>
                                  <td><span className="key-val">{fmt(inn.runs, 0)}</span></td>
                                  <td>{fmt(inn.balls_faced, 0)}</td>
                                  <td>{fmt(inn.strike_rate)}</td>
                                  <td>{fmt(inn.fours, 0)}</td>
                                  <td>{fmt(inn.sixes, 0)}</td>
                                  <td>
                                    <span className={`dismissal-chip${!inn.dismissal_type ? ' not-out' : ''}`}>
                                      {labelDismissal(inn.dismissal_type)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {battingLog.length > 30 && (
                          <button className="show-all-btn" onClick={() => setShowAllBat(v => !v)}>
                            {showAllBat
                              ? `Show less`
                              : `Show all ${battingLog.length} innings`}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── BOWLING TAB ── */}
            {tab === 'bowling' && (
              <>
                {!careerBowl ? (
                  <div className="empty-profile">No bowling data recorded yet.</div>
                ) : (
                  <>
                    {/* Primary career cards */}
                    <div className="career-cards">
                      <div className="career-card highlight-card">
                        <div className="career-card-val sky">{fmt(careerBowl.wickets, 0)}</div>
                        <div className="career-card-lbl">Career Wickets</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">{fmt(careerBowl.economy)}</div>
                        <div className="career-card-lbl">Economy</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">
                          {bestFigures(careerBowl.best_bowling_wickets, careerBowl.best_bowling_runs)}
                        </div>
                        <div className="career-card-lbl">Best Figures</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">
                          {bowlingAvgFmt(careerBowl.runs_conceded, careerBowl.wickets)}
                        </div>
                        <div className="career-card-lbl">Average</div>
                      </div>
                    </div>

                    {/* Secondary cards */}
                    <div className="career-cards-secondary">
                      <div className="career-card">
                        <div className="career-card-val sm">{overs(careerBowl.legal_balls)}</div>
                        <div className="career-card-lbl">Overs Bowled</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBowl.maidens, 0)}</div>
                        <div className="career-card-lbl">Maidens</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBowl.wides, 0)}</div>
                        <div className="career-card-lbl">Wides</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val sm">{fmt(careerBowl.no_balls, 0)}</div>
                        <div className="career-card-lbl">No Balls</div>
                      </div>
                    </div>

                    {/* Bowling Metrics chips */}
                    <div className="profile-panel">
                      <div className="panel-header"><div className="panel-title">Bowling Metrics</div></div>
                      <div className="stat-chips">
                        <div className="stat-chip">
                          <div className="stat-chip-val sky">
                            {careerBowl.matches > 0 ? (Number(careerBowl.wickets) / Number(careerBowl.matches)).toFixed(1) : '—'}
                          </div>
                          <div className="stat-chip-lbl">Wkts / Match</div>
                        </div>
                        <div className="stat-chip">
                          <div className="stat-chip-val">
                            {careerBowl.wickets > 0 ? Math.round(Number(careerBowl.legal_balls) / Number(careerBowl.wickets)) : '—'}
                          </div>
                          <div className="stat-chip-lbl">Strike Rate</div>
                        </div>
                        {bowlDotPct != null && (
                          <div className="stat-chip">
                            <div className={`stat-chip-val${bowlDotPct >= 40 ? ' green' : ''}`}>{bowlDotPct}%</div>
                            <div className="stat-chip-lbl">Dot Ball %</div>
                          </div>
                        )}
                        <div className="stat-chip">
                          <div className="stat-chip-val">
                            {careerBowl.legal_balls > 0
                              ? ((Number(careerBowl.wides) + Number(careerBowl.no_balls)) / (Number(careerBowl.legal_balls) / 6)).toFixed(2)
                              : '—'}
                          </div>
                          <div className="stat-chip-lbl">Extras / Over</div>
                        </div>
                      </div>
                    </div>

                    {/* Season table */}
                    {seasonBowl.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Season by Season</div>
                        </div>
                        <div className="table-scroll">
                          <table className="season-table">
                            <thead>
                              <tr>
                                <th>Season</th>
                                <th>M</th><th>O</th><th>Mdns</th>
                                <th>Wkts</th><th>Runs</th><th>Best</th>
                                <th>Avg</th><th>Econ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {seasonBowl.map(s => (
                                <tr key={s.season_id}>
                                  <td>{s.seasons?.name ?? s.season_id}</td>
                                  <td>{fmt(s.matches, 0)}</td>
                                  <td>{overs(s.legal_balls)}</td>
                                  <td>{fmt(s.maidens, 0)}</td>
                                  <td><span className="key-val">{fmt(s.wickets, 0)}</span></td>
                                  <td>{fmt(s.runs_conceded, 0)}</td>
                                  <td>{bestFigures(s.best_bowling_wickets, s.best_bowling_runs)}</td>
                                  <td>{bowlingAvgFmt(s.runs_conceded, s.wickets)}</td>
                                  <td>{fmt(s.economy)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Bowling phase analysis */}
                    {bowlingPhase.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">Bowling by Phase</div></div>
                        <div className="phase-wrap table-scroll">
                          <table className="phase-table">
                            <thead><tr><th>Phase</th><th>Balls</th><th>Runs</th><th>Wkts</th><th>Econ</th></tr></thead>
                            <tbody>
                              {bowlingPhase.map(ph => (
                                <tr key={ph.label}>
                                  <td>{ph.label}</td><td>{ph.legalBalls}</td><td>{ph.runs}</td>
                                  <td><span className="key-val">{ph.wickets}</span></td><td>{ph.economy}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Wicket type breakdown */}
                    {wicketTypes.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Wicket Types</div>
                        </div>
                        <CSSBarChart
                          items={wicketTypes.map(w => ({ label: w.label, value: w.count }))}
                          maxVal={Math.max(...wicketTypes.map(w => w.count), 1)}
                        />
                      </div>
                    )}

                    {/* When Do You Take Wickets */}
                    {wicketOvers.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">When Do You Take Wickets?</div></div>
                        <ColorBarChart
                          items={wicketOvers.map(w => ({ label: `Over ${w.over}`, value: w.count }))}
                          maxVal={Math.max(...wicketOvers.map(w => w.count), 1)}
                        />
                      </div>
                    )}

                    {/* Wicket Quality */}
                    {impactWickets.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header"><div className="panel-title">Wicket Quality</div></div>
                        <ColorBarChart
                          items={impactWickets.map(w => ({ label: w.label, value: w.count, color: w.color }))}
                          maxVal={Math.max(...impactWickets.map(w => w.count), 1)}
                        />
                      </div>
                    )}

                    {/* Bowling by Result */}
                    <div className="profile-panel">
                      <div className="panel-header"><div className="panel-title">Bowling by Result</div></div>
                      <WinLossPanel rows={bowlWinLoss} statCols={[{ key: 'wickets', label: 'Wkts' }, { key: 'economy', label: 'Econ' }]} />
                    </div>

                    {/* Bowling innings log */}
                    {bowlingLog.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Bowling Log</div>
                        </div>
                        <div className="table-scroll">
                          <table className="season-table innings-table">
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Date</th>
                                <th style={{ textAlign: 'left' }}>vs</th>
                                <th>Overs</th>
                                <th>Mdns</th>
                                <th>Wkts</th>
                                <th>Runs</th>
                                <th>Wd</th>
                                <th>NB</th>
                                <th>Econ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleBowlLog.map((inn, i) => (
                                <tr key={i}>
                                  <td style={{ textAlign: 'left' }}>{formatDate(inn.match_date)}</td>
                                  <td style={{ textAlign: 'left', color: 'rgba(147,197,253,0.55)' }}>
                                    {inn.opposition_name ?? '—'}
                                  </td>
                                  <td>{overs(inn.legal_balls)}</td>
                                  <td>{fmt(inn.maidens, 0)}</td>
                                  <td><span className="key-val">{fmt(inn.wickets, 0)}</span></td>
                                  <td>{fmt(inn.runs_conceded, 0)}</td>
                                  <td>{fmt(inn.wides, 0)}</td>
                                  <td>{fmt(inn.no_balls, 0)}</td>
                                  <td>{fmt(inn.economy)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {bowlingLog.length > 30 && (
                          <button className="show-all-btn" onClick={() => setShowAllBowl(v => !v)}>
                            {showAllBowl
                              ? `Show less`
                              : `Show all ${bowlingLog.length} innings`}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── FIELDING TAB ── */}
            {tab === 'fielding' && (
              <>
                {!careerField ? (
                  <div className="empty-profile">No fielding data recorded yet.</div>
                ) : (
                  <>
                    {/* Career cards */}
                    <div className="career-cards">
                      <div className="career-card highlight-card">
                        <div className="career-card-val sky">{fmt(careerField.total_dismissals, 0)}</div>
                        <div className="career-card-lbl">Total Dismissals</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">
                          {fmt((careerField.catches ?? 0) + (careerField.caught_bowled ?? 0), 0)}
                        </div>
                        <div className="career-card-lbl">Catches</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">{fmt(careerField.stumpings, 0)}</div>
                        <div className="career-card-lbl">Stumpings</div>
                      </div>
                      <div className="career-card">
                        <div className="career-card-val">{fmt(careerField.run_outs, 0)}</div>
                        <div className="career-card-lbl">Run Outs</div>
                      </div>
                    </div>

                    {/* Season table */}
                    {seasonField.length > 0 && (
                      <div className="profile-panel">
                        <div className="panel-header">
                          <div className="panel-title">Season by Season</div>
                        </div>
                        <div className="table-scroll">
                          <table className="season-table">
                            <thead>
                              <tr>
                                <th>Season</th>
                                <th>M</th>
                                <th>Total</th>
                                <th>Ct</th>
                                <th>C&amp;B</th>
                                <th>St</th>
                                <th>RO</th>
                              </tr>
                            </thead>
                            <tbody>
                              {seasonField.map(s => (
                                <tr key={s.season_id}>
                                  <td>{s.seasons?.name ?? s.season_id}</td>
                                  <td>{fmt(s.matches, 0)}</td>
                                  <td><span className="key-val">{fmt(s.total_dismissals, 0)}</span></td>
                                  <td>{fmt(s.catches, 0)}</td>
                                  <td>{fmt(s.caught_bowled, 0)}</td>
                                  <td>{fmt(s.stumpings, 0)}</td>
                                  <td>{fmt(s.run_outs, 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </div>
        )}
      </div>
    </>
  )
}
