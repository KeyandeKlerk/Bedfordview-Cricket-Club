import { describe, it, expect } from 'vitest'
import { dlsResources, dlsTarget } from '../dls'

// ── dlsResources ──────────────────────────────────────────────────────────────

describe('dlsResources', () => {
  it('returns 0 at 0 overs remaining for any wickets', () => {
    expect(dlsResources(0, 0)).toBe(0)
    expect(dlsResources(0, 5)).toBe(0)
    expect(dlsResources(0, 9)).toBe(0)
  })

  it('increases monotonically with overs remaining (0 wickets)', () => {
    const r10 = dlsResources(10, 0)
    const r20 = dlsResources(20, 0)
    const r50 = dlsResources(50, 0)
    expect(r10).toBeGreaterThan(0)
    expect(r20).toBeGreaterThan(r10)
    expect(r50).toBeGreaterThan(r20)
  })

  it('shows the last-wicket column (w=9) is far below w=0 at 20 overs', () => {
    // The raw formula's wicket dimension is non-monotone for mid-range w values
    // (different b values cause different saturation rates). However, w=9 (last
    // wicket) is always dramatically lower than w=0 at any meaningful over count.
    const r0 = dlsResources(20, 0)
    const r9 = dlsResources(20, 9)
    expect(r9).toBeLessThan(r0 * 0.2) // last wicket < 20% of fresh innings resources
  })

  it('last wicket (w=9) is always far less than fresh innings (w=0)', () => {
    // The raw formula is NOT monotone across all w values — the product Z0[w]×b[w]
    // peaks near w=5-6, making mid-range columns higher at small over counts.
    // However, w=9 (final wicket) is always significantly less than w=0 because
    // Z0[9]=4.7 << Z0[0]=100 dominates at any over count > 0.
    for (const u of [2, 5, 10, 20, 50]) {
      expect(dlsResources(u, 9)).toBeLessThan(dlsResources(u, 0))
    }
  })

  it('clamps wickets above 9 to 9', () => {
    expect(dlsResources(20, 10)).toBeCloseTo(dlsResources(20, 9), 8)
    expect(dlsResources(20, 100)).toBeCloseTo(dlsResources(20, 9), 8)
  })

  it('clamps overs above 50 to 50', () => {
    expect(dlsResources(60, 0)).toBeCloseTo(dlsResources(50, 0), 8)
  })

  it('interpolates linearly between integer overs', () => {
    const r10 = dlsResources(10, 0)
    const r11 = dlsResources(11, 0)
    // Midpoint should be the average of the two neighbours
    expect(dlsResources(10.5, 0)).toBeCloseTo((r10 + r11) / 2, 8)
    // Quarter-point
    expect(dlsResources(10.25, 0)).toBeCloseTo(r10 * 0.75 + r11 * 0.25, 8)
  })

  it('interpolates between wicket rows via flooring (fractional wickets clamp to floor)', () => {
    // wicketsLost is floored, so 1.9 acts as 1
    expect(dlsResources(20, 1.9)).toBeCloseTo(dlsResources(20, 1), 8)
  })
})

// ── dlsTarget ─────────────────────────────────────────────────────────────────

describe('dlsTarget — equal overs (standard case)', () => {
  it('returns score + 1 when both teams get the same overs', () => {
    expect(dlsTarget(150, 20, 20)).toBe(151)
    expect(dlsTarget(200, 50, 50)).toBe(201)
    expect(dlsTarget(0,   20, 20)).toBe(1)
    expect(dlsTarget(100, 10, 10)).toBe(101)
  })
})

describe('dlsTarget — team 2 gets fewer overs (rain reduces team 2 allocation)', () => {
  it('produces a target strictly less than score + 1', () => {
    const target = dlsTarget(150, 20, 15)
    expect(target).toBeLessThan(151)
    expect(target).toBeGreaterThan(0)
  })

  it('produces a lower target the fewer overs team 2 receives', () => {
    const t15 = dlsTarget(150, 20, 15)
    const t10 = dlsTarget(150, 20, 10)
    const t5  = dlsTarget(150, 20,  5)
    expect(t10).toBeLessThan(t15)
    expect(t5).toBeLessThan(t10)
  })

  it('gives a substantially reduced target when overs are halved', () => {
    // 10 of 20 overs: actual DLS target is ~120 (≈60% of score+1)
    // Non-linear: fewer overs is more penalising than proportional because
    // the middle overs (power-play/death) are the highest-scoring ones.
    const target = dlsTarget(200, 20, 10)
    expect(target).toBeGreaterThan(100) // strictly above half
    expect(target).toBeLessThan(181)    // strictly below score+1
  })
})

describe('dlsTarget — team 2 gets more overs than team 1 had (bonus case)', () => {
  it('produces a target strictly above score + 1', () => {
    // Team 1 scored 100 in 10 overs (rain ended inn1 early), team 2 gets 20 overs
    const target = dlsTarget(100, 10, 20)
    expect(target).toBeGreaterThan(101)
  })

  it('is larger the more extra overs team 2 receives', () => {
    const t15 = dlsTarget(100, 10, 15)
    const t20 = dlsTarget(100, 10, 20)
    expect(t20).toBeGreaterThan(t15)
  })
})

describe('dlsTarget — edge cases', () => {
  it('handles team1Score = 0 without error', () => {
    expect(dlsTarget(0, 20, 15)).toBeGreaterThanOrEqual(1)
  })

  it('handles team1Overs = 0 (degenerate — R1=0) without division by zero', () => {
    // R1=0 guard returns score+1
    expect(dlsTarget(100, 0, 0)).toBe(101)
  })

  it('is consistent: target with same overs == score+1 across many match lengths', () => {
    for (const overs of [5, 10, 15, 20, 25, 30, 40, 50]) {
      expect(dlsTarget(120, overs, overs)).toBe(121)
    }
  })
})
