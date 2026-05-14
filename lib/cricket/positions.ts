import type { InningsState } from './types'

export interface EffectivePositions {
  effectiveStrikerId: string | null
  effectiveNonStrikerId: string | null
  effectiveBowlerId: string | null
  needsNewBatter: boolean
  needsNewBowler: boolean
}

export interface PositionInputs {
  state: Pick<InningsState, 'currentStrikerId' | 'currentNonStrikerId' | 'currentBowlerId' | 'legalBalls'> & { currentOverLegalBalls?: number }
  ballCount: number
  pendingNewBatterId: string | null
  pendingNewBowlerId: string | null
  opener1: string | null
  opener2: string | null
  openingBowler: string | null
}

/**
 * Pure derivation of effective player positions from innings state + pending selections.
 *
 * Extracted from ScorerShell so this critical fallback logic can be unit-tested,
 * including the page-reload scenario where opener1/opener2 are null.
 *
 * Slot assignment after a wicket:
 *   - striker null + non-striker present  → pendingNewBatterId fills striker slot
 *   - non-striker null + striker present  → pendingNewBatterId fills non-striker slot
 *   - both null (before any balls)        → opener1/opener2 used as fallback
 */
export function deriveEffectivePositions({
  state,
  ballCount,
  pendingNewBatterId,
  pendingNewBowlerId,
  opener1,
  opener2,
  openingBowler,
}: PositionInputs): EffectivePositions {
  const effectiveStrikerId =
    state.currentStrikerId ??
    (state.currentNonStrikerId !== null ? pendingNewBatterId : null) ??
    opener1

  const effectiveNonStrikerId =
    state.currentNonStrikerId ??
    (state.currentStrikerId !== null ? pendingNewBatterId : null) ??
    opener2

  const needsNewBatter =
    ballCount > 0 &&
    pendingNewBatterId === null &&
    (state.currentStrikerId === null || state.currentNonStrikerId === null)

  // currentOverLegalBalls defaults to 6 when absent so existing tests (which don't set it)
  // still see needsNewBowler=true at over boundaries; after a NB starts the new over it is 0.
  const overLegal = state.currentOverLegalBalls ?? 6
  const needsNewBowler =
    ballCount > 0 &&
    state.legalBalls > 0 &&
    state.legalBalls % 6 === 0 &&
    overLegal === 6 &&  // current over has exactly 6 legal balls = it just ended
    pendingNewBowlerId === null

  const effectiveBowlerId = pendingNewBowlerId ?? state.currentBowlerId ?? openingBowler

  return {
    effectiveStrikerId,
    effectiveNonStrikerId,
    effectiveBowlerId,
    needsNewBatter,
    needsNewBowler,
  }
}
