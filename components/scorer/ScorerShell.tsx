'use client'
import { useEffect, useRef, useState } from 'react'
import type { BallEvent, DismissalType, ExtrasType, InningsState, MatchPlayer } from '@/lib/cricket/types'
import { computeInningsState, isNaturalEnd, deriveResultText } from '@/lib/cricket/engine'
import { detectPhase as _detectPhase, type Phase } from '@/lib/cricket/phases'
import { validateBall } from '@/lib/cricket/validators'
import { generateCommentary } from '@/lib/cricket/commentary'
import { queueBall, flushQueue, getQueueCount } from '@/lib/offline/queue'
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

interface MatchData {
  id: string
  overs_per_innings: number
  free_hit_on_no_ball: boolean
  our_team_side: 'home' | 'away'
  opponentName?: string
  competitionName?: string
  matchDate?: string
}

interface InningsData {
  id: string
  innings_number: number
  batting_side: 'home' | 'away'
  status: string
  target: number | null
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
  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false)
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false)
  const [showAbandonFlow, setShowAbandonFlow]       = useState(false)
  const [showMatchOptions, setShowMatchOptions]     = useState(false)
  const [abandonReason, setAbandonReason]           = useState<string>('')
  const [endInningsBallId, setEndInningsBallId] = useState<string | null>(null)
  const [correctingBall, setCorrectingBall] = useState<BallEvent | null>(null)
  // Pending selections: hold chosen player until the next ball is submitted
  const [pendingNewBatterId, setPendingNewBatterId] = useState<string | null>(null)
  const [pendingNewBowlerId, setPendingNewBowlerId] = useState<string | null>(null)
  const [tossWonBy, setTossWonBy]     = useState<'home' | 'away' | null>(null)
  const [tossDecision, setTossDecision] = useState<'bat' | 'field' | null>(null)
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

  // Over boundary → prompt new bowler (must be before any early returns)
  const prevLegalBalls = useRef(state.legalBalls)
  useEffect(() => {
    if (state.legalBalls > 0 && state.legalBalls % 6 === 0 && state.legalBalls !== prevLegalBalls.current)
      setShowChangeBowler(true)
    prevLegalBalls.current = state.legalBalls
  }, [state.legalBalls])

  // Wicket → prompt new batter (must be before any early returns)
  // Don't prompt if the innings is already naturally over (saves no purpose and blocks UI)
  const prevWickets = useRef(state.wickets)
  useEffect(() => {
    const inningsOver = innings ? isNaturalEnd(state, match.overs_per_innings, innings.target) : false
    if (state.wickets > prevWickets.current && state.wickets < 10 && !inningsOver) setShowNewBatter(true)
    prevWickets.current = state.wickets
  }, [state.wickets])

  // ── PHASE: setup_bcc_xi ───────────────────────────────────────
  if (phase === 'setup_bcc_xi') {
    return (
      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh' }}>
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
      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh' }}>
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
      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh' }}>
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
      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh' }}>
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
                .upsert({ match_id: match.id, innings_number: 1, batting_side: battingSide, status: 'in_progress' }, { onConflict: 'match_id,innings_number' })
                .select().single()
              if (data) {
                setInnings({ id: data.id, innings_number: 1, batting_side: battingSide, status: 'in_progress', target: null })
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
        battingPlayers={matchPlayers.filter(p => p.side === bowlingSide)}
        bowlingPlayers={matchPlayers.filter(p => p.side === innings.batting_side)}
        playerName={playerName}
        onResumeScoring={(inn2Id, op1, op2, bowler, target) => {
          // Reset all innings-1 state that must not leak into innings 2
          prevLegalBalls.current = 0
          prevWickets.current = 0
          lastKnownSequenceRef.current = 0
          setPendingNewBatterId(null)
          setPendingNewBowlerId(null)
          setShowChangeBowler(false)
          setShowNewBatter(false)
          setShowWicketModal(false)
          setShowEndInningsConfirm(false)
          // Start innings 2
          setInnings({ id: inn2Id, innings_number: 2, batting_side: bowlingSide, status: 'in_progress', target })
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
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
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

  // Fall back to selected openers when no balls have been bowled yet.
  // After a wicket, the engine sets the dismissed slot to null (Bug A fix).
  // pendingNewBatterId fills that null slot once the scorer picks a replacement.
  // The pending batter goes to whichever position is null:
  //   - striker null + non-striker present  → new batter is striker
  //   - non-striker null + striker present  → new batter is non-striker
  const effectiveStrikerId = state.currentStrikerId ??
    (state.currentNonStrikerId !== null ? pendingNewBatterId : null) ?? opener1
  const effectiveNonStrikerId = state.currentNonStrikerId ??
    (state.currentStrikerId !== null ? pendingNewBatterId : null) ?? opener2

  // A new batter MUST be selected before the next ball can be scored.
  // This is true when a wicket was recorded (engine slot is null) but no
  // replacement has been chosen yet. We check balls.length > 0 to exclude
  // the pre-game state where both slots are null before any delivery.
  const needsNewBatter = balls.length > 0 && pendingNewBatterId === null &&
    (state.currentStrikerId === null || state.currentNonStrikerId === null)

  // A new bowler MUST be selected at the start of each over (after the first).
  // Derived purely from state so it self-clears after an undo that crosses an
  // over boundary, without needing any manual ref/state cleanup.
  const needsNewBowler =
    balls.length > 0 &&
    state.legalBalls > 0 &&
    state.legalBalls % 6 === 0 &&
    pendingNewBowlerId === null
  // pendingNewBowlerId overrides the previous bowler until the first ball of
  // the new over is submitted, after which state.currentBowlerId takes over.
  const effectiveBowlerId = pendingNewBowlerId ?? state.currentBowlerId ?? openingBowler

  if (!effectiveStrikerId || !effectiveBowlerId) {
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
    if (isNaturalEnd(state, match.overs_per_innings, innings.target)) {
      setError('Innings is already over — click "End Innings" to continue.')
      return
    }

    const validation = validateBall(partialBall, state, {
      overs_per_innings: match.overs_per_innings,
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
        commentary: null,
        created_at: new Date().toISOString(),
        ...partialBall,
      }

      // Generate commentary text from the state before this ball
      newBall.commentary = generateCommentary(newBall, state, playerName)

      // Compute state after this ball to detect a natural end caused by it
      const nextState = computeInningsState([...balls, newBall], playerNameMap)
      const endsInnings = isNaturalEnd(nextState, match.overs_per_innings, innings.target)

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
        // Restore the ball optimistically removed above
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

    // Capture original for rollback before any state mutation
    const original = balls.find(x => x.id === updated.id)!
    // Optimistic update
    setBalls(prev => prev.map(b => b.id === updated.id ? updated : b))
    setCorrectingBall(null)

    const { error } = await supabase.from('ball_events').update({
      runs_off_bat:      updated.runs_off_bat,
      extras_type:       updated.extras_type,
      extras_runs:       updated.extras_runs,
      is_boundary_four:  updated.is_boundary_four,
      is_boundary_six:   updated.is_boundary_six,
    }).eq('id', updated.id)

    if (error) {
      setError('Failed to save correction: ' + error.message)
      // Revert on failure using the original captured above
      setBalls(prev => prev.map(b => b.id === updated.id ? original : b))
    }
  }

  async function handleEndInnings() {
    if (!innings) return
    if (innings.innings_number >= 2) {
      // Compute result text from available data
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
      // First innings: InningsBreakFlow handles the DB update + innings 2 creation
      setPhase('innings_break')
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
        position: fixed; top: var(--nav-h); left: 0; right: 0; bottom: 0;
        display: flex; flex-direction: column; overflow: hidden;
      }
      .scorer-header { flex-shrink: 0; background: var(--panel); border-bottom: 1px solid var(--border); }
      .scorer-info { flex-shrink: 0; max-width: 640px; margin: 0 auto; width: 100%; }
      .scorer-mid { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
      .scorer-secondary { flex-shrink: 0; padding: 8px 16px 0; max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
      .scorer-primary { flex-shrink: 0; padding: 10px 16px 0; max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
      .scorer-danger-row { flex-shrink: 0; padding: 6px 16px 12px; max-width: 640px; margin: 0 auto; width: 100%; box-sizing: border-box; }
      .scorer-batter-grid {
        display: grid;
        grid-template-columns: 1fr 38px 34px 28px 28px;
        gap: 0 6px;
        padding: 8px 16px;
        border-bottom: 1px solid var(--border);
      }
      .scorer-batter-col { text-align: center; align-self: center; }
      .scorer-wicket-btn {
        width: 100%; padding: 0; border-radius: 10px;
        background: rgba(224,60,46,0.18); border: 1px solid var(--red);
        color: var(--red); font-family: var(--font-display); font-weight: 900;
        font-size: 17px; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        min-height: 60px; touch-action: manipulation;
        box-shadow: 0 0 0 1px rgba(224,60,46,0.3), 0 4px 16px rgba(224,60,46,0.12);
        margin-bottom: 10px;
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
      .scorer-match-options {
        overflow: hidden; max-height: 0; transition: max-height 0.2s ease;
      }
      .scorer-match-options.open { max-height: 200px; }
      @media (max-width: 400px) {
        .scorer-batter-grid { grid-template-columns: 1fr 34px 30px 26px 26px; gap: 0 4px; padding: 7px 10px; }
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


      {/* Score header — compact, info only */}
      <div className="scorer-header" style={{ padding: '8px 16px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Score + overs inline */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 10vw, 60px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', flexShrink: 0 }}>
              <span style={{ color: 'var(--lime)' }}>{state.totalRuns}</span>
              <span style={{ color: 'var(--muted)', fontSize: 'clamp(32px, 7vw, 44px)' }}>/{state.wickets}</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{state.oversDisplay} ov</span>
              {state.legalBalls > 0 && (
                <span style={{ color: 'var(--dim)' }}>RR <strong style={{ color: 'var(--text)' }}>{((state.totalRuns / state.legalBalls) * 6).toFixed(2)}</strong></span>
              )}
              {(() => {
                const remaining = match.overs_per_innings * 6 - state.legalBalls
                if (remaining <= 0 || remaining > 6) return null
                return <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>Last over</span>
              })()}
            </div>
          </div>
          {/* Right: nav + target */}
          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <div style={{ fontSize: 10, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/admin/matches" style={{ color: 'var(--dim)', textDecoration: 'none', fontSize: 12 }}>← Matches</Link>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inn {innings.innings_number}</span>
            </div>
            {innings.target ? (
              state.totalRuns >= innings.target ? (
                <div style={{ background: 'rgba(184,240,0,0.12)', border: '1px solid var(--lime)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--lime)', fontSize: 14 }}>Target!</div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.35)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--gold)', fontSize: 20, lineHeight: 1 }}>
                    {innings.target - state.totalRuns}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 1 }}>to win</div>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>

      <div className="scorer-info">
        {/* Batters */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 0, borderLeft: 'none', borderRight: 'none', overflow: 'hidden' }}>
          <div className="scorer-batter-grid" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            {['Batter', 'R', 'B', '4s', '6s'].map((h, i) => (
              <span key={h} style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 0 ? 'center' : 'left' }}>{h}</span>
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
                <span style={{ fontWeight: 700, color: isStriker ? 'var(--lime)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  {isStriker && <span style={{ color: 'var(--lime)', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>*</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName(id!)}</span>
                  {mp?.is_captain && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>(C)</span>}
                  {mp?.is_keeper && <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>†</span>}
                </span>
                <span className="scorer-batter-col" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: isStriker ? 'var(--lime)' : 'var(--text)' }}>
                  {b?.runs ?? 0}
                </span>
                <span className="scorer-batter-col" style={{ color: 'var(--muted)', fontSize: 14 }}>{b?.balls ?? 0}</span>
                <span className="scorer-batter-col" style={{ color: 'var(--lime)', fontSize: 13, fontWeight: 700 }}>{b?.fours ?? 0}</span>
                <span className="scorer-batter-col" style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 700 }}>{b?.sixes ?? 0}</span>
              </div>
            )
          })}
        </div>

        {/* Bowler + This over — inline row to save vertical space */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderTop: '1px solid var(--border)' }}>
          {effectiveBowlerId && (() => {
            const bs = state.bowlerStats[effectiveBowlerId]
            const bowlerMp = matchPlayers.find(p => p.id === effectiveBowlerId)
            return (
              <div style={{ flex: 1, padding: '5px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderRight: '1px solid var(--border)', minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Bowling</div>
                  <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName(effectiveBowlerId)}</span>
                    {bowlerMp?.is_captain && <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>(C)</span>}
                    {bowlerMp?.is_keeper && <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>†</span>}
                  </div>
                </div>
                {bs && (
                  <div style={{ textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.01em' }}>
                    <span style={{ color: 'var(--text)' }}>{bs.overs}</span>
                    <span style={{ color: 'var(--dim)' }}>–</span>
                    <span style={{ color: bs.maidens > 0 ? 'var(--sky)' : 'var(--muted)' }}>{bs.maidens}</span>
                    <span style={{ color: 'var(--dim)' }}>–</span>
                    <span style={{ color: 'var(--text)' }}>{bs.runs}</span>
                    <span style={{ color: 'var(--dim)' }}>–</span>
                    <span style={{ color: bs.wickets > 0 ? 'var(--lime)' : 'var(--text)' }}>{bs.wickets}</span>
                  </div>
                )}
              </div>
            )
          })()}
          {/* This over */}
          <div style={{ padding: '5px 12px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              This over{state.currentOverBalls.length > 0 && <span style={{ color: 'rgba(147,197,253,0.25)', marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>·tap</span>}
            </div>
            <OverDots balls={state.currentOverBalls} onBallTap={setCorrectingBall} />
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

        {!needsNewBatter && !needsNewBowler && !isNaturalEnd(state, match.overs_per_innings, innings.target) && (
          <>
            <div style={{ opacity: submitting ? 0.3 : 1, pointerEvents: submitting ? 'none' : 'auto', marginBottom: 8 }}>
              <ExtrasRow onExtra={(type, extrasRuns, batRuns) => submitBall({ extras_type: type, extras_runs: extrasRuns, runs_off_bat: batRuns })} />
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
        ) : isNaturalEnd(state, match.overs_per_innings, innings.target) ? (
          <button className="btn btn-primary" onClick={handleEndInnings}
            style={{ fontSize: 17, width: '100%', justifyContent: 'center', minHeight: 64 }}>
            End Innings →
          </button>
        ) : (
          <div style={{ opacity: submitting ? 0.3 : 1, pointerEvents: submitting ? 'none' : 'auto' }}>
            {/* Wicket — full width, above run buttons, in the hot zone */}
            <button onClick={() => setShowWicketModal(true)} disabled={submitting} className="scorer-wicket-btn">
              <span style={{ fontSize: 22, fontWeight: 900 }}>W</span>
              {freeHit ? 'WICKET (RO only)' : 'WICKET'}
            </button>
            <RunButtons onRun={(runs, isFour, isSix) => submitBall({ runs_off_bat: runs, is_boundary_four: isFour, is_boundary_six: isSix })} />
          </div>
        )}
      </div>

      {/* Zone E — Danger row (match options hidden behind toggle) */}
      {!needsNewBatter && !needsNewBowler && !isNaturalEnd(state, match.overs_per_innings, innings.target) && (
        <div className="scorer-danger-row">
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            {!showEndInningsConfirm ? (
              <>
                <button
                  onClick={() => setShowMatchOptions(v => !v)}
                  style={{ width: '100%', padding: '6px 8px', minHeight: 34, borderRadius: 7, background: 'transparent', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>⋯</span> Match options
                </button>
                <div className={`scorer-match-options${showMatchOptions ? ' open' : ''}`}>
                  <div style={{ display: 'flex', gap: 6, paddingTop: 6 }}>
                    <button onClick={() => { setShowEndInningsConfirm(true); setShowMatchOptions(false) }}
                      style={{ flex: 1, padding: '8px 6px', minHeight: 36, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      End early
                    </button>
                    <button onClick={() => { setShowDeclareConfirm(true); setShowMatchOptions(false) }}
                      style={{ flex: 1, padding: '8px 6px', minHeight: 36, borderRadius: 7, background: 'transparent', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--blue-mid)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      Declare
                    </button>
                    <button onClick={() => { setShowAbandonFlow(true); setShowMatchOptions(false) }}
                      style={{ flex: 1, padding: '8px 6px', minHeight: 36, borderRadius: 7, background: 'transparent', border: '1px solid transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, opacity: 0.55 }}>
                      Abandon
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background: 'rgba(255,200,0,0.08)', border: '1px solid rgba(255,200,0,0.35)', borderRadius: 7, padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gold)', marginBottom: 4 }}>End innings early?</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  {state.oversDisplay} ov · {state.wickets} wkts · {state.totalRuns} runs
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowEndInningsConfirm(false)}
                    style={{ flex: 1, padding: '10px', minHeight: 40, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button onClick={handleEndInnings}
                    style={{ flex: 2, padding: '10px', minHeight: 40, borderRadius: 7, background: 'rgba(255,200,0,0.15)', border: '1px solid var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    Confirm End
                  </button>
                </div>
              </div>
            )}
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

      {showWicketModal && (
        <WicketModal
          strikerId={effectiveStrikerId}
          nonStrikerId={effectiveNonStrikerId ?? effectiveStrikerId}
          fieldingPlayers={fieldingPlayers}
          isFreeHit={freeHit}
          playerName={playerName}
          onConfirm={async (args) => {
            await submitBall({
              dismissal_type: args.dismissalType,
              dismissed_player_id: args.dismissedPlayerId,
              fielder_id: args.fielderId,
              fielder_substitute_name: args.fielderSubstituteName,
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

      {correctingBall && (
        <CorrectBallModal
          ball={correctingBall}
          playerName={playerName}
          onSave={correctBall}
          onClose={() => setCorrectingBall(null)}
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

// ── Setup BCC XI ──────────────────────────────────────────────────
function SetupBccXi({ matchId, ourSide, availablePlayers, onComplete }: {
  matchId: string
  ourSide: 'home' | 'away'
  availablePlayers: AvailablePlayer[]
  onComplete: (inserted: MatchPlayer[]) => void
}) {
  const isPrePopulated = availablePlayers.some(p => p._preselected)

  // Pre-check all players tagged from the coach's selection, sorted by position
  const initialSelected = new Set(
    availablePlayers
      .filter(p => p._preselected)
      .sort((a, b) => (a._position ?? 99) - (b._position ?? 99))
      .map(p => p.id)
  )

  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Set<string>>(initialSelected)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const filtered = availablePlayers.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleConfirm() {
    if (selected.size < 11) { setError(`Select at least 11 players (${selected.size} selected).`); return }
    setSaving(true); setError(null)

    // Preserve position order: pre-selected players keep their batting position;
    // manually added replacements are appended at the end.
    const orderedIds = [
      ...availablePlayers
        .filter(p => p._preselected && selected.has(p.id))
        .sort((a, b) => (a._position ?? 99) - (b._position ?? 99))
        .map(p => p.id),
      ...Array.from(selected).filter(id => !availablePlayers.find(p => p.id === id && p._preselected)),
    ]

    const rows = orderedIds.map((playerId, i) => ({
      match_id: matchId,
      player_id: playerId,
      side: ourSide,
      batting_position: i + 1,
    }))

    // Delete any existing BCC-side rows for this match that haven't been scored yet
    // (safe: ball_events reference match_players.id; if scoring has started those rows
    // won't be here anyway). This avoids the partial-index upsert limitation.
    const { error: delError } = await supabase
      .from('match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('side', ourSide)
      .not('player_id', 'is', null)

    if (delError) { setSaving(false); setError(delError.message); return }

    const { data, error } = await supabase
      .from('match_players')
      .insert(rows)
      .select()
    setSaving(false)
    if (error) { setError(error.message); return }
    onComplete(data as MatchPlayer[])
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', maxWidth: 560, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: isPrePopulated ? 8 : 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
          BCC XI
        </h2>
        {selected.size > 0 && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--lime)' }}>{selected.size}/11</span>
        )}
      </div>

      {isPrePopulated && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Pre-selected from coach&apos;s XI. Uncheck a player to replace them.
        </p>
      )}

      <input
        className="input"
        style={{ marginBottom: 12 }}
        placeholder="Search players..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />

      <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>No players found.</div>
        ) : (
          filtered.map(p => {
            const isSelected = selected.has(p.id)
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', minHeight: 52, cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent', touchAction: 'manipulation' }}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(p.id)} style={{ accentColor: 'var(--lime)', width: 20, height: 20, flexShrink: 0 }} />
                <span style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--text)' : 'var(--muted)', fontSize: 15 }}>
                  {p.first_name} {p.last_name}
                </span>
                {isSelected && <span style={{ marginLeft: 'auto', color: 'var(--lime)', fontSize: 16, flexShrink: 0 }}>✓</span>}
              </label>
            )
          })
        )}
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button className="btn btn-primary" disabled={saving || selected.size < 11}
        style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
        onClick={handleConfirm}>
        {saving ? 'Saving...' : `Confirm Squad (${selected.size}/11) →`}
      </button>
    </div>
  )
}

// ── Setup Opposition XI ───────────────────────────────────────────
function SetupOppXi({ matchId, oppSide, onComplete }: {
  matchId: string
  oppSide: 'home' | 'away'
  onComplete: (inserted: MatchPlayer[]) => void
}) {
  const [names, setNames] = useState<string[]>(['', '', '', '', '', '', '', '', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const filled = names.filter(n => n.trim())

  function updateName(i: number, val: string) {
    setNames(prev => prev.map((n, idx) => idx === i ? val : n))
  }

  function addRow() { setNames(prev => [...prev, '']) }
  function removeRow(i: number) { setNames(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleConfirm() {
    if (filled.length < 11) { setError(`Enter at least 11 player names (${filled.length} entered).`); return }
    setSaving(true); setError(null)
    const rows = filled.map((name, i) => ({
      match_id: matchId,
      opposition_name: name.trim(),
      side: oppSide,
      batting_position: i + 1,
    }))
    const { data, error } = await supabase.from('match_players').insert(rows).select()
    setSaving(false)
    if (error) { setError(error.message); return }
    onComplete(data as MatchPlayer[])
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', maxWidth: 480, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
          Opposition XI
        </h2>
        {filled.length > 0 && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--lime)' }}>{filled.length}/11</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {names.map((name, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--dim)', fontSize: 13, width: 22, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
            <input
              className="input"
              style={{ flex: 1, padding: '11px 12px' }}
              placeholder={`Player ${i + 1}`}
              value={name}
              onChange={e => updateName(i, e.target.value)}
            />
            {names.length > 1 && (
              /* 44×44 touch target for the remove button */
              <button
                onClick={() => removeRow(i)}
                style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 8 }}
                aria-label={`Remove player ${i + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={addRow} style={{ fontSize: 13, marginBottom: 20 }}>+ Add player</button>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button className="btn btn-primary" disabled={saving || filled.length < 11}
        style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
        onClick={handleConfirm}>
        {saving ? 'Saving...' : `Confirm (${filled.length}/11) →`}
      </button>
    </div>
  )
}

// ── Searchable select (opener/bowler picker) ──────────────────────
function SearchSelect({ players, playerName, exclude, selected, onSelect }: {
  players: MatchPlayer[]
  playerName: (id: string) => string
  exclude: string[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  const filtered = players.filter(p =>
    !exclude.includes(p.id) &&
    playerName(p.id).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{
          padding: '12px 14px', minHeight: 48, background: 'var(--surface)', border: `1px solid ${open ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer', fontSize: 15, color: selected ? 'var(--text)' : 'var(--dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? playerName(selected) : 'Select player...'}
        </span>
        <span style={{ color: 'var(--dim)', fontSize: 12, marginLeft: 8, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--panel)', border: '1px solid var(--border-bright)', borderRadius: 8, zIndex: 100, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 }}>
          <div style={{ position: 'sticky', top: 0, background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
            <input
              autoFocus
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, outline: 'none' }}
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); setSearch('') }}
              style={{ padding: '13px 16px', minHeight: 48, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', color: selected === p.id ? 'var(--lime)' : 'var(--text)', background: selected === p.id ? 'rgba(59,130,246,0.08)' : 'transparent', borderBottom: '1px solid var(--border)' }}
            >
              {selected === p.id && <span style={{ marginRight: 8, fontSize: 13 }}>✓</span>}
              {playerName(p.id)}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: '14px 16px', color: 'var(--dim)', fontSize: 14 }}>No players found.</div>}
        </div>
      )}
    </div>
  )
}
