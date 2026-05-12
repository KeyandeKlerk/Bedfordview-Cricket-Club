import { describe, it, expect } from 'vitest'
import { computeMatchResult, deriveResultText } from '../engine'
import type { InningsState } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInningsState(totalRuns: number, wickets: number, legalBalls: number): InningsState {
  return {
    inningsId: 'inn-1',
    inningsNumber: 1,
    battingSide: 'home',
    totalRuns,
    wickets,
    legalBalls,
    oversDisplay: `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`,
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
}

// ── computeMatchResult — in_progress ─────────────────────────────────────────

describe('computeMatchResult — in_progress', () => {
  const inn1 = makeInningsState(150, 8, 120) // completed first innings

  it('in_progress when inn2 has not reached overs or target', () => {
    const inn2 = makeInningsState(80, 3, 90) // 15 overs bowled, target=151 not met
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('in_progress')
    expect(r.winner).toBeNull()
    expect(r.marginRuns).toBeNull()
    expect(r.marginWickets).toBeNull()
  })

  it('in_progress at start of second innings (0 balls)', () => {
    const inn2 = makeInningsState(0, 0, 0)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('in_progress')
  })

  it('in_progress with 9 wickets but overs remaining and target not met', () => {
    const inn2 = makeInningsState(100, 9, 60) // 10 overs, need 51 more
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('in_progress')
  })

  it('in_progress when target is 1 run away with overs remaining', () => {
    const inn2 = makeInningsState(149, 4, 60) // one run short of target 151... wait, target = inn1Runs+1 = 151, inn2=149 short
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('in_progress')
  })
})

// ── computeMatchResult — team2 wins (chase complete) ─────────────────────────

describe('computeMatchResult — team2 wins', () => {
  const inn1 = makeInningsState(150, 10, 120)

  it('team2 wins by 10 wickets (no wickets lost)', () => {
    const inn2 = makeInningsState(151, 0, 50)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('complete')
    expect(r.winner).toBe('team2')
    expect(r.marginWickets).toBe(10)
    expect(r.marginRuns).toBeNull()
  })

  it('team2 wins by 5 wickets (5 wickets lost)', () => {
    const inn2 = makeInningsState(151, 5, 80)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team2')
    expect(r.marginWickets).toBe(5)
  })

  it('team2 wins by 1 wicket (last pair gets the run)', () => {
    const inn2 = makeInningsState(151, 9, 118)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team2')
    expect(r.marginWickets).toBe(1)
  })

  it('team2 wins when target is exactly met (inn2.totalRuns = inn1.totalRuns + 1)', () => {
    const inn2 = makeInningsState(151, 3, 100)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team2')
    expect(r.marginWickets).toBe(7)
  })

  it('team2 wins with overs to spare (before all overs bowled)', () => {
    const inn2 = makeInningsState(200, 2, 60) // 10 overs, chase of 151 — well beyond
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team2')
  })
})

// ── computeMatchResult — team1 wins ──────────────────────────────────────────

describe('computeMatchResult — team1 wins', () => {
  const inn1 = makeInningsState(200, 7, 120)

  it('team1 wins when inn2 all out below target', () => {
    const inn2 = makeInningsState(150, 10, 80)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('complete')
    expect(r.winner).toBe('team1')
    expect(r.marginRuns).toBe(50)
    expect(r.marginWickets).toBeNull()
  })

  it('team1 wins when overs complete but target not reached', () => {
    const inn2 = makeInningsState(190, 3, 120)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team1')
    expect(r.marginRuns).toBe(10)
  })

  it('team1 wins by 1 run (closest possible margin)', () => {
    const inn2 = makeInningsState(199, 10, 119)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team1')
    expect(r.marginRuns).toBe(1)
  })

  it('team1 wins by 50 runs', () => {
    const inn2 = makeInningsState(150, 10, 100)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.marginRuns).toBe(50)
  })
})

// ── computeMatchResult — tie ──────────────────────────────────────────────────

describe('computeMatchResult — tie', () => {
  const inn1 = makeInningsState(100, 8, 120)

  it('tie when overs complete at equal scores', () => {
    const inn2 = makeInningsState(100, 4, 120)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.status).toBe('complete')
    expect(r.winner).toBe('tie')
    expect(r.marginRuns).toBeNull()
    expect(r.marginWickets).toBeNull()
  })

  it('tie when inn2 all out for same score as inn1', () => {
    const inn2 = makeInningsState(100, 10, 95)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('tie')
  })

  it('NOT a tie when inn2 scores one less (team1 wins by 1)', () => {
    const inn2 = makeInningsState(99, 10, 110)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team1')
    expect(r.marginRuns).toBe(1)
  })

  it('NOT a tie when inn2 scores one more (team2 wins)', () => {
    const inn2 = makeInningsState(101, 5, 90)
    const r = computeMatchResult(inn1, inn2, 20)
    expect(r.winner).toBe('team2')
  })
})

// ── computeMatchResult — margin exclusivity ───────────────────────────────────

describe('computeMatchResult — margin field exclusivity', () => {
  const inn1 = makeInningsState(100, 10, 120)

  it('team2 win: marginRuns is null, marginWickets is a number', () => {
    const r = computeMatchResult(inn1, makeInningsState(101, 3, 80), 20)
    expect(r.marginRuns).toBeNull()
    expect(r.marginWickets).toBeTypeOf('number')
  })

  it('team1 win: marginWickets is null, marginRuns is a number', () => {
    const r = computeMatchResult(inn1, makeInningsState(80, 10, 100), 20)
    expect(r.marginWickets).toBeNull()
    expect(r.marginRuns).toBeTypeOf('number')
  })

  it('tie: both margins are null', () => {
    const r = computeMatchResult(inn1, makeInningsState(100, 5, 120), 20)
    expect(r.marginRuns).toBeNull()
    expect(r.marginWickets).toBeNull()
  })

  it('in_progress: both margins are null', () => {
    const r = computeMatchResult(inn1, makeInningsState(50, 2, 60), 20)
    expect(r.marginRuns).toBeNull()
    expect(r.marginWickets).toBeNull()
  })
})

// ── deriveResultText — BCC batted first (set target) ─────────────────────────

describe('deriveResultText — BCC batted first (bccBattedSecond=false)', () => {
  it('BCC won by 50 runs', () => {
    expect(deriveResultText(200, 150, 10, false)).toBe('BCC won by 50 runs')
  })

  it('BCC won by 1 run — singular "run"', () => {
    expect(deriveResultText(100, 99, 10, false)).toBe('BCC won by 1 run')
  })

  it('BCC won by 2 runs — plural "runs"', () => {
    expect(deriveResultText(100, 98, 10, false)).toBe('BCC won by 2 runs')
  })

  it('BCC lost by 6 wickets (opponent chased: inn2 >= target)', () => {
    // inn1=100, inn2=101, inn2Wickets=4 → 10-4=6 wickets remaining → opponent won by 6
    expect(deriveResultText(100, 101, 4, false)).toBe('BCC lost by 6 wickets')
  })

  it('BCC lost by 1 wicket — singular "wicket"', () => {
    // inn2Wickets=9 → 10-9=1 wicket remaining
    expect(deriveResultText(100, 101, 9, false)).toBe('BCC lost by 1 wicket')
  })

  it('BCC lost by 10 wickets', () => {
    expect(deriveResultText(100, 101, 0, false)).toBe('BCC lost by 10 wickets')
  })
})

// ── deriveResultText — BCC batted second (chasing) ───────────────────────────

describe('deriveResultText — BCC batted second (bccBattedSecond=true)', () => {
  it('BCC won by 4 wickets (BCC chased successfully)', () => {
    // inn1=150, inn2=151, inn2Wickets=6 → 10-6=4 wickets remaining
    expect(deriveResultText(150, 151, 6, true)).toBe('BCC won by 4 wickets')
  })

  it('BCC won by 1 wicket — singular', () => {
    expect(deriveResultText(150, 151, 9, true)).toBe('BCC won by 1 wicket')
  })

  it('BCC won by 10 wickets', () => {
    expect(deriveResultText(150, 151, 0, true)).toBe('BCC won by 10 wickets')
  })

  it('BCC lost by 30 runs (BCC failed chase)', () => {
    expect(deriveResultText(200, 170, 10, true)).toBe('BCC lost by 30 runs')
  })

  it('BCC lost by 1 run — singular', () => {
    expect(deriveResultText(100, 99, 10, true)).toBe('BCC lost by 1 run')
  })

  it('BCC lost by 2 runs — plural', () => {
    expect(deriveResultText(100, 98, 10, true)).toBe('BCC lost by 2 runs')
  })
})

// ── deriveResultText — tie ────────────────────────────────────────────────────

describe('deriveResultText — tie', () => {
  it('returns "Match tied" when inn2Runs === inn1Runs (BCC batted first)', () => {
    expect(deriveResultText(100, 100, 8, false)).toBe('Match tied')
  })

  it('returns "Match tied" when inn2Runs === inn1Runs (BCC batted second)', () => {
    expect(deriveResultText(100, 100, 8, true)).toBe('Match tied')
  })
})

// ── deriveResultText — target boundary conditions ─────────────────────────────

describe('deriveResultText — target boundary conditions', () => {
  it('inn2Runs === inn1Runs is a tie, not a win (target = inn1Runs + 1)', () => {
    // Target is 101. inn2Runs=100 does not reach 101 → tie, not win.
    expect(deriveResultText(100, 100, 5, true)).toBe('Match tied')
  })

  it('inn2Runs === inn1Runs + 1 is a chase win (exactly meets target)', () => {
    // Target is 101. inn2Runs=101 meets target → chase win.
    expect(deriveResultText(100, 101, 5, true)).toBe('BCC won by 5 wickets')
  })

  it('inn2Runs one short of inn1Runs is a team1 win by 1 run, not a tie', () => {
    expect(deriveResultText(100, 99, 10, false)).toBe('BCC won by 1 run')
  })
})
