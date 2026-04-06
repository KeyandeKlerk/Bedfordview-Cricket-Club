import type { BallEvent } from '../cricket/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const QUEUE_WARN_THRESHOLD = 250
const QUEUE_HARD_CAP = 300

// In-memory fallback (used when IndexedDB is unavailable)
let memoryQueue: BallEvent[] = []

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
