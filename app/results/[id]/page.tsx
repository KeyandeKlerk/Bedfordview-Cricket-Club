import { notFound } from 'next/navigation'
import Link from 'next/link'
import { anonSupabase as supabase } from '@/lib/supabase/server'
import { computeInningsState, oversDisplay, deriveResultText } from '@/lib/cricket/engine'
import type { BallEvent } from '@/lib/cricket/types'
import ShareButton from '@/components/ShareButton'
import { getClubConfig } from '@/lib/club-config'

export const revalidate = 30

/** Returns cricket-standard dismissal string, e.g. "c Smith b Jones", "b Jones", "run out (Smith/Jones)" */
function formatHowOut(
  dismissalType: string | null,
  bowlerName: string | null,
  fielderName: string | null,
  fielder2Name?: string | null,
): string {
  if (!dismissalType) return 'not out'
  const b = bowlerName ? shortName(bowlerName) : null
  const f = fielderName ? shortName(fielderName) : null
  const f2 = fielder2Name ? shortName(fielder2Name) : null
  switch (dismissalType) {
    case 'bowled':     return b ? `b ${b}` : 'bowled'
    case 'lbw':        return b ? `lbw b ${b}` : 'lbw'
    case 'caught':
      if (f && b && f === b) return `c & b ${b}`
      if (f && b)            return `c ${f} b ${b}`
      if (b)                 return `c & b ${b}`
      return 'caught'
    case 'stumped':    return f && b ? `st †${f} b ${b}` : b ? `st b ${b}` : 'stumped'
    case 'run_out': {
      const fielders = [f, f2].filter(Boolean).join('/')
      return fielders ? `run out (${fielders})` : 'run out'
    }
    case 'hit_wicket': return b ? `hit wkt b ${b}` : 'hit wicket'
    case 'obstructing_the_field': return 'obstructing the field'
    case 'timed_out':  return 'timed out'
    case 'handled_the_ball': return 'handled the ball'
    default:           return dismissalType.replace(/_/g, ' ')
  }
}

/** "Andrew Griesel" → "A Griesel" */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return full
  return `${parts[0][0]} ${parts.slice(1).join(' ')}`
}

function sr(runs: number, balls: number) {
  if (!balls) return '—'
  return ((runs / balls) * 100).toFixed(0)
}
function econ(runs: number, legalBalls: number) {
  if (!legalBalls) return '—'
  return ((runs / legalBalls) * 6).toFixed(1)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Partnership {
  wicket: number    // 0 = unbroken current partnership
  runs: number
  balls: number
  batter1: string   // dismissed (or current striker if unbroken)
  batter2: string   // surviving partner (or current non-striker)
}

function computePartnerships(balls: BallEvent[], playerNameMap: Map<string, string>): Partnership[] {
  const ps: Partnership[] = []
  let start = 0

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]
    if (!b.dismissal_type) continue

    const seg = balls.slice(start, i + 1)
    const runs = seg.reduce((s, x) => s + x.runs_off_bat + x.extras_runs, 0)
    const legalBalls = seg.filter(x => x.extras_type !== 'wide' && x.extras_type !== 'no_ball').length

    ps.push({
      wicket: ps.length + 1,
      runs, balls: legalBalls,
      batter1: playerNameMap.get(b.batter_id) ?? '?',
      batter2: playerNameMap.get(b.non_striker_id) ?? '?',
    })
    start = i + 1
  }

  // Unbroken current partnership
  if (start < balls.length) {
    const seg = balls.slice(start)
    const runs = seg.reduce((s, x) => s + x.runs_off_bat + x.extras_runs, 0)
    const legalBalls = seg.filter(x => x.extras_type !== 'wide' && x.extras_type !== 'no_ball').length
    const last = seg[seg.length - 1]
    ps.push({
      wicket: 0, runs, balls: legalBalls,
      batter1: playerNameMap.get(last.batter_id) ?? '?',
      batter2: playerNameMap.get(last.non_striker_id) ?? '?',
    })
  }

  return ps
}

// Returns set of match_player_ids who took a hat-trick in this innings
function detectHatTricks(balls: BallEvent[]): Set<string> {
  const bowlerWicketBalls = balls.filter(b =>
    b.dismissal_type &&
    !['run_out', 'retired_hurt', 'retired_out', 'timed_out', 'handled_ball', 'obstructing_field'].includes(b.dismissal_type)
  )
  const ht = new Set<string>()
  for (let i = 0; i + 2 < bowlerWicketBalls.length; i++) {
    const [a, b, c] = [bowlerWicketBalls[i], bowlerWicketBalls[i + 1], bowlerWicketBalls[i + 2]]
    if (a.bowler_id === b.bowler_id && b.bowler_id === c.bowler_id) {
      ht.add(a.bowler_id)
    }
  }
  return ht
}

async function getScorecard(matchId: string) {
  const [matchRes, inningsRes, playersRes, registeredRes] = await Promise.all([
    supabase.from('matches').select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name,match_format,overs_per_innings)').eq('id', matchId).single(),
    supabase.from('innings').select('*').eq('match_id', matchId).order('innings_number'),
    supabase.from('match_players').select('*').eq('match_id', matchId),
    supabase.from('players').select('id, first_name, last_name'),
  ])

  if (matchRes.error) throw new Error('Match not found')

  const match = matchRes.data
  const allInnings = inningsRes.data ?? []
  const allPlayers = playersRes.data ?? []

  // Build a lookup for registered (BCC) players: players.id → display name
  const registeredNames = new Map(
    (registeredRes.data ?? []).map((p: any) => [
      p.id,
      `${p.first_name} ${p.last_name}`.trim(),
    ])
  )

  // Resolve name: opposition players have opposition_name set directly;
  // BCC players link via player_id to the players table.
  const playerNameMap = new Map(
    allPlayers.map((p: any) => [
      p.id,
      p.opposition_name ?? registeredNames.get(p.player_id) ?? 'Unknown',
    ])
  )

  const inningsWithState = []
  for (const inn of allInnings) {
    const { data: balls } = await supabase
      .from('ball_events')
      .select('*')
      .eq('innings_id', inn.id)
      .order('sequence_number')

    const typedBalls = (balls ?? []) as BallEvent[]
    const state = computeInningsState(typedBalls, playerNameMap)
    const partnerships = computePartnerships(typedBalls, playerNameMap)
    const hatTrickBowlers = detectHatTricks(typedBalls)
    inningsWithState.push({ inn, state, partnerships, hatTrickBowlers })
  }

  // Derive result text from innings data if not already stored (covers historical matches)
  let resultText = match.result_text ?? null
  if (!resultText && match.status === 'completed' && inningsWithState.length === 2) {
    const s1 = inningsWithState[0].state
    const s2 = inningsWithState[1].state
    const inn2Side = inningsWithState[1].inn.batting_side
    resultText = deriveResultText(
      s1.totalRuns,
      s2.totalRuns,
      s2.wickets,
      inn2Side === match.our_team_side,
    )
  }

  // Linked match report article (published)
  const { data: article } = await supabase
    .from('articles')
    .select('id, title, slug, content, published_at')
    .eq('match_id', matchId)
    .not('published_at', 'is', null)
    .maybeSingle()

  return { match: { ...match, result_text: resultText }, inningsWithState, playerNameMap, article: article ?? null }
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [config, scorecard] = await Promise.allSettled([getClubConfig(), getScorecard(id)])
  if (scorecard.status === 'rejected') notFound()
  const clubShortName = config.status === 'fulfilled' ? config.value.club_short_name : 'BCC'
  let data: any
  data = scorecard.value

  const { match, inningsWithState, playerNameMap, article } = data

  return (
    <>
      <style>{`
        .result-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }

        /* Hero */
        .result-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          padding: 36px 0;
          margin-bottom: 36px;
          position: relative;
          overflow: hidden;
        }
        .result-hero::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 65%);
          pointer-events: none;
        }
        .result-breadcrumb {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.4);
          margin-bottom: 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .result-breadcrumb a { color: #60a5fa; text-decoration: none; transition: color 0.15s; }
        .result-breadcrumb a:hover { color: #93c5fd; }
        .result-breadcrumb-sep { opacity: 0.4; }

        .result-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(24px, 4vw, 42px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.02em;
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        }
        .result-title-vs {
          font-family: 'Outfit', sans-serif;
          font-size: 14px; font-weight: 600;
          color: #38bdf8;
          padding: 3px 10px; border-radius: 5px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.2);
        }

        .result-meta {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          color: rgba(147,197,253,0.5);
          display: flex; gap: 20px; flex-wrap: wrap; align-items: center;
          margin-bottom: 12px;
        }
        .result-outcome {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700;
          color: #38bdf8;
          padding: 5px 14px; border-radius: 7px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
          display: inline-flex;
        }

        /* Innings blocks */
        .innings-blocks { display: flex; flex-direction: column; gap: 24px; }

        .innings-block {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.14);
          border-radius: 14px;
          overflow: hidden;
          position: relative;
        }
        .innings-block::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent);
        }

        /* Collapsible innings */
        .innings-details { display: contents; }
        .innings-details summary { list-style: none; cursor: pointer; }
        .innings-details summary::-webkit-details-marker { display: none; }

        .innings-header {
          background: rgba(10,22,40,0.6);
          padding: 18px 22px;
          border-bottom: 1px solid rgba(59,130,246,0.1);
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .innings-details:not([open]) .innings-header { border-bottom: none; }
        .innings-collapse-icon {
          font-size: 11px; color: rgba(147,197,253,0.3);
          margin-left: 8px; transition: transform 0.2s;
          display: inline-block;
        }
        .innings-details[open] .innings-collapse-icon { transform: rotate(180deg); }
        .innings-number {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(147,197,253,0.4);
          margin-bottom: 4px;
        }
        .innings-team {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.02em;
        }
        .innings-total {
          font-family: 'Syne', sans-serif;
          font-size: 40px; font-weight: 800;
          color: #60a5fa;
          letter-spacing: -0.02em;
          text-align: right; line-height: 1;
        }
        .innings-total-wkts {
          color: rgba(147,197,253,0.4);
          font-size: 28px;
        }
        .innings-rr {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; color: rgba(147,197,253,0.45);
          text-align: right; margin-top: 6px;
        }

        /* Scorecard sections */
        .sc-section { padding: 0; }
        .sc-section-title {
          padding: 10px 22px;
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(147,197,253,0.4);
          background: rgba(10,22,40,0.4);
          border-bottom: 1px solid rgba(59,130,246,0.08);
        }

        .sc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sc-table th {
          font-family: 'Outfit', sans-serif;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.3);
          text-align: right; padding: 8px 16px;
          border-bottom: 1px solid rgba(59,130,246,0.08);
          white-space: nowrap;
        }
        .sc-table th:first-child { text-align: left; }
        .sc-table td {
          padding: 10px 16px;
          border-bottom: 1px solid rgba(59,130,246,0.05);
          color: rgba(147,197,253,0.5);
          text-align: right; vertical-align: top;
          font-family: 'Outfit', sans-serif;
        }
        .sc-table td:first-child { text-align: left; color: #e2eeff; }
        .sc-table tbody tr:last-child td { border-bottom: none; }
        .sc-table tbody tr:hover { background: rgba(37,99,235,0.04); }

        .player-name { font-family: 'Syne', sans-serif; font-weight: 700; color: #e2eeff; font-size: 13px; letter-spacing: -0.01em; }
        .how-out { font-family: 'Outfit', sans-serif; font-size: 10px; color: rgba(147,197,253,0.35); margin-top: 2px; }
        .big-num { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: #60a5fa; }
        .wickets-num { color: #fca5a5; }

        .extras-row {
          padding: 10px 16px;
          border-top: 1px solid rgba(59,130,246,0.08);
          display: flex; justify-content: space-between;
          font-family: 'Outfit', sans-serif; font-size: 12px;
          background: rgba(10,22,40,0.3);
        }
        .extras-label { color: rgba(147,197,253,0.4); }
        .extras-value { color: #93c5fd; font-weight: 600; }

        .fow-row {
          padding: 12px 16px;
          border-top: 1px solid rgba(59,130,246,0.08);
          font-family: 'Outfit', sans-serif; font-size: 12px;
          color: rgba(147,197,253,0.45);
          line-height: 1.9;
          background: rgba(10,22,40,0.2);
        }
        .fow-label {
          font-family: 'Outfit', sans-serif;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(147,197,253,0.3);
          margin-bottom: 6px;
        }

        /* Scrollable table wrapper */
        .sc-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        @media (max-width: 768px) {
          .innings-header { padding: 14px 16px; }
          .innings-team { font-size: 17px; }
          .innings-total { font-size: 32px; }
          .innings-total-wkts { font-size: 22px; }
          .sc-table { font-size: 12px; }
          .sc-table th { padding: 7px 10px; font-size: 8px; }
          .sc-table td { padding: 9px 10px; }
          .big-num { font-size: 14px; }
          .sc-section-title { padding: 8px 16px; }
          .result-hero { padding: 28px 0; margin-bottom: 24px; }
          .fow-row { padding: 10px 12px; font-size: 11px; }
          .extras-row { padding: 8px 12px; }
        }
        @media (max-width: 480px) {
          .innings-total { font-size: 28px; }
          .sc-table { font-size: 11px; }
          .sc-table th { font-size: 8px; padding: 6px 8px; }
          .sc-table td { padding: 8px 8px; }
          .player-name { font-size: 12px; }
          .result-meta { gap: 10px; font-size: 12px; }
        }

        /* Milestones */
        .milestone {
          display: inline-block;
          font-size: 9px; font-weight: 800; letter-spacing: 0.05em;
          padding: 1px 5px; border-radius: 4px; margin-left: 5px;
          vertical-align: middle; line-height: 1.6;
        }
        .milestone-100 { background: rgba(251,191,36,0.2); color: #fbbf24; border: 1px solid rgba(251,191,36,0.35); }
        .milestone-50  { background: rgba(148,163,184,0.15); color: #94a3b8; border: 1px solid rgba(148,163,184,0.25); }
        .milestone-5w  { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
        .milestone-ht  { background: rgba(168,85,247,0.15); color: #d8b4fe; border: 1px solid rgba(168,85,247,0.25); }

        /* Partnerships */
        .ps-row {
          padding: 10px 16px;
          border-top: 1px solid rgba(59,130,246,0.08);
          font-family: 'Outfit', sans-serif; font-size: 12px;
          background: rgba(10,22,40,0.2);
        }
        .ps-label {
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(147,197,253,0.3);
          margin-bottom: 8px;
        }
        .ps-grid {
          display: flex; flex-wrap: wrap; gap: 6px;
        }
        .ps-chip {
          display: inline-flex; flex-direction: column;
          padding: 5px 10px; border-radius: 7px; min-width: 60px;
          background: rgba(37,99,235,0.06); border: 1px solid rgba(59,130,246,0.12);
          text-align: center;
        }
        .ps-chip-runs { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: #60a5fa; line-height: 1.2; }
        .ps-chip-balls { font-size: 10px; color: rgba(147,197,253,0.35); }
        .ps-chip-names { font-size: 10px; color: rgba(147,197,253,0.45); margin-top: 1px; }
        .ps-chip-unbroken { border-color: rgba(34,197,94,0.2); background: rgba(34,197,94,0.05); }
        .ps-chip-unbroken .ps-chip-runs { color: #86efac; }

        /* Match report article */
        .match-report {
          margin-top: 36px;
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.14);
          border-radius: 14px;
          overflow: hidden;
          position: relative;
        }
        .match-report::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(56,189,248,0.35), transparent);
        }
        .match-report-header {
          background: rgba(10,22,40,0.6);
          padding: 18px 24px;
          border-bottom: 1px solid rgba(59,130,246,0.1);
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
        }
        .match-report-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(56,189,248,0.5);
          margin-bottom: 4px;
        }
        .match-report-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.02em;
        }
        .match-report-body {
          padding: 24px;
          font-family: 'Outfit', sans-serif;
          font-size: 15px; line-height: 1.8;
          color: rgba(147,197,253,0.75);
        }
        .match-report-body p { margin: 0 0 1.2em 0; }
        .match-report-body p:last-child { margin-bottom: 0; }
        .match-report-body strong { color: #e2eeff; font-weight: 700; }
        .match-report-edit-link {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          color: rgba(147,197,253,0.35);
          text-decoration: none; padding: 4px 10px;
          border-radius: 5px; border: 1px solid rgba(59,130,246,0.15);
          background: rgba(10,22,40,0.4);
          transition: all 0.15s; white-space: nowrap;
        }
        .match-report-edit-link:hover { color: #60a5fa; border-color: rgba(59,130,246,0.35); }
        @media (max-width: 768px) {
          .match-report-header { padding: 14px 16px; }
          .match-report-body { padding: 16px; font-size: 14px; }
          .match-report-title { font-size: 16px; }
          .match-report { margin-top: 24px; }
        }
      `}</style>

      <div className="result-page">
        <div className="result-hero">
          <div className="container">
            <div className="result-breadcrumb">
              <Link href="/results">Results</Link>
              <span className="result-breadcrumb-sep">/</span>
              Match Scorecard
            </div>
            <div className="result-title">
              {clubShortName}
              <span className="result-title-vs">vs</span>
              {match.opponent?.canonical_name}
            </div>
            <div className="result-meta">
              <span>📅 {formatDate(match.match_date)}</span>
              {match.ground?.name && <span>📍 {match.ground.name}</span>}
              {match.competition?.name && <span>🏆 {match.competition.name}</span>}
              <span className={`badge ${match.status === 'in_progress' ? 'badge-red' : match.status === 'completed' ? 'badge-muted' : 'badge-gold'}`}>
                {match.status}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              {match.result_text && <div className="result-outcome">{match.result_text}</div>}
              <ShareButton
                title={`${clubShortName} vs ${match.opponent?.canonical_name}`}
                text={match.result_text ?? undefined}
              />
            </div>
          </div>
        </div>

        <div className="container">
          {match.status === 'in_progress' && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Link href={`/matches/${match.id}`} className="btn btn-outline">
                <span className="live-dot" /> Watch Live
              </Link>
            </div>
          )}

          {inningsWithState.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              Scoring has not started yet.
            </div>
          ) : (
            <div className="innings-blocks">
              {inningsWithState.map(({ inn, state, partnerships, hatTrickBowlers }: any) => (
                <div key={inn.id} className="innings-block">
                  <details className="innings-details" open>
                  <summary>
                  <div className="innings-header">
                    <div>
                      <div className="innings-number">Innings {inn.innings_number}</div>
                      <div className="innings-team">
                        {inn.batting_side === 'home' ? clubShortName : match.opponent?.canonical_name}
                        <span className="innings-collapse-icon">▼</span>
                      </div>
                    </div>
                    <div>
                      <div className="innings-total">
                        {state.totalRuns + (inn.bonus_runs ?? 0)}<span className="innings-total-wkts">/{state.wickets}</span>
                      </div>
                      <div className="innings-rr">
                        {state.oversDisplay} overs ·{' '}
                        RR {state.legalBalls > 0 ? (((state.totalRuns + (inn.bonus_runs ?? 0)) / state.legalBalls) * 6).toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                  </summary>

                  {/* Batting */}
                  <div className="sc-section">
                    <div className="sc-section-title">Batting</div>
                    <div className="sc-scroll"><table className="sc-table">
                      <thead>
                        <tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
                      </thead>
                      <tbody>
                        {Object.values(state.batterStats).map((b: any) => {
                          const bowlerName = b.dismissalBowlerId ? (playerNameMap.get(b.dismissalBowlerId) ?? null) : null
                          const fielderName = b.dismissalFielderSubName
                            ?? (b.dismissalFielderId ? (playerNameMap.get(b.dismissalFielderId) ?? null) : null)
                          const fielder2Name = b.dismissalFielder2SubName
                            ?? (b.dismissalFielder2Id ? (playerNameMap.get(b.dismissalFielder2Id) ?? null) : null)
                          return (
                          <tr key={b.matchPlayerId}>
                            <td>
                              <div className="player-name">{b.name}</div>
                              <div className="how-out">
                                {b.isOut
                                  ? formatHowOut(b.dismissalType, bowlerName, fielderName, fielder2Name)
                                  : 'not out'}
                              </div>
                            </td>
                            <td>
                              <span className="big-num">{b.runs}</span>
                              {b.runs >= 100 && <span className="milestone milestone-100">100</span>}
                              {b.runs >= 50 && b.runs < 100 && <span className="milestone milestone-50">50</span>}
                            </td>
                            <td>{b.balls}</td>
                            <td>{b.fours}</td>
                            <td>{b.sixes}</td>
                            <td>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '—'}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table></div>
                    <div className="extras-row">
                      <span className="extras-label">Extras</span>
                      <span className="extras-value">
                        {state.extras.total + (inn.bonus_runs ?? 0)}{' '}
                        (b {state.extras.bye}, lb {state.extras.leg_bye}, wd {state.extras.wide}, nb {state.extras.no_ball}
                        {(state.extras.penalty + (inn.bonus_runs ?? 0)) > 0 && `, pen ${state.extras.penalty + (inn.bonus_runs ?? 0)}`})
                      </span>
                    </div>
                    {state.fallOfWickets.length > 0 && (
                      <div className="fow-row">
                        <div className="fow-label">Fall of Wickets</div>
                        {state.fallOfWickets.map((f: any) => (
                          <span key={f.wicketNumber} style={{ marginRight: 12 }}>
                            {f.wicketNumber}/{f.runs} ({playerNameMap.get(f.matchPlayerId) ?? '?'}, {f.over} ov)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Partnerships */}
                  {partnerships.length > 0 && (
                    <div className="ps-row">
                      <div className="ps-label">Partnerships</div>
                      <div className="ps-grid">
                        {partnerships.map((p: Partnership) => (
                          <div key={p.wicket} className={`ps-chip${p.wicket === 0 ? ' ps-chip-unbroken' : ''}`}>
                            <span className="ps-chip-runs">{p.runs}</span>
                            <span className="ps-chip-balls">({p.balls}b)</span>
                            <span className="ps-chip-names">{shortName(p.batter1)} &amp; {shortName(p.batter2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bowling */}
                  <div className="sc-section" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="sc-section-title">Bowling</div>
                    <div className="sc-scroll"><table className="sc-table">
                      <thead>
                        <tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Wd</th><th>NB</th><th>Econ</th></tr>
                      </thead>
                      <tbody>
                        {Object.values(state.bowlerStats).map((b: any) => (
                          <tr key={b.matchPlayerId}>
                            <td>
                              <div className="player-name">{b.name}</div>
                              {hatTrickBowlers.has(b.matchPlayerId) && <span className="milestone milestone-ht">HT</span>}
                            </td>
                            <td>{b.overs}</td>
                            <td>{b.runs}</td>
                            <td>
                              <span className="big-num wickets-num">{b.wickets}</span>
                              {b.wickets >= 5 && <span className="milestone milestone-5w">5W</span>}
                            </td>
                            <td>{b.wides}</td>
                            <td>{b.noBalls}</td>
                            <td>{b.economy || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                  </details>
                </div>
              ))}
            </div>
          )}

          {/* Match report article */}
          {article && (
            <div className="match-report">
              <div className="match-report-header">
                <div>
                  <div className="match-report-label">Match Report</div>
                  <div className="match-report-title">{article.title}</div>
                </div>
                <Link href={`/admin/news/${article.id}`} className="match-report-edit-link">
                  Edit →
                </Link>
              </div>
              <div
                className="match-report-body"
                dangerouslySetInnerHTML={{ __html: renderArticle(article.content) }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '') // remove event handlers
    .replace(/javascript\s*:/gi, '')                  // remove javascript: URLs
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove script tags
}

/** Minimal markdown → HTML: paragraphs only (no headings needed for auto reports) */
function renderArticle(md: string): string {
  return sanitizeHtml(
    md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('')
  )
}
