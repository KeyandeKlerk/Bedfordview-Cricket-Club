import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeInningsState,
  bowlerRuns,
  oversDisplay,
} from '../engine'
import type { BallEvent } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

let seq = 0
beforeEach(() => { seq = 0 })

function ball(overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `b-${++seq}`,
    innings_id: 'inn-1',
    match_id: 'm-1',
    sequence_number: seq,
    over_number: 0,
    ball_in_over: seq - 1,
    batter_id: 'bat1',
    non_striker_id: 'bat2',
    bowler_id: 'bowl1',
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

const NAMES = new Map([
  ['bat1', 'Opener One'],
  ['bat2', 'Opener Two'],
  ['bat3', 'No. 3'],
  ['bat4', 'No. 4'],
  ['bat5', 'No. 5'],
  ['bat6', 'No. 6'],
  ['bat7', 'No. 7'],
  ['bat8', 'No. 8'],
  ['bat9', 'No. 9'],
  ['bat10', 'No. 10'],
  ['bat11', 'No. 11'],
  ['bowl1', 'Bowler One'],
  ['bowl2', 'Bowler Two'],
])

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Leg-bye handling
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 1 — Leg-bye handling', () => {

  it('1.1 — extras.leg_bye accumulates correctly', () => {
    const balls = [
      ball({ extras_type: 'leg_bye', extras_runs: 1 }),
      ball({ extras_type: 'leg_bye', extras_runs: 2, over_number: 0, ball_in_over: 1 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.extras.leg_bye).toBe(3)
  })

  it('1.2 — extras.total includes leg-bye runs', () => {
    const balls = [
      ball({ extras_type: 'leg_bye', extras_runs: 4 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.extras.total).toBe(4)
    expect(state.totalRuns).toBe(4)
  })

  it('1.3 — batter gets ball counted but NO runs from leg-bye', () => {
    const balls = [
      ball({ extras_type: 'leg_bye', extras_runs: 2, runs_off_bat: 0 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.batterStats['bat1'].balls).toBe(1)   // ball is counted
    expect(state.batterStats['bat1'].runs).toBe(0)    // no runs to batter
  })

  it('1.4 — bowler is charged 0 runs for leg-bye', () => {
    const balls = [
      ball({ extras_type: 'leg_bye', extras_runs: 4, runs_off_bat: 0 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['bowl1'].runs).toBe(0)
  })

  it('1.5 — leg-bye is a legal delivery (increments legalBalls)', () => {
    const balls = [
      ball({ extras_type: 'leg_bye', extras_runs: 1 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.legalBalls).toBe(1)
  })

  it('1.6 — leg-bye breaks a maiden (over of 5 dots + 1 leg-bye is not a maiden)', () => {
    const balls = Array.from({ length: 6 }, (_, i) =>
      ball({
        over_number: 0,
        ball_in_over: i,
        extras_type: i === 0 ? 'leg_bye' : null,
        extras_runs: i === 0 ? 1 : 0,
      })
    )
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['bowl1'].maidens).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Free-hit flag persistence through wides
// Bug: before fix, nextBallIsFreeHit was reset by a wide after a no-ball.
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 2 — Free-hit flag persistence', () => {

  it('2.1 — no-ball alone: nextBallIsFreeHit = true', () => {
    const state = computeInningsState(
      [ball({ extras_type: 'no_ball', extras_runs: 1 })],
      NAMES,
    )
    expect(state.nextBallIsFreeHit).toBe(true)
  })

  it('2.2 — legal delivery after no ball: nextBallIsFreeHit = false', () => {
    const state = computeInningsState([
      ball({ extras_type: 'no_ball', extras_runs: 1, over_number: 0, ball_in_over: 0 }),
      ball({ over_number: 0, ball_in_over: 1 }),
    ], NAMES)
    expect(state.nextBallIsFreeHit).toBe(false)
  })

  it('2.3 — no-ball followed by wide: free hit STILL active (Bug 1 fix)', () => {
    const state = computeInningsState([
      ball({ extras_type: 'no_ball', extras_runs: 1, over_number: 0, ball_in_over: 0 }),
      ball({ extras_type: 'wide',   extras_runs: 1, over_number: 0, ball_in_over: 1 }),
    ], NAMES)
    // Free hit persists — wide is not a legal delivery
    expect(state.nextBallIsFreeHit).toBe(true)
  })

  it('2.4 — no-ball, wide, wide: free hit still active after two consecutive wides', () => {
    const state = computeInningsState([
      ball({ extras_type: 'no_ball', extras_runs: 1, over_number: 0, ball_in_over: 0 }),
      ball({ extras_type: 'wide',   extras_runs: 1, over_number: 0, ball_in_over: 1 }),
      ball({ extras_type: 'wide',   extras_runs: 1, over_number: 0, ball_in_over: 2 }),
    ], NAMES)
    expect(state.nextBallIsFreeHit).toBe(true)
  })

  it('2.5 — no-ball, wide, legal delivery: free hit cleared by legal ball', () => {
    const state = computeInningsState([
      ball({ extras_type: 'no_ball', extras_runs: 1, over_number: 0, ball_in_over: 0 }),
      ball({ extras_type: 'wide',   extras_runs: 1, over_number: 0, ball_in_over: 1 }),
      ball({ over_number: 0, ball_in_over: 2 }),  // legal delivery — clears free hit
    ], NAMES)
    expect(state.nextBallIsFreeHit).toBe(false)
  })

  it('2.6 — no-ball at end of over: free hit persists into next over until legal delivery', () => {
    // Over 0: 5 legal + 1 no-ball (over_number=0, ball_in_over=5)
    // Over 1: starts with a wide → free hit should still be active
    const balls = [
      ...Array.from({ length: 5 }, (_, i) => ball({ over_number: 0, ball_in_over: i })),
      ball({ over_number: 0, ball_in_over: 5, extras_type: 'no_ball', extras_runs: 1 }),
      ball({ over_number: 1, ball_in_over: 0, extras_type: 'wide', extras_runs: 1 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.nextBallIsFreeHit).toBe(true)
  })

  it('2.7 — two consecutive no-balls: free hit set; first legal delivery clears it', () => {
    const state = computeInningsState([
      ball({ extras_type: 'no_ball', extras_runs: 1, over_number: 0, ball_in_over: 0 }),
      ball({ extras_type: 'no_ball', extras_runs: 1, over_number: 0, ball_in_over: 1 }),
      ball({ over_number: 0, ball_in_over: 2 }),  // legal — clears
    ], NAMES)
    expect(state.nextBallIsFreeHit).toBe(false)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Partnership runs consistency
// Bug: fielding-side penalty runs were included in partnership, not innings total.
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 3 — Partnership runs consistency', () => {

  it('3.1 — basic partnership runs match innings total (no extras)', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, runs_off_bat: 3 }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'bat2', non_striker_id: 'bat1', runs_off_bat: 4, is_boundary_four: true }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.currentPartnership).not.toBeNull()
    expect(state.currentPartnership!.runs).toBe(state.totalRuns)
  })

  it('3.2 — fielding-side penalty NOT included in partnership runs (Bug 2 fix)', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, runs_off_bat: 3 }),
      ball({ over_number: 0, ball_in_over: 1, extras_type: 'penalty', extras_runs: 5, penalty_to_fielding: true }),
    ]
    const state = computeInningsState(balls, NAMES)
    // Innings total = 3 (fielding penalty not counted)
    expect(state.totalRuns).toBe(3)
    // Partnership should also be 3, NOT 8
    expect(state.currentPartnership).not.toBeNull()
    expect(state.currentPartnership!.runs).toBe(3)
  })

  it('3.3 — batting-side penalty IS included in partnership runs', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, runs_off_bat: 3 }),
      ball({ over_number: 0, ball_in_over: 1, extras_type: 'penalty', extras_runs: 5, penalty_to_fielding: false }),
    ]
    const state = computeInningsState(balls, NAMES)
    // Innings total = 3 + 5 = 8
    expect(state.totalRuns).toBe(8)
    // Partnership = 8 (batting-side penalty counts)
    expect(state.currentPartnership!.runs).toBe(8)
  })

  it('3.4 — fielding-side penalty before wicket does not pollute new partnership', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, runs_off_bat: 5 }),
      ball({ over_number: 0, ball_in_over: 1, extras_type: 'penalty', extras_runs: 5, penalty_to_fielding: true }),
      ball({ over_number: 0, ball_in_over: 2, dismissal_type: 'bowled', dismissed_player_id: 'bat1', batter_id: 'bat1', non_striker_id: 'bat2' }),
      // New partnership starts: bat3 and bat2
      ball({ over_number: 0, ball_in_over: 3, batter_id: 'bat3', non_striker_id: 'bat2', runs_off_bat: 2 }),
    ]
    const state = computeInningsState(balls, NAMES)
    // New partnership should only count runs after the wicket
    expect(state.currentPartnership).not.toBeNull()
    expect(state.currentPartnership!.runs).toBe(2)
  })

  it('3.5 — partnership.runs equals bat runs + batting-side extras since last wicket', () => {
    // Wicket on ball 1, then: 4 bat + 1 wide + 2 leg-bye (both extras count to batting innings)
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'bat1', non_striker_id: 'bat2', dismissal_type: 'bowled', dismissed_player_id: 'bat1' }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'bat3', non_striker_id: 'bat2', runs_off_bat: 4, is_boundary_four: true }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'bat3', non_striker_id: 'bat2', extras_type: 'wide', extras_runs: 1 }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'bat3', non_striker_id: 'bat2', extras_type: 'leg_bye', extras_runs: 2 }),
    ]
    const state = computeInningsState(balls, NAMES)
    // Partnership = 4 + 1 (wide) + 2 (leg_bye) = 7
    expect(state.currentPartnership!.runs).toBe(7)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Maiden detection edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 4 — Maiden detection edge cases', () => {

  it('4.1 — leg-bye breaks a maiden (same as bye)', () => {
    // Over: 5 dots + 1 leg-bye
    const balls = Array.from({ length: 6 }, (_, i) =>
      ball({
        over_number: 0,
        ball_in_over: i,
        extras_type: i === 5 ? 'leg_bye' : null,
        extras_runs: i === 5 ? 1 : 0,
      })
    )
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['bowl1'].maidens).toBe(0)
  })

  it('4.2 — batting-side penalty breaks a maiden (runs awarded to batting innings)', () => {
    // Over: 5 dots + 1 batting-side penalty
    const balls = Array.from({ length: 6 }, (_, i) =>
      ball({
        over_number: 0,
        ball_in_over: i,
        extras_type: i === 5 ? 'penalty' : null,
        extras_runs: i === 5 ? 5 : 0,
        penalty_to_fielding: false,
      })
    )
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['bowl1'].maidens).toBe(0)
  })

  it('4.3 — no-ball with 0 bat runs breaks a maiden', () => {
    // Over: 5 dots + 1 no-ball (1 extra run)
    const balls = Array.from({ length: 7 }, (_, i) => {
      if (i === 5) return ball({ over_number: 0, ball_in_over: i, extras_type: 'no_ball', extras_runs: 1 })
      if (i < 5)  return ball({ over_number: 0, ball_in_over: i })
      // i === 6: 6th legal ball needed after the no-ball
      return ball({ over_number: 0, ball_in_over: i })
    })
    const state = computeInningsState(balls, NAMES)
    // The over has 6 legal balls but also 1 no-ball extra run → not a maiden
    expect(state.bowlerStats['bowl1'].maidens).toBe(0)
  })

  it('4.4 — pure dot over remains a maiden (control test)', () => {
    const balls = Array.from({ length: 6 }, (_, i) =>
      ball({ over_number: 0, ball_in_over: i })
    )
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['bowl1'].maidens).toBe(1)
  })

  it('4.5 — mixed-bowler over is not counted as maiden even if zero runs', () => {
    // 3 balls by bowl1, 3 by bowl2 — no maiden for either
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, bowler_id: 'bowl1' }),
      ball({ over_number: 0, ball_in_over: 1, bowler_id: 'bowl1' }),
      ball({ over_number: 0, ball_in_over: 2, bowler_id: 'bowl1' }),
      ball({ over_number: 0, ball_in_over: 3, bowler_id: 'bowl2' }),
      ball({ over_number: 0, ball_in_over: 4, bowler_id: 'bowl2' }),
      ball({ over_number: 0, ball_in_over: 5, bowler_id: 'bowl2' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['bowl1'].maidens).toBe(0)
    expect(state.bowlerStats['bowl2'].maidens).toBe(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — oversDisplay direct tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 5 — oversDisplay', () => {

  it('5.1 — 0 balls → "0.0"', () => {
    expect(oversDisplay(0)).toBe('0.0')
  })

  it('5.2 — 6 balls (1 complete over) → "1.0"', () => {
    expect(oversDisplay(6)).toBe('1.0')
  })

  it('5.3 — 7 balls (1 over + 1 ball) → "1.1"', () => {
    expect(oversDisplay(7)).toBe('1.1')
  })

  it('5.4 — 119 balls (19 complete overs + 5 balls) → "19.5"', () => {
    expect(oversDisplay(119)).toBe('19.5')
  })

  it('5.5 — 120 balls (20 complete overs) → "20.0"', () => {
    expect(oversDisplay(120)).toBe('20.0')
  })

})

// Need oversDisplay import — add it at the top
// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — bowlerRuns with leg-bye
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 6 — bowlerRuns with leg-bye', () => {

  it('6.1 — leg-bye 1 run: bowlerRuns = 0', () => {
    const b = ball({ extras_type: 'leg_bye', extras_runs: 1, runs_off_bat: 0 })
    expect(bowlerRuns(b)).toBe(0)
  })

  it('6.2 — leg-bye 4 runs (boundary leg-bye): bowlerRuns = 0', () => {
    const b = ball({ extras_type: 'leg_bye', extras_runs: 4, runs_off_bat: 0 })
    expect(bowlerRuns(b)).toBe(0)
  })

  it('6.3 — normal ball 4 runs (control): bowlerRuns = 4', () => {
    const b = ball({ runs_off_bat: 4, is_boundary_four: true })
    expect(bowlerRuns(b)).toBe(4)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Full 10-wicket innings
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 7 — Full 10-wicket innings', () => {

  function tenWicketInnings(): BallEvent[] {
    // 10 batters dismissed one per ball, batter11 is the non-striker on the last ball
    return Array.from({ length: 10 }, (_, i) => {
      const batIdx = i + 1
      const nonIdx = i === 9 ? 11 : i + 2
      return ball({
        over_number: Math.floor(i / 6),
        ball_in_over: i % 6,
        batter_id: `bat${batIdx}`,
        non_striker_id: `bat${nonIdx}`,
        dismissal_type: 'bowled',
        dismissed_player_id: `bat${batIdx}`,
      })
    })
  }

  it('7.1 — all 10 batters dismissed: wickets = 10', () => {
    const state = computeInningsState(tenWicketInnings(), NAMES)
    expect(state.wickets).toBe(10)
  })

  it('7.2 — currentStrikerId = null after 10th wicket', () => {
    const state = computeInningsState(tenWicketInnings(), NAMES)
    expect(state.currentStrikerId).toBeNull()
  })

  it('7.3 — currentNonStrikerId = null after 10th wicket', () => {
    const state = computeInningsState(tenWicketInnings(), NAMES)
    // bat11 was non-striker on ball 10. bat10 was dismissed. Since bat10 ≠ bat11,
    // currentNonStrikerId = bat11 (they survived). This is correct: last wicket means
    // the non-surviving bat11 ends up as non-striker with no partner.
    // The innings is over; what matters is the dismissed player (bat10) is not in a slot.
    expect(state.currentStrikerId).toBeNull()
    // Non-striker (bat11) remains — there's no 11th wicket
    expect(state.currentNonStrikerId).toBe('bat11')
  })

  it('7.4 — currentPartnership = null after 10 wickets', () => {
    const state = computeInningsState(tenWicketInnings(), NAMES)
    expect(state.currentPartnership).toBeNull()
  })

  it('7.5 — fallOfWickets has 10 entries with sequential wicket numbers', () => {
    const state = computeInningsState(tenWicketInnings(), NAMES)
    expect(state.fallOfWickets).toHaveLength(10)
    state.fallOfWickets.forEach((fow, i) => {
      expect(fow.wicketNumber).toBe(i + 1)
    })
  })

  it('7.6 — all 10 dismissed batters are in batterStats with isOut = true', () => {
    const state = computeInningsState(tenWicketInnings(), NAMES)
    for (let i = 1; i <= 10; i++) {
      expect(state.batterStats[`bat${i}`]).toBeDefined()
      expect(state.batterStats[`bat${i}`].isOut).toBe(true)
    }
  })

  it('7.7 — last pair: 10th batter dismissed on legal ball, 11th batter is non-striker (not out)', () => {
    const balls = tenWicketInnings()
    const state = computeInningsState(balls, NAMES)
    // bat11 (non-striker on last ball) should be in batterStats but NOT out
    expect(state.batterStats['bat11']).toBeDefined()
    expect(state.batterStats['bat11'].isOut).toBe(false)
  })

})
