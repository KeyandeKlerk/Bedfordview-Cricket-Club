// fake-indexeddb/auto MUST be imported before anything that touches Dexie.
// It sets globalThis.indexedDB (and friends) once, before Dexie captures them
// into its internal `domDeps` object.  vi.resetModules() cannot re-run Dexie's
// module-level initialisation in the current Vitest/Node environment, so we
// rely on a single shared IDB instance and clear the stores between tests.
import 'fake-indexeddb/auto'

import { describe, it, expect, beforeEach } from 'vitest'
import * as queueModule from '../queue'

// Clear both the ball queue and any pending annotations before each test so
// tests are independent even though they share the Dexie singleton.
beforeEach(async () => {
  await queueModule.clearQueue()
  // Flush annotations against a no-op Supabase to drain the pendingAnnotations
  // store.  We pass a mock that always succeeds so the store is cleared.
  await queueModule.flushAnnotations(makeSuccessSupabase())
})

// ── queueBall ─────────────────────────────────────────────────────────────────

describe('queueBall()', () => {
  it('stores a ball and increments count', async () => {
    await queueModule.queueBall(makeBall('b1', 1))
    expect(await queueModule.getQueueCount()).toBe(1)
  })

  it('returns { warned: false, blocked: false } for a normal enqueue', async () => {
    const result = await queueModule.queueBall(makeBall('b2', 2))
    expect(result).toEqual({ warned: false, blocked: false })
  })

  it('stores multiple balls', async () => {
    await queueModule.queueBall(makeBall('b1', 1))
    await queueModule.queueBall(makeBall('b2', 2))
    expect(await queueModule.getQueueCount()).toBe(2)
  })
})

// ── flushQueue ────────────────────────────────────────────────────────────────

describe('flushQueue()', () => {
  it('POSTs queued balls and clears queue on success', async () => {
    await queueModule.queueBall(makeBall('b1', 1))
    await queueModule.queueBall(makeBall('b2', 2))

    const { flushed, errors } = await queueModule.flushQueue(makeSuccessSupabase())
    expect(flushed).toBe(2)
    expect(errors).toBe(0)
    expect(await queueModule.getQueueCount()).toBe(0)
  })

  it('retains balls in queue when the network call fails', async () => {
    await queueModule.queueBall(makeBall('b1', 1))

    const { flushed, errors } = await queueModule.flushQueue(makeErrorSupabase())
    expect(flushed).toBe(0)
    expect(errors).toBe(1)
    expect(await queueModule.getQueueCount()).toBe(1)
  })

  it('returns { flushed: 0, errors: 0 } when queue is empty', async () => {
    const result = await queueModule.flushQueue(makeSuccessSupabase())
    expect(result).toEqual({ flushed: 0, errors: 0 })
  })
})

// ── queueAnnotation ───────────────────────────────────────────────────────────

describe('queueAnnotation()', () => {
  it('stores an annotation without throwing', async () => {
    await expect(
      queueModule.queueAnnotation('ball-99', makeAnnotation())
    ).resolves.toBeUndefined()
  })
})

// ── mergeAnnotationIntoBallQueue ──────────────────────────────────────────────

describe('mergeAnnotationIntoBallQueue()', () => {
  it('merges annotation fields into a ball still in the queue', async () => {
    const ball = makeBall('bm1', 1)
    await queueModule.queueBall(ball)

    const annotation = { ...makeAnnotation(), wagon_x: 0.7, shot_type: 'drive' as const }
    await queueModule.mergeAnnotationIntoBallQueue('bm1', annotation)

    // Flush and capture what gets upserted
    let upserted: any = null
    const supabase = {
      from: () => ({
        upsert: (data: any, _opts?: any) => {
          upserted = data
          return Promise.resolve({ error: null })
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    }
    await queueModule.flushQueue(supabase as any)

    expect(upserted?.wagon_x).toBe(0.7)
    expect(upserted?.shot_type).toBe('drive')
  })

  it('returns true when the ball is found and merged', async () => {
    await queueModule.queueBall(makeBall('bm2', 1))
    const result = await queueModule.mergeAnnotationIntoBallQueue('bm2', makeAnnotation())
    expect(result).toBe(true)
  })

  it('returns false when the ball is not in the queue (e.g. flushed between check and merge)', async () => {
    const result = await queueModule.mergeAnnotationIntoBallQueue('not-in-queue', makeAnnotation())
    expect(result).toBe(false)
  })
})

// ── flushAnnotations ──────────────────────────────────────────────────────────

describe('flushAnnotations()', () => {
  it('PATCHes pending annotations and clears them on success', async () => {
    await queueModule.queueAnnotation('synced-ball-id', makeAnnotation())

    let updateCalled = false
    let eqCalled = false
    const supabase = {
      from: () => ({
        update: () => ({
          eq: (_col: string, _val: string) => {
            updateCalled = true
            eqCalled = true
            return Promise.resolve({ error: null })
          },
        }),
        upsert: () => Promise.resolve({ error: null }),
      }),
    }
    const { flushed, errors } = await queueModule.flushAnnotations(supabase as any)
    expect(flushed).toBe(1)
    expect(errors).toBe(0)
    expect(updateCalled).toBe(true)
    expect(eqCalled).toBe(true)
  })

  it('returns { flushed: 0, errors: 0 } when no annotations pending', async () => {
    const result = await queueModule.flushAnnotations(makeSuccessSupabase())
    expect(result).toEqual({ flushed: 0, errors: 0 })
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBall(id: string, seq: number) {
  return {
    id,
    innings_id: 'innings-1',
    match_id: 'match-1',
    sequence_number: seq,
    over_number: 0,
    ball_in_over: seq - 1,
    batter_id: 'mp1',
    non_striker_id: 'mp2',
    bowler_id: 'mp11',
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
  } as any
}

function makeAnnotation() {
  return {
    wagon_x: null,
    wagon_y: null,
    pitch_length: null,
    pitch_line: null,
    shot_type: null,
    bowling_type: null,
    execution_quality: null,
    decision_quality: null,
  } as any
}

function makeSuccessSupabase() {
  return {
    from: () => ({
      upsert: (_data: any, _opts?: any) => Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  } as any
}

function makeErrorSupabase() {
  return {
    from: () => ({
      upsert: (_data: any, _opts?: any) => Promise.resolve({ error: { message: 'network error' } }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  } as any
}
