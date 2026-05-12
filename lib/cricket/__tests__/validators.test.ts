import { describe, it, expect } from 'vitest'
import { validateBall } from '../validators'
import type { BallEvent, InningsState, MatchConfig } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<InningsState> = {}): InningsState {
  return {
    inningsId: 'inn-1',
    inningsNumber: 1,
    battingSide: 'home',
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
    oversDisplay: '0.0',
    extras: { wide: 0, no_ball: 0, bye: 0, leg_bye: 0, penalty: 0, total: 0 },
    batterStats: {},
    bowlerStats: {},
    currentStrikerId: 'mp1',
    currentNonStrikerId: 'mp2',
    currentBowlerId: 'mp11',
    currentOverBalls: [],
    completedOvers: [],
    fallOfWickets: [],
    currentPartnership: null,
    nextBallIsFreeHit: false,
    ...overrides,
  }
}

function makeBall(overrides: Partial<BallEvent> = {}): Partial<BallEvent> {
  return {
    runs_off_bat: 0,
    extras_type: null,
    extras_runs: 0,
    is_boundary_four: false,
    is_boundary_six: false,
    dismissal_type: null,
    dismissed_player_id: null,
    fielder_id: null,
    fielder_substitute_name: null,
    ...overrides,
  }
}

const CONFIG: MatchConfig = { overs_per_innings: 20, free_hit_on_no_ball: true }

function invalid(result: ReturnType<typeof validateBall>): asserts result is { valid: false; error: string } {
  expect(result.valid).toBe(false)
}

function valid(result: ReturnType<typeof validateBall>): asserts result is { valid: true } {
  if (!result.valid) throw new Error(`Expected valid but got error: ${(result as any).error}`)
  expect(result.valid).toBe(true)
}

// ── Branch 1: innings over by overs ──────────────────────────────────────────

describe('Branch 1 — innings over by overs', () => {
  it('valid at 119 legal balls (one ball remaining in 20-over match)', () => {
    valid(validateBall(makeBall(), makeState({ legalBalls: 119 }), CONFIG))
  })

  it('invalid at exactly 120 legal balls (all overs bowled)', () => {
    const r = validateBall(makeBall(), makeState({ legalBalls: 120 }), CONFIG)
    invalid(r)
    expect(r.error).toContain('overs bowled')
  })

  it('invalid beyond 120 (defensive — should not occur but must not crash)', () => {
    const r = validateBall(makeBall(), makeState({ legalBalls: 121 }), CONFIG)
    invalid(r)
    expect(r.error).toContain('overs bowled')
  })

  it('valid at 5 legal balls in a 1-over match (ball 6 still allowed)', () => {
    const oneOver: MatchConfig = { overs_per_innings: 1, free_hit_on_no_ball: true }
    valid(validateBall(makeBall(), makeState({ legalBalls: 5 }), oneOver))
  })

  it('invalid at 6 legal balls in a 1-over match', () => {
    const oneOver: MatchConfig = { overs_per_innings: 1, free_hit_on_no_ball: true }
    const r = validateBall(makeBall(), makeState({ legalBalls: 6 }), oneOver)
    invalid(r)
    expect(r.error).toContain('overs bowled')
  })
})

// ── Branch 2: all out ─────────────────────────────────────────────────────────

describe('Branch 2 — all out', () => {
  it('valid at 9 wickets', () => {
    valid(validateBall(makeBall(), makeState({ wickets: 9 }), CONFIG))
  })

  it('invalid at 10 wickets', () => {
    const r = validateBall(makeBall(), makeState({ wickets: 10 }), CONFIG)
    invalid(r)
    expect(r.error).toContain('all out')
  })

  it('invalid at 11 wickets (defensive)', () => {
    const r = validateBall(makeBall(), makeState({ wickets: 11 }), CONFIG)
    invalid(r)
    expect(r.error).toContain('all out')
  })
})

// ── Branch 3: wide with bat runs ──────────────────────────────────────────────

describe('Branch 3 — wide with bat runs', () => {
  it('invalid when runs_off_bat=1 on a wide', () => {
    const r = validateBall(makeBall({ extras_type: 'wide', runs_off_bat: 1 }), makeState(), CONFIG)
    invalid(r)
    expect(r.error).toContain('Bat runs cannot be scored off a wide')
  })

  it('invalid when runs_off_bat=4 on a wide', () => {
    const r = validateBall(makeBall({ extras_type: 'wide', runs_off_bat: 4 }), makeState(), CONFIG)
    invalid(r)
    expect(r.error).toContain('Bat runs cannot be scored off a wide')
  })

  it('valid when runs_off_bat=0 on a wide', () => {
    valid(validateBall(makeBall({ extras_type: 'wide', extras_runs: 1, runs_off_bat: 0 }), makeState(), CONFIG))
  })

  it('valid when non-wide delivery has runs_off_bat > 0', () => {
    valid(validateBall(makeBall({ runs_off_bat: 4 }), makeState(), CONFIG))
  })
})

// ── Branch 4: wide with invalid dismissal ─────────────────────────────────────

describe('Branch 4 — wide with invalid dismissal', () => {
  const wideBase = { extras_type: 'wide' as const, extras_runs: 1 }

  it('invalid: caught on a wide', () => {
    const r = validateBall(
      makeBall({ ...wideBase, dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('caught')
    expect(r.error).toContain('wide')
  })

  it('invalid: bowled on a wide', () => {
    const r = validateBall(
      makeBall({ ...wideBase, dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: lbw on a wide', () => {
    const r = validateBall(
      makeBall({ ...wideBase, dismissal_type: 'lbw', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: hit_wicket on a wide', () => {
    const r = validateBall(
      makeBall({ ...wideBase, dismissal_type: 'hit_wicket', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('valid: run_out on a wide', () => {
    valid(validateBall(
      makeBall({ ...wideBase, dismissal_type: 'run_out', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: stumped on a wide', () => {
    valid(validateBall(
      makeBall({ ...wideBase, dismissal_type: 'stumped', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: no dismissal on a wide', () => {
    valid(validateBall(makeBall(wideBase), makeState(), CONFIG))
  })
})

// ── Branch 5: no-ball with invalid dismissal ──────────────────────────────────

describe('Branch 5 — no-ball with invalid dismissal', () => {
  const noBallBase = { extras_type: 'no_ball' as const, extras_runs: 1 }

  it('invalid: caught on no-ball', () => {
    const r = validateBall(
      makeBall({ ...noBallBase, dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('caught')
    expect(r.error).toContain('no-ball')
  })

  it('invalid: stumped on no-ball', () => {
    const r = validateBall(
      makeBall({ ...noBallBase, dismissal_type: 'stumped', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: bowled on no-ball', () => {
    const r = validateBall(
      makeBall({ ...noBallBase, dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: lbw on no-ball', () => {
    const r = validateBall(
      makeBall({ ...noBallBase, dismissal_type: 'lbw', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: hit_wicket on no-ball', () => {
    const r = validateBall(
      makeBall({ ...noBallBase, dismissal_type: 'hit_wicket', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('valid: run_out on no-ball', () => {
    valid(validateBall(
      makeBall({ ...noBallBase, dismissal_type: 'run_out', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: no dismissal on no-ball', () => {
    valid(validateBall(makeBall(noBallBase), makeState(), CONFIG))
  })
})

// ── Branch 6: free hit dismissal ─────────────────────────────────────────────

describe('Branch 6 — free hit dismissal', () => {
  const freeHitState = makeState({ nextBallIsFreeHit: true })

  it('invalid: caught on free hit (feature enabled)', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      freeHitState, CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('free hit')
  })

  it('invalid: bowled on free hit (feature enabled)', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
      freeHitState, CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('free hit')
  })

  it('invalid: lbw on free hit (feature enabled)', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'lbw', dismissed_player_id: 'mp1' }),
      freeHitState, CONFIG,
    )
    invalid(r)
  })

  it('invalid: stumped on free hit (feature enabled)', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'stumped', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      freeHitState, CONFIG,
    )
    invalid(r)
  })

  it('valid: run_out on free hit (feature enabled)', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'run_out', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      freeHitState, CONFIG,
    ))
  })

  it('valid: caught on free hit when feature is disabled (nextBallIsFreeHit respected but flag off)', () => {
    const featureOff: MatchConfig = { overs_per_innings: 20, free_hit_on_no_ball: false }
    valid(validateBall(
      makeBall({ dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      freeHitState, featureOff,
    ))
  })

  it('valid: no dismissal on free hit', () => {
    valid(validateBall(makeBall({ runs_off_bat: 1 }), freeHitState, CONFIG))
  })
})

// ── Branch 7: bye / leg-bye impossible dismissals ─────────────────────────────

describe('Branch 7 — bye/leg-bye impossible dismissals', () => {
  for (const extrasType of ['bye', 'leg_bye'] as const) {
    describe(`extras_type = ${extrasType}`, () => {
      it(`invalid: caught on ${extrasType}`, () => {
        const r = validateBall(
          makeBall({ extras_type: extrasType, extras_runs: 1, dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
          makeState(), CONFIG,
        )
        invalid(r)
        expect(r.error).toContain('caught')
      })

      it(`invalid: bowled on ${extrasType}`, () => {
        const r = validateBall(
          makeBall({ extras_type: extrasType, extras_runs: 1, dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
          makeState(), CONFIG,
        )
        invalid(r)
      })

      it(`invalid: lbw on ${extrasType}`, () => {
        const r = validateBall(
          makeBall({ extras_type: extrasType, extras_runs: 1, dismissal_type: 'lbw', dismissed_player_id: 'mp1' }),
          makeState(), CONFIG,
        )
        invalid(r)
      })

      it(`invalid: hit_wicket on ${extrasType}`, () => {
        const r = validateBall(
          makeBall({ extras_type: extrasType, extras_runs: 1, dismissal_type: 'hit_wicket', dismissed_player_id: 'mp1' }),
          makeState(), CONFIG,
        )
        invalid(r)
      })

      it(`valid: run_out on ${extrasType}`, () => {
        valid(validateBall(
          makeBall({ extras_type: extrasType, extras_runs: 1, dismissal_type: 'run_out', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
          makeState(), CONFIG,
        ))
      })

      it(`valid: stumped on ${extrasType}`, () => {
        valid(validateBall(
          makeBall({ extras_type: extrasType, extras_runs: 1, dismissal_type: 'stumped', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
          makeState(), CONFIG,
        ))
      })

      it(`valid: no dismissal on ${extrasType}`, () => {
        valid(validateBall(makeBall({ extras_type: extrasType, extras_runs: 1 }), makeState(), CONFIG))
      })
    })
  }
})

// ── Branch 8: fielder required ────────────────────────────────────────────────

describe('Branch 8 — fielder required for caught/stumped/run_out', () => {
  it('invalid: caught with no fielder_id and no substitute', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'caught', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('Fielder required')
  })

  it('invalid: stumped with no fielder', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'stumped', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('Fielder required')
  })

  it('invalid: run_out with no fielder', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'run_out', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('Fielder required')
  })

  it('valid: caught with fielder_id set', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: caught with fielder_substitute_name set', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_substitute_name: 'Sub Fielder' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: run_out with fielder_id set', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'run_out', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: bowled with no fielder (fielder not required)', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: lbw with no fielder', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'lbw', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: hit_wicket with no fielder', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'hit_wicket', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    ))
  })
})

// ── Branch 9: fielder XOR substitute ─────────────────────────────────────────

describe('Branch 9 — fielder XOR substitute (cannot have both)', () => {
  it('invalid: both fielder_id and fielder_substitute_name set on caught', () => {
    const r = validateBall(
      makeBall({
        dismissal_type: 'caught',
        dismissed_player_id: 'mp1',
        fielder_id: 'f1',
        fielder_substitute_name: 'Sub Guy',
      }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('both')
    expect(r.error).toContain('substitute')
  })

  it('invalid: both fielder sources set on run_out', () => {
    const r = validateBall(
      makeBall({
        dismissal_type: 'run_out',
        dismissed_player_id: 'mp1',
        fielder_id: 'f1',
        fielder_substitute_name: 'Sub Guy',
      }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('valid: only fielder_id set', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'caught', dismissed_player_id: 'mp1', fielder_id: 'f1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: only fielder_substitute_name set', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'stumped', dismissed_player_id: 'mp1', fielder_substitute_name: 'Sub Keeper' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: both fielder fields null (non-fielder dismissal)', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    ))
  })
})

// ── Branch 10: dismissed_player_id ↔ dismissal_type pairing ──────────────────

describe('Branch 10 — dismissed_player_id and dismissal_type must both be set or both null', () => {
  it('invalid: dismissed_player_id set but dismissal_type null', () => {
    const r = validateBall(
      makeBall({ dismissed_player_id: 'mp1', dismissal_type: null }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('dismissed_player_id')
    expect(r.error).toContain('dismissal_type')
  })

  it('invalid: dismissal_type set but dismissed_player_id null', () => {
    const r = validateBall(
      makeBall({ dismissal_type: 'bowled', dismissed_player_id: null }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('valid: both set', () => {
    valid(validateBall(
      makeBall({ dismissal_type: 'bowled', dismissed_player_id: 'mp1' }),
      makeState(), CONFIG,
    ))
  })

  it('valid: both null (no dismissal)', () => {
    valid(validateBall(makeBall(), makeState(), CONFIG))
  })
})

// ── Branch 11: boundary flag exclusivity ─────────────────────────────────────

describe('Branch 11 — boundary flags mutually exclusive', () => {
  it('invalid: both is_boundary_four and is_boundary_six true', () => {
    const r = validateBall(
      makeBall({ is_boundary_four: true, is_boundary_six: true, runs_off_bat: 4 }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('four')
    expect(r.error).toContain('six')
  })

  it('valid: only is_boundary_four (with matching runs)', () => {
    valid(validateBall(makeBall({ is_boundary_four: true, runs_off_bat: 4 }), makeState(), CONFIG))
  })

  it('valid: only is_boundary_six (with matching runs)', () => {
    valid(validateBall(makeBall({ is_boundary_six: true, runs_off_bat: 6 }), makeState(), CONFIG))
  })

  it('valid: both false (non-boundary delivery)', () => {
    valid(validateBall(makeBall({ runs_off_bat: 3 }), makeState(), CONFIG))
  })
})

// ── Branch 12: boundary run counts must match ─────────────────────────────────

describe('Branch 12 — boundary run counts must match', () => {
  it('invalid: is_boundary_four=true but runs_off_bat=3', () => {
    const r = validateBall(
      makeBall({ is_boundary_four: true, runs_off_bat: 3 }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('Boundary four requires runs_off_bat = 4')
  })

  it('invalid: is_boundary_four=true but runs_off_bat=6', () => {
    const r = validateBall(
      makeBall({ is_boundary_four: true, runs_off_bat: 6 }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: is_boundary_four=true but runs_off_bat=0', () => {
    const r = validateBall(
      makeBall({ is_boundary_four: true, runs_off_bat: 0 }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('invalid: is_boundary_six=true but runs_off_bat=4', () => {
    const r = validateBall(
      makeBall({ is_boundary_six: true, runs_off_bat: 4 }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('Boundary six requires runs_off_bat = 6')
  })

  it('invalid: is_boundary_six=true but runs_off_bat=5', () => {
    const r = validateBall(
      makeBall({ is_boundary_six: true, runs_off_bat: 5 }),
      makeState(), CONFIG,
    )
    invalid(r)
  })

  it('valid: is_boundary_four=true and runs_off_bat=4', () => {
    valid(validateBall(makeBall({ is_boundary_four: true, runs_off_bat: 4 }), makeState(), CONFIG))
  })

  it('valid: is_boundary_six=true and runs_off_bat=6', () => {
    valid(validateBall(makeBall({ is_boundary_six: true, runs_off_bat: 6 }), makeState(), CONFIG))
  })
})

// ── Branch ordering ───────────────────────────────────────────────────────────

describe('Branch ordering — earlier checks fire first', () => {
  it('overs error fires before all-out error when both conditions true', () => {
    const r = validateBall(
      makeBall(),
      makeState({ legalBalls: 120, wickets: 10 }),
      CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('overs bowled')
    expect(r.error).not.toContain('all out')
  })

  it('wide-bat-runs error fires before wide-dismissal error', () => {
    const r = validateBall(
      makeBall({
        extras_type: 'wide',
        runs_off_bat: 1,
        dismissal_type: 'bowled',
        dismissed_player_id: 'mp1',
      }),
      makeState(), CONFIG,
    )
    invalid(r)
    expect(r.error).toContain('Bat runs cannot be scored off a wide')
  })
})
