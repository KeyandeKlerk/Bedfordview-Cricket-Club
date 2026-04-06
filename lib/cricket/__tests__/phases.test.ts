/**
 * Tests for detectPhase — the pure function that determines which UI phase
 * the scorer should be in given the current DB state.
 *
 * These tests were written to catch bugs discovered in the innings-transition
 * flow: stale phase detection when innings 2 completes, wrong batting side on
 * reload, etc.
 */

import { describe, it, expect } from 'vitest'
import { detectPhase } from '../phases'
import type { MatchPlayer } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────

function mp(overrides: Partial<MatchPlayer> & { side: 'home' | 'away' }): MatchPlayer {
  return {
    id: `mp-${Math.random()}`,
    match_id: 'm1',
    player_id: null,
    opposition_name: null,
    batting_position: null,
    actual_batting_position: null,
    is_captain: false,
    is_keeper: false,
    is_active: true,
    ...overrides,
  }
}

/** Build a minimal 11-player squad for a side */
function squad(side: 'home' | 'away', withCaptain = true, withKeeper = true): MatchPlayer[] {
  return Array.from({ length: 11 }, (_, i) =>
    mp({
      side,
      is_captain: withCaptain && i === 0,
      is_keeper: withKeeper && i === 1,
    })
  )
}

const OUR_SIDE = 'home' as const
const OPP_SIDE = 'away' as const

// ── Section 1: squad setup phases ────────────────────────────────────────────

describe('detectPhase — squad setup', () => {

  it('1.1 — no BCC players → setup_bcc_xi', () => {
    expect(detectPhase([], null, 0, OUR_SIDE)).toBe('setup_bcc_xi')
  })

  it('1.2 — BCC players but no opposition → setup_opp_xi', () => {
    const players = squad(OUR_SIDE)
    expect(detectPhase(players, null, 0, OUR_SIDE)).toBe('setup_opp_xi')
  })

  it('1.3 — both squads but no captain → captain_keeper', () => {
    const players = [...squad(OUR_SIDE, false, true), ...squad(OPP_SIDE)]
    expect(detectPhase(players, null, 0, OUR_SIDE)).toBe('captain_keeper')
  })

  it('1.4 — both squads but no keeper → captain_keeper', () => {
    const players = [...squad(OUR_SIDE, true, false), ...squad(OPP_SIDE)]
    expect(detectPhase(players, null, 0, OUR_SIDE)).toBe('captain_keeper')
  })

  it('1.5 — both squads, captain + keeper present, no innings → toss', () => {
    const players = [...squad(OUR_SIDE), ...squad(OPP_SIDE)]
    expect(detectPhase(players, null, 0, OUR_SIDE)).toBe('toss')
  })

})

// ── Section 2: innings 1 phases ───────────────────────────────────────────────

describe('detectPhase — innings 1', () => {

  const players = [...squad(OUR_SIDE), ...squad(OPP_SIDE)]

  it('2.1 — innings 1 in_progress, 0 balls → select_openers', () => {
    expect(detectPhase(players, { innings_number: 1, status: 'in_progress' }, 0, OUR_SIDE))
      .toBe('select_openers')
  })

  it('2.2 — innings 1 in_progress, 1+ balls → scoring', () => {
    expect(detectPhase(players, { innings_number: 1, status: 'in_progress' }, 1, OUR_SIDE))
      .toBe('scoring')
  })

  it('2.3 — innings 1 in_progress, many balls → scoring', () => {
    expect(detectPhase(players, { innings_number: 1, status: 'in_progress' }, 120, OUR_SIDE))
      .toBe('scoring')
  })

  it('2.4 — innings 1 pending, 0 balls → select_openers', () => {
    expect(detectPhase(players, { innings_number: 1, status: 'pending' }, 0, OUR_SIDE))
      .toBe('select_openers')
  })

  it('2.5 — innings 1 completed → innings_break (NOT match_complete)', () => {
    expect(detectPhase(players, { innings_number: 1, status: 'completed' }, 120, OUR_SIDE))
      .toBe('innings_break')
  })

  it('2.6 — innings 1 completed with 0 balls (edge) → innings_break', () => {
    expect(detectPhase(players, { innings_number: 1, status: 'completed' }, 0, OUR_SIDE))
      .toBe('innings_break')
  })

})

// ── Section 3: innings 2 phases ────────────────────────────────────────────────

describe('detectPhase — innings 2 (critical: must NOT return innings_break when complete)', () => {

  const players = [...squad(OUR_SIDE), ...squad(OPP_SIDE)]

  it('3.1 — innings 2 in_progress, 0 balls → select_openers (page reload before first ball)', () => {
    expect(detectPhase(players, { innings_number: 2, status: 'in_progress' }, 0, OUR_SIDE))
      .toBe('select_openers')
  })

  it('3.2 — innings 2 in_progress, 1+ balls → scoring', () => {
    expect(detectPhase(players, { innings_number: 2, status: 'in_progress' }, 1, OUR_SIDE))
      .toBe('scoring')
  })

  it('3.3 — innings 2 completed → match_complete (NOT innings_break)', () => {
    // BUG THAT WAS FIXED: previously returned innings_break, re-triggering innings 2 setup
    expect(detectPhase(players, { innings_number: 2, status: 'completed' }, 73, OUR_SIDE))
      .toBe('match_complete')
  })

  it('3.4 — innings 2 pending, 0 balls → select_openers (created but not started)', () => {
    expect(detectPhase(players, { innings_number: 2, status: 'pending' }, 0, OUR_SIDE))
      .toBe('select_openers')
  })

  it('3.5 — innings 2 pending, 1+ balls → scoring (was started before status update)', () => {
    expect(detectPhase(players, { innings_number: 2, status: 'pending' }, 5, OUR_SIDE))
      .toBe('scoring')
  })

  it('3.6 — innings 2 completed with 0 balls → match_complete', () => {
    expect(detectPhase(players, { innings_number: 2, status: 'completed' }, 0, OUR_SIDE))
      .toBe('match_complete')
  })

})

// ── Section 4: our_side = away ────────────────────────────────────────────────

describe('detectPhase — when BCC is the away side', () => {

  it('4.1 — detects BCC players correctly when side=away', () => {
    // BCC is away. If we only have home players, should return setup_bcc_xi (away missing)
    const homePlayers = squad('home')
    expect(detectPhase(homePlayers, null, 0, 'away')).toBe('setup_bcc_xi')
  })

  it('4.2 — detects opp (home) players missing when BCC is away', () => {
    const awayPlayers = squad('away')  // only BCC (away) present
    expect(detectPhase(awayPlayers, null, 0, 'away')).toBe('setup_opp_xi')
  })

  it('4.3 — full flow works correctly when ourSide=away', () => {
    const players = [...squad('home'), ...squad('away')]
    // toss
    expect(detectPhase(players, null, 0, 'away')).toBe('toss')
    // scoring
    expect(detectPhase(players, { innings_number: 1, status: 'in_progress' }, 10, 'away')).toBe('scoring')
    // innings 1 complete
    expect(detectPhase(players, { innings_number: 1, status: 'completed' }, 60, 'away')).toBe('innings_break')
    // innings 2 complete → match_complete, not innings_break
    expect(detectPhase(players, { innings_number: 2, status: 'completed' }, 30, 'away')).toBe('match_complete')
  })

})

// ── Section 5: innings number beyond 2 ────────────────────────────────────────

describe('detectPhase — innings_number edge cases', () => {

  const players = [...squad(OUR_SIDE), ...squad(OPP_SIDE)]

  it('5.1 — innings_number 3 completed → match_complete (>= 2 rule)', () => {
    expect(detectPhase(players, { innings_number: 3, status: 'completed' }, 0, OUR_SIDE))
      .toBe('match_complete')
  })

  it('5.2 — innings_number 3 in_progress → scoring', () => {
    expect(detectPhase(players, { innings_number: 3, status: 'in_progress' }, 12, OUR_SIDE))
      .toBe('scoring')
  })

})
