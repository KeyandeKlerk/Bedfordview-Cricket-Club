import { describe, it, expect } from 'vitest'
import {
  totalBallRuns,
  bowlerRuns,
  isWideOrNoBall,
  computeStrikeAfterBall,
  computeInningsState,
} from '../engine'
import type { BallEvent } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

let seq = 0
function makeBall(overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `ball-${++seq}`,
    innings_id: 'inn-1',
    match_id: 'match-1',
    sequence_number: seq,
    over_number: 0,
    ball_in_over: 0,
    batter_id: 'mp-1',
    non_striker_id: 'mp-2',
    bowler_id: 'mp-3',
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
    ...overrides,
  }
}

/** Build N dot balls in a single over (legal, run-free) */
function dotBalls(n: number, overNumber = 0, bowlerId = 'mp-3'): BallEvent[] {
  return Array.from({ length: n }, (_, i) =>
    makeBall({ over_number: overNumber, ball_in_over: i, bowler_id: bowlerId })
  )
}

const NAMES = new Map([
  ['mp-1', 'Striker'],
  ['mp-2', 'Non-Striker'],
  ['mp-3', 'Bowler'],
])

// ── Test 1: No-ball with bat runs ──────────────────────────────────────────────

describe('Test 1 — no-ball with bat runs', () => {
  it('total=5, batter=4, bowler=5, legal ball count unchanged', () => {
    const ball = makeBall({ extras_type: 'no_ball', runs_off_bat: 4, extras_runs: 1 })
    expect(totalBallRuns(ball)).toBe(5)
    expect(bowlerRuns(ball)).toBe(5)

    const state = computeInningsState([ball], NAMES)
    expect(state.totalRuns).toBe(5)
    expect(state.batterStats['mp-1'].runs).toBe(4)
    expect(state.bowlerStats['mp-3'].runs).toBe(5)
    expect(state.legalBalls).toBe(0)
  })
})

// ── Test 2: Wide with runs ─────────────────────────────────────────────────────

describe('Test 2 — wide with runs', () => {
  it('total=4, batter=0, bowler=4, legal ball count unchanged', () => {
    const ball = makeBall({ extras_type: 'wide', runs_off_bat: 0, extras_runs: 4 })
    expect(totalBallRuns(ball)).toBe(4)
    expect(bowlerRuns(ball)).toBe(4)

    const state = computeInningsState([ball], NAMES)
    expect(state.totalRuns).toBe(4)
    expect(state.batterStats['mp-1'].runs).toBe(0)
    expect(state.bowlerStats['mp-3'].runs).toBe(4)
    expect(state.legalBalls).toBe(0)
  })
})

// ── Test 3: Bye ────────────────────────────────────────────────────────────────

describe('Test 3 — bye', () => {
  it('total=1, batter=0, bowler=0, counts as legal delivery', () => {
    const ball = makeBall({ extras_type: 'bye', runs_off_bat: 0, extras_runs: 1 })
    expect(totalBallRuns(ball)).toBe(1)
    expect(bowlerRuns(ball)).toBe(0)

    const state = computeInningsState([ball], NAMES)
    expect(state.totalRuns).toBe(1)
    expect(state.batterStats['mp-1'].runs).toBe(0)
    expect(state.bowlerStats['mp-3'].runs).toBe(0)
    expect(state.legalBalls).toBe(1)
  })
})

// ── Test 4: Penalty runs ───────────────────────────────────────────────────────

describe('Test 4 — penalty runs (batting side receives)', () => {
  it('total+=5, extras.penalty+=5, batter=0, bowler=0', () => {
    const ball = makeBall({ extras_type: 'penalty', runs_off_bat: 0, extras_runs: 5, penalty_to_fielding: false })
    expect(totalBallRuns(ball)).toBe(5)
    expect(bowlerRuns(ball)).toBe(0)

    const state = computeInningsState([ball], NAMES)
    expect(state.totalRuns).toBe(5)
    expect(state.extras.penalty).toBe(5)
    expect(state.extras.total).toBe(5)
    expect(state.batterStats['mp-1'].runs).toBe(0)
    expect(state.bowlerStats['mp-3'].runs).toBe(0)
  })
})

// ── Test 4b: Fielding-side penalty (opponent receives runs) ────────────────────

describe('Test 4b — penalty runs (fielding side receives)', () => {
  it('totalRuns unchanged, extras excluded, batter=0, bowler=0', () => {
    const ball = makeBall({ extras_type: 'penalty', runs_off_bat: 0, extras_runs: 5, penalty_to_fielding: true })
    // totalBallRuns still returns 5 (raw ball total), but engine excludes it from batting innings
    expect(totalBallRuns(ball)).toBe(5)
    expect(bowlerRuns(ball)).toBe(0)

    const state = computeInningsState([ball], NAMES)
    expect(state.totalRuns).toBe(0)         // NOT credited to batting innings
    expect(state.extras.penalty).toBe(0)    // NOT in extras
    expect(state.extras.total).toBe(0)
    expect(state.batterStats['mp-1'].runs).toBe(0)
    expect(state.bowlerStats['mp-3'].runs).toBe(0)
  })

  it('mix: one batting-side penalty + one fielding-side penalty: only batting one counts', () => {
    const battingPenalty = makeBall({ extras_type: 'penalty', extras_runs: 5, penalty_to_fielding: false, over_number: 0, ball_in_over: 0 })
    const fieldingPenalty = makeBall({ extras_type: 'penalty', extras_runs: 5, penalty_to_fielding: true, over_number: 0, ball_in_over: 1 })

    const state = computeInningsState([battingPenalty, fieldingPenalty], NAMES)
    expect(state.totalRuns).toBe(5)          // only batting-side counts
    expect(state.extras.penalty).toBe(5)     // only batting-side in extras
    expect(state.extras.total).toBe(5)
  })
})

// ── Test 5: Non-striker run-out ────────────────────────────────────────────────

describe('Test 5 — non-striker run-out', () => {
  it('non-striker is marked out; striker is not out', () => {
    const ball = makeBall({
      batter_id: 'mp-1',
      non_striker_id: 'mp-2',
      dismissal_type: 'run_out',
      dismissed_player_id: 'mp-2',  // non-striker dismissed
    })
    const state = computeInningsState([ball], NAMES)

    expect(state.batterStats['mp-2']?.isOut).toBe(true)
    expect(state.batterStats['mp-1']?.isOut).toBeFalsy()
    expect(state.wickets).toBe(1)
  })
})

// ── Test 6: End-of-over + odd runs → net cancel ────────────────────────────────

describe('Test 6 — end-of-over + odd runs', () => {
  it('striker stays the same after end-of-over with odd runs (net cancel)', () => {
    // 6 legal balls: first 5 dots, last ball has 1 run (odd)
    const balls = dotBalls(5)
    balls.push(makeBall({ over_number: 0, ball_in_over: 5, runs_off_bat: 1 }))
    // After 6 legal balls, legalBallsAfterThisBall = 6 → end of over
    // odd runs → swap, end of over → swap again → net: original striker (mp-1) stays

    const lastBall = balls[5]
    const { striker, nonStriker } = computeStrikeAfterBall(lastBall, 6, 'mp-1', 'mp-2')
    expect(striker).toBe('mp-1')
    expect(nonStriker).toBe('mp-2')
  })
})

// ── Test 7: End-of-over + even runs → striker swapped ─────────────────────────

describe('Test 7 — end-of-over + even runs', () => {
  it('striker swaps after end-of-over with even runs', () => {
    const lastBall = makeBall({ over_number: 0, ball_in_over: 5, runs_off_bat: 2 })
    // legalBallsAfterThisBall = 6 → end of over; even runs → no crossing; end-of-over swap → striker becomes mp-2
    const { striker, nonStriker } = computeStrikeAfterBall(lastBall, 6, 'mp-1', 'mp-2')
    expect(striker).toBe('mp-2')
    expect(nonStriker).toBe('mp-1')
  })
})

// ── Test 8: Maiden detection — bye breaks a maiden ────────────────────────────

describe('Test 8 — maiden detection', () => {
  it('bye breaks a maiden (0 maiden when over has a bye)', () => {
    // Over of 6 balls, one of which is a bye
    const balls = Array.from({ length: 6 }, (_, i) =>
      makeBall({
        over_number: 0,
        ball_in_over: i,
        extras_type: i === 0 ? 'bye' : null,
        extras_runs: i === 0 ? 1 : 0,
      })
    )
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['mp-3'].maidens).toBe(0)
  })

  it('pure dot over is a maiden', () => {
    const balls = dotBalls(6)
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['mp-3'].maidens).toBe(1)
  })
})

// ── Test 9: currentOverBalls at over boundary ──────────────────────────────────

describe('Test 9 — currentOverBalls at over boundary', () => {
  it('shows the completed over (not an empty array) when exactly 6 legal balls bowled', () => {
    const balls = dotBalls(6)
    const state = computeInningsState(balls, NAMES)
    expect(state.currentOverBalls).toHaveLength(6)
  })

  it('starts fresh when first ball of new over is added', () => {
    const over0 = dotBalls(6, 0)
    const over1Ball = makeBall({ over_number: 1, ball_in_over: 0 })
    const state = computeInningsState([...over0, over1Ball], NAMES)
    expect(state.currentOverBalls).toHaveLength(1)
    expect(state.currentOverBalls[0].over_number).toBe(1)
  })
})

// ── Test 10: computeInningsState([]) ──────────────────────────────────────────

describe('Test 10 — empty innings', () => {
  it('returns all zeros and does not throw', () => {
    expect(() => {
      const state = computeInningsState([], new Map())
      expect(state.totalRuns).toBe(0)
      expect(state.wickets).toBe(0)
      expect(state.legalBalls).toBe(0)
      expect(state.currentOverBalls).toHaveLength(0)
      expect(state.completedOvers).toHaveLength(0)
      expect(state.fallOfWickets).toHaveLength(0)
    }).not.toThrow()
  })
})

// ── Test 11: retired_hurt does NOT count as a real wicket ─────────────────────
//
// retired_hurt is a valid dismissal_type (batter leaves the field injured) but
// is NOT an actual dismissal — the batter can return later. Only retired_out
// (and all other genuine dismissal types) should increment state.wickets and
// push a fallOfWickets entry.

describe('Test 11 — retired_hurt is not a real wicket', () => {
  const MANY_NAMES = new Map([
    ['bat1', 'Bat One'], ['bat2', 'Bat Two'], ['bat3', 'Bat Three'],
    ['bat4', 'Bat Four'], ['bat5', 'Bat Five'], ['bat6', 'Bat Six'],
    ['bat7', 'Bat Seven'], ['bat8', 'Bat Eight'], ['bat9', 'Bat Nine'],
    ['bat10', 'Bat Ten'], ['bat11', 'Bat Eleven'],
    ['bowl1', 'Bowler One'],
  ])

  it('a retired_hurt ball followed by a genuine dismissal only counts the genuine one', () => {
    const balls = [
      makeBall({
        over_number: 0, ball_in_over: 0,
        batter_id: 'bat1', non_striker_id: 'bat2', bowler_id: 'bowl1',
        dismissal_type: 'retired_hurt', dismissed_player_id: 'bat1',
      }),
      makeBall({
        over_number: 0, ball_in_over: 1,
        batter_id: 'bat3', non_striker_id: 'bat2', bowler_id: 'bowl1',
        dismissal_type: 'bowled', dismissed_player_id: 'bat3',
      }),
    ]
    const state = computeInningsState(balls, MANY_NAMES)
    expect(state.wickets).toBe(1)
    expect(state.fallOfWickets).toHaveLength(1)
    expect(state.fallOfWickets[0].matchPlayerId).toBe('bat3')
    // The retired-hurt batter should not be marked as out — he can return.
    expect(state.batterStats['bat1'].isOut).toBe(false)
  })

  it('retired_hurt + 9 genuine dismissals is NOT all-out (only 9 real wickets)', () => {
    // bat1 retires hurt, then bat2..bat10 (9 batters) are genuinely bowled out.
    const balls: BallEvent[] = [
      makeBall({
        over_number: 0, ball_in_over: 0,
        batter_id: 'bat1', non_striker_id: 'bat11', bowler_id: 'bowl1',
        dismissal_type: 'retired_hurt', dismissed_player_id: 'bat1',
      }),
      ...Array.from({ length: 9 }, (_, i) => {
        const batIdx = i + 2 // bat2..bat10
        return makeBall({
          over_number: Math.floor((i + 1) / 6),
          ball_in_over: (i + 1) % 6,
          batter_id: `bat${batIdx}`, non_striker_id: 'bat11', bowler_id: 'bowl1',
          dismissal_type: 'bowled', dismissed_player_id: `bat${batIdx}`,
        })
      }),
    ]
    const state = computeInningsState(balls, MANY_NAMES)
    expect(state.wickets).toBe(9)
    expect(state.fallOfWickets).toHaveLength(9)
  })

  it('retired_out (distinct from retired_hurt) DOES count as a real wicket', () => {
    const balls = [
      makeBall({
        over_number: 0, ball_in_over: 0,
        batter_id: 'bat1', non_striker_id: 'bat2', bowler_id: 'bowl1',
        dismissal_type: 'retired_out', dismissed_player_id: 'bat1',
      }),
    ]
    const state = computeInningsState(balls, MANY_NAMES)
    expect(state.wickets).toBe(1)
    expect(state.fallOfWickets).toHaveLength(1)
    expect(state.batterStats['bat1'].isOut).toBe(true)
  })
})
