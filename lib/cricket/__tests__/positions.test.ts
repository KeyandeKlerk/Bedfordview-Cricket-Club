import { describe, it, expect } from 'vitest'
import { deriveEffectivePositions } from '../positions'
import type { PositionInputs } from '../positions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInputs(overrides: Partial<PositionInputs> = {}): PositionInputs {
  return {
    state: {
      currentStrikerId: 'mp1',
      currentNonStrikerId: 'mp2',
      currentBowlerId: 'mp11',
      legalBalls: 3,
    },
    ballCount: 3,
    pendingNewBatterId: null,
    pendingNewBowlerId: null,
    opener1: 'mp1',
    opener2: 'mp2',
    openingBowler: 'mp11',
    ...overrides,
  }
}

// ── Pre-game: ballCount = 0 ───────────────────────────────────────────────────

describe('pre-game (ballCount=0, engine positions null)', () => {
  const preBallState = {
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    legalBalls: 0,
  }

  it('uses opener1 as effectiveStrikerId', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: preBallState, ballCount: 0, opener1: 'mp1',
    }))
    expect(r.effectiveStrikerId).toBe('mp1')
  })

  it('uses opener2 as effectiveNonStrikerId', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: preBallState, ballCount: 0, opener2: 'mp2',
    }))
    expect(r.effectiveNonStrikerId).toBe('mp2')
  })

  it('uses openingBowler as effectiveBowlerId', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: preBallState, ballCount: 0, openingBowler: 'mp11',
    }))
    expect(r.effectiveBowlerId).toBe('mp11')
  })

  it('needsNewBatter is false (ballCount=0 excluded)', () => {
    const r = deriveEffectivePositions(makeInputs({ state: preBallState, ballCount: 0 }))
    expect(r.needsNewBatter).toBe(false)
  })

  it('needsNewBowler is false (ballCount=0 excluded)', () => {
    const r = deriveEffectivePositions(makeInputs({ state: preBallState, ballCount: 0 }))
    expect(r.needsNewBowler).toBe(false)
  })

  it('effectiveStrikerId is null when opener1 is also null (page reload + pre-ball)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: preBallState, ballCount: 0, opener1: null,
    }))
    expect(r.effectiveStrikerId).toBeNull()
  })
})

// ── Normal scoring (engine knows positions) ───────────────────────────────────

describe('normal scoring — engine positions take precedence over openers', () => {
  it('state.currentStrikerId overrides opener1', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp3', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 10 },
      opener1: 'mp1',
    }))
    expect(r.effectiveStrikerId).toBe('mp3')
  })

  it('state.currentNonStrikerId overrides opener2', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp4', currentBowlerId: 'mp11', legalBalls: 10 },
      opener2: 'mp2',
    }))
    expect(r.effectiveNonStrikerId).toBe('mp4')
  })

  it('state.currentBowlerId overrides openingBowler', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp15', legalBalls: 10 },
      openingBowler: 'mp11',
    }))
    expect(r.effectiveBowlerId).toBe('mp15')
  })

  it('pendingNewBowlerId overrides state.currentBowlerId', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp15', legalBalls: 6 },
      pendingNewBowlerId: 'mp16',
    }))
    expect(r.effectiveBowlerId).toBe('mp16')
  })

  it('needsNewBatter is false when both engine positions are set', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 5 },
      ballCount: 5,
    }))
    expect(r.needsNewBatter).toBe(false)
  })
})

// ── Post-wicket, page-reload scenario (opener1 = null) ───────────────────────

describe('post-wicket — page-reload bug scenario', () => {
  // THE BUG: after a page reload, opener1/opener2 are null (React state reset).
  // When a wicket is taken, currentStrikerId goes null.
  // effectiveStrikerId falls to opener1 (null) → causes "Waiting for innings setup..."
  // needsNewBatter=true must be returned so the guard in ScorerShell skips that message.

  it('effectiveStrikerId is null when striker dismissed, non-striker present, no pending, opener1=null', () => {
    // This IS the page-reload bug scenario
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: null, currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 7 },
      ballCount: 7,
      pendingNewBatterId: null,
      opener1: null,
    }))
    // currentNonStrikerId !== null → pendingNewBatterId (null) goes to striker slot → still null
    expect(r.effectiveStrikerId).toBeNull()
  })

  it('needsNewBatter is true in the page-reload bug scenario', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: null, currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 7 },
      ballCount: 7,
      pendingNewBatterId: null,
      opener1: null,
    }))
    // This being true is what prevents "Waiting for innings setup..." from showing
    expect(r.needsNewBatter).toBe(true)
  })

  it('effectiveStrikerId resolves to pendingNewBatterId once scorer picks a replacement', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: null, currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 7 },
      ballCount: 7,
      pendingNewBatterId: 'mp5',  // scorer just picked the new batter
      opener1: null,
    }))
    expect(r.effectiveStrikerId).toBe('mp5')
    expect(r.needsNewBatter).toBe(false)
  })

  it('effectiveNonStrikerId is null when non-striker run-out, striker present, no pending, opener2=null', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: null, currentBowlerId: 'mp11', legalBalls: 9 },
      ballCount: 9,
      pendingNewBatterId: null,
      opener2: null,
    }))
    // currentStrikerId !== null → pendingNewBatterId (null) goes to non-striker slot → null
    expect(r.effectiveNonStrikerId).toBeNull()
  })

  it('needsNewBatter is true when non-striker is null (run-out after reload)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: null, currentBowlerId: 'mp11', legalBalls: 9 },
      ballCount: 9,
      pendingNewBatterId: null,
      opener2: null,
    }))
    expect(r.needsNewBatter).toBe(true)
  })

  it('normal reload (no wicket): effectiveStrikerId from engine, not opener fallback', () => {
    // After reload, opener1=null but engine knows the striker from ball events
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp3', currentNonStrikerId: 'mp4', currentBowlerId: 'mp11', legalBalls: 10 },
      ballCount: 10,
      opener1: null,
      opener2: null,
    }))
    expect(r.effectiveStrikerId).toBe('mp3')
    expect(r.effectiveNonStrikerId).toBe('mp4')
    expect(r.needsNewBatter).toBe(false)
  })
})

// ── pendingNewBatterId slot assignment ────────────────────────────────────────

describe('pendingNewBatterId slot assignment', () => {
  it('when non-striker is present, pending fills the striker slot', () => {
    // striker dismissed (null), non-striker present → pending goes to striker
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: null, currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 6 },
      ballCount: 6,
      pendingNewBatterId: 'mp5',
    }))
    expect(r.effectiveStrikerId).toBe('mp5')
    expect(r.effectiveNonStrikerId).toBe('mp2') // non-striker unchanged
  })

  it('when striker is present, pending fills the non-striker slot', () => {
    // non-striker run-out (null), striker present → pending goes to non-striker
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: null, currentBowlerId: 'mp11', legalBalls: 6 },
      ballCount: 6,
      pendingNewBatterId: 'mp5',
    }))
    expect(r.effectiveStrikerId).toBe('mp1') // striker unchanged
    expect(r.effectiveNonStrikerId).toBe('mp5')
  })

  it('when both slots null and pending set, neither slot gets the pending batter (documents existing behaviour)', () => {
    // Both null → currentNonStrikerId IS null → condition (currentNonStrikerId !== null) is false
    //           → pendingNewBatterId not routed to striker slot
    //           → currentStrikerId IS null → condition (currentStrikerId !== null) is false
    //           → pendingNewBatterId not routed to non-striker slot either
    // Falls back to opener1/opener2
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: null, currentNonStrikerId: null, currentBowlerId: 'mp11', legalBalls: 0 },
      ballCount: 0,
      pendingNewBatterId: 'mp5',
      opener1: 'mp1',
      opener2: 'mp2',
    }))
    // With ballCount=0, opener fallbacks are used
    expect(r.effectiveStrikerId).toBe('mp1')
    expect(r.effectiveNonStrikerId).toBe('mp2')
  })
})

// ── needsNewBowler logic ──────────────────────────────────────────────────────

describe('needsNewBowler', () => {
  it('true at over boundary with no pendingNewBowlerId', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 6 },
      ballCount: 6,
      pendingNewBowlerId: null,
    }))
    expect(r.needsNewBowler).toBe(true)
  })

  it('true at 12 legal balls (over boundary)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 12 },
      ballCount: 12,
      pendingNewBowlerId: null,
    }))
    expect(r.needsNewBowler).toBe(true)
  })

  it('false when pendingNewBowlerId is set (selection pending)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 6 },
      ballCount: 6,
      pendingNewBowlerId: 'mp12',
    }))
    expect(r.needsNewBowler).toBe(false)
  })

  it('false mid-over (legalBalls not divisible by 6)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 3 },
      ballCount: 3,
    }))
    expect(r.needsNewBowler).toBe(false)
  })

  it('false when ballCount=0 (pre-game)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: null, currentNonStrikerId: null, currentBowlerId: null, legalBalls: 0 },
      ballCount: 0,
    }))
    expect(r.needsNewBowler).toBe(false)
  })

  it('false when legalBalls=0 despite balls bowled (all extras)', () => {
    // 3 wides bowled: ballCount=3 but legalBalls=0 — no over has completed
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 0 },
      ballCount: 3,
    }))
    expect(r.needsNewBowler).toBe(false)
  })

  it('false on ball 5 of first over (legalBalls=5)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 5 },
      ballCount: 5,
    }))
    expect(r.needsNewBowler).toBe(false)
  })
})

// ── Opener fallback only used pre-game ────────────────────────────────────────

describe('opener fallback only relevant before any balls', () => {
  it('opener1 is ignored when currentStrikerId is set (mid-innings)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp3', currentNonStrikerId: 'mp2', currentBowlerId: 'mp11', legalBalls: 10 },
      opener1: 'mp1', // different player — opener1 should be ignored
    }))
    expect(r.effectiveStrikerId).toBe('mp3')
    expect(r.effectiveStrikerId).not.toBe('mp1')
  })

  it('opener2 is ignored when currentNonStrikerId is set (mid-innings)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp4', currentBowlerId: 'mp11', legalBalls: 10 },
      opener2: 'mp2', // different player — should be ignored
    }))
    expect(r.effectiveNonStrikerId).toBe('mp4')
    expect(r.effectiveNonStrikerId).not.toBe('mp2')
  })

  it('openingBowler is ignored when currentBowlerId is set (mid-innings)', () => {
    const r = deriveEffectivePositions(makeInputs({
      state: { currentStrikerId: 'mp1', currentNonStrikerId: 'mp2', currentBowlerId: 'mp15', legalBalls: 10 },
      openingBowler: 'mp11', // should be ignored
    }))
    expect(r.effectiveBowlerId).toBe('mp15')
  })
})
