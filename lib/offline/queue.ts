import type { BallAnnotation, BallEvent } from '../cricket/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const QUEUE_WARN_THRESHOLD = 250
const QUEUE_HARD_CAP = 300

// In-memory fallback (used when IndexedDB is unavailable)
let memoryQueue: BallEvent[] = []
let memoryAnnotationQueue: Array<{ ballId: string } & BallAnnotation> = []

// Dexie instance — lazily initialised
let db: any = null

async function getDb(): Promise<any> {
  if (db) return db
  try {
    const { default: Dexie } = await import('dexie')
    const database = new Dexie('BCCScorerQueue')
    database.version(1).stores({
      balls: 'id, innings_id, sequence_number',
    })
    // v2 adds pendingAnnotations for professional scoring mode.
    // balls store is unchanged — the upgrade is additive.
    database.version(2).stores({
      balls: 'id, innings_id, sequence_number',
      pendingAnnotations: 'ballId',
    })
    db = database
    return db
  } catch {
    // Private browsing, iOS WebView, or Dexie not available
    return null
  }
}

async function dbCount(): Promise<number> {
  const d = await getDb()
  if (!d) return memoryQueue.length
  try {
    return await d.balls.count()
  } catch {
    return memoryQueue.length
  }
}

export async function getQueueCount(): Promise<number> {
  return dbCount()
}

/**
 * Returns the highest sequence_number across all queued balls, or 0 if the queue
 * is empty. Used on page load to advance lastKnownSequenceRef past any offline balls
 * that were queued but not yet flushed, preventing sequence number collisions when
 * the scorer scores online after a reload mid-offline session.
 */
export async function getQueueMaxSequence(): Promise<number> {
  const d = await getDb()
  if (d) {
    try {
      const last = await d.balls.orderBy('sequence_number').last()
      if (last) return last.sequence_number
    } catch { /* fall through */ }
  }
  if (memoryQueue.length === 0) return 0
  return Math.max(...memoryQueue.map(b => b.sequence_number))
}

/**
 * Enqueue a ball event for later sync.
 * Returns { warned: true } when approaching the hard cap (>= 250),
 * and { blocked: true } when at the hard cap (>= 300).
 */
export async function queueBall(
  ball: BallEvent
): Promise<{ warned: boolean; blocked: boolean }> {
  const count = await dbCount()
  if (count >= QUEUE_HARD_CAP) {
    return { warned: false, blocked: true }
  }

  const d = await getDb()
  if (d) {
    try {
      await d.balls.put(ball)
    } catch {
      memoryQueue.push(ball)
    }
  } else {
    memoryQueue.push(ball)
  }

  return { warned: count + 1 >= QUEUE_WARN_THRESHOLD, blocked: false }
}

/**
 * Flush the offline queue to Supabase.
 * Uses upsert with onConflict on innings_id+sequence_number for safe partial-sync recovery.
 */
export async function flushQueue(
  supabase: SupabaseClient
): Promise<{ flushed: number; errors: number }> {
  const d = await getDb()

  let balls: BallEvent[] = []
  if (d) {
    try {
      balls = await d.balls.orderBy('sequence_number').toArray()
    } catch {
      balls = [...memoryQueue]
    }
  } else {
    balls = [...memoryQueue]
  }

  if (balls.length === 0) return { flushed: 0, errors: 0 }

  let flushed = 0
  let errors = 0

  for (const ball of balls) {
    try {
      const { error } = await supabase
        .from('ball_events')
        .upsert(ball, { onConflict: 'innings_id,sequence_number' })

      if (error) {
        errors++
      } else {
        // Remove from queue on success
        if (d) {
          try { await d.balls.delete(ball.id) } catch { /* ignore */ }
        } else {
          memoryQueue = memoryQueue.filter(b => b.id !== ball.id)
        }
        flushed++
      }
    } catch {
      errors++
    }
  }

  // After balls are flushed, flush any pending annotations (ordering invariant:
  // the ball must exist in the DB before its annotation UPDATE is sent).
  await flushAnnotations(supabase)

  return { flushed, errors }
}

/** Remove all queued balls (e.g. after confirmed full sync) */
export async function clearQueue(): Promise<void> {
  const d = await getDb()
  if (d) {
    try { await d.balls.clear() } catch { /* ignore */ }
  }
  memoryQueue = []
}

// ── Annotation queue (professional scoring mode) ─────────────────────────────

/** Returns true if a ball with this id is still sitting in the local offline queue (not yet synced). */
export async function isInBallQueue(ballId: string): Promise<boolean> {
  const d = await getDb()
  if (d) {
    try {
      const row = await d.balls.get(ballId)
      return row != null
    } catch { /* fall through */ }
  }
  return memoryQueue.some(b => b.id === ballId)
}

/**
 * Merge annotation fields into a queued ball so they are sent together in one upsert.
 * Call this when the ball is still in the queue (offline) and the annotation arrives offline.
 *
 * Returns true if a queued ball was found and merged, false if no matching ball was
 * found (e.g. it was flushed — and thus already synced — between the caller's
 * isInBallQueue() check and this call). Callers MUST treat a false return as "not
 * applied" and fall back to another delivery path (direct update / queueAnnotation)
 * so the annotation is never silently dropped.
 */
export async function mergeAnnotationIntoBallQueue(ballId: string, annotation: BallAnnotation): Promise<boolean> {
  const d = await getDb()
  if (d) {
    try {
      const existing = await d.balls.get(ballId)
      if (existing) {
        await d.balls.put({ ...existing, ...annotation })
        return true
      }
      return false
    } catch { /* fall through */ }
  }
  const idx = memoryQueue.findIndex(b => b.id === ballId)
  if (idx !== -1) {
    memoryQueue[idx] = { ...memoryQueue[idx], ...annotation }
    return true
  }
  return false
}

/**
 * Queue an annotation UPDATE for a ball that has already been synced to Supabase.
 * The annotation will be flushed (as an UPDATE on ball_events) when connectivity restores.
 */
export async function queueAnnotation(ballId: string, annotation: BallAnnotation): Promise<void> {
  const d = await getDb()
  const row = { ballId, ...annotation }
  if (d) {
    try {
      await d.pendingAnnotations.put(row)
      return
    } catch { /* fall through */ }
  }
  const idx = memoryAnnotationQueue.findIndex(a => a.ballId === ballId)
  if (idx !== -1) memoryAnnotationQueue[idx] = row
  else memoryAnnotationQueue.push(row)
}

/**
 * Flush pending annotation UPDATEs to Supabase.
 * MUST be called AFTER flushQueue() so the parent balls exist in the DB.
 */
export async function flushAnnotations(
  supabase: SupabaseClient
): Promise<{ flushed: number; errors: number }> {
  const d = await getDb()

  let annotations: Array<{ ballId: string } & BallAnnotation> = []
  if (d) {
    try {
      annotations = await d.pendingAnnotations.toArray()
    } catch {
      annotations = [...memoryAnnotationQueue]
    }
  } else {
    annotations = [...memoryAnnotationQueue]
  }

  if (annotations.length === 0) return { flushed: 0, errors: 0 }

  let flushed = 0
  let errors = 0

  for (const { ballId, ...annotation } of annotations) {
    try {
      const { error } = await supabase
        .from('ball_events')
        .update(annotation)
        .eq('id', ballId)

      if (error) {
        errors++
      } else {
        if (d) {
          try { await d.pendingAnnotations.delete(ballId) } catch { /* ignore */ }
        } else {
          memoryAnnotationQueue = memoryAnnotationQueue.filter(a => a.ballId !== ballId)
        }
        flushed++
      }
    } catch {
      errors++
    }
  }

  return { flushed, errors }
}
