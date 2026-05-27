'use client'
import { useEffect, useRef, useState } from 'react'
import type { BallAnnotation, BallEvent, BowlingType, DismissalType, ExtrasType, InningsState, MatchPlayer, ScoringMode } from '@/lib/cricket/types'
import { computeInningsState, isNaturalEnd, deriveResultText, totalBallRuns, recomputeBatterSequence } from '@/lib/cricket/engine'
import { deriveEffectivePositions } from '@/lib/cricket/positions'
import { detectPhase as _detectPhase, type Phase } from '@/lib/cricket/phases'
import { validateBall } from '@/lib/cricket/validators'
import { generateCommentary } from '@/lib/cricket/commentary'
import { queueBall, flushQueue, getQueueCount, getQueueMaxSequence } from '@/lib/offline/queue'
import { dlsTarget } from '@/lib/cricket/dls'
import { supabase } from '@/lib/supabase/client'
import { subscribeBallEvents } from '@/lib/supabase/realtime'
import Link from 'next/link'
import ScorerErrorBoundary from './ScorerErrorBoundary'
import RunButtons from './RunButtons'
import ExtrasRow from './ExtrasRow'
import WicketModal from './WicketModal'
import PlayerSelectModal from './PlayerSelectModal'
import OverDots from './OverDots'
import UndoButton from './UndoButton'
import InningsBreakFlow from './InningsBreakFlow'
import CaptainKeeperSetup from './CaptainKeeperSetup'
import CorrectBallModal from './CorrectBallModal'
import CorrectOverBowlerModal from './CorrectOverBowlerModal'
import PenaltyModal from './PenaltyModal'
import SetupBccXi from './SetupBccXi'
import SetupOppXi from './SetupOppXi'
import SearchSelect from './SearchSelect'
import BallAnnotationPanel from './professional/BallAnnotationPanel'

interface MatchData {
  id: string
  overs_per_innings: number
  free_hit_on_no_ball: boolean
  our_team_side: 'home' | 'away'
  opponentName?: string
  competitionName?: string
  matchDate?: string
  initialTossWonBy?: 'home' | 'away' | null
  initialTossDecision?: 'bat' | 'field' | null
  scoring_mode: ScoringMode
}

interface InningsData {
  id: string
  innings_number: number
  batting_side: 'home' | 'away'
  status: string
  target: number | null
  bonus_runs: number
  is_dls: boolean
}

interface AvailablePlayer {
  id: string
  first_name: string
  last_name: string
  _preselected?: boolean  // true when pre-populated from coach's selections
  _position?: number      // batting position from selections
}

// Phase type is imported from lib/cricket/phases

interface Props {
  match: MatchData
  innings: InningsData | null
  initialBalls: BallEvent[]
  allPlayers: MatchPlayer[]
  availablePlayers: AvailablePlayer[]
}

function detectPhase(
  matchPlayers: MatchPlayer[],
  innings: InningsData | null,
  balls: BallEvent[],
  ourSide: 'home' | 'away'
): Phase {
  return _detectPhase(matchPlayers, innings, balls.length, ourSide)
}

function SetupPhaseHeader({ step, title }: { step: number; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderBottom: '1px solid var(--border)',
      background: 'rgba(5,12,26,0.95)',
    }}>
      <Link href="/admin/matches" style={{
        color: 'var(--muted)', fontSize: 13, textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        ← Matches
      </Link>
      <div style={{
        fontSize: 10, color: 'var(--dim)', letterSpacing: '0.14em',
        fontFamily: 'var(--font-display)', fontWeight: 700,
      }}>
        STEP {step} / 5 — {title.toUpperCase()}
      </div>
    </div>
  )
}

export default function ScorerShell(props: Props) {
  const [queueCount, setQueueCount] = useState(0)

  return (
    <ScorerErrorBoundary queueCount={queueCount}>
      <ScorerShellInner {...props} queueCount={queueCount} onQueueCount={setQueueCount} />
    </ScorerErrorBoundary>
  )
}


function ScorerShellInner({
  match,
  innings: initialInnings,
  initialBalls,
  allPlayers: initialMatchPlayers,
  availablePlayers,
  queueCount,
  onQueueCount,
}: Props & { queueCount: number; onQueueCount: (n: number) => void }) {

  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>(initialMatchPlayers)
  const [balls, setBalls]   = useState<BallEvent[]>(initialBalls)
  const [innings, setInnings] = useState<InningsData | null>(initialInnings)
  const [phase, setPhase]   = useState<Phase>(() =>
    detectPhase(initialMatchPlayers, initialInnings, initialBalls, match.our_team_side)
  )
  const [online, setOnline]           = useState(true)
  const [authWarning, setAuthWarning] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showWicketModal, setShowWicketModal]       = useState(false)
  const [showNewBatter, setShowNewBatter]           = useState(false)
  const [showChangeBowler, setShowChangeBowler]     = useState(false)
  const [matchOptionsSheet, setMatchOptionsSheet]   = useState<null | 'menu' | 'end_innings'>(null)
  const [endEarlyReason, setEndEarlyReason]               = useState('')
  const [endEarlyOtherText, setEndEarlyOtherText]         = useState('')
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false)
  const [showAbandonFlow, setShowAbandonFlow]       = useState(false)
  const [abandonReason, setAbandonReason]           = useState<string>('')
  const [showEditFormat, setShowEditFormat]         = useState(false)
  const [newOversInput, setNewOversInput]           = useState('')
  const [oversPerInnings, setOversPerInnings]       = useState(match.overs_per_innings)
  const [showCorrectBowler, setShowCorrectBowler]   = useState(false)
  const [showInjuryBowler, setShowInjuryBowler]     = useState(false)
  const [showPenaltyModal, setShowPenaltyModal]     = useState(false)
  const [showReviseDlsDialog, setShowReviseDlsDialog] = useState(false)
  const [revisedTeam2Overs, setRevisedTeam2Overs]     = useState(match.overs_per_innings)
  const [team1Score, setTeam1Score]                   = useState(0)
  const [team1OversAllocated, setTeam1OversAllocated] = useState(match.overs_per_innings)
  const [endInningsBallId, setEndInningsBallId] = useState<string | null>(null)
  // Professional scoring mode — annotation panel shown after each ball
  const [pendingAnnotationBallId, setPendingAnnotationBallId] = useState<string | null>(null)
  const [pendingAnnotationBowlerId, setPendingAnnotationBowlerId] = useState<string | null>(null)
  // Bowling type remembered per bowler for the duration of the match (set once on first ball)
  const [bowlerTypeMap, setBowlerTypeMap] = useState<Record<string, BowlingType>>({})
  const [correctingBall, setCorrectingBall] = useState<BallEvent | null>(null)
  // Pending selections: hold chosen player until the next ball is submitted
  const [pendingNewBatterId, setPendingNewBatterId] = useState<string | null>(null)
  const [pendingNewBowlerId, setPendingNewBowlerId] = useState<string | null>(null)
  const [tossWonBy, setTossWonBy]     = useState<'home' | 'away' | null>(match.initialTossWonBy ?? null)
  const [tossDecision, setTossDecision] = useState<'bat' | 'field' | null>(match.initialTossDecision ?? null)
  const [matchResultText, setMatchResultText] = useState<string | null>(null)
  const [opener1, setOpener1]         = useState<string | null>(null)
  const [opener2, setOpener2]         = useState<string | null>(null)
  const [openingBowler, setOpeningBowler] = useState<string | null>(null)

  const lastKnownSequenceRef = useRef(
    initialBalls.length > 0 ? initialBalls[initialBalls.length - 1].sequence_number : 0
  )
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Prevents double-tap and submit/undo races — checked synchronously before any async work
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  // Name resolution: match_players.id → display name
  const availableMap = new Map(
    availablePlayers.map(p => [p.id, `${p.first_name} ${p.last_name}`.trim()])
  )
  const playerNameMap = new Map(
    matchPlayers.map(p => [
      p.id,
      p.opposition_name ?? availableMap.get(p.player_id ?? '') ?? `Player ${p.batting_position ?? '?'}`,
    ])
  )
  const playerName = (id: string) => playerNameMap.get(id) ?? id

  const oppSide = match.our_team_side === 'home' ? 'away' : 'home'
  const bccPlayers = matchPlayers.filter(p => p.side === match.our_team_side)
  const oppPlayers = matchPlayers.filter(p => p.side === oppSide)

  const state: InningsState = computeInningsState(balls, playerNameMap)

  // Online/offline
  useEffect(() => {
    const go  = () => {
      setOnline(true)
      flushQueue(supabase).then(() => getQueueCount().then(onQueueCount))
    }
    const off = () => setOnline(false)
    window.addEventListener('online',  go)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', off) }
  }, [])

  // Auth check
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setAuthWarning(true)
      else setAuthWarning(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (!innings?.id) return
    const channel = subscribeBallEvents(
      innings.id,
      lastKnownSequenceRef.current,
      (ball) => {
        setBalls(prev => prev.some(b => b.id === ball.id) ? prev : [...prev, ball].sort((a, b) => a.sequence_number - b.sequence_number))
        lastKnownSequenceRef.current = Math.max(lastKnownSequenceRef.current, ball.sequence_number)
      },
      (ballId) => setBalls(prev => prev.filter(b => b.id !== ballId)),
      () => {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const { data } = await supabase.from('ball_events').select('*')
              .eq('innings_id', innings!.id)
              .gt('sequence_number', lastKnownSequenceRef.current)
              .order('sequence_number')
            if (data?.length) {
              setBalls(prev => {
                const existing = new Set(prev.map(b => b.id))
                const newBalls = data.filter((b: BallEvent) => !existing.has(b.id))
                if (!newBalls.length) return prev
                const merged = [...prev, ...newBalls].sort((a, b) => a.sequence_number - b.sequence_number)
                lastKnownSequenceRef.current = merged[merged.length - 1].sequence_number
                return merged
              })
            }
          }, 10000)
        }
      }
    )
    return () => {
      channel.unsubscribe()
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }
  }, [innings?.id])

  useEffect(() => { getQueueCount().then(onQueueCount) }, [])

  // On mount, advance lastKnownSequenceRef past any balls that are still in the
  // offline queue from a previous session. Without this, a page reload mid-offline
  // would re-use sequence numbers already assigned to queued balls, causing the
  // first online ball to collide with the first queued ball on flush.
  useEffect(() => {
    getQueueMaxSequence().then(maxQueued => {
      if (maxQueued > lastKnownSequenceRef.current) {
        lastKnownSequenceRef.current = maxQueued
      }
    })
  }, [])

  // Over boundary → prompt new bowler (must be before any early returns)
  const prevLegalBalls = useRef(state.legalBalls)
  useEffect(() => {
    if (state.legalBalls > 0 && state.legalBalls % 6 === 0 && state.legalBalls !== prevLegalBalls.current) {
      setShowChangeBowler(true)
    }
    prevLegalBalls.current = state.legalBalls
  }, [state.legalBalls])

  // Wicket → prompt new batter (must be before any early returns)
  // Don't prompt if the innings is already naturally over (saves no purpose and blocks UI)
  const prevWickets = useRef(state.wickets)
  useEffect(() => {
    const inningsOver = innings ? isNaturalEnd(state, oversPerInnings, innings.target) : false
    if (state.wickets > prevWickets.current && state.wickets < 10 && !inningsOver) setShowNewBatter(true)
    prevWickets.current = state.wickets
  }, [state.wickets])

  // Reload recovery: prevWickets/prevLegalBalls refs start at the current values, so the
  // effects above never fire on reload even if a wicket was the last ball or an over just
  // ended. Re-derive positions from initialBalls (all pending state is null on mount) and
  // auto-show the picker if needed.
  useEffect(() => {
    const s = computeInningsState(initialBalls, new Map())
    const pos = deriveEffectivePositions({
      state: s,
      ballCount: initialBalls.length,
      pendingNewBatterId: null,
      pendingNewBowlerId: null,
      opener1: null,
      opener2: null,
      openingBowler: null,
    })
    if (pos.needsNewBatter) setShowNewBatter(true)
    if (pos.needsNewBowler) setShowChangeBowler(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount-only — captures initialBalls from the first render's closure

  // ── PHASE: setup_bcc_xi ───────────────────────────────────────
  if (phase === 'setup_bcc_xi') {
    return (
      <div style={{ minHeight: '100vh' }}>
        <SetupPhaseHeader step={1} title="BCC XI" />
        <SetupBccXi
          matchId={match.id}
          ourSide={match.our_team_side}
          availablePlayers={availablePlayers}
          onComplete={(inserted) => {
            setMatchPlayers(prev => [...prev, ...inserted])
            setPhase('setup_opp_xi')
          }}
        />
      </div>
    )
  }

  // ── PHASE: setup_opp_xi ───────────────────────────────────────
  if (phase === 'setup_opp_xi') {
    return (
      <div style={{ minHeight: '100vh' }}>
        <SetupPhaseHeader step={2} title="Opposition XI" />
        <SetupOppXi
          matchId={match.id}
          oppSide={oppSide}
          onComplete={(inserted) => {
            setMatchPlayers(prev => [...prev, ...inserted])
            setPhase('captain_keeper')
          }}
        />
      </div>
    )
  }

  // ── PHASE: captain_keeper ─────────────────────────────────────
  if (phase === 'captain_keeper') {
    return (
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <SetupPhaseHeader step={3} title="Captain & Keeper" />
        <CaptainKeeperSetup
          matchId={match.id}
          homePlayers={bccPlayers}
          awayPlayers={oppPlayers}
          playerName={playerName}
          onComplete={() => setPhase('toss')}
        />
      </div>
    )
  }

  // ── PHASE: toss ───────────────────────────────────────────────
  if (phase === 'toss') {
    return (
      <div style={{ minHeight: '100vh' }}>
        <SetupPhaseHeader step={4} title="Toss" />
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '32px 20px 40px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', marginBottom: 24 }}>Toss</h2>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Toss won by</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['home', 'away'] as const).map(side => (
              <button key={side} className={tossWonBy === side ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={() => setTossWonBy(side)} style={{ flex: 1, justifyContent: 'center', minHeight: 52, fontSize: 15 }}>
                {side === match.our_team_side ? 'BCC (us)' : 'Opposition'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Elected to</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['bat', 'field'] as const).map(dec => (
              <button key={dec} className={tossDecision === dec ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={() => setTossDecision(dec)} style={{ flex: 1, justifyContent: 'center', minHeight: 52, fontSize: 15, textTransform: 'capitalize' }}>
                {dec}
              </button>
            ))}
          </div>
        </div>

        {/* Summary pill — confirms the selection before proceeding */}
        {tossWonBy && tossDecision && (
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 14, color: 'var(--text)' }}>
            {tossWonBy === match.our_team_side ? 'BCC' : 'Opposition'} won the toss and elected to <strong>{tossDecision}</strong>.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost"
            style={{ padding: '14px 20px', fontSize: 15, minHeight: 50 }}
            onClick={() => setPhase('captain_keeper')}>
            ← Back
          </button>
          <button className="btn btn-primary" disabled={!tossWonBy || !tossDecision}
            style={{ flex: 1, justifyContent: 'center', padding: 14, fontSize: 16, minHeight: 50 }}
            onClick={async () => {
              await supabase.from('matches').update({ toss_won_by: tossWonBy, toss_decision: tossDecision }).eq('id', match.id)
              setPhase('select_openers')
            }}>
            Continue →
          </button>
        </div>
      </div>
      </div>
    )
  }

  // ── PHASE: select_openers ─────────────────────────────────────
  if (phase === 'select_openers') {
    // Use innings.batting_side from DB when available (handles page reload correctly).
    // Fall back to toss calculation only when creating innings 1 fresh.
    const battingSide: 'home' | 'away' = innings?.batting_side
      ?? (tossDecision === 'bat' ? (tossWonBy ?? match.our_team_side)
         : (tossWonBy === 'home' ? 'away' : 'home'))
    const batters = matchPlayers.filter(p => p.side === battingSide)
    const bowlers = matchPlayers.filter(p => p.side !== battingSide)

    return (
      <div style={{ minHeight: '100vh' }}>
        <SetupPhaseHeader step={5} title="Select Openers" />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', lineHeight: 1 }}>
            Select Openers
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            Batting: <strong style={{ color: 'var(--text)' }}>{battingSide === match.our_team_side ? 'BCC' : 'Opposition'}</strong>
          </div>
        </div>

        {(['Opener 1', 'Opener 2'] as const).map((label, i) => {
          const val = i === 0 ? opener1 : opener2
          const other = i === 0 ? opener2 : opener1
          const setter = i === 0 ? setOpener1 : setOpener2
          return (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
              <SearchSelect
                players={batters}
                playerName={playerName}
                exclude={other ? [other] : []}
                selected={val}
                onSelect={setter}
              />
            </div>
          )
        })}

        <div style={{ marginBottom: 28, marginTop: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Opening Bowler</div>
          <SearchSelect
            players={bowlers}
            playerName={playerName}
            exclude={[]}
            selected={openingBowler}
            onSelect={setOpeningBowler}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost"
            style={{ padding: 14, fontSize: 16 }}
            onClick={() => setPhase('toss')}>
            ← Back
          </button>
          <button className="btn btn-primary"
          disabled={!opener1 || !opener2 || !openingBowler}
          style={{ flex: 1, justifyContent: 'center', padding: 14, fontSize: 16 }}
          onClick={async () => {
            if (!innings) {
              // Innings 1 — create it in the DB and mark match as in_progress
              const { data } = await supabase
                .from('innings')
                .upsert({ match_id: match.id, innings_number: 1, batting_side: battingSide, status: 'in_progress', bonus_runs: 0 }, { onConflict: 'match_id,innings_number' })
                .select().single()
              if (data) {
                setInnings({ id: data.id, innings_number: 1, batting_side: battingSide, status: 'in_progress', target: null, bonus_runs: 0, is_dls: false })
              }
              await supabase.from('matches').update({ status: 'in_progress' }).eq('id', match.id)
            } else if (innings.status !== 'in_progress') {
              // Innings already exists but status not yet in_progress (e.g. innings 2 reload)
              await supabase.from('innings').update({ status: 'in_progress' }).eq('id', innings.id)
              setInnings(prev => prev ? { ...prev, status: 'in_progress' } : prev)
            }
            if (opener1) await supabase.from('match_players').update({ actual_batting_position: 1 }).eq('id', opener1)
            if (opener2) await supabase.from('match_players').update({ actual_batting_position: 2 }).eq('id', opener2)
            setPhase('scoring')
          }}>
          Start Scoring →
          </button>
        </div>
      </div>
      </div>
    )
  }

  // ── PHASE: innings_break ──────────────────────────────────────
  if (phase === 'innings_break' && innings) {
    const bowlingSide = innings.batting_side === 'home' ? 'away' : 'home'
    return (
      <InningsBreakFlow
        matchId={match.id}
        completedInningsId={innings.id}
        completedState={state}
        innings2Id={null}
        innings2BattingSide={bowlingSide}
        oversPerInnings={oversPerInnings}
        battingPlayers={matchPlayers.filter(p => p.side === bowlingSide)}
        bowlingPlayers={matchPlayers.filter(p => p.side === innings.batting_side)}
        playerName={playerName}
        onResumeScoring={(inn2Id, op1, op2, bowler, target, bonusRuns, t1Score, t1Overs, isDls) => {
          // Reset all innings-1 state that must not leak into innings 2
          prevLegalBalls.current = 0
          prevWickets.current = 0
          lastKnownSequenceRef.current = 0
          setPendingNewBatterId(null)
          setPendingNewBowlerId(null)
          setShowChangeBowler(false)
          setShowNewBatter(false)
          setShowWicketModal(false)
          setMatchOptionsSheet(null)
          // Store team 1 data for possible DLS revision during innings 2
          setTeam1Score(t1Score)
          setTeam1OversAllocated(t1Overs)
          setRevisedTeam2Overs(oversPerInnings)
          // Start innings 2
          setInnings({ id: inn2Id, innings_number: 2, batting_side: bowlingSide, status: 'in_progress', target, bonus_runs: bonusRuns, is_dls: isDls })
          setOpener1(op1); setOpener2(op2); setOpeningBowler(bowler)
          setBalls([])
          setPhase('scoring')
        }}
        onMatchComplete={() => setPhase('match_complete')}
      />
    )
  }

  // ── PHASE: match_complete ─────────────────────────────────────
  if (phase === 'match_complete') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 900, color: 'var(--lime)', marginBottom: 16 }}>
          Match Complete
        </div>
        {matchResultText && (
          <p style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>{matchResultText}</p>
        )}
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>The match has been marked as complete.</p>
        <Link href={`/results/${match.id}`} className="btn btn-primary">
          View Scorecard →
        </Link>
      </div>
    )
  }

  // ── PHASE: scoring ────────────────────────────────────────────
  if (!innings) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Waiting for innings setup...</div>
  }

  const {
    effectiveStrikerId,
    effectiveNonStrikerId,
    effectiveBowlerId,
    needsNewBatter,
    needsNewBowler,
  } = deriveEffectivePositions({
    state,
    ballCount: balls.length,
    pendingNewBatterId,
    pendingNewBowlerId,
    opener1,
    opener2,
    openingBowler,
  })

  // Skip this guard when needsNewBatter is true: a wicket was just taken and
  // opener1/opener2 are null (page reload mid-innings), but we still need to
  // render so the new-batter modal can appear. Without this, the scorer sees
  // "Waiting for innings setup..." instead of the replacement-picker.
  if ((!effectiveStrikerId || !effectiveBowlerId) && !needsNewBatter) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Waiting for innings setup...</div>
  }

  const freeHit = state.nextBallIsFreeHit && match.free_hit_on_no_ball
  const fieldingPlayers = matchPlayers.filter(p => p.side !== innings.batting_side)
  const prevBowlerId = state.legalBalls >= 6
    ? balls.filter(b => b.over_number === Math.floor(state.legalBalls / 6) - 1)[0]?.bowler_id
    : undefined

  async function submitBall(partialBall: Partial<BallEvent>) {
    // Double-tap / submit+undo race guard — checked synchronously before any async work
    if (submittingRef.current) return
    if (!innings?.id) return
    if (['completed', 'declared', 'abandoned'].includes(innings.status)) {
      setError('Innings is already complete.'); return
    }
    if (authWarning) { setError('Session expired — please refresh and log in again.'); return }

    // Block if the innings has already reached a natural end (target met, all out, overs up)
    if (isNaturalEnd(state, oversPerInnings, innings.target)) {
      setError('Innings is already over — click "End Innings" to continue.')
      return
    }

    const validation = validateBall(partialBall, state, {
      overs_per_innings: oversPerInnings,
      free_hit_on_no_ball: match.free_hit_on_no_ball,
    })
    if (!validation.valid) { setError(validation.error); return }
    setError(null)

    submittingRef.current = true
    setSubmitting(true)
    try {
      const nextSeq = lastKnownSequenceRef.current + 1
      // ball_in_over: at an over boundary currentOverBalls shows the completed over (6 balls),
      // not the new (empty) over — so force 0 when we're starting a fresh over.
      const isStartOfNewOver = state.legalBalls > 0 && state.legalBalls % 6 === 0
      const newBall: BallEvent = {
        id: crypto.randomUUID(),
        innings_id: innings.id,
        match_id: match.id,
        sequence_number: nextSeq,
        over_number: Math.floor(state.legalBalls / 6),
        ball_in_over: isStartOfNewOver ? 0 : state.currentOverBalls.length,
        batter_id: effectiveStrikerId!,
        non_striker_id: effectiveNonStrikerId ?? effectiveStrikerId!,
        bowler_id: effectiveBowlerId!,
        runs_off_bat: 0,
        extras_type: null,
        extras_runs: 0,
        is_boundary_four: false,
        is_boundary_six: false,
        dismissal_type: null,
        dismissed_player_id: null,
        fielder_id: null,
        fielder_substitute_name: null,
        penalty_reason: null,
        penalty_to_fielding: false,
        commentary: null,
        created_at: new Date().toISOString(),
        ...partialBall,
      }

      // Generate commentary text from the state before this ball
      newBall.commentary = generateCommentary(newBall, state, playerName)

      // Compute state after this ball to detect a natural end caused by it
      const nextState = computeInningsState([...balls, newBall], playerNameMap)
      const endsInnings = isNaturalEnd(nextState, oversPerInnings, innings.target)

      setBalls(prev => [...prev, newBall])
      lastKnownSequenceRef.current = nextSeq
      // Consume pending selections — engine will now derive positions from ball events
      setPendingNewBatterId(null)
      setPendingNewBowlerId(null)

      // Fallback: ensure match is marked in_progress on first ball (catches matches started before this fix)
      if (online && balls.length === 0) {
        supabase.from('matches').update({ status: 'in_progress' }).eq('id', match.id).then(() => {})
      }

      if (online) {
        const { error } = await supabase.from('ball_events').insert(newBall)
        if (error) {
          setBalls(prev => prev.filter(b => b.id !== newBall.id))
          const { blocked } = await queueBall(newBall)
          if (blocked) setError('Offline queue full (300 balls). Connect to sync.')
          else setError('Save failed — ball queued for retry when connection restores.')
          getQueueCount().then(onQueueCount)
          return
        }
      } else {
        const { warned, blocked } = await queueBall(newBall)
        if (blocked) setError('Offline queue full (300 balls). Connect to sync.')
        else if (warned) setError('Warning: 250+ balls in offline queue.')
        getQueueCount().then(onQueueCount)
      }

      // Professional mode: show annotation panel for this ball (always skippable)
      if (match.scoring_mode === 'professional') {
        setPendingAnnotationBallId(newBall.id)
        setPendingAnnotationBowlerId(effectiveBowlerId ?? null)
      }

      // Prompt scorer to confirm end — they may want to undo a misclick
      if (endsInnings) {
        setEndInningsBallId(newBall.id)
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function undoLastBall(ballId: string) {
    // Don't allow undo while a ball submit is in flight — state would be stale
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const ballToUndo = balls.find(b => b.id === ballId)

      // Snapshot ref values BEFORE the optimistic removal so we can restore them
      // if the DB delete fails — otherwise the rollback setBalls call triggers the
      // over-boundary and wicket useEffects spuriously.
      const preUndoLegalBalls = prevLegalBalls.current
      const preUndoWickets    = prevWickets.current

      setBalls(prev => {
        const filtered = prev.filter(b => b.id !== ballId)
        // Recompute to get accurate counts BEFORE the useEffect runs,
        // so the boundary/wicket useEffects don't fire spuriously.
        const newState = computeInningsState(filtered, new Map())
        prevLegalBalls.current = newState.legalBalls
        prevWickets.current    = newState.wickets
        return filtered
      })

      // Clear modal state triggered by the undone ball
      if (ballToUndo?.dismissal_type) {
        setShowNewBatter(false)
        setPendingNewBatterId(null)
      }
      // If undoing a legal delivery that was the first ball of a new over, the
      // pending bowler selection is no longer valid (we're back at the boundary
      // and the scorer should re-pick). Also close the change-bowler modal if open.
      const isLegal = ballToUndo && !['wide', 'no_ball'].includes(ballToUndo.extras_type ?? '')
      const wasFirstBallOfOver = isLegal && state.legalBalls % 6 === 1
      if (wasFirstBallOfOver) {
        setPendingNewBowlerId(null)
        setShowChangeBowler(false)
      }

      const { error } = await supabase.from('ball_events').delete().eq('id', ballId)
      if (error) {
        setError('Failed to delete ball: ' + error.message)
        // Restore pre-undo ref values before re-adding the ball so the useEffects
        // see no net change and don't re-fire the change-bowler / new-batter modals.
        prevLegalBalls.current = preUndoLegalBalls
        prevWickets.current    = preUndoWickets
        const { data } = await supabase.from('ball_events').select('*').eq('id', ballId).single()
        if (data) setBalls(prev => [...prev, data as BallEvent].sort((a, b) => a.sequence_number - b.sequence_number))
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function correctBall(updated: BallEvent) {
    // Validate boundary flags before applying — these are the only things
    // CorrectBallModal can change, so we check only ball-level constraints.
    if (updated.is_boundary_four && updated.is_boundary_six) {
      setError('A delivery cannot be both a four and a six.'); return
    }
    if (updated.is_boundary_four && updated.runs_off_bat !== 4) {
      setError('Boundary four requires runs_off_bat = 4.'); return
    }
    if (updated.is_boundary_six && updated.runs_off_bat !== 6) {
      setError('Boundary six requires runs_off_bat = 6.'); return
    }
    if (updated.extras_type === 'wide' && updated.runs_off_bat > 0) {
      setError('Bat runs cannot be scored off a wide.'); return
    }

    // Snapshot for rollback
    const originalBalls = balls

    // Build corrected list and compute which downstream balls need batter swaps
    const correctedList = balls.map(b => b.id === updated.id ? updated : b)
    const correctedIndex = correctedList.findIndex(b => b.id === updated.id)
    const cascades = recomputeBatterSequence(correctedList, correctedIndex)

    // Optimistic update: corrected ball + any cascaded batter swaps
    setBalls(correctedList.map(b => {
      const c = cascades.find(u => u.id === b.id)
      return c ? { ...b, batter_id: c.batter_id, non_striker_id: c.non_striker_id } : b
    }))
    setCorrectingBall(null)

    // Persist: main correction + cascade batter updates in parallel
    const results = await Promise.all([
      supabase.from('ball_events').update({
        runs_off_bat:      updated.runs_off_bat,
        extras_type:       updated.extras_type,
        extras_runs:       updated.extras_runs,
        is_boundary_four:  updated.is_boundary_four,
        is_boundary_six:   updated.is_boundary_six,
      }).eq('id', updated.id),
      ...cascades.map(c =>
        supabase.from('ball_events')
          .update({ batter_id: c.batter_id, non_striker_id: c.non_striker_id })
          .eq('id', c.id)
      ),
    ])

    const firstError = results.find(r => r.error)?.error
    if (firstError) {
      setError('Failed to save correction: ' + firstError.message)
      setBalls(originalBalls)
    }
  }

  async function correctOverBowler(overNumber: number, newBowlerId: string) {
    const overBalls = balls.filter(b => b.over_number === overNumber)
    const ballIds = overBalls.map(b => b.id)
    const originalBalls = [...balls]
    setBalls(prev => prev.map(b => b.over_number === overNumber ? { ...b, bowler_id: newBowlerId } : b))
    setShowCorrectBowler(false)
    const { error } = await supabase
      .from('ball_events')
      .update({ bowler_id: newBowlerId })
      .in('id', ballIds)
    if (error) {
      setError('Failed to correct bowler: ' + error.message)
      setBalls(originalBalls)
    }
  }

  async function handlePenalty(reason: string, toFielding: boolean) {
    setShowPenaltyModal(false)
    await submitBall({ extras_type: 'penalty', extras_runs: 5, runs_off_bat: 0, penalty_reason: reason, penalty_to_fielding: toFielding })
    if (toFielding && innings) {
      const fieldingSide = innings.batting_side === match.our_team_side ? oppSide : match.our_team_side
      const { data: opponentInnings } = await supabase
        .from('innings')
        .select('id, bonus_runs')
        .eq('match_id', match.id)
        .eq('batting_side', fieldingSide)
        .maybeSingle()
      if (opponentInnings) {
        await supabase
          .from('innings')
          .update({ bonus_runs: opponentInnings.bonus_runs + 5 })
          .eq('id', opponentInnings.id)
      }
      // If no opponent innings yet: the penalty_to_fielding=true ball is stored in ball_events.
      // InningsBreakFlow seeds bonus_runs from those balls when innings 2 is created.
    }
  }

  async function handleEndInnings() {
    if (submittingRef.current) return
    if (!innings) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (innings.innings_number >= 2) {
        const resultText = innings.target != null
          ? deriveResultText(
              innings.target - 1,
              state.totalRuns,
              state.wickets,
              innings.batting_side === match.our_team_side,
            )
          : null

        await supabase.from('innings').update({ status: 'completed' }).eq('id', innings.id)
        await supabase.from('matches').update({ status: 'completed', result_text: resultText }).eq('id', match.id)
        setMatchResultText(resultText)
        setPhase('match_complete')
      } else {
        // First innings: InningsBreakFlow handles DB update + innings 2 creation
        setPhase('innings_break')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function handleDeclare() {
    if (!innings) return
    await supabase.from('innings').update({ status: 'declared' }).eq('id', innings.id)
    setInnings(prev => prev ? { ...prev, status: 'declared' } : prev)
    setShowDeclareConfirm(false)
    if (innings.innings_number >= 2) {
      await supabase.from('matches').update({ status: 'completed' }).eq('id', match.id)
      setPhase('match_complete')
    } else {
      setPhase('innings_break')
    }
  }

  async function handleAbandon() {
    if (!innings) return
    await supabase.from('innings').update({ status: 'abandoned' }).eq('id', innings.id)
    await supabase.from('matches').update({ status: 'abandoned', result_text: abandonReason || 'Match abandoned' }).eq('id', match.id)
    setShowAbandonFlow(false)
    window.location.href = '/admin/matches'
  }

  const lastBall = balls.length > 0 ? balls[balls.length - 1] : null

  return (
    <>
    <style>{`
      .scorer-shell {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        display: flex; flex-direction: column; overflow: hidden;
        /* Responsive scale tokens — all scorer sizes derive from these */
        --sf-score:     clamp(26px, 4.5dvh, 44px);
        --sf-score-wkt: clamp(18px, 3.2dvh, 32px);
        --sf-stat:      clamp(13px, 2dvh,   18px);
        --sf-body:      clamp(12px, 1.85dvh, 16px);
        --sf-small:     clamp(10px, 1.5dvh,  13px);
        --sf-label:     clamp(9px,  1.3dvh,  12px);
        --sf-row-pad:   clamp(5px,  0.85dvh,  9px);
        --sf-strip-val: clamp(12px, 1.9dvh,  17px);
      }
      .scorer-info { flex-shrink: 0; max-width: 640px; margin: 0 auto; width: 100%; }
      .scorer-mid { flex-shrink: 0; overflow: hidden; }
      .scorer-secondary { flex-shrink: 0; padding: 8px 16px 0; max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
      .scorer-primary { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 16px 0; max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
      .scorer-actions-bar { flex-shrink: 0; padding: 6px 16px; padding-bottom: max(8px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
      .scorer-batter-grid {
        display: grid;
        grid-template-columns: 1fr 38px 34px 28px 28px;
        gap: 0 6px;
        padding: var(--sf-row-pad) 16px;
        border-bottom: 1px solid var(--border);
      }
      .scorer-batter-col { text-align: center; align-self: center; }
      .scorer-wicket-btn {
        width: 100%; padding: 0; border-radius: 10px;
        background: rgba(224,60,46,0.18); border: 1px solid var(--red);
        color: var(--red); font-family: var(--font-display); font-weight: 900;
        font-size: clamp(15px, 2.3dvh, 20px); cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        min-height: clamp(46px, 7dvh, 66px); touch-action: manipulation;
        box-shadow: 0 0 0 1px rgba(224,60,46,0.3), 0 4px 16px rgba(224,60,46,0.12);
        margin-bottom: clamp(6px, 1dvh, 12px);
      }
      .scorer-wicket-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
      .scorer-block-btn {
        width: 100%; justify-content: center; min-height: 64px;
        font-size: 17px; margin-bottom: 8px;
      }
      .scorer-saving-badge {
        text-align: center; padding: 4px 0 6px;
        font-size: 12px; color: var(--blue-mid); font-weight: 600; letter-spacing: 0.02em;
      }
      @media (max-width: 400px) {
        .scorer-batter-grid { grid-template-columns: 1fr 34px 30px 26px 26px; gap: 0 4px; padding: 5px 10px; }
      }
      @media (max-height: 680px) {
        .scorer-secondary { padding-top: 4px; }
        .scorer-primary   { padding-top: 6px; }
        .scorer-actions-bar { padding-bottom: max(4px, env(safe-area-inset-bottom)); }
        .scorer-wicket-btn { min-height: 44px !important; }
      }
    `}</style>
    <div className="scorer-shell">
      {/* Status banners */}
      {!online && (
        <div style={{ background: 'rgba(224,60,46,0.15)', borderBottom: '1px solid var(--red)', padding: '10px 20px', textAlign: 'center', fontSize: 13, color: 'var(--red)', fontWeight: 600, letterSpacing: '0.03em' }}>
          OFFLINE — balls are being saved locally
        </div>
      )}
      {online && queueCount > 0 && (
        <div style={{ background: 'rgba(255,200,0,0.1)', borderBottom: '1px solid var(--gold)', padding: '8px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gold)', fontWeight: 600 }}>
          Syncing {queueCount} ball{queueCount !== 1 ? 's' : ''}…
        </div>
      )}
      {authWarning && (
        <div style={{ background: 'rgba(255,200,0,0.1)', borderBottom: '1px solid var(--gold)', padding: '10px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gold)' }}>
          Session expired — please refresh and log in again
        </div>
      )}
      {freeHit && (
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,191,36,0.2))', borderBottom: '2px solid #f59e0b', padding: '6px 20px', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, color: '#fbbf24', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          ⚡ FREE HIT
        </div>
      )}


      <div className="scorer-info">
        {/* Compact score strip — replaces full header bar */}
        <div data-testid="score-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'var(--sf-row-pad) 16px' }}>
          <Link href="/admin/matches" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 'var(--sf-stat)', lineHeight: 1, flexShrink: 0, padding: '2px 4px 2px 0' }}>←</Link>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--sf-score)', fontWeight: 900, lineHeight: 1, flexShrink: 0 }}>
              <span style={{ color: 'var(--lime)' }}>{state.totalRuns}</span>
              <span style={{ color: 'var(--muted)', fontSize: 'var(--sf-score-wkt)' }}>/{state.wickets}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)', fontSize: 'var(--sf-body)' }}>{state.oversDisplay} ov</span>
            {state.legalBalls > 0 && (
              <span style={{ color: 'var(--dim)', fontSize: 'var(--sf-small)' }}>RR <strong style={{ color: 'var(--text)' }}>{((state.totalRuns / state.legalBalls) * 6).toFixed(2)}</strong></span>
            )}
            {(() => {
              const remaining = oversPerInnings * 6 - state.legalBalls
              if (remaining <= 0 || remaining > 6) return null
              return <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 'var(--sf-small)' }}>Last over</span>
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inn {innings.innings_number}</span>
            {innings.target ? (
              state.totalRuns >= innings.target ? (
                <div style={{ background: 'rgba(184,240,0,0.12)', border: '1px solid var(--lime)', borderRadius: 7, padding: '3px 7px', textAlign: 'center' }}>
                  {innings.is_dls && <div style={{ fontSize: 'var(--sf-label)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--sky)', marginBottom: 1 }}>DLS</div>}
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--lime)', fontSize: 'var(--sf-body)' }}>Target!</div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.35)', borderRadius: 7, padding: '3px 7px', textAlign: 'center' }}>
                  {innings.is_dls && <div style={{ fontSize: 'var(--sf-label)', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--sky)', marginBottom: 1 }}>DLS</div>}
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--gold)', fontSize: 'var(--sf-stat)', lineHeight: 1 }}>
                    {innings.target - state.totalRuns}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 'var(--sf-label)', marginTop: 1 }}>to win</div>
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Batters */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 0, borderLeft: 'none', borderRight: 'none', overflow: 'hidden' }}>
          <div className="scorer-batter-grid" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            {['Batter', 'R', 'B', '4s', '6s'].map((h, i) => (
              <span key={h} style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 0 ? 'center' : 'left' }}>{h}</span>
            ))}
          </div>
          {Array.from(new Set([effectiveStrikerId, effectiveNonStrikerId].filter(Boolean))).map(id => {
            const b = state.batterStats[id!]
            const isStriker = id === effectiveStrikerId
            const mp = matchPlayers.find(p => p.id === id)
            return (
              <div key={id} className="scorer-batter-grid" style={{
                background: isStriker ? 'rgba(59,130,246,0.06)' : 'transparent',
              }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--sf-body)', color: isStriker ? 'var(--lime)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  {isStriker && <span style={{ color: 'var(--lime)', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--sf-body)', flexShrink: 0 }}>*</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName(id!)}</span>
                  {mp?.is_captain && <span style={{ fontSize: 'var(--sf-label)', color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>(C)</span>}
                  {mp?.is_keeper && <span style={{ fontSize: 'var(--sf-small)', color: 'var(--muted)', flexShrink: 0 }}>†</span>}
                </span>
                <span className="scorer-batter-col" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--sf-stat)', color: isStriker ? 'var(--lime)' : 'var(--text)' }}>
                  {b?.runs ?? 0}
                </span>
                <span className="scorer-batter-col" style={{ color: 'var(--muted)', fontSize: 'var(--sf-body)' }}>{b?.balls ?? 0}</span>
                <span className="scorer-batter-col" style={{ color: 'var(--lime)', fontSize: 'var(--sf-body)', fontWeight: 700 }}>{b?.fours ?? 0}</span>
                <span className="scorer-batter-col" style={{ color: 'var(--gold)', fontSize: 'var(--sf-body)', fontWeight: 700 }}>{b?.sixes ?? 0}</span>
              </div>
            )
          })}
        </div>

        {/* Partnership & over info strip */}
        {state.currentPartnership && (
          <div style={{
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            padding: 'var(--sf-row-pad) 16px', borderTop: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Partnership</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--sf-strip-val)', fontWeight: 800, color: 'var(--text)' }}>
                {state.currentPartnership.runs}
                <span style={{ fontSize: 'var(--sf-small)', color: 'var(--muted)', fontWeight: 600 }}> ({state.currentPartnership.balls})</span>
              </div>
            </div>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>This over</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--sf-strip-val)', fontWeight: 800, color: 'var(--text)' }}>
                {state.currentOverBalls.reduce((s, b) => s + totalBallRuns(b), 0)}
              </div>
            </div>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Balls left</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--sf-strip-val)', fontWeight: 800, color: 'var(--text)' }}>
                {6 - (state.currentOverLegalBalls ?? 0)}
              </div>
            </div>
          </div>
        )}

        {/* Bowler + This over — two-line layout to prevent name clipping */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Line 1: bowler name + stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sf-row-pad) 16px calc(var(--sf-row-pad) / 2)', gap: 8 }}>
            {effectiveBowlerId ? (() => {
              const bs = state.bowlerStats[effectiveBowlerId]
              const bowlerMp = matchPlayers.find(p => p.id === effectiveBowlerId)
              return (
                <>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Bowling</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--sf-body)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName(effectiveBowlerId)}</span>
                      {bowlerMp?.is_captain && <span style={{ fontSize: 'var(--sf-label)', color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>(C)</span>}
                      {bowlerMp?.is_keeper && <span style={{ fontSize: 'var(--sf-small)', color: 'var(--muted)', flexShrink: 0 }}>†</span>}
                    </div>
                  </div>
                  {bs && (
                    <div style={{ textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--sf-body)', letterSpacing: '0.01em' }}>
                      <span style={{ color: 'var(--text)' }}>{bs.overs}</span>
                      <span style={{ color: 'var(--dim)' }}>–</span>
                      <span style={{ color: bs.maidens > 0 ? 'var(--sky)' : 'var(--muted)' }}>{bs.maidens}</span>
                      <span style={{ color: 'var(--dim)' }}>–</span>
                      <span style={{ color: 'var(--text)' }}>{bs.runs}</span>
                      <span style={{ color: 'var(--dim)' }}>–</span>
                      <span style={{ color: bs.wickets > 0 ? 'var(--lime)' : 'var(--text)' }}>{bs.wickets}</span>
                    </div>
                  )}
                </>
              )
            })() : (
              <div style={{ color: 'var(--dim)', fontSize: 'var(--sf-small)' }}>Awaiting bowler</div>
            )}
          </div>
          {/* Line 2: this over dots */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px var(--sf-row-pad)' }}>
            <div style={{ fontSize: 'var(--sf-label)', color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
              This over{state.currentOverBalls.length > 0 && <span style={{ color: 'rgba(147,197,253,0.25)', textTransform: 'none', letterSpacing: 0 }}>·tap</span>}
            </div>
            <OverDots balls={state.currentOverBalls} onBallTap={setCorrectingBall} compact />
          </div>
        </div>
      </div>

      {/* Mid zone: errors */}
      <div className="scorer-mid">
        {error && (
          <div style={{ margin: '0 16px 4px', background: 'rgba(224,60,46,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ flex: 1, lineHeight: 1.5 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0, opacity: 0.7 }} aria-label="Dismiss error">×</button>
          </div>
        )}
      </div>

      {/* Zone C — Secondary actions (extras + undo) */}
      <div className="scorer-secondary">
        {submitting && <div className="scorer-saving-badge">Saving…</div>}

        {!needsNewBatter && !needsNewBowler && !isNaturalEnd(state, oversPerInnings, innings.target) && (
          <>
            <div style={{ opacity: submitting ? 0.3 : 1, pointerEvents: submitting ? 'none' : 'auto', marginBottom: 8 }}>
              <ExtrasRow
                onExtra={(type, extrasRuns, batRuns) => submitBall({ extras_type: type, extras_runs: extrasRuns, runs_off_bat: batRuns })}
                onPenalty={() => setShowPenaltyModal(true)}
                disabled={submitting}
              />
            </div>
            <div style={{ marginBottom: 4 }}>
              <UndoButton lastBall={lastBall} playerName={playerName} onUndo={undoLastBall} disabled={submitting} />
            </div>
          </>
        )}
      </div>

      {/* Zone D — Primary actions (wicket + run buttons) */}
      <div className="scorer-primary">
        {needsNewBatter ? (
          <button className="btn btn-primary scorer-block-btn" onClick={() => setShowNewBatter(true)}>
            Wicket — Choose next batter →
          </button>
        ) : needsNewBowler ? (
          <button className="btn btn-primary scorer-block-btn" onClick={() => setShowChangeBowler(true)}>
            Over complete — Choose bowler →
          </button>
        ) : isNaturalEnd(state, oversPerInnings, innings.target) ? (
          <button className="btn btn-primary" onClick={handleEndInnings}
            style={{ fontSize: 17, width: '100%', justifyContent: 'center', minHeight: 64 }}>
            End Innings →
          </button>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', opacity: submitting ? 0.3 : 1, pointerEvents: submitting ? 'none' : 'auto' }}>
            {/* Wicket — full width, above run buttons, in the hot zone */}
            <button onClick={() => setShowWicketModal(true)} disabled={submitting} className="scorer-wicket-btn">
              <span style={{ fontSize: 22, fontWeight: 900 }}>W</span>
              {freeHit ? 'WICKET (RO only)' : 'WICKET'}
            </button>
            <RunButtons onRun={(runs, isFour, isSix) => submitBall({ runs_off_bat: runs, is_boundary_four: isFour, is_boundary_six: isSix })} fill />
          </div>
        )}
      </div>

      {/* Zone E — Match options button, always accessible */}
      {!needsNewBatter && !needsNewBowler && !isNaturalEnd(state, oversPerInnings, innings.target) && (
        <div className="scorer-actions-bar">
          <button
            onClick={() => setMatchOptionsSheet('menu')}
            style={{
              width: '100%', minHeight: 44, borderRadius: 9,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--muted)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, touchAction: 'manipulation',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚙</span>
            Match options
          </button>
        </div>
      )}

      {/* Match options bottom sheet */}
      {matchOptionsSheet !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)' }} onClick={() => setMatchOptionsSheet(null)} />
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: '20px 20px 0 0', padding: '0 20px',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
            maxHeight: '80dvh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
            </div>

            {matchOptionsSheet === 'menu' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Match Options</div>
                  <button onClick={() => setMatchOptionsSheet(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>×</button>
                </div>

                <button
                  onClick={() => { setEndEarlyReason(''); setEndEarlyOtherText(''); setMatchOptionsSheet('end_innings') }}
                  style={{ width: '100%', padding: '11px 12px', marginBottom: 10, borderRadius: 9, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.45)', color: '#fb923c', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                >
                  End innings early →
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => { setShowDeclareConfirm(true); setMatchOptionsSheet(null) }}
                    style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--blue-mid)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Declare
                  </button>
                  <button onClick={() => { setShowAbandonFlow(true); setMatchOptionsSheet(null) }}
                    style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(224,60,46,0.25)', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
                    Abandon
                  </button>
                  <button onClick={() => { setNewOversInput(String(oversPerInnings)); setShowEditFormat(true); setMatchOptionsSheet(null) }}
                    style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(56,189,248,0.3)', color: 'var(--sky)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Edit overs
                  </button>
                  <button onClick={() => { setShowCorrectBowler(true); setMatchOptionsSheet(null) }}
                    style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(56,189,248,0.3)', color: 'var(--sky)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Correct bowler
                  </button>
                  <button onClick={() => { setShowInjuryBowler(true); setMatchOptionsSheet(null) }}
                    style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(56,189,248,0.3)', color: 'var(--sky)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Bowler injured
                  </button>
                  {lastBall && (
                    <button onClick={() => { setCorrectingBall(lastBall); setMatchOptionsSheet(null) }}
                      style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(56,189,248,0.3)', color: 'var(--sky)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Edit last ball
                    </button>
                  )}
                  {innings?.innings_number === 2 && (
                    <button onClick={() => { setRevisedTeam2Overs(oversPerInnings); setShowReviseDlsDialog(true); setMatchOptionsSheet(null) }}
                      style={{ padding: '10px 8px', minHeight: 44, borderRadius: 8, background: 'transparent', border: '1px solid rgba(56,189,248,0.3)', color: 'var(--sky)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Revise target (DLS)
                    </button>
                  )}
                </div>
              </>
            )}

            {matchOptionsSheet === 'end_innings' && (
              <>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fb923c', marginBottom: 4, paddingTop: 4 }}>End innings early?</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                  {state.oversDisplay} ov · {state.wickets} wkts · {state.totalRuns} runs
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Reason</div>
                {(['Rain / bad light', 'Opposition conceded', 'Overs reduced (D/L)', 'Other'] as const).map(r => (
                  <button key={r} onClick={() => setEndEarlyReason(r)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', marginBottom: 5, borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: endEarlyReason === r ? 'rgba(251,146,60,0.15)' : 'var(--surface)', border: endEarlyReason === r ? '1px solid rgba(251,146,60,0.55)' : '1px solid var(--border)', color: endEarlyReason === r ? '#fb923c' : 'var(--text)' }}>
                    {r}
                  </button>
                ))}
                {endEarlyReason === 'Other' && (
                  <input
                    type="text"
                    placeholder="Describe reason…"
                    value={endEarlyOtherText}
                    onChange={e => setEndEarlyOtherText(e.target.value)}
                    autoFocus
                    style={{ width: '100%', padding: '8px 10px', marginTop: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setMatchOptionsSheet('menu')}
                    style={{ flex: 1, padding: '10px', minHeight: 44, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    ← Back
                  </button>
                  <button onClick={async () => { setMatchOptionsSheet(null); await handleEndInnings() }}
                    disabled={!endEarlyReason || (endEarlyReason === 'Other' && !endEarlyOtherText.trim())}
                    style={{ flex: 2, padding: '10px', minHeight: 44, borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: (!endEarlyReason || (endEarlyReason === 'Other' && !endEarlyOtherText.trim())) ? 'rgba(251,146,60,0.05)' : 'rgba(251,146,60,0.18)', border: '1px solid rgba(251,146,60,0.45)', color: '#fb923c', opacity: (!endEarlyReason || (endEarlyReason === 'Other' && !endEarlyOtherText.trim())) ? 0.5 : 1 }}>
                    Confirm End
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DLS revision dialog */}
      {showReviseDlsDialog && innings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ maxWidth: 360, width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Revise Target — Rain / DLS</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Team 1 scored <strong style={{ color: 'var(--text)' }}>{team1Score}</strong> from <strong style={{ color: 'var(--text)' }}>{team1OversAllocated}</strong> overs.
              Enter Team 2&apos;s revised overs allocation.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Team 2 overs</div>
              <input
                type="number"
                min={1}
                max={oversPerInnings}
                value={revisedTeam2Overs}
                onChange={e => setRevisedTeam2Overs(Math.max(1, Math.min(oversPerInnings, Number(e.target.value))))}
                style={{ width: 80, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, textAlign: 'center' }}
              />
            </div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              DLS target: <strong style={{ color: 'var(--gold)', fontSize: 20, fontFamily: 'var(--font-display)' }}>
                {dlsTarget(team1Score, team1OversAllocated, revisedTeam2Overs)}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowReviseDlsDialog(false)}
                style={{ flex: 1, padding: '10px', minHeight: 40, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={async () => {
                const newTarget = dlsTarget(team1Score, team1OversAllocated, revisedTeam2Overs)
                const { error: e } = await supabase.from('innings').update({ target: newTarget, is_dls: true }).eq('id', innings.id)
                if (e) { setError(e.message); return }
                setInnings(prev => prev ? { ...prev, target: newTarget, is_dls: true } : prev)
                setShowReviseDlsDialog(false)
              }}
                style={{ flex: 2, padding: '10px', minHeight: 40, borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.45)', color: 'var(--sky)' }}>
                Apply new target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Declare confirmation modal */}
      {showDeclareConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>Declare Innings?</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Current score: {state.totalRuns}/{state.wickets} ({state.oversDisplay} overs).<br />
              The opposition target will be {state.totalRuns + 1}.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeclareConfirm(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeclare}
                style={{ flex: 2, padding: '12px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#3b82f6', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Declare
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abandon match modal */}
      {showAbandonFlow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'var(--panel)', border: '1px solid rgba(224,60,46,0.4)', borderRadius: 16, padding: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--red)', marginBottom: 16 }}>Abandon Match?</h2>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Reason</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Rain', 'Bad Light', 'Other'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setAbandonReason(reason)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14, textAlign: 'left',
                      background: abandonReason === reason ? 'rgba(224,60,46,0.12)' : 'var(--surface)',
                      border: abandonReason === reason ? '1px solid var(--red)' : '1px solid var(--border)',
                      color: abandonReason === reason ? 'var(--red)' : 'var(--text)',
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowAbandonFlow(false); setAbandonReason('') }}
                style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleAbandon}
                disabled={!abandonReason}
                style={{ flex: 2, padding: '12px', borderRadius: 8, background: abandonReason ? 'rgba(224,60,46,0.15)' : 'transparent', border: '1px solid var(--red)', color: 'var(--red)', cursor: abandonReason ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, opacity: abandonReason ? 1 : 0.4 }}
              >
                Confirm Abandon
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditFormat && innings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ maxWidth: 380, width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>Edit match overs</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Currently set to <strong style={{ color: 'var(--text)' }}>{oversPerInnings} overs</strong>.
              {state.legalBalls > 0 && (
                <> {Math.ceil(state.legalBalls / 6)} over{Math.ceil(state.legalBalls / 6) !== 1 ? 's' : ''} already started — minimum is {Math.ceil(state.legalBalls / 6)}.</>
              )}
            </p>
            <input
              type="number"
              min={Math.max(1, Math.ceil(state.legalBalls / 6))}
              value={newOversInput}
              onChange={e => setNewOversInput(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 18, fontWeight: 700, boxSizing: 'border-box', textAlign: 'center' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowEditFormat(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={(() => {
                  const v = parseInt(newOversInput, 10)
                  return !Number.isInteger(v) || v < Math.max(1, Math.ceil(state.legalBalls / 6))
                })()}
                onClick={async () => {
                  const v = parseInt(newOversInput, 10)
                  const { error: rpcErr } = await supabase.rpc('update_match_overs', {
                    p_match_id: match.id,
                    p_new_overs: v,
                  })
                  if (rpcErr) { setError(rpcErr.message); return }
                  setOversPerInnings(v)
                  setShowEditFormat(false)
                }}
                style={{ flex: 2, padding: '12px', borderRadius: 8, background: 'rgba(56,189,248,0.15)', border: '1px solid var(--sky)', color: 'var(--sky)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Update overs
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrectBowler && innings && (
        <CorrectOverBowlerModal
          overs={[
            ...state.completedOvers,
            ...(state.currentOverBalls.length > 0 ? [state.currentOverBalls] : []),
          ]}
          fieldingPlayers={fieldingPlayers}
          playerName={playerName}
          onConfirm={correctOverBowler}
          onClose={() => setShowCorrectBowler(false)}
        />
      )}

      {showWicketModal && (
        <WicketModal
          strikerId={effectiveStrikerId ?? ''}
          nonStrikerId={effectiveNonStrikerId ?? effectiveStrikerId ?? ''}
          fieldingPlayers={fieldingPlayers}
          isFreeHit={freeHit}
          playerName={playerName}
          getBallsFaced={(id) => state.batterStats[id]?.balls ?? 0}
          onConfirm={async (args) => {
            await submitBall({
              dismissal_type: args.dismissalType,
              dismissed_player_id: args.dismissedPlayerId,
              fielder_id: args.fielderId,
              fielder_substitute_name: args.fielderSubstituteName,
              fielder2_id: args.fielder2Id,
              fielder2_substitute_name: args.fielder2SubstituteName,
            })
            setShowWicketModal(false)
          }}
          onClose={() => setShowWicketModal(false)}
        />
      )}

      {showNewBatter && (
        <PlayerSelectModal
          purpose="new_batter"
          players={matchPlayers.filter(p => p.side === innings.batting_side && !state.batterStats[p.id])}
          playerName={playerName}
          excludeIds={[state.currentStrikerId, state.currentNonStrikerId].filter(Boolean) as string[]}
          onSelect={(id) => { setPendingNewBatterId(id); setShowNewBatter(false) }}
          onClose={() => {
            // If a wicket was taken and no replacement chosen, the modal cannot
            // be dismissed — re-open it immediately so scoring stays unblocked.
            if (needsNewBatter) return
            setShowNewBatter(false)
          }}
        />
      )}

      {showChangeBowler && (
        <PlayerSelectModal
          purpose="change_bowler"
          players={fieldingPlayers}
          playerName={playerName}
          previousBowlerId={prevBowlerId}
          excludeIds={[]}
          onSelect={(id) => { setPendingNewBowlerId(id); setShowChangeBowler(false) }}
          onClose={() => setShowChangeBowler(false)}
        />
      )}

      {showInjuryBowler && innings && (
        <PlayerSelectModal
          purpose="change_bowler"
          players={fieldingPlayers}
          playerName={playerName}
          previousBowlerId={prevBowlerId}
          excludeIds={state.currentBowlerId ? [state.currentBowlerId] : []}
          onSelect={(id) => { setPendingNewBowlerId(id); setShowInjuryBowler(false) }}
          onClose={() => setShowInjuryBowler(false)}
        />
      )}

      {correctingBall && (
        <CorrectBallModal
          ball={correctingBall}
          playerName={playerName}
          onSave={correctBall}
          onClose={() => setCorrectingBall(null)}
        />
      )}

      {showPenaltyModal && innings && (
        <PenaltyModal
          battingTeamName={innings.batting_side === match.our_team_side ? 'BCC' : (match.opponentName ?? 'Opponents')}
          fieldingTeamName={innings.batting_side !== match.our_team_side ? 'BCC' : (match.opponentName ?? 'Opponents')}
          onConfirm={handlePenalty}
          onClose={() => setShowPenaltyModal(false)}
        />
      )}

      {pendingAnnotationBallId && match.scoring_mode === 'professional' && (
        <BallAnnotationPanel
          ballId={pendingAnnotationBallId}
          knownBowlingType={pendingAnnotationBowlerId ? (bowlerTypeMap[pendingAnnotationBowlerId] ?? null) : null}
          onAnnotated={(annotation: BallAnnotation) => {
            if (annotation.bowling_type && pendingAnnotationBowlerId) {
              setBowlerTypeMap(prev => ({ ...prev, [pendingAnnotationBowlerId]: annotation.bowling_type! }))
            }
            setPendingAnnotationBallId(null)
            setPendingAnnotationBowlerId(null)
          }}
          onSkip={() => {
            setPendingAnnotationBallId(null)
            setPendingAnnotationBowlerId(null)
          }}
        />
      )}

      {endInningsBallId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏏</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
              {innings.innings_number >= 2 ? 'Match Over?' : 'Innings Over?'}
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {innings.target != null && state.totalRuns >= innings.target
                ? `Target of ${innings.target} reached — ${state.totalRuns}/${state.wickets}`
                : state.wickets >= 10
                ? `All out for ${state.totalRuns}`
                : `Overs complete — ${state.totalRuns}/${state.wickets}`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '13px' }}
                onClick={async () => {
                  setEndInningsBallId(null)
                  await handleEndInnings()
                }}
              >
                {innings.innings_number >= 2 ? 'End Match' : 'End Innings'}
              </button>
              <button
                className="btn"
                style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}
                onClick={async () => {
                  const ballId = endInningsBallId
                  setEndInningsBallId(null)
                  await undoLastBall(ballId)
                }}
              >
                Undo Last Ball
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  )
}

