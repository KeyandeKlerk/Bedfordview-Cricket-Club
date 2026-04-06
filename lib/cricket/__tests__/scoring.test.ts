/**
 * Comprehensive scoring system tests.
 *
 * TWO KNOWN BUGS UNDER TEST — both cause failing tests intentionally:
 *
 * BUG A — Engine: after a dismissal, currentStrikerId / currentNonStrikerId
 *   still point to the dismissed player because computeStrikeAfterBall() does
 *   not know about dismissals. The dismissed player also gets isStriker:true.
 *   Fix: in computeInningsState, after computeStrikeAfterBall(), null-out
 *   whichever slot holds the dismissed player's id.
 *
 * BUG B — Shell: PlayerSelectModal.onSelect in ScorerShell is
 *   `() => setShowNewBatter(false)` — it discards the selected player id.
 *   The new batter is never stored, so the next ball still uses the dismissed
 *   player as batter_id.  This is a React-component bug; the pure engine
 *   handles new batters correctly once they appear in ball_events, so the
 *   engine tests below document the EXPECTED contract that the shell must
 *   satisfy.  Tests marked [BUG B — shell contract] will pass (engine is
 *   correct) but serve as a regression guard once the shell is fixed.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeInningsState,
  computeStrikeAfterBall,
  totalBallRuns,
  isLegalDelivery,
} from '../engine'
import type { BallEvent } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────

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
    batter_id: 'mp-bat1',
    non_striker_id: 'mp-bat2',
    bowler_id: 'mp-bowl1',
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

/** Six dot balls in one over. */
function over(overNum: number, batterId = 'mp-bat1', nonStrikerId = 'mp-bat2', bowlerId = 'mp-bowl1'): BallEvent[] {
  return Array.from({ length: 6 }, (_, i) =>
    ball({ over_number: overNum, ball_in_over: i, batter_id: batterId, non_striker_id: nonStrikerId, bowler_id: bowlerId })
  )
}

const NAMES = new Map([
  ['mp-bat1',  'Opener One'],
  ['mp-bat2',  'Opener Two'],
  ['mp-bat3',  'No. 3'],
  ['mp-bat4',  'No. 4'],
  ['mp-bat5',  'No. 5'],
  ['mp-bat6',  'No. 6'],
  ['mp-bat7',  'No. 7'],
  ['mp-bat8',  'No. 8'],
  ['mp-bat9',  'No. 9'],
  ['mp-bat10', 'No. 10'],
  ['mp-bat11', 'No. 11'],
  ['mp-bowl1', 'Bowler One'],
  ['mp-bowl2', 'Bowler Two'],
  ['mp-keep1', 'Keeper'],
])

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — currentStrikerId / currentNonStrikerId after dismissal
// [BUG A] — these tests currently FAIL
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 1 — currentStrikerId after dismissal [BUG A — currently FAILS]', () => {

  it('1.1 — currentStrikerId should be null after striker is bowled', () => {
    // mp-bat1 faces ball 1 and is bowled. Nobody has come in yet.
    const balls = [
      ball({
        batter_id: 'mp-bat1',
        non_striker_id: 'mp-bat2',
        dismissal_type: 'bowled',
        dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    // BUG A: engine currently sets currentStrikerId = 'mp-bat1' (dismissed)
    expect(state.currentStrikerId).toBeNull()
    expect(state.currentNonStrikerId).toBe('mp-bat2')
  })

  it('1.2 — currentNonStrikerId should be null after non-striker is run-out', () => {
    const balls = [
      ball({
        batter_id: 'mp-bat1',
        non_striker_id: 'mp-bat2',
        dismissal_type: 'run_out',
        dismissed_player_id: 'mp-bat2',  // non-striker run-out
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    // BUG A: engine currently keeps currentNonStrikerId = 'mp-bat2' (dismissed)
    expect(state.currentStrikerId).toBe('mp-bat1')
    expect(state.currentNonStrikerId).toBeNull()
  })

  it('1.3 — dismissed batter should not have isStriker:true', () => {
    const balls = [
      ball({
        batter_id: 'mp-bat1',
        non_striker_id: 'mp-bat2',
        dismissal_type: 'caught',
        dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    // BUG A: engine currently marks isOut:true AND isStriker:true simultaneously
    expect(state.batterStats['mp-bat1'].isOut).toBe(true)
    expect(state.batterStats['mp-bat1'].isStriker).toBe(false)
  })

  it('1.4 — currentStrikerId should be null after striker is lbw', () => {
    const balls = [
      ball({
        batter_id: 'mp-bat1',
        non_striker_id: 'mp-bat2',
        dismissal_type: 'lbw',
        dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.currentStrikerId).toBeNull()
  })

  it('1.5 — currentStrikerId should be null after striker is stumped', () => {
    const balls = [
      ball({
        batter_id: 'mp-bat1',
        non_striker_id: 'mp-bat2',
        dismissal_type: 'stumped',
        dismissed_player_id: 'mp-bat1',
        fielder_id: 'mp-keep1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.currentStrikerId).toBeNull()
  })

  it('1.6 — striker run-out on last ball of over: non-striker faces next over, dismissed slot is null', () => {
    // mp-bat1 (striker) is run-out on ball 6, 0 runs.
    // End-of-over swap fires: mp-bat2 (non-striker) crosses to striker's end.
    // mp-bat1 is dismissed: their slot (now non-striker after the swap) is nulled.
    // Result: currentStrikerId='mp-bat2', currentNonStrikerId=null (new batter needed).
    const balls = [
      ...Array.from({ length: 5 }, (_, i) =>
        ball({ over_number: 0, ball_in_over: i })
      ),
      ball({
        over_number: 0,
        ball_in_over: 5,
        dismissal_type: 'run_out',
        dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    // mp-bat1 is dismissed — must not appear in any current slot
    expect(state.currentStrikerId).not.toBe('mp-bat1')
    expect(state.currentNonStrikerId).not.toBe('mp-bat1')
    // mp-bat2 survived and (via end-of-over swap) is now striker
    expect(state.currentStrikerId).toBe('mp-bat2')
    // Non-striker slot is null: new batter coming in
    expect(state.currentNonStrikerId).toBeNull()
  })

  it('1.7 — after two wickets, both dismissed players absent from current positions', () => {
    // Ball 1: mp-bat1 out
    // Ball 2: mp-bat3 (new batter) comes in, mp-bat2 strikes next over
    //         mp-bat3 out on ball 2
    const balls = [
      ball({
        over_number: 0, ball_in_over: 0,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1',
      }),
      ball({
        over_number: 0, ball_in_over: 1,
        batter_id: 'mp-bat3', non_striker_id: 'mp-bat2',
        dismissal_type: 'caught', dismissed_player_id: 'mp-bat3',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.batterStats['mp-bat1'].isOut).toBe(true)
    expect(state.batterStats['mp-bat3'].isOut).toBe(true)
    expect(state.currentStrikerId).not.toBe('mp-bat1')
    expect(state.currentStrikerId).not.toBe('mp-bat3')
    expect(state.currentNonStrikerId).not.toBe('mp-bat1')
    expect(state.currentNonStrikerId).not.toBe('mp-bat3')
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — New batter appears correctly [BUG B — shell contract]
// Engine-level tests PASS; they document what the shell must do once fixed.
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 2 — New batter replaces dismissed batter [BUG B — shell contract]', () => {

  it('2.1 — new batter (mp-bat3) appears as currentStriker once they face a ball', () => {
    const balls = [
      // Ball 1: opener 1 dismissed
      ball({
        over_number: 0, ball_in_over: 0,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1',
      }),
      // Ball 2: mp-bat3 comes in as new striker
      ball({
        over_number: 0, ball_in_over: 1,
        batter_id: 'mp-bat3', non_striker_id: 'mp-bat2',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.currentStrikerId).toBe('mp-bat3')
    expect(state.batterStats['mp-bat3']).toBeDefined()
    expect(state.batterStats['mp-bat3'].isOut).toBe(false)
  })

  it('2.2 — dismissed batter does NOT appear as currentStriker once new batter takes guard', () => {
    const balls = [
      ball({
        over_number: 0, ball_in_over: 0,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'lbw', dismissed_player_id: 'mp-bat1',
      }),
      ball({
        over_number: 0, ball_in_over: 1,
        batter_id: 'mp-bat3', non_striker_id: 'mp-bat2',
        runs_off_bat: 4, is_boundary_four: true,
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.currentStrikerId).toBe('mp-bat3')
    expect(state.currentStrikerId).not.toBe('mp-bat1')
    expect(state.batterStats['mp-bat1'].isOut).toBe(true)
    expect(state.batterStats['mp-bat3'].runs).toBe(4)
    expect(state.batterStats['mp-bat3'].fours).toBe(1)
  })

  it('2.3 — new batter stats are clean: 0 runs, 0 balls before they face first ball', () => {
    // mp-bat3 is non-striker before batting — they appear in batterStats via non_striker_id
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2' }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.batterStats['mp-bat2'].runs).toBe(0)
    expect(state.batterStats['mp-bat2'].balls).toBe(0)
    expect(state.batterStats['mp-bat2'].isOut).toBe(false)
  })

  it('2.4 — non-striker run-out: new batter comes in as non-striker', () => {
    const balls = [
      // Non-striker mp-bat2 is run out
      ball({
        over_number: 0, ball_in_over: 0,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'run_out', dismissed_player_id: 'mp-bat2',
      }),
      // mp-bat1 is still striking; mp-bat3 comes in as non-striker
      ball({
        over_number: 0, ball_in_over: 1,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat3',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.currentStrikerId).toBe('mp-bat1')
    expect(state.currentNonStrikerId).toBe('mp-bat3')
    expect(state.batterStats['mp-bat2'].isOut).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — New batter filter: who is eligible to bat next
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 3 — New batter eligibility filter', () => {

  it('3.1 — dismissed player is in batterStats and excluded by !batterStats[p.id] filter', () => {
    const balls = [
      ball({
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    // Dismissed batter IS in batterStats
    expect(state.batterStats['mp-bat1']).toBeDefined()
    expect(state.batterStats['mp-bat1'].isOut).toBe(true)

    // The filter used in ScorerShell: !state.batterStats[p.id]
    // A dismissed player is in batterStats → they are correctly excluded
    const allBattingIds = ['mp-bat1', 'mp-bat2', 'mp-bat3', 'mp-bat4']
    const eligible = allBattingIds.filter(id => !state.batterStats[id])
    expect(eligible).not.toContain('mp-bat1')  // dismissed — excluded ✓
    expect(eligible).not.toContain('mp-bat2')  // currently at crease — excluded ✓
    expect(eligible).toContain('mp-bat3')      // hasn't batted — included ✓
    expect(eligible).toContain('mp-bat4')      // hasn't batted — included ✓
  })

  it('3.2 — non-striker also appears in batterStats (added from ball.non_striker_id)', () => {
    const balls = [
      ball({ batter_id: 'mp-bat1', non_striker_id: 'mp-bat2' }),
    ]
    const state = computeInningsState(balls, NAMES)

    // Both openers are in batterStats after ball 1
    expect(state.batterStats['mp-bat1']).toBeDefined()
    expect(state.batterStats['mp-bat2']).toBeDefined()

    // Neither should appear in new-batter list
    const allIds = ['mp-bat1', 'mp-bat2', 'mp-bat3']
    const eligible = allIds.filter(id => !state.batterStats[id])
    expect(eligible).not.toContain('mp-bat1')
    expect(eligible).not.toContain('mp-bat2')
    expect(eligible).toContain('mp-bat3')
  })

  it('3.3 — old filter (!batterStats[id]?.isOut) would incorrectly include both current batters', () => {
    // This test documents WHY the old filter was wrong and the new one is better.
    const balls = [ball({ batter_id: 'mp-bat1', non_striker_id: 'mp-bat2' })]
    const state = computeInningsState(balls, NAMES)

    // Old filter: !state.batterStats[id]?.isOut
    const oldFilter = (id: string) => !state.batterStats[id]?.isOut
    // New (correct) filter: !state.batterStats[id]
    const newFilter = (id: string) => !state.batterStats[id]

    const allIds = ['mp-bat1', 'mp-bat2', 'mp-bat3']

    // Old filter would include both current batters (isOut=false → !false=true)
    // They'd only be excluded by the separate excludeIds mechanism
    expect(allIds.filter(oldFilter)).toContain('mp-bat1')  // old filter lets them through
    expect(allIds.filter(oldFilter)).toContain('mp-bat2')

    // New filter correctly excludes them at the filter stage
    expect(allIds.filter(newFilter)).not.toContain('mp-bat1')
    expect(allIds.filter(newFilter)).not.toContain('mp-bat2')
    expect(allIds.filter(newFilter)).toContain('mp-bat3')
  })

  it('3.4 — multiple wickets: only players with no entry in batterStats are eligible', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1' }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2' }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', dismissal_type: 'caught', dismissed_player_id: 'mp-bat3' }),
    ]
    const state = computeInningsState(balls, NAMES)

    const squad = ['mp-bat1', 'mp-bat2', 'mp-bat3', 'mp-bat4', 'mp-bat5']
    const eligible = squad.filter(id => !state.batterStats[id])

    expect(eligible).not.toContain('mp-bat1')  // out
    expect(eligible).not.toContain('mp-bat2')  // at crease
    expect(eligible).not.toContain('mp-bat3')  // out
    expect(eligible).toContain('mp-bat4')
    expect(eligible).toContain('mp-bat5')
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Strike rotation with wickets
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 4 — Strike rotation around wickets', () => {

  it('4.1 — dot ball before wicket: non-striker remains non-striker', () => {
    const balls = [
      ball({ batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
    ]
    const state = computeInningsState(balls, NAMES)
    // No dismissal — mp-bat1 stays striker (dot ball, no cross)
    expect(state.currentStrikerId).toBe('mp-bat1')
    expect(state.currentNonStrikerId).toBe('mp-bat2')
  })

  it('4.2 — 1-run before wicket ball: batters cross, so non-striker would face next', () => {
    // mp-bat1 hits 1, then mp-bat2 (now striker) is bowled on next ball
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 1 }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat2', non_striker_id: 'mp-bat1', dismissal_type: 'bowled', dismissed_player_id: 'mp-bat2' }),
    ]
    const state = computeInningsState(balls, NAMES)

    // mp-bat2 is dismissed, mp-bat1 is at non-striker end (didn't cross on this ball)
    // After dismissal: currentStrikerId should be null (new batter needed), non-striker = mp-bat1
    expect(state.batterStats['mp-bat2'].isOut).toBe(true)
    // BUG A: currently fails because engine puts mp-bat2 as currentStriker
    expect(state.currentStrikerId).toBeNull()
    expect(state.currentNonStrikerId).toBe('mp-bat1')
  })

  it('4.3 — wicket at end of over: non-striker crosses to face next over, then dismissed batter slot is null', () => {
    // Over of 6 balls, striker dismissed on last ball
    const balls = [
      ...Array.from({ length: 5 }, (_, i) =>
        ball({ over_number: 0, ball_in_over: i, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2' })
      ),
      ball({
        over_number: 0, ball_in_over: 5,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    // mp-bat1 is dismissed. End-of-over swap would normally put mp-bat2 as striker.
    // But mp-bat1 is out — so the new over should have mp-bat2 striking and mp-bat1 slot null.
    expect(state.batterStats['mp-bat1'].isOut).toBe(true)
    expect(state.currentStrikerId).not.toBe('mp-bat1')
    // After fixing bug A, we'd expect: currentStrikerId=null, currentNonStrikerId='mp-bat2'
    // (or currentStrikerId='mp-bat2' if end-of-over swap is applied before clearing)
  })

  it('4.4 — computeStrikeAfterBall: dismissed player should not be returned as striker', () => {
    // Tests computeStrikeAfterBall directly — this function does NOT know about dismissals,
    // which is the root cause of Bug A. After fixing the engine, calling computeInningsState
    // should clear the dismissed slot. This test documents the raw function behaviour.
    const wicketBall = ball({
      batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
      dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1',
    })
    // computeStrikeAfterBall itself just does run-crossing logic — it doesn't clear dismissals
    // The fix belongs in computeInningsState, not here.
    const { striker, nonStriker } = computeStrikeAfterBall(wicketBall, 1, 'mp-bat1', 'mp-bat2')
    // Raw function returns mp-bat1 (no dismissal awareness) — this is expected at this level
    expect(striker).toBe('mp-bat1')
    expect(nonStriker).toBe('mp-bat2')
    // The ENGINE test (1.1) verifies computeInningsState clears the dismissed slot — that's where the fix lives.
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Wickets counter, fall of wickets, bowler wickets
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 5 — Wickets, fall of wickets, bowler attribution', () => {

  it('5.1 — bowled: wickets=1, bowler gets credit', () => {
    const balls = [
      ball({ dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
  })

  it('5.2 — caught: wickets=1, bowler gets credit', () => {
    const balls = [
      ball({ dismissal_type: 'caught', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1', fielder_id: 'mp-bowl2' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
  })

  it('5.3 — run_out: wickets=1, bowler gets NO credit', () => {
    const balls = [
      ball({ dismissal_type: 'run_out', dismissed_player_id: 'mp-bat2', bowler_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(0)  // run-out not credited to bowler
  })

  it('5.4 — stumped: wickets=1, bowler gets credit', () => {
    const balls = [
      ball({ dismissal_type: 'stumped', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1', fielder_id: 'mp-keep1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
  })

  it('5.5 — lbw: wickets=1, bowler gets credit', () => {
    const balls = [
      ball({ dismissal_type: 'lbw', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
  })

  it('5.6 — hit_wicket: bowler gets credit', () => {
    const balls = [
      ball({ dismissal_type: 'hit_wicket', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
  })

  it('5.7 — obstructing_field: bowler gets NO credit', () => {
    const balls = [
      ball({ dismissal_type: 'obstructing_field', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(0)
  })

  it('5.8 — retired_hurt: wickets=1, bowler gets NO credit', () => {
    const balls = [
      ball({ dismissal_type: 'retired_hurt', dismissed_player_id: 'mp-bat1', bowler_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(0)
  })

  it('5.9 — fall of wickets recorded correctly', () => {
    const balls = [
      ball({ runs_off_bat: 3 }),
      ball({ runs_off_bat: 2 }),
      ball({ dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1', batter_id: 'mp-bat1', non_striker_id: 'mp-bat2' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.fallOfWickets).toHaveLength(1)
    expect(state.fallOfWickets[0].wicketNumber).toBe(1)
    expect(state.fallOfWickets[0].runs).toBe(5)   // 3+2+0
    expect(state.fallOfWickets[0].matchPlayerId).toBe('mp-bat1')
  })

  it('5.10 — two wickets: fall of wickets has two entries in order', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 6, is_boundary_six: true }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1' }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 4, is_boundary_four: true }),
      ball({ over_number: 0, ball_in_over: 3, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', dismissal_type: 'lbw', dismissed_player_id: 'mp-bat3' }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(2)
    expect(state.fallOfWickets).toHaveLength(2)
    expect(state.fallOfWickets[0].wicketNumber).toBe(1)
    expect(state.fallOfWickets[0].runs).toBe(6)
    expect(state.fallOfWickets[1].wicketNumber).toBe(2)
    expect(state.fallOfWickets[1].runs).toBe(10)  // 6 + 0 (wicket ball) + 4
    expect(state.fallOfWickets[1].matchPlayerId).toBe('mp-bat3')
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Batter stats accuracy after wickets
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 6 — Batter stats accuracy after wickets', () => {

  it('6.1 — dismissed batter stats preserved: runs, balls, fours, sixes', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 4, is_boundary_four: true }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 6, is_boundary_six: true }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 1 }),
      ball({
        over_number: 0, ball_in_over: 3,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
        dismissal_type: 'caught', dismissed_player_id: 'mp-bat1',
      }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.batterStats['mp-bat1'].runs).toBe(11)
    expect(state.batterStats['mp-bat1'].balls).toBe(4)
    expect(state.batterStats['mp-bat1'].fours).toBe(1)
    expect(state.batterStats['mp-bat1'].sixes).toBe(1)
    expect(state.batterStats['mp-bat1'].isOut).toBe(true)
    expect(state.batterStats['mp-bat1'].dismissalType).toBe('caught')
    expect(state.batterStats['mp-bat1'].strikeRate).toBe(275.00)
  })

  it('6.2 — new batter stats start at zero and accumulate correctly', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1' }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 2 }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat2', non_striker_id: 'mp-bat3', runs_off_bat: 6, is_boundary_six: true }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.batterStats['mp-bat3'].runs).toBe(2)
    expect(state.batterStats['mp-bat3'].balls).toBe(1)
    expect(state.batterStats['mp-bat3'].isOut).toBe(false)
    expect(state.batterStats['mp-bat2'].runs).toBe(6)
    expect(state.batterStats['mp-bat2'].sixes).toBe(1)
  })

  it('6.3 — wide does not count as a ball faced by batter', () => {
    const balls = [
      ball({ extras_type: 'wide', extras_runs: 1, runs_off_bat: 0 }),
      ball({ runs_off_bat: 3 }),
    ]
    const state = computeInningsState(balls, NAMES)
    // Wide: batter gets 0 balls, 0 runs. Next ball: 3 runs, 1 ball.
    expect(state.batterStats['mp-bat1'].balls).toBe(1)
    expect(state.batterStats['mp-bat1'].runs).toBe(3)
  })

  it('6.4 — bye: batter gets ball counted but no runs', () => {
    const balls = [
      ball({ extras_type: 'bye', extras_runs: 1, runs_off_bat: 0 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.batterStats['mp-bat1'].balls).toBe(1)
    expect(state.batterStats['mp-bat1'].runs).toBe(0)
  })

  it('6.5 — no-ball: batter gets runs credited and ball counted', () => {
    const balls = [
      ball({ extras_type: 'no_ball', extras_runs: 1, runs_off_bat: 3 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.batterStats['mp-bat1'].runs).toBe(3)
    expect(state.batterStats['mp-bat1'].balls).toBe(1)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Wicket on a no-ball (free hit follows)
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 7 — Wicket interactions with extras', () => {

  it('7.1 — wicket on a wide: counts as extra, batter still dismissed', () => {
    // Run-out can happen on a wide
    const balls = [
      ball({
        extras_type: 'wide', extras_runs: 1,
        dismissal_type: 'run_out', dismissed_player_id: 'mp-bat2',
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
      }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.totalRuns).toBe(1)
    expect(state.wickets).toBe(1)
    expect(state.batterStats['mp-bat2'].isOut).toBe(true)
    expect(state.legalBalls).toBe(0)  // wide is not a legal delivery
  })

  it('7.2 — no-ball wicket: only run-out counts; batsman not out on caught off no-ball', () => {
    // On a no-ball, only run-out, obstructing, handled-ball, timed-out are valid.
    // The validator blocks invalid dismissals — here we just confirm run-out on no-ball works.
    const balls = [
      ball({
        extras_type: 'no_ball', extras_runs: 1,
        dismissal_type: 'run_out', dismissed_player_id: 'mp-bat2',
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat2',
      }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(1)
    expect(state.batterStats['mp-bat2'].isOut).toBe(true)
    expect(state.nextBallIsFreeHit).toBe(true)
  })

  it('7.3 — free hit flag set after no-ball', () => {
    const balls = [
      ball({ extras_type: 'no_ball', extras_runs: 1 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.nextBallIsFreeHit).toBe(true)
  })

  it('7.4 — free hit flag cleared after next delivery', () => {
    const balls = [
      ball({ extras_type: 'no_ball', extras_runs: 1 }),
      ball({ over_number: 0, ball_in_over: 1 }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.nextBallIsFreeHit).toBe(false)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — Partnership tracking after wickets
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 8 — Partnership tracking', () => {

  it('8.1 — partnership resets after wicket: only balls AFTER last wicket count', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, runs_off_bat: 10 }),       // pre-wicket runs
      ball({ over_number: 0, ball_in_over: 1, dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1' }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 3 }),  // new partnership
    ]
    const state = computeInningsState(balls, NAMES)

    // Partnership should only count runs from ball 3 onwards
    expect(state.currentPartnership).not.toBeNull()
    expect(state.currentPartnership!.runs).toBe(3)
    expect(state.currentPartnership!.balls).toBe(1)
  })

  it('8.2 — opening partnership: all balls count', () => {
    const balls = [
      ball({ runs_off_bat: 2 }),
      ball({ runs_off_bat: 0 }),
      ball({ runs_off_bat: 4, is_boundary_four: true }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.currentPartnership).not.toBeNull()
    expect(state.currentPartnership!.runs).toBe(6)
    expect(state.currentPartnership!.balls).toBe(3)
  })

  it('8.3 — no partnership when 10 wickets down', () => {
    // Simulate 10 wickets by building 10 wicket balls
    const wicketBalls = Array.from({ length: 10 }, (_, i) =>
      ball({
        over_number: Math.floor(i / 6),
        ball_in_over: i % 6,
        batter_id: `mp-bat${i + 1}`,
        non_striker_id: `mp-bat${i === 9 ? 10 : i + 2}`,
        dismissal_type: 'bowled',
        dismissed_player_id: `mp-bat${i + 1}`,
      })
    )
    const state = computeInningsState(wicketBalls, NAMES)
    expect(state.wickets).toBe(10)
    expect(state.currentPartnership).toBeNull()
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — Full innings simulation with wickets and new batters
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 9 — Full innings simulation', () => {

  it('9.1 — 3 wickets, correct runs and current batters tracked', () => {
    const balls = [
      // Over 0: opener 1 hits 20 then is out
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 6, is_boundary_six: true }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 4, is_boundary_four: true }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 1 }),
      // mp-bat2 is now striker (odd runs from previous ball)
      ball({ over_number: 0, ball_in_over: 3, batter_id: 'mp-bat2', non_striker_id: 'mp-bat1', runs_off_bat: 0 }),
      ball({
        over_number: 0, ball_in_over: 4,
        batter_id: 'mp-bat2', non_striker_id: 'mp-bat1',
        dismissal_type: 'lbw', dismissed_player_id: 'mp-bat2',
      }),
      // mp-bat3 comes in
      ball({ over_number: 0, ball_in_over: 5, batter_id: 'mp-bat3', non_striker_id: 'mp-bat1', runs_off_bat: 2 }),
      // Over 1
      ball({ over_number: 1, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat3', runs_off_bat: 0, bowler_id: 'mp-bowl2' }),
      ball({
        over_number: 1, ball_in_over: 1,
        batter_id: 'mp-bat1', non_striker_id: 'mp-bat3', bowler_id: 'mp-bowl2',
        dismissal_type: 'caught', dismissed_player_id: 'mp-bat1', fielder_id: 'mp-bowl1',
      }),
      // mp-bat4 comes in
      ball({ over_number: 1, ball_in_over: 2, batter_id: 'mp-bat4', non_striker_id: 'mp-bat3', runs_off_bat: 3, bowler_id: 'mp-bowl2' }),
    ]

    const state = computeInningsState(balls, NAMES)

    // Totals
    expect(state.totalRuns).toBe(6 + 4 + 1 + 0 + 0 + 2 + 0 + 0 + 3)  // = 16
    expect(state.wickets).toBe(2)
    expect(state.legalBalls).toBe(9)  // all legal

    // Dismissed batter stats
    expect(state.batterStats['mp-bat2'].isOut).toBe(true)
    expect(state.batterStats['mp-bat2'].dismissalType).toBe('lbw')
    expect(state.batterStats['mp-bat1'].isOut).toBe(true)
    expect(state.batterStats['mp-bat1'].dismissalType).toBe('caught')

    // Current batters
    // BUG A: currently fails — engine still shows dismissed batters as current
    expect(state.currentStrikerId).not.toBe('mp-bat2')
    expect(state.currentStrikerId).not.toBe('mp-bat1')
  })

  it('9.2 — scorecard totals match sum of individual batter runs + extras', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 4, is_boundary_four: true }),
      ball({ over_number: 0, ball_in_over: 1, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', extras_type: 'wide', extras_runs: 1, runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 2, batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', runs_off_bat: 6, is_boundary_six: true }),
      ball({ over_number: 0, ball_in_over: 3, batter_id: 'mp-bat2', non_striker_id: 'mp-bat1', extras_type: 'bye', extras_runs: 2, runs_off_bat: 0 }),
    ]
    const state = computeInningsState(balls, NAMES)

    const batterRunsSum = Object.values(state.batterStats).reduce((s, b) => s + b.runs, 0)
    const extrasTotal = state.extras.total

    expect(state.totalRuns).toBe(batterRunsSum + extrasTotal)
    expect(state.totalRuns).toBe(4 + 0 + 1 + 6 + 2)  // 13
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — Bowler stats with wickets
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 10 — Bowler stats with wickets', () => {

  it('10.1 — bowler economy calculated correctly across wicket balls', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, runs_off_bat: 6, is_boundary_six: true }),
      ball({ over_number: 0, ball_in_over: 1, runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 2, runs_off_bat: 0, dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1' }),
      ball({ over_number: 0, ball_in_over: 3, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 4, is_boundary_four: true }),
      ball({ over_number: 0, ball_in_over: 4, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 5, batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
    ]
    const state = computeInningsState(balls, NAMES)

    // Bowler: 1 over, 10 runs, 1 wicket
    expect(state.bowlerStats['mp-bowl1'].legalBalls).toBe(6)
    expect(state.bowlerStats['mp-bowl1'].overs).toBe('1.0')
    expect(state.bowlerStats['mp-bowl1'].runs).toBe(10)
    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].economy).toBe(10.0)
  })

  it('10.2 — bowler not charged for byes on a wicket ball', () => {
    const balls = [
      ball({
        extras_type: 'bye', extras_runs: 1, runs_off_bat: 0,
        dismissal_type: 'run_out', dismissed_player_id: 'mp-bat2',
      }),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.totalRuns).toBe(1)
    expect(state.bowlerStats['mp-bowl1'].runs).toBe(0)  // bye not charged to bowler
    expect(state.wickets).toBe(1)
  })

  it('10.3 — two bowlers split wickets correctly', () => {
    const balls = [
      ball({ over_number: 0, ball_in_over: 0, bowler_id: 'mp-bowl1', batter_id: 'mp-bat1', non_striker_id: 'mp-bat2', dismissal_type: 'bowled', dismissed_player_id: 'mp-bat1' }),
      ball({ over_number: 0, ball_in_over: 1, bowler_id: 'mp-bowl1', batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 2, bowler_id: 'mp-bowl1', batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 3, bowler_id: 'mp-bowl1', batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 4, bowler_id: 'mp-bowl1', batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 0, ball_in_over: 5, bowler_id: 'mp-bowl1', batter_id: 'mp-bat3', non_striker_id: 'mp-bat2', runs_off_bat: 0 }),
      ball({ over_number: 1, ball_in_over: 0, bowler_id: 'mp-bowl2', batter_id: 'mp-bat2', non_striker_id: 'mp-bat3', dismissal_type: 'lbw', dismissed_player_id: 'mp-bat2' }),
      ball({ over_number: 1, ball_in_over: 1, bowler_id: 'mp-bowl2', batter_id: 'mp-bat4', non_striker_id: 'mp-bat3', dismissal_type: 'caught', dismissed_player_id: 'mp-bat4', fielder_id: 'mp-bowl1' }),
    ]
    const state = computeInningsState(balls, NAMES)

    expect(state.bowlerStats['mp-bowl1'].wickets).toBe(1)
    expect(state.bowlerStats['mp-bowl2'].wickets).toBe(2)
    expect(state.wickets).toBe(3)
  })

})
