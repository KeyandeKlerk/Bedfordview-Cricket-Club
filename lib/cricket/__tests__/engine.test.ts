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

describe('Test 4 — penalty runs', () => {
  it('total+=5, batter=0, bowler=0', () => {
    const ball = makeBall({ extras_type: 'penalty', runs_off_bat: 0, extras_runs: 5 })
    expect(totalBallRuns(ball)).toBe(5)
    expect(bowlerRuns(ball)).toBe(0)

    const state = computeInningsState([ball], NAMES)
    expect(state.totalRuns).toBe(5)
    expect(state.batterStats['mp-1'].runs).toBe(0)
    expect(state.bowlerStats['mp-3'].runs).toBe(0)
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
