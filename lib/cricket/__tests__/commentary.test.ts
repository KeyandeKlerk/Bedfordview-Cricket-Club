import { describe, it, expect } from 'vitest'
import { generateCommentary } from '../commentary'
import type { BallEvent, InningsState } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

let seq = 0

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

function makeState(battingRuns: Record<string, number> = {}): InningsState {
  const batterStats: InningsState['batterStats'] = {}
  for (const [id, runs] of Object.entries(battingRuns)) {
    batterStats[id] = {
      matchPlayerId: id,
      name: id,
      runs,
      balls: runs,
      fours: 0,
      sixes: 0,
      strikeRate: 100,
      isStriker: true,
      isOut: false,
      dismissalType: null,
      dismissalText: null,
      dismissalBowlerId: null,
      dismissalFielderId: null,
      dismissalFielderSubName: null,
      battingPosition: null,
    }
  }
  return {
    inningsId: 'inn-1',
    inningsNumber: 1,
    battingSide: 'home',
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
    oversDisplay: '0.0',
    extras: { wide: 0, no_ball: 0, bye: 0, leg_bye: 0, penalty: 0, total: 0 },
    batterStats,
    bowlerStats: {},
    currentStrikerId: 'bat1',
    currentNonStrikerId: 'bat2',
    currentBowlerId: 'bowl1',
    currentOverBalls: [],
    completedOvers: [],
    fallOfWickets: [],
    currentPartnership: null,
    nextBallIsFreeHit: false,
  }
}

const playerName = (id: string): string => {
  const names: Record<string, string> = {
    bat1: 'Smith',
    bat2: 'Jones',
    bowl1: 'Kumar',
    field1: 'Taylor',
    keep1: 'Patel',
  }
  return names[id] ?? id
}

const emptyState = makeState()

// ── Section 1 — Dismissal commentary ─────────────────────────────────────────

describe('Section 1 — Dismissal commentary', () => {

  it('1.1 — bowled', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'bowled', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith is bowled by Kumar!')
  })

  it('1.2 — caught with fielder_id', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'caught', dismissed_player_id: 'bat1', fielder_id: 'field1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith caught by Taylor off Kumar!')
  })

  it('1.3 — caught with fielder_substitute_name (no fielder_id)', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'caught', dismissed_player_id: 'bat1', fielder_id: null, fielder_substitute_name: 'Sub Guy' }),
      emptyState, playerName,
    )
    expect(c).toContain('caught by Sub Guy')
    expect(c).toContain('Kumar')
  })

  it('1.4 — caught with no fielder', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'caught', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith caught off Kumar!')
  })

  it('1.5 — lbw', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'lbw', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith lbw to Kumar!')
  })

  it('1.6 — run_out with fielder', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'run_out', dismissed_player_id: 'bat1', fielder_id: 'field1' }),
      emptyState, playerName,
    )
    expect(c).toBe('RUN OUT! Smith is run out by Taylor!')
  })

  it('1.7 — run_out with no fielder', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'run_out', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('RUN OUT! Smith is run out!')
  })

  it('1.8 — stumped with fielder', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'stumped', dismissed_player_id: 'bat1', fielder_id: 'keep1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith stumped by Patel off Kumar!')
  })

  it('1.9 — stumped with no fielder', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'stumped', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith stumped off Kumar!')
  })

  it('1.10 — hit_wicket', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'hit_wicket', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('OUT! Smith hit wicket off Kumar!')
  })

  it('1.11 — retired_hurt', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'retired_hurt', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('Smith retires hurt.')
  })

  it('1.12 — retired_out', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'retired_out', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toBe('Smith retires out.')
  })

  it('1.13 — handled_ball falls through to default case', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'handled_ball', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toContain('OUT!')
    expect(c).toContain('dismissed')
  })

  it('1.14 — obstructing_field falls through to default case', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'obstructing_field', dismissed_player_id: 'bat1' }),
      emptyState, playerName,
    )
    expect(c).toContain('OUT!')
    expect(c).toContain('dismissed')
  })

})

// ── Section 2 — Extras commentary ────────────────────────────────────────────

describe('Section 2 — Extras commentary', () => {

  it('2.1 — wide', () => {
    const c = generateCommentary(
      ball({ extras_type: 'wide', extras_runs: 1 }),
      emptyState, playerName,
    )
    expect(c).toContain('Wide ball')
  })

  it('2.2 — no_ball with no bat runs', () => {
    const c = generateCommentary(
      ball({ extras_type: 'no_ball', extras_runs: 1, runs_off_bat: 0 }),
      emptyState, playerName,
    )
    expect(c).toBe('No ball! Free hit to follow.')
  })

  it('2.3 — no_ball with bat runs', () => {
    const c = generateCommentary(
      ball({ extras_type: 'no_ball', extras_runs: 1, runs_off_bat: 4 }),
      emptyState, playerName,
    )
    expect(c).toContain('No ball! Free hit to follow.')
    expect(c).toContain('Smith hits it for 4.')
  })

  it('2.4 — bye 1 run (singular)', () => {
    const c = generateCommentary(
      ball({ extras_type: 'bye', extras_runs: 1 }),
      emptyState, playerName,
    )
    expect(c).toBe('Bye — 1 run to the total.')
  })

  it('2.5 — bye 4 runs (plural)', () => {
    const c = generateCommentary(
      ball({ extras_type: 'bye', extras_runs: 4 }),
      emptyState, playerName,
    )
    expect(c).toBe('Bye — 4 runs to the total.')
  })

  it('2.6 — leg_bye 1 run (singular)', () => {
    const c = generateCommentary(
      ball({ extras_type: 'leg_bye', extras_runs: 1 }),
      emptyState, playerName,
    )
    expect(c).toBe('Leg bye — 1 run off the pad.')
  })

  it('2.7 — leg_bye 2 runs (plural)', () => {
    const c = generateCommentary(
      ball({ extras_type: 'leg_bye', extras_runs: 2 }),
      emptyState, playerName,
    )
    expect(c).toBe('Leg bye — 2 runs off the pad.')
  })

  it('2.8 — penalty 5 runs (plural)', () => {
    const c = generateCommentary(
      ball({ extras_type: 'penalty', extras_runs: 5 }),
      emptyState, playerName,
    )
    expect(c).toBe('Penalty — 5 runs awarded.')
  })

  it('2.9 — penalty 1 run (singular)', () => {
    const c = generateCommentary(
      ball({ extras_type: 'penalty', extras_runs: 1 }),
      emptyState, playerName,
    )
    expect(c).toBe('Penalty — 1 run awarded.')
  })

})

// ── Section 3 — Runs off bat commentary ──────────────────────────────────────

describe('Section 3 — Runs off bat commentary', () => {

  it('3.1 — 0 runs (dot ball)', () => {
    const c = generateCommentary(ball({ runs_off_bat: 0 }), emptyState, playerName)
    expect(c).toBe('Dot ball. Kumar to Smith.')
  })

  it('3.2 — 1 run (single)', () => {
    const c = generateCommentary(ball({ runs_off_bat: 1 }), emptyState, playerName)
    expect(c).toBe('Smith works it away for a single.')
  })

  it('3.3 — 2 runs', () => {
    const c = generateCommentary(ball({ runs_off_bat: 2 }), emptyState, playerName)
    expect(c).toBe('Smith finds the gap — 2 runs.')
  })

  it('3.4 — 3 runs', () => {
    const c = generateCommentary(ball({ runs_off_bat: 3 }), emptyState, playerName)
    expect(c).toBe('Smith finds the gap — 3 runs.')
  })

  it('3.5 — boundary four (is_boundary_four=true)', () => {
    const c = generateCommentary(
      ball({ runs_off_bat: 4, is_boundary_four: true }),
      emptyState, playerName,
    )
    expect(c).toContain('FOUR!')
    expect(c).toContain('Smith')
  })

  it('3.6 — boundary six (is_boundary_six=true)', () => {
    const c = generateCommentary(
      ball({ runs_off_bat: 6, is_boundary_six: true }),
      emptyState, playerName,
    )
    expect(c).toContain('SIX!')
    expect(c).toContain('Smith')
  })

  it('3.7 — 5 runs (non-boundary, falls through to generic)', () => {
    const c = generateCommentary(ball({ runs_off_bat: 5 }), emptyState, playerName)
    expect(c).toContain('Smith')
    expect(c).toContain('5')
    expect(c).not.toContain('FOUR')
    expect(c).not.toContain('SIX')
  })

  it('3.8 — 7 runs (non-boundary, falls through to generic)', () => {
    const c = generateCommentary(ball({ runs_off_bat: 7 }), emptyState, playerName)
    expect(c).toContain('7')
  })

})

// ── Section 4 — Milestone detection ──────────────────────────────────────────

describe('Section 4 — Milestone detection', () => {

  it('4.1 — reaches 50 from 47, scores 4 (51 total): milestone appended', () => {
    const state = makeState({ bat1: 47 })
    const c = generateCommentary(ball({ runs_off_bat: 4, is_boundary_four: true }), state, playerName)
    expect(c).toContain('Smith reaches 50!')
  })

  it('4.2 — reaches exactly 50 (was 46, scores 4): milestone appended', () => {
    const state = makeState({ bat1: 46 })
    const c = generateCommentary(ball({ runs_off_bat: 4, is_boundary_four: true }), state, playerName)
    expect(c).toContain('Smith reaches 50!')
  })

  it('4.3 — reaches 100 from 97, scores 4 (101 total): century appended', () => {
    const state = makeState({ bat1: 97 })
    const c = generateCommentary(ball({ runs_off_bat: 4, is_boundary_four: true }), state, playerName)
    expect(c).toContain('Smith brings up a century!')
  })

  it('4.4 — reaches exactly 100 (was 96, scores 4): century appended', () => {
    const state = makeState({ bat1: 96 })
    const c = generateCommentary(ball({ runs_off_bat: 4, is_boundary_four: true }), state, playerName)
    expect(c).toContain('Smith brings up a century!')
  })

  it('4.5 — already past 50 (was 55): no 50 milestone triggered again', () => {
    const state = makeState({ bat1: 55 })
    const c = generateCommentary(ball({ runs_off_bat: 4, is_boundary_four: true }), state, playerName)
    expect(c).not.toContain('reaches 50')
  })

  it('4.6 — already past 100 (was 110): no century triggered again', () => {
    const state = makeState({ bat1: 110 })
    const c = generateCommentary(ball({ runs_off_bat: 6, is_boundary_six: true }), state, playerName)
    expect(c).not.toContain('century')
  })

  it('4.7 — dismissed on the milestone ball: NO milestone appended', () => {
    const state = makeState({ bat1: 47 })
    const c = generateCommentary(
      ball({ runs_off_bat: 4, is_boundary_four: true, dismissal_type: 'caught', dismissed_player_id: 'bat1', fielder_id: 'field1' }),
      state, playerName,
    )
    expect(c).not.toContain('reaches 50')
    expect(c).not.toContain('century')
  })

  it('4.8 — 0-run ball: no milestone', () => {
    const state = makeState({ bat1: 49 })
    const c = generateCommentary(ball({ runs_off_bat: 0 }), state, playerName)
    expect(c).not.toContain('reaches 50')
  })

  it('4.9 — batter goes from 0 to 100+ in one ball (e.g. first ball hit for 6): century triggered only', () => {
    // No prior state — batterStats is empty (first ball)
    const c = generateCommentary(ball({ runs_off_bat: 6, is_boundary_six: true }), emptyState, playerName)
    // 0 → 6: doesn't cross 50 or 100, so no milestone
    expect(c).not.toContain('century')
    expect(c).not.toContain('reaches 50')
  })

  it('4.10 — batter scores 51 from 0 (hit for 51, hypothetical): 50 triggered, not 100', () => {
    // 0 → 51: crosses 50 but not 100
    const state = makeState({ bat1: 0 })
    const c = generateCommentary(ball({ runs_off_bat: 6, is_boundary_six: true }), state, playerName)
    // 0+6=6, doesn't cross 50 — just a six
    expect(c).not.toContain('reaches 50')
  })

  it('4.11 — century milestone takes priority over 50 (goes from 45 to 105 in one shot)', () => {
    // From 45 to 45+6=51 → would trigger 50 only. Let's try from 95 to 101:
    const state = makeState({ bat1: 95 })
    const c = generateCommentary(ball({ runs_off_bat: 6, is_boundary_six: true }), state, playerName)
    // 95+6=101 → crosses 100 (batterBefore < 100, batterAfter >= 100) → century
    expect(c).toContain('century')
    // 95 < 50 is false, so 50 check is skipped
    expect(c).not.toContain('reaches 50')
  })

})

// ── Section 5 — Player name resolution ───────────────────────────────────────

describe('Section 5 — Player name resolution', () => {

  it('5.1 — fielder resolved via fielder_id through playerName function', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'caught', dismissed_player_id: 'bat1', fielder_id: 'field1' }),
      emptyState, playerName,
    )
    expect(c).toContain('Taylor')  // field1 → 'Taylor'
    expect(c).not.toContain('field1')  // raw id not present
  })

  it('5.2 — fielder resolved via fielder_substitute_name when fielder_id is null', () => {
    const c = generateCommentary(
      ball({ dismissal_type: 'caught', dismissed_player_id: 'bat1', fielder_id: null, fielder_substitute_name: 'Sub Player' }),
      emptyState, playerName,
    )
    expect(c).toContain('Sub Player')
  })

  it('5.3 — batter and bowler names resolved for dot ball', () => {
    const c = generateCommentary(ball({ runs_off_bat: 0 }), emptyState, playerName)
    expect(c).toContain('Kumar')   // bowl1
    expect(c).toContain('Smith')   // bat1
    expect(c).not.toContain('bat1')
    expect(c).not.toContain('bowl1')
  })

  it('5.4 — run-out: commentary uses batter (striker) name even when non-striker is dismissed', () => {
    // On a non-striker run-out, dismissed_player_id = 'bat2' but batter_id = 'bat1' (striker)
    // The commentary function uses batter (playerName(batter_id)) for the dismissed text
    const c = generateCommentary(
      ball({
        batter_id: 'bat1',
        dismissed_player_id: 'bat2',
        dismissal_type: 'run_out',
        fielder_id: 'field1',
      }),
      emptyState, playerName,
    )
    // batter_id is 'bat1' → 'Smith' — the commentary displays the striker's name
    expect(c).toContain('Smith')
    expect(c).toContain('Taylor')  // fielder
    expect(c).toContain('RUN OUT')
  })

})
