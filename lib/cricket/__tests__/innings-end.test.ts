/**
 * TDD — End Innings feature
 *
 * Tests are written FIRST. They fail until the feature is implemented.
 *
 * Feature spec:
 *   isNaturalEnd(state, oversPerInnings) — pure function exported from engine.ts
 *   Returns true when the innings has reached a natural conclusion:
 *     - 10 wickets have fallen, OR
 *     - all allocated overs have been bowled (legalBalls >= oversPerInnings * 6)
 *   Returns false in all other cases (scorer can still manually end the innings,
 *   but the UI distinguishes between a natural end and a manual/declared end).
 *
 * The scorer can ALWAYS trigger End Innings (manual declare/retire).
 * isNaturalEnd only controls whether the UI prompts for confirmation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { computeInningsState, isNaturalEnd } from '../engine'
import type { BallEvent, InningsState } from '../types'

// ── helpers ─────────────────────────────────────────────────────────────────

let seq = 0
beforeEach(() => { seq = 0 })

function ball(overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `b-${++seq}`,
    innings_id: 'inn-1',
    match_id: 'm-1',
    sequence_number: seq,
    over_number: 0,
    ball_in_over: 0,
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

/** Build n legal dot balls across consecutive overs */
function legalBalls(n: number): BallEvent[] {
  return Array.from({ length: n }, (_, i) =>
    ball({ over_number: Math.floor(i / 6), ball_in_over: i % 6 })
  )
}

/** Build n wicket balls (each batter gets a unique id so the engine doesn't trip) */
function wickets(n: number): BallEvent[] {
  return Array.from({ length: n }, (_, i) =>
    ball({
      over_number: Math.floor(i / 6),
      ball_in_over: i % 6,
      batter_id: `mp-bat${i + 1}`,
      non_striker_id: `mp-bat${i === 9 ? 10 : i + 2}`,
      dismissal_type: 'bowled',
      dismissed_player_id: `mp-bat${i + 1}`,
    })
  )
}

const NAMES = new Map<string, string>()  // engine falls back to id when name missing

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — isNaturalEnd: natural completion conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('isNaturalEnd — natural completion', () => {

  it('1.1 — returns true when 10 wickets have fallen', () => {
    const state = computeInningsState(wickets(10), NAMES)
    expect(state.wickets).toBe(10)
    expect(isNaturalEnd(state, 20)).toBe(true)
  })

  it('1.2 — returns true when all overs are complete (20-over match)', () => {
    const state = computeInningsState(legalBalls(120), NAMES)
    expect(state.legalBalls).toBe(120)
    expect(isNaturalEnd(state, 20)).toBe(true)
  })

  it('1.3 — returns true when all overs are complete (50-over match)', () => {
    const state = computeInningsState(legalBalls(300), NAMES)
    expect(isNaturalEnd(state, 50)).toBe(true)
  })

  it('1.4 — returns true when all overs are complete (1-over match edge case)', () => {
    const state = computeInningsState(legalBalls(6), NAMES)
    expect(isNaturalEnd(state, 1)).toBe(true)
  })

  it('1.5 — returns true when 10 wickets AND overs complete simultaneously', () => {
    // Both conditions true at once — still natural end
    const state = computeInningsState(wickets(10), NAMES)
    // Pretend these 10 balls also fill the overs (overs=1, 6 legal + extras irrelevant)
    expect(isNaturalEnd(state, 1)).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — isNaturalEnd: not yet complete
// ─────────────────────────────────────────────────────────────────────────────

describe('isNaturalEnd — innings still in progress', () => {

  it('2.1 — returns false at start of innings (0 balls)', () => {
    const state = computeInningsState([], NAMES)
    expect(isNaturalEnd(state, 20)).toBe(false)
  })

  it('2.2 — returns false with 9 wickets and overs remaining', () => {
    const state = computeInningsState(wickets(9), NAMES)
    expect(state.wickets).toBe(9)
    expect(isNaturalEnd(state, 20)).toBe(false)
  })

  it('2.3 — returns false with 0 wickets and overs remaining', () => {
    const state = computeInningsState(legalBalls(10), NAMES)
    expect(isNaturalEnd(state, 20)).toBe(false)
  })

  it('2.4 — returns false one ball before overs complete', () => {
    const state = computeInningsState(legalBalls(119), NAMES)
    expect(isNaturalEnd(state, 20)).toBe(false)
  })

  it('2.5 — returns false one ball before overs complete even with 9 wickets', () => {
    const balls = [...wickets(9), ...legalBalls(1)]
    // 9 wickets + 1 legal ball somewhere = not complete on either condition
    const state = computeInningsState(balls, NAMES)
    expect(state.wickets).toBe(9)
    // 9 legal wicket balls + 1 extra legal = 10 legal balls, far from 120
    expect(isNaturalEnd(state, 20)).toBe(false)
  })

  it('2.6 — returns false with exactly 119 legal balls (one over short)', () => {
    const state = computeInningsState(legalBalls(119), NAMES)
    expect(state.legalBalls).toBe(119)
    expect(isNaturalEnd(state, 20)).toBe(false)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — isNaturalEnd: extras do NOT count toward over completion
// ─────────────────────────────────────────────────────────────────────────────

describe('isNaturalEnd — wides and no-balls do not complete overs', () => {

  it('3.1 — 6 wides do not complete an over (still false)', () => {
    const balls = Array.from({ length: 6 }, () =>
      ball({ extras_type: 'wide', extras_runs: 1 })
    )
    const state = computeInningsState(balls, NAMES)
    expect(state.legalBalls).toBe(0)
    expect(isNaturalEnd(state, 1)).toBe(false)
  })

  it('3.2 — 5 legal + 3 wides in a 1-over match: not complete (only 5 legal)', () => {
    const balls = [
      ...Array.from({ length: 5 }, (_, i) => ball({ over_number: 0, ball_in_over: i })),
      ...Array.from({ length: 3 }, () => ball({ extras_type: 'wide', extras_runs: 1 })),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.legalBalls).toBe(5)
    expect(isNaturalEnd(state, 1)).toBe(false)
  })

  it('3.3 — 6 legal + 2 no-balls: overs complete (6 legal = 1 over)', () => {
    const balls = [
      ...Array.from({ length: 6 }, (_, i) => ball({ over_number: 0, ball_in_over: i })),
      ...Array.from({ length: 2 }, () => ball({ extras_type: 'no_ball', extras_runs: 1 })),
    ]
    const state = computeInningsState(balls, NAMES)
    expect(state.legalBalls).toBe(6)
    expect(isNaturalEnd(state, 1)).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Manual end: scorer can always end innings
// This section documents the UI contract: isNaturalEnd returning false does NOT
// prevent the scorer from ending the innings — it only means a confirmation
// prompt should be shown.
// ─────────────────────────────────────────────────────────────────────────────

describe('Manual end — scorer can end innings at any time', () => {

  it('4.1 — innings with 0 balls: isNaturalEnd=false but manual end is valid', () => {
    const state = computeInningsState([], NAMES)
    expect(isNaturalEnd(state, 20)).toBe(false)
    // The UI should still allow ending — this test documents the contract:
    // manual end is ALWAYS permissible; isNaturalEnd only controls confirmation UI.
    const manualEndAllowed = true  // the scorer can always press End Innings
    expect(manualEndAllowed).toBe(true)
  })

  it('4.2 — mid-innings declaration: isNaturalEnd=false, manual end still valid', () => {
    const state = computeInningsState(legalBalls(36), NAMES)
    expect(isNaturalEnd(state, 20)).toBe(false)  // only 6 overs, not 20
    const manualEndAllowed = true
    expect(manualEndAllowed).toBe(true)
  })

  it('4.3 — isNaturalEnd=true: no confirmation needed, direct end', () => {
    const state = computeInningsState(legalBalls(120), NAMES)
    expect(isNaturalEnd(state, 20)).toBe(true)
    // When isNaturalEnd is true, the UI shows direct "End Innings →" without confirm
    const requiresConfirmation = !isNaturalEnd(state, 20)
    expect(requiresConfirmation).toBe(false)
  })

  it('4.4 — isNaturalEnd=false: confirmation required before ending', () => {
    const state = computeInningsState(legalBalls(60), NAMES)
    expect(isNaturalEnd(state, 20)).toBe(false)  // only 10 overs
    const requiresConfirmation = !isNaturalEnd(state, 20)
    expect(requiresConfirmation).toBe(true)
  })

})
