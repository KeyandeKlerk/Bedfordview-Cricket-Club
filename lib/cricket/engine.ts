import type {
  BallEvent,
  BatterStats,
  BowlerStats,
  InningsState,
  Partnership,
  DismissalType,
  MatchResult,
} from './types'

// ── PRIMITIVE HELPERS ─────────────────────────────────────────────────────────

export function isWideOrNoBall(ball: BallEvent): boolean {
  return ball.extras_type === 'wide' || ball.extras_type === 'no_ball'
}

export function isLegalDelivery(ball: BallEvent): boolean {
  return !isWideOrNoBall(ball)
}

/** Total runs added to the innings score on this ball */
export function totalBallRuns(ball: BallEvent): number {
  return ball.runs_off_bat + ball.extras_runs
}

/**
 * Runs charged to the bowler.
 * Byes and leg-byes are NOT charged to the bowler.
 * Penalty runs are NOT charged to the bowler.
 * Wides and no-ball extras ARE charged to the bowler.
 */
export function bowlerRuns(ball: BallEvent): number {
  if (ball.extras_type === 'bye' || ball.extras_type === 'leg_bye' || ball.extras_type === 'penalty') {
    return ball.runs_off_bat  // typically 0 for bye/leg-bye
  }
  return ball.runs_off_bat + ball.extras_runs
}

/**
 * Returns true when the innings has reached a natural conclusion:
 *   - 10 wickets have fallen, OR
 *   - all allocated overs have been bowled (legalBalls >= oversPerInnings * 6)
 *
 * A false result does NOT prevent the scorer from manually ending the innings
 * (declare / weather / forfeit). It only signals that a confirmation prompt
 * should be shown before ending early.
 */
export function isNaturalEnd(state: InningsState, oversPerInnings: number, target?: number | null): boolean {
  if (target != null && state.totalRuns >= target) return true
  return state.wickets >= 10 || state.legalBalls >= oversPerInnings * 6
}

/**
 * Derives the match result from two completed innings states.
 *
 * target = inn1.totalRuns + 1 (team2 must EXCEED inn1 to win)
 *
 * - If inn2 has not yet reached a natural end → in_progress
 * - inn2.totalRuns >= target → team2 wins by (10 - inn2.wickets) wickets
 * - inn2.totalRuns === inn1.totalRuns → tie
 * - inn2.totalRuns < inn1.totalRuns → team1 wins by (inn1 - inn2) runs
 */
export function computeMatchResult(
  inn1: InningsState,
  inn2: InningsState,
  oversPerInnings: number
): MatchResult {
  const target = inn1.totalRuns + 1

  if (!isNaturalEnd(inn2, oversPerInnings, target)) {
    return { status: 'in_progress', winner: null, marginRuns: null, marginWickets: null }
  }

  if (inn2.totalRuns >= target) {
    return { status: 'complete', winner: 'team2', marginRuns: null, marginWickets: 10 - inn2.wickets }
  }

  if (inn2.totalRuns === inn1.totalRuns) {
    return { status: 'complete', winner: 'tie', marginRuns: null, marginWickets: null }
  }

  return { status: 'complete', winner: 'team1', marginRuns: inn1.totalRuns - inn2.totalRuns, marginWickets: null }
}

export function oversDisplay(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

/**
 * Produces a human-readable match result string from BCC's perspective.
 * e.g. "BCC won by 20 runs" / "BCC lost by 6 wickets" / "Match tied"
 *
 * @param inn1Runs      - first innings total runs
 * @param inn2Runs      - second innings total runs
 * @param inn2Wickets   - wickets fallen in second innings
 * @param bccBattedSecond - true if BCC was the chasing side
 */
export function deriveResultText(
  inn1Runs: number,
  inn2Runs: number,
  inn2Wickets: number,
  bccBattedSecond: boolean,
): string {
  const target = inn1Runs + 1
  if (inn2Runs >= target) {
    const w = 10 - inn2Wickets
    return bccBattedSecond
      ? `BCC won by ${w} wicket${w !== 1 ? 's' : ''}`
      : `BCC lost by ${w} wicket${w !== 1 ? 's' : ''}`
  }
  if (inn2Runs === inn1Runs) return 'Match tied'
  const r = inn1Runs - inn2Runs
  return bccBattedSecond
    ? `BCC lost by ${r} run${r !== 1 ? 's' : ''}`
    : `BCC won by ${r} run${r !== 1 ? 's' : ''}`
}

// ── STRIKE ROTATION ───────────────────────────────────────────────────────────

/**
 * After a ball is bowled, determine who should be striker for the NEXT ball.
 *
 * Rules:
 * - If odd total runs: batters cross (swap)
 * - At end of over (legalBallsAfterThisBall % 6 === 0): swap regardless
 * - These are applied sequentially, so end-of-over + odd runs = double swap = net cancel
 *
 * @param ball - the ball just bowled
 * @param legalBallsAfterThisBall - total legal deliveries INCLUDING this one
 * @param currentBatterId - striker on this ball (match_players.id)
 * @param nonStrikerId - non-striker on this ball (match_players.id)
 */
export function computeStrikeAfterBall(
  ball: BallEvent,
  legalBallsAfterThisBall: number,
  currentBatterId: string,
  nonStrikerId: string
): { striker: string; nonStriker: string } {
  const isEndOfOver = legalBallsAfterThisBall > 0 && legalBallsAfterThisBall % 6 === 0
  const runsCompleted = totalBallRuns(ball)
  const crossForRuns = runsCompleted % 2 === 1

  // Apply crossing-for-runs first, then end-of-over swap
  let striker    = currentBatterId
  let nonStriker = nonStrikerId

  if (crossForRuns) {
    ;[striker, nonStriker] = [nonStriker, striker]
  }
  if (isEndOfOver) {
    ;[striker, nonStriker] = [nonStriker, striker]
  }

  return { striker, nonStriker }
}

// ── FULL INNINGS STATE ────────────────────────────────────────────────────────

const BOWLER_WICKET_TYPES: DismissalType[] = [
  'bowled', 'caught', 'lbw', 'stumped', 'hit_wicket',
]

function makeBatterStats(matchPlayerId: string, name: string): BatterStats {
  return {
    matchPlayerId,
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isStriker: false,
    isOut: false,
    dismissalType: null,
    dismissalText: null,
    battingPosition: null,
  }
}

function makeBowlerStats(matchPlayerId: string, name: string): BowlerStats {
  return {
    matchPlayerId,
    name,
    overs: '0.0',
    legalBalls: 0,
    runs: 0,
    wickets: 0,
    economy: 0,
    wides: 0,
    noBalls: 0,
    maidens: 0,
  }
}

/**
 * Pure function — recomputes full innings state from the event log.
 *
 * @param balls       - all ball_events for this innings, ordered by sequence_number
 * @param playerNames - map from match_players.id → display name
 */
export function computeInningsState(
  balls: BallEvent[],
  playerNames: Map<string, string>
): InningsState {
  const name = (id: string) => playerNames.get(id) ?? id

  const empty: InningsState = {
    inningsId: null,
    inningsNumber: 1,
    battingSide: 'home',
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
    oversDisplay: '0.0',
    extras: { wide: 0, no_ball: 0, bye: 0, leg_bye: 0, penalty: 0, total: 0 },
    batterStats: {},
    bowlerStats: {},
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    currentOverBalls: [],
    completedOvers: [],
    fallOfWickets: [],
    currentPartnership: null,
    nextBallIsFreeHit: false,
  }

  if (balls.length === 0) return empty

  const state: InningsState = {
    ...empty,
    inningsId: balls[0].innings_id,
    extras: { wide: 0, no_ball: 0, bye: 0, leg_bye: 0, penalty: 0, total: 0 },
    batterStats: {},
    bowlerStats: {},
    completedOvers: [],
    fallOfWickets: [],
  }

  // Group balls by over_number for maiden + currentOverBalls calculations
  const ballsByOver = new Map<number, BallEvent[]>()
  let lastWicketBallIndex = -1

  // ── Main processing loop ──────────────────────────────────────
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i]
    const legal = isLegalDelivery(ball)

    // Totals
    state.totalRuns += totalBallRuns(ball)
    if (legal) state.legalBalls++

    // Extras
    if (ball.extras_type) {
      const key = ball.extras_type as keyof typeof state.extras
      if (key !== 'total') {
        state.extras[key] += ball.extras_runs
        state.extras.total += ball.extras_runs
      }
    }

    // ── Batter stats ────────────────────────────────────────────
    const batterId = ball.batter_id
    if (!state.batterStats[batterId]) {
      state.batterStats[batterId] = makeBatterStats(batterId, name(batterId))
    }
    // Wides: batter doesn't face the ball
    if (ball.extras_type !== 'wide') {
      state.batterStats[batterId].balls++
    }
    // Bat runs (not for byes/leg-byes where runs_off_bat should be 0)
    state.batterStats[batterId].runs += ball.runs_off_bat
    if (ball.is_boundary_four) state.batterStats[batterId].fours++
    if (ball.is_boundary_six)  state.batterStats[batterId].sixes++

    // Ensure non-striker appears in batterStats too
    const nonStrikerId = ball.non_striker_id
    if (!state.batterStats[nonStrikerId]) {
      state.batterStats[nonStrikerId] = makeBatterStats(nonStrikerId, name(nonStrikerId))
    }

    // ── Bowler stats ────────────────────────────────────────────
    const bowlerId = ball.bowler_id
    if (!state.bowlerStats[bowlerId]) {
      state.bowlerStats[bowlerId] = makeBowlerStats(bowlerId, name(bowlerId))
    }
    if (legal) state.bowlerStats[bowlerId].legalBalls++
    state.bowlerStats[bowlerId].runs += bowlerRuns(ball)
    if (ball.extras_type === 'wide')    state.bowlerStats[bowlerId].wides++
    if (ball.extras_type === 'no_ball') state.bowlerStats[bowlerId].noBalls++

    // ── Over grouping ──────────────────────────────────────────
    if (!ballsByOver.has(ball.over_number)) ballsByOver.set(ball.over_number, [])
    ballsByOver.get(ball.over_number)!.push(ball)

    // ── Dismissal ──────────────────────────────────────────────
    if (ball.dismissal_type && ball.dismissed_player_id) {
      const dismissedId = ball.dismissed_player_id
      if (!state.batterStats[dismissedId]) {
        state.batterStats[dismissedId] = makeBatterStats(dismissedId, name(dismissedId))
      }
      state.batterStats[dismissedId].isOut          = true
      state.batterStats[dismissedId].dismissalType  = ball.dismissal_type
      state.batterStats[dismissedId].dismissalText  = ball.commentary

      state.wickets++
      if (BOWLER_WICKET_TYPES.includes(ball.dismissal_type as DismissalType)) {
        state.bowlerStats[bowlerId].wickets++
      }

      state.fallOfWickets.push({
        wicketNumber: state.wickets,
        runs: state.totalRuns,
        matchPlayerId: dismissedId,
        over: oversDisplay(state.legalBalls),
      })

      lastWicketBallIndex = i
    }
  }

  // ── Completed overs + currentOverBalls ────────────────────────
  const sortedOverNums = [...ballsByOver.keys()].sort((a, b) => a - b)

  for (const overNum of sortedOverNums) {
    const overBalls = ballsByOver.get(overNum)!
    const legalInOver = overBalls.filter(b => isLegalDelivery(b)).length
    if (legalInOver >= 6) {
      state.completedOvers.push(overBalls)
    }
  }

  // currentOverBalls = balls of the highest over_number present.
  // At an over boundary (last over complete, no balls of new over yet) this
  // naturally shows the completed over rather than an empty array (test 9).
  const lastOverNum = sortedOverNums[sortedOverNums.length - 1]
  state.currentOverBalls = ballsByOver.get(lastOverNum) ?? []

  // ── Maidens (spec: bye breaks a maiden) ──────────────────────
  for (const [, overBalls] of ballsByOver) {
    if (overBalls.length === 0) continue
    const legalInOver = overBalls.filter(b => isLegalDelivery(b)).length
    if (legalInOver < 6) continue  // incomplete over cannot be a maiden

    const bowlerIdForOver = overBalls[0].bowler_id
    // In the (unusual) case the over was bowled by multiple bowlers, skip
    const allSameBowler = overBalls.every(b => b.bowler_id === bowlerIdForOver)
    if (!allSameBowler) continue

    const totalRunsInOver = overBalls.reduce((s, b) => s + totalBallRuns(b), 0)
    if (totalRunsInOver === 0 && state.bowlerStats[bowlerIdForOver]) {
      state.bowlerStats[bowlerIdForOver].maidens++
    }
  }

  // ── Finalize bowler overs + economy ──────────────────────────
  for (const bs of Object.values(state.bowlerStats)) {
    bs.overs = oversDisplay(bs.legalBalls)
    bs.economy = bs.legalBalls > 0
      ? parseFloat(((bs.runs / bs.legalBalls) * 6).toFixed(2))
      : 0
  }

  // ── Finalize batter strike rates ──────────────────────────────
  for (const batt of Object.values(state.batterStats)) {
    batt.strikeRate = batt.balls > 0
      ? parseFloat(((batt.runs / batt.balls) * 100).toFixed(2))
      : 0
  }

  // ── Current on-field positions ────────────────────────────────
  const lastBall = balls[balls.length - 1]
  const { striker, nonStriker } = computeStrikeAfterBall(
    lastBall,
    state.legalBalls,
    lastBall.batter_id,
    lastBall.non_striker_id
  )
  state.currentStrikerId    = striker
  state.currentNonStrikerId = nonStriker
  state.currentBowlerId     = lastBall.bowler_id
  state.nextBallIsFreeHit   = lastBall.extras_type === 'no_ball'
  state.oversDisplay        = oversDisplay(state.legalBalls)

  // ── Clear dismissed player from on-field slots ────────────────
  // computeStrikeAfterBall has no dismissal awareness, so the dismissed
  // player's id can end up in currentStrikerId/currentNonStrikerId.
  // Null out whichever slot they occupy so the UI knows a new batter is needed.
  if (lastBall.dismissed_player_id) {
    if (state.currentStrikerId    === lastBall.dismissed_player_id) state.currentStrikerId    = null
    if (state.currentNonStrikerId === lastBall.dismissed_player_id) state.currentNonStrikerId = null
  }

  // Mark isStriker on batterStats (only for players still on the field)
  if (state.currentStrikerId    && state.batterStats[state.currentStrikerId])    state.batterStats[state.currentStrikerId].isStriker    = true
  if (state.currentNonStrikerId && state.batterStats[state.currentNonStrikerId]) state.batterStats[state.currentNonStrikerId].isStriker = false

  // ── Current partnership ───────────────────────────────────────
  if (state.wickets < 10 && state.currentStrikerId && state.currentNonStrikerId) {
    const partnershipBalls = lastWicketBallIndex >= 0
      ? balls.slice(lastWicketBallIndex + 1)
      : balls
    const partnershipRuns  = partnershipBalls.reduce((s, b) => s + totalBallRuns(b), 0)
    const partnershipBallCount = partnershipBalls.filter(b => isLegalDelivery(b)).length

    state.currentPartnership = {
      batter1Id: state.currentStrikerId!,
      batter2Id: state.currentNonStrikerId!,
      runs:  partnershipRuns,
      balls: partnershipBallCount,
    }
  }

  return state
}
