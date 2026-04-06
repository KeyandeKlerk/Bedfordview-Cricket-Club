/**
 * TDD — Full game cycle tests
 *
 * Functions under test (not yet implemented — all tests below fail on first run):
 *
 *   isNaturalEnd(state, oversPerInnings, target?)
 *     Extended to accept an optional target.  When target is provided and
 *     state.totalRuns >= target the innings ends naturally (chase complete).
 *     Existing 2-arg behaviour is unchanged.
 *
 *   computeMatchResult(inn1, inn2, oversPerInnings) → MatchResult
 *     Pure function that derives the match outcome from two completed innings
 *     states and the overs allocation.
 *
 * Structure
 *   Section 1 — player/squad helper logic
 *   Section 2 — full first innings (overs complete, all-out, declared)
 *   Section 3 — target derivation
 *   Section 4 — isNaturalEnd extended with target (second-innings natural end)
 *   Section 5 — second innings: team 2 wins (chase complete)
 *   Section 6 — second innings: team 1 wins (team 2 falls short)
 *   Section 7 — second innings: tie
 *   Section 8 — computeMatchResult full scenarios
 *   Section 9 — manual end in second innings
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { computeInningsState, isNaturalEnd, computeMatchResult } from '../engine'
import type { BallEvent, InningsState } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// ── Match participants ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// BCC (home) — batting match_player ids
const BCC = {
  bat: ['h1','h2','h3','h4','h5','h6','h7','h8','h9','h10','h11'],
  bowl: ['hb1','hb2','hb3','hb4','hb5'],   // their bowlers when fielding
}

// Opposition (away) — batting match_player ids
const OPP = {
  bat: ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11'],
  bowl: ['ab1','ab2','ab3','ab4','ab5'],
}

const ALL_NAMES = new Map<string, string>([
  ...BCC.bat.map((id, i) => [id, `BCC Bat ${i + 1}`] as [string, string]),
  ...BCC.bowl.map((id, i) => [id, `BCC Bowl ${i + 1}`] as [string, string]),
  ...OPP.bat.map((id, i) => [id, `Opp Bat ${i + 1}`] as [string, string]),
  ...OPP.bowl.map((id, i) => [id, `Opp Bowl ${i + 1}`] as [string, string]),
])

// ─────────────────────────────────────────────────────────────────────────────
// ── Ball builders ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

let seq = 0
beforeEach(() => { seq = 0 })

function b(overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `b${++seq}`, innings_id: 'inn', match_id: 'm',
    sequence_number: seq, over_number: 0, ball_in_over: 0,
    batter_id: 'h1', non_striker_id: 'h2', bowler_id: 'ab1',
    runs_off_bat: 0, extras_type: null, extras_runs: 0,
    is_boundary_four: false, is_boundary_six: false,
    dismissal_type: null, dismissed_player_id: null,
    fielder_id: null, fielder_substitute_name: null,
    commentary: null, created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Build a full innings from a simple per-over run spec.
 *
 * @param batting   - array of batting player ids (positional, index 0 = opener 1)
 * @param bowling   - cycling list of bowler ids
 * @param overSpecs - one entry per over: { runs, wide?, wicket? }
 *                    runs are distributed as singles (or 4s/6s when specified).
 *                    wicket=true means the facing batter is dismissed on ball 1.
 *
 * Returns the ball array and the final batting index (who came in last).
 */
function buildInnings(
  batting: string[],
  bowling: string[],
  overSpecs: Array<{ runs: number; wicket?: boolean; wide?: boolean }>,
  inningsId = 'inn'
): BallEvent[] {
  const balls: BallEvent[] = []
  let batIdx = 0   // current striker index in batting array
  let nonIdx = 1   // current non-striker index
  let legalBallCount = 0

  for (let ov = 0; ov < overSpecs.length; ov++) {
    const spec = overSpecs[ov]
    const bowler = bowling[ov % bowling.length]
    let legalInOver = 0
    let ballInOver = 0

    // Optional wide before the over's runs
    if (spec.wide) {
      balls.push(b({
        innings_id: inningsId, over_number: ov, ball_in_over: ballInOver++,
        batter_id: batting[batIdx], non_striker_id: batting[nonIdx],
        bowler_id: bowler, extras_type: 'wide', extras_runs: 1,
      }))
    }

    // Optional wicket on ball 1 of this over
    if (spec.wicket && batIdx + 1 < batting.length) {
      balls.push(b({
        innings_id: inningsId, over_number: ov, ball_in_over: ballInOver++,
        batter_id: batting[batIdx], non_striker_id: batting[nonIdx],
        bowler_id: bowler, dismissal_type: 'bowled',
        dismissed_player_id: batting[batIdx],
      }))
      legalInOver++
      legalBallCount++
      const next = Math.max(batIdx, nonIdx) + 1
      // Use non-striker as fallback when no new batter exists (10th wicket)
      batIdx = next < batting.length ? next : nonIdx
    }

    // Distribute runs across the remaining 5 (or 6 if no wicket) legal balls
    const legalNeeded = 6 - legalInOver
    let runsLeft = spec.runs

    for (let i = 0; i < legalNeeded; i++) {
      let r = 0
      if (i === legalNeeded - 1) {
        // last ball of over: dump remaining runs here
        r = runsLeft
      } else if (runsLeft >= 6) {
        r = 6; runsLeft -= 6
      } else if (runsLeft >= 4) {
        r = 4; runsLeft -= 4
      } else if (runsLeft > 0) {
        r = 1; runsLeft -= 1
      }

      const isFour = r === 4
      const isSix  = r === 6

      balls.push(b({
        innings_id: inningsId, over_number: ov, ball_in_over: ballInOver++,
        batter_id: batting[batIdx], non_striker_id: batting[nonIdx],
        bowler_id: bowler, runs_off_bat: r,
        is_boundary_four: isFour, is_boundary_six: isSix,
      }))
      legalBallCount++
      legalInOver++

      // Rotate strike on odd runs
      if (r % 2 === 1) { [batIdx, nonIdx] = [nonIdx, batIdx] }
    }

    // End-of-over swap
    ;[batIdx, nonIdx] = [nonIdx, batIdx]
  }

  return balls
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Squad / player selection helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 1 — Squad selection and eligibility', () => {

  it('1.1 — squad of 11 batting players is complete', () => {
    expect(BCC.bat).toHaveLength(11)
    expect(OPP.bat).toHaveLength(11)
  })

  it('1.2 — all player ids are unique across both squads', () => {
    const all = [...BCC.bat, ...BCC.bowl, ...OPP.bat, ...OPP.bowl]
    expect(new Set(all).size).toBe(all.length)
  })

  it('1.3 — after first ball both openers appear in batterStats', () => {
    const balls = [b({ batter_id: 'h1', non_striker_id: 'h2', bowler_id: 'ab1' })]
    const state = computeInningsState(balls, ALL_NAMES)
    expect(state.batterStats['h1']).toBeDefined()
    expect(state.batterStats['h2']).toBeDefined()
    expect(state.batterStats['h1'].isOut).toBe(false)
    expect(state.batterStats['h2'].isOut).toBe(false)
  })

  it('1.4 — players who have not batted are absent from batterStats', () => {
    const balls = [b({ batter_id: 'h1', non_striker_id: 'h2', bowler_id: 'ab1' })]
    const state = computeInningsState(balls, ALL_NAMES)
    // h3 through h11 have not been at the crease
    for (const id of BCC.bat.slice(2)) {
      expect(state.batterStats[id]).toBeUndefined()
    }
  })

  it('1.5 — new batter eligible filter: only returns players not yet in batterStats', () => {
    const balls = [
      b({ batter_id: 'h1', non_striker_id: 'h2', bowler_id: 'ab1', dismissal_type: 'bowled', dismissed_player_id: 'h1' }),
    ]
    const state = computeInningsState(balls, ALL_NAMES)

    // eligible = not in batterStats at all
    const eligible = BCC.bat.filter(id => !state.batterStats[id])
    expect(eligible).not.toContain('h1')   // dismissed — in batterStats
    expect(eligible).not.toContain('h2')   // at crease — in batterStats
    expect(eligible).toContain('h3')       // hasn't batted
    expect(eligible).toHaveLength(9)       // h3..h11
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Full first innings
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 2 — Full first innings', () => {

  it('2.1 — 20 overs complete: correct runs, legalBalls=120, isNaturalEnd=true', () => {
    // 20 overs, 8 runs per over = 160 total, 0 wickets
    const specs = Array.from({ length: 20 }, () => ({ runs: 8 }))
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const state = computeInningsState(balls, ALL_NAMES)

    expect(state.legalBalls).toBe(120)
    expect(state.totalRuns).toBe(160)
    expect(state.wickets).toBe(0)
    expect(isNaturalEnd(state, 20)).toBe(true)
  })

  it('2.2 — all out (10 wickets): isNaturalEnd=true regardless of overs left', () => {
    // 10 wickets in 10 balls (one per ball, each batter faces one ball)
    const specs = Array.from({ length: 10 }, (_, i) => ({
      runs: 0,
      wicket: true,
    }))
    // Use only 10 overs allocation
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const state = computeInningsState(balls, ALL_NAMES)

    expect(state.wickets).toBe(10)
    expect(isNaturalEnd(state, 20)).toBe(true)
  })

  it('2.3 — realistic innings: 156/4 off 20 overs', () => {
    // Mix: some quiet overs, some big overs, 4 wickets spread through
    const specs = [
      { runs: 6 },                    // ov 0:  6
      { runs: 8 },                    // ov 1: 14
      { runs: 4,  wicket: true },     // ov 2: 18 (wkt 1)
      { runs: 12 },                   // ov 3: 30
      { runs: 10 },                   // ov 4: 40
      { runs: 6,  wicket: true },     // ov 5: 46 (wkt 2)
      { runs: 8 },                    // ov 6: 54
      { runs: 14 },                   // ov 7: 68
      { runs: 6 },                    // ov 8: 74
      { runs: 10 },                   // ov 9: 84
      { runs: 8 },                    // ov10: 92
      { runs: 10, wicket: true },     // ov11:102 (wkt 3)
      { runs: 6 },                    // ov12:108
      { runs: 8 },                    // ov13:116
      { runs: 6 },                    // ov14:122
      { runs: 10 },                   // ov15:132
      { runs: 4,  wicket: true },     // ov16:136 (wkt 4)
      { runs: 6 },                    // ov17:142
      { runs: 8 },                    // ov18:150
      { runs: 6 },                    // ov19:156
    ]
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const state = computeInningsState(balls, ALL_NAMES)

    expect(state.legalBalls).toBe(120)
    expect(state.wickets).toBe(4)
    expect(state.totalRuns).toBe(156)
    expect(isNaturalEnd(state, 20)).toBe(true)
  })

  it('2.4 — declared at 6 overs: isNaturalEnd=false (manual end)', () => {
    const specs = Array.from({ length: 6 }, () => ({ runs: 10 }))
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const state = computeInningsState(balls, ALL_NAMES)

    expect(state.legalBalls).toBe(36)
    expect(state.totalRuns).toBe(60)
    expect(isNaturalEnd(state, 20)).toBe(false)   // only 6 overs, not 20
    // Scorer can still end manually — isNaturalEnd returning false doesn't block it
  })

  it('2.5 — innings score is sum of batter runs + extras', () => {
    const specs = [
      { runs: 10, wide: true },  // 10 bat runs + 1 wide extra
      { runs: 6 },
    ]
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const state = computeInningsState(balls, ALL_NAMES)

    const batterTotal = Object.values(state.batterStats).reduce((s, b) => s + b.runs, 0)
    expect(state.totalRuns).toBe(batterTotal + state.extras.total)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Target derivation
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 3 — Target derivation', () => {

  it('3.1 — target is inn1.totalRuns + 1', () => {
    const specs = Array.from({ length: 20 }, () => ({ runs: 8 }))
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const inn1 = computeInningsState(balls, ALL_NAMES)

    const target = inn1.totalRuns + 1
    expect(target).toBe(161)
  })

  it('3.2 — target is correct for a low-scoring innings', () => {
    const specs = Array.from({ length: 10 }, (_, i) => ({ runs: 0, wicket: true }))
    const balls = buildInnings(BCC.bat, OPP.bowl, specs)
    const inn1 = computeInningsState(balls, ALL_NAMES)

    const target = inn1.totalRuns + 1
    expect(target).toBeGreaterThan(inn1.totalRuns)
    expect(target).toBe(inn1.totalRuns + 1)
  })

  it('3.3 — inn2 needs to score target runs to win, not just match inn1', () => {
    // Scoring inn1.totalRuns exactly = tie; scoring +1 = win
    const inn1Runs = 150
    const target = inn1Runs + 1   // 151 to win

    // 150 is not a win — it's a tie
    expect(150 >= target).toBe(false)
    // 151 is a win
    expect(151 >= target).toBe(true)
    // 152 is also a win
    expect(152 >= target).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — isNaturalEnd extended: target parameter
// [FAILS until isNaturalEnd(state, overs, target?) is implemented]
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 4 — isNaturalEnd with target (2nd innings) [FAILS until implemented]', () => {

  it('4.1 — returns true when target is chased within overs', () => {
    // Inn1 scored 80. Target = 81. Inn2 scores 85 in 10 overs.
    const specs = Array.from({ length: 10 }, (_, i) => ({ runs: i < 5 ? 6 : 10 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(inn2.totalRuns).toBe(80)  // 5*6 + 5*10 = 30+50 = 80... hmm let me recalculate
    // 10 overs: 5 overs at 6 = 30, 5 overs at 10 = 50 → total = 80
    // Actually I want > 80, let me just use a direct check
    const target = 75   // inn2 scores 80, which exceeds 75
    expect(inn2.totalRuns).toBeGreaterThanOrEqual(target)
    expect(isNaturalEnd(inn2, 20, target)).toBe(true)   // FAILS: function ignores target
  })

  it('4.2 — returns true when target chased with overs to spare', () => {
    // Score 120 in 12 overs, target = 100
    const specs = Array.from({ length: 12 }, () => ({ runs: 10 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(inn2.totalRuns).toBe(120)
    expect(inn2.legalBalls).toBe(72)
    expect(isNaturalEnd(inn2, 20, 100)).toBe(true)   // FAILS
  })

  it('4.3 — returns false when target not yet reached and overs remain', () => {
    // Score 50 in 8 overs, target = 100
    const specs = Array.from({ length: 8 }, () => ({ runs: 6 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(inn2.totalRuns).toBe(48)
    expect(isNaturalEnd(inn2, 20, 100)).toBe(false)   // should already pass (no target chased, no natural end)
  })

  it('4.4 — target exactly reached on last ball: isNaturalEnd=true', () => {
    // 20 overs complete AND target reached — both conditions true
    const specs = Array.from({ length: 20 }, () => ({ runs: 8 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(inn2.legalBalls).toBe(120)
    // Target = inn2.totalRuns (reached exactly on last ball)
    expect(isNaturalEnd(inn2, 20, inn2.totalRuns)).toBe(true)   // FAILS without target support
  })

  it('4.5 — overs complete but target not reached: isNaturalEnd=true (overs exhausted)', () => {
    // Team 2 faces all 20 overs but never reaches target — overs end is natural end
    const specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(inn2.legalBalls).toBe(120)
    // Target 200 — not reached, but overs done
    expect(isNaturalEnd(inn2, 20, 200)).toBe(true)   // true via overs exhausted
  })

  it('4.6 — null target: behaviour identical to 2-arg call', () => {
    const specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(isNaturalEnd(inn2, 20, null)).toBe(isNaturalEnd(inn2, 20))   // FAILS until null handled
  })

  it('4.7 — undefined target: behaviour identical to 2-arg call', () => {
    const specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const balls = buildInnings(OPP.bat, BCC.bowl, specs, 'inn2')
    const inn2 = computeInningsState(balls, ALL_NAMES)

    expect(isNaturalEnd(inn2, 20, undefined)).toBe(isNaturalEnd(inn2, 20))
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Second innings: team 2 wins (chase complete)
// [FAILS until computeMatchResult is implemented]
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 5 — Team 2 chases down target [FAILS until implemented]', () => {

  it('5.1 — team 2 wins with 8 wickets in hand', () => {
    // Inn1: BCC 160/0 in 20 overs. Target = 161.
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 8 }))
    const inn1Balls = buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1')
    const inn1 = computeInningsState(inn1Balls, ALL_NAMES)
    expect(inn1.totalRuns).toBe(160)

    const target = inn1.totalRuns + 1   // 161

    // Inn2: Opp chases — 2 wickets early then 161+ in remaining overs
    const inn2Specs = [
      { runs: 0, wicket: true },   // wkt 1 in over 0
      { runs: 0, wicket: true },   // wkt 2 in over 1
      ...Array.from({ length: 18 }, (_, i) => ({ runs: i < 9 ? 9 : 10 })),  // 9*9+9*10=171
    ]
    const inn2Balls = buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2')
    const inn2 = computeInningsState(inn2Balls, ALL_NAMES)

    expect(inn2.totalRuns).toBeGreaterThanOrEqual(target)
    expect(isNaturalEnd(inn2, 20, target)).toBe(true)

    const result = computeMatchResult(inn1, inn2, 20)   // FAILS: function doesn't exist
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team2')
    expect(result.marginWickets).toBe(10 - inn2.wickets)
    expect(result.marginRuns).toBeNull()
  })

  it('5.2 — team 2 wins on the last ball (target reached exactly in over 19)', () => {
    // Inn1: 100/0 in 20 overs. Target = 101.
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 5 }))
    const inn1Balls = buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1')
    const inn1 = computeInningsState(inn1Balls, ALL_NAMES)
    expect(inn1.totalRuns).toBe(100)

    const target = 101

    // Inn2: score exactly 101 in 20 overs, 0 wickets
    const inn2Specs = Array.from({ length: 20 }, (_, i) => ({
      runs: i < 19 ? 5 : 6,   // 19 overs of 5 = 95, last over 6 = 101
    }))
    const inn2Balls = buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2')
    const inn2 = computeInningsState(inn2Balls, ALL_NAMES)

    expect(inn2.totalRuns).toBe(101)
    expect(inn2.legalBalls).toBe(120)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team2')
  })

  it('5.3 — team 2 wins with overs to spare (all out after passing target)', () => {
    // Inn1: 60 all out. Target = 61.
    const inn1Specs = Array.from({ length: 10 }, () => ({ runs: 6, wicket: true }))
    const inn1Balls = buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1')
    const inn1 = computeInningsState(inn1Balls, ALL_NAMES)

    const target = inn1.totalRuns + 1

    // Inn2: reaches target in 8 overs, then 2 wickets but still won
    const inn2Specs = [
      ...Array.from({ length: 8 }, () => ({ runs: 10 })),   // 80 > target
      { runs: 0, wicket: true },
      { runs: 0, wicket: true },
    ]
    const inn2Balls = buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2')
    const inn2 = computeInningsState(inn2Balls, ALL_NAMES)

    // isNaturalEnd via target chased OR all overs complete
    expect(isNaturalEnd(inn2, 20, target)).toBe(true)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team2')
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Second innings: team 1 wins (team 2 falls short)
// [FAILS until computeMatchResult is implemented]
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 6 — Team 1 wins (team 2 falls short) [FAILS until implemented]', () => {

  it('6.1 — team 2 all out below target: team 1 wins by X runs', () => {
    // Inn1: 200/3 in 20 overs. Target = 201.
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 10 }))
    const inn1Balls = buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1')
    const inn1 = computeInningsState(inn1Balls, ALL_NAMES)
    expect(inn1.totalRuns).toBe(200)

    const target = 201

    // Inn2: scores 150 then all out — short by 50 runs
    const inn2Specs = [
      ...Array.from({ length: 15 }, () => ({ runs: 10 })),  // 150 after 15 overs
      ...Array.from({ length: 5 }, () => ({ runs: 0, wicket: true })),  // 5 more wickets
    ]
    const inn2Balls = buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2')
    const inn2 = computeInningsState(inn2Balls, ALL_NAMES)

    expect(inn2.totalRuns).toBe(150)
    expect(inn2.wickets).toBe(5)

    const result = computeMatchResult(inn1, inn2, 20)   // FAILS
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team1')
    expect(result.marginRuns).toBe(inn1.totalRuns - inn2.totalRuns)   // 50
    expect(result.marginWickets).toBeNull()
  })

  it('6.2 — team 2 overs exhausted below target: team 1 wins by runs', () => {
    // Inn1: 180 in 20 overs. Target = 181.
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 9 }))
    const inn1Balls = buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1')
    const inn1 = computeInningsState(inn1Balls, ALL_NAMES)
    expect(inn1.totalRuns).toBe(180)

    // Inn2: 160/0 in 20 overs — didn't reach 181
    const inn2Specs = Array.from({ length: 20 }, () => ({ runs: 8 }))
    const inn2Balls = buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2')
    const inn2 = computeInningsState(inn2Balls, ALL_NAMES)
    expect(inn2.totalRuns).toBe(160)
    expect(inn2.legalBalls).toBe(120)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team1')
    expect(result.marginRuns).toBe(20)   // 180 - 160
  })

  it('6.3 — result is still in_progress if inn2 overs not complete and target not reached', () => {
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 8 }))
    const inn1Balls = buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1')
    const inn1 = computeInningsState(inn1Balls, ALL_NAMES)

    // Inn2 only 10 overs in
    const inn2Specs = Array.from({ length: 10 }, () => ({ runs: 6 }))
    const inn2Balls = buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2')
    const inn2 = computeInningsState(inn2Balls, ALL_NAMES)

    expect(inn2.legalBalls).toBe(60)
    expect(inn2.totalRuns).toBeLessThan(inn1.totalRuns + 1)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.status).toBe('in_progress')
    expect(result.winner).toBeNull()
  })

  it('6.4 — margin runs = inn1.totalRuns - inn2.totalRuns', () => {
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 10 }))
    const inn1 = computeInningsState(buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1'), ALL_NAMES)

    // Inn2: all out for 130 (70 short)
    const inn2Specs = [
      ...Array.from({ length: 13 }, () => ({ runs: 10 })),
      ...Array.from({ length: 7 }, () => ({ runs: 0, wicket: true })),
    ]
    const inn2 = computeInningsState(buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2'), ALL_NAMES)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.winner).toBe('team1')
    expect(result.marginRuns).toBe(inn1.totalRuns - inn2.totalRuns)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Tie
// [FAILS until computeMatchResult is implemented]
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 7 — Tie [FAILS until implemented]', () => {

  it('7.1 — tie: inn2 exactly matches inn1 score, overs exhausted', () => {
    // Inn1: 120 in 20 overs. Inn2: also 120 in 20 overs.
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const inn1 = computeInningsState(buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1'), ALL_NAMES)
    expect(inn1.totalRuns).toBe(120)

    const inn2Specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const inn2 = computeInningsState(buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2'), ALL_NAMES)
    expect(inn2.totalRuns).toBe(120)
    expect(inn2.legalBalls).toBe(120)

    const result = computeMatchResult(inn1, inn2, 20)   // FAILS
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('tie')
    expect(result.marginRuns).toBeNull()
    expect(result.marginWickets).toBeNull()
  })

  it('7.2 — tie: inn2 exactly matches inn1 score, all out', () => {
    // Inn1: 60 runs, all out.  Inn2: also 60 runs, all out.
    const inn1Specs = [
      ...Array.from({ length: 6 }, () => ({ runs: 10 })),
      ...Array.from({ length: 10 }, () => ({ runs: 0, wicket: true })),
    ]
    const inn1 = computeInningsState(buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1'), ALL_NAMES)

    const inn2Specs = [
      ...Array.from({ length: 6 }, () => ({ runs: 10 })),
      ...Array.from({ length: 10 }, () => ({ runs: 0, wicket: true })),
    ]
    const inn2 = computeInningsState(buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2'), ALL_NAMES)

    expect(inn1.totalRuns).toBe(inn2.totalRuns)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.winner).toBe('tie')
  })

  it('7.3 — NOT a tie when inn2 scores one less', () => {
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const inn1 = computeInningsState(buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1'), ALL_NAMES)

    // Inn2 scores 1 less (119 vs 120)
    const inn2Specs = [
      ...Array.from({ length: 19 }, () => ({ runs: 6 })),  // 114
      { runs: 5 },                                           // 119
    ]
    const inn2 = computeInningsState(buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2'), ALL_NAMES)

    expect(inn2.totalRuns).toBe(119)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.winner).toBe('team1')  // not a tie
    expect(result.marginRuns).toBe(1)
  })

  it('7.4 — NOT a tie when inn2 scores one more (team 2 wins)', () => {
    const inn1Specs = Array.from({ length: 20 }, () => ({ runs: 6 }))
    const inn1 = computeInningsState(buildInnings(BCC.bat, OPP.bowl, inn1Specs, 'inn1'), ALL_NAMES)

    const inn2Specs = [
      ...Array.from({ length: 19 }, () => ({ runs: 6 })),  // 114
      { runs: 7 },                                           // 121 (> 121 target)
    ]
    const inn2 = computeInningsState(buildInnings(OPP.bat, BCC.bowl, inn2Specs, 'inn2'), ALL_NAMES)

    expect(inn2.totalRuns).toBe(121)

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.winner).toBe('team2')  // not a tie
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — Full game cycle end-to-end
// [FAILS until computeMatchResult is implemented]
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 8 — Full game cycle end-to-end', () => {

  it('8.1 — complete 20-over match: BCC wins defending', () => {
    // BCC bat first: 156/4 in 20 overs
    const bccSpecs = [
      { runs: 6 }, { runs: 8 }, { runs: 4, wicket: true }, { runs: 12 }, { runs: 10 },
      { runs: 6, wicket: true }, { runs: 8 }, { runs: 14 }, { runs: 6 }, { runs: 10 },
      { runs: 8 }, { runs: 10, wicket: true }, { runs: 6 }, { runs: 8 }, { runs: 6 },
      { runs: 10 }, { runs: 4, wicket: true }, { runs: 6 }, { runs: 8 }, { runs: 6 },
    ]
    const bccBalls = buildInnings(BCC.bat, OPP.bowl, bccSpecs, 'inn1')
    const bccInn = computeInningsState(bccBalls, ALL_NAMES)

    expect(bccInn.legalBalls).toBe(120)
    expect(bccInn.wickets).toBe(4)
    expect(isNaturalEnd(bccInn, 20)).toBe(true)

    const target = bccInn.totalRuns + 1

    // Opp chase: fall short, all out for ~110
    const oppSpecs = [
      { runs: 8 }, { runs: 6 }, { runs: 4, wicket: true }, { runs: 4 }, { runs: 6 },
      { runs: 0, wicket: true }, { runs: 4 }, { runs: 6 }, { runs: 8 }, { runs: 4 },
      { runs: 6, wicket: true }, { runs: 4 }, { runs: 6 }, { runs: 8 }, { runs: 4 },
      { runs: 0, wicket: true }, { runs: 0, wicket: true }, { runs: 0, wicket: true },
      { runs: 4 }, { runs: 6 },
    ]
    const oppBalls = buildInnings(OPP.bat, BCC.bowl, oppSpecs, 'inn2')
    const oppInn = computeInningsState(oppBalls, ALL_NAMES)

    expect(isNaturalEnd(oppInn, 20, target)).toBe(true)
    expect(oppInn.totalRuns).toBeLessThan(target)

    const result = computeMatchResult(bccInn, oppInn, 20)
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team1')
    expect(result.marginRuns).toBe(bccInn.totalRuns - oppInn.totalRuns)
    expect(result.marginRuns).toBeGreaterThan(0)
  })

  it('8.2 — complete match: opposition wins the chase', () => {
    // BCC all out (10 wickets, 0 runs). Opp chase 1+, win with wickets to spare.
    const bccSpecs = [
      ...Array.from({ length: 10 }, () => ({ runs: 0, wicket: true })),
    ]
    const bccInn = computeInningsState(
      buildInnings(BCC.bat, OPP.bowl, bccSpecs, 'inn1'), ALL_NAMES
    )
    expect(isNaturalEnd(bccInn, 20)).toBe(true)  // all out

    const target = bccInn.totalRuns + 1

    const oppSpecs = Array.from({ length: 12 }, (_, i) => ({ runs: 9 }))
    const oppInn = computeInningsState(
      buildInnings(OPP.bat, BCC.bowl, oppSpecs, 'inn2'), ALL_NAMES
    )

    expect(oppInn.totalRuns).toBeGreaterThanOrEqual(target)
    expect(isNaturalEnd(oppInn, 20, target)).toBe(true)

    const result = computeMatchResult(bccInn, oppInn, 20)
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team2')
    expect(result.marginWickets).toBe(10 - oppInn.wickets)
  })

  it('8.3 — match still in_progress mid second innings', () => {
    const inn1 = computeInningsState(
      buildInnings(BCC.bat, OPP.bowl, Array.from({ length: 20 }, () => ({ runs: 8 })), 'inn1'),
      ALL_NAMES
    )
    // Inn2: only 5 overs in, not chased yet
    const inn2 = computeInningsState(
      buildInnings(OPP.bat, BCC.bowl, Array.from({ length: 5 }, () => ({ runs: 6 })), 'inn2'),
      ALL_NAMES
    )

    const result = computeMatchResult(inn1, inn2, 20)
    expect(result.status).toBe('in_progress')
    expect(result.winner).toBeNull()
    expect(result.marginRuns).toBeNull()
    expect(result.marginWickets).toBeNull()
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — Manual end in second innings
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 9 — Manual end in second innings', () => {

  it('9.1 — isNaturalEnd=false mid-chase means scorer must confirm before ending', () => {
    const inn1 = computeInningsState(
      buildInnings(BCC.bat, OPP.bowl, Array.from({ length: 20 }, () => ({ runs: 8 })), 'inn1'),
      ALL_NAMES
    )
    const target = inn1.totalRuns + 1

    // 8 overs in, 50 runs, target 161
    const inn2 = computeInningsState(
      buildInnings(OPP.bat, BCC.bowl, Array.from({ length: 8 }, () => ({ runs: 6 })), 'inn2'),
      ALL_NAMES
    )

    expect(isNaturalEnd(inn2, 20, target)).toBe(false)
    // The scorer CAN still end it — isNaturalEnd=false just means confirmation needed
    const requiresConfirm = !isNaturalEnd(inn2, 20, target)
    expect(requiresConfirm).toBe(true)
  })

  it('9.2 — if inn2 manually ended before target reached, team1 wins by remaining runs', () => {
    const inn1 = computeInningsState(
      buildInnings(BCC.bat, OPP.bowl, Array.from({ length: 20 }, () => ({ runs: 8 })), 'inn1'),
      ALL_NAMES
    )

    // Inn2: scorer ends the innings manually at 10 overs / 80 runs
    // For computeMatchResult, this is the same as any other completed inn2
    // (the "manual" flag is just a UI concern — the engine sees a completed innings)
    const inn2 = computeInningsState(
      buildInnings(OPP.bat, BCC.bowl, Array.from({ length: 10 }, () => ({ runs: 8 })), 'inn2'),
      ALL_NAMES
    )
    expect(inn2.totalRuns).toBe(80)

    // Treat as complete for result purposes (scorer confirmed manual end)
    const result = computeMatchResult(inn1, inn2, 10)  // "overs played" = 10 for manual end
    expect(result.status).toBe('complete')
    expect(result.winner).toBe('team1')
    expect(result.marginRuns).toBe(inn1.totalRuns - inn2.totalRuns)
  })

})
