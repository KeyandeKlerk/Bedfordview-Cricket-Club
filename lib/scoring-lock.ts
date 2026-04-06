import type { SupabaseClient } from '@supabase/supabase-js'

export const LOCK_TTL_MS   = 2 * 60 * 1000  // 2 minutes — lock expires if no heartbeat
export const HEARTBEAT_MS  = 30 * 1000       // send heartbeat every 30s

export interface LockState {
  held: boolean          // this session holds the lock
  lockedByUser: string | null   // email/name of holder (null if free)
  lockedAt: Date | null
}

/**
 * Try to acquire the scoring lock for a match.
 * Uses an atomic UPDATE ... WHERE to avoid races.
 * Returns true if the lock was acquired.
 */
export async function acquireLock(
  supabase: SupabaseClient,
  matchId: string,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  // Uses an RPC to avoid a PostgREST bug where .or() on UPDATE generates
  // invalid table-qualified column references (error 42703).
  const { data, error } = await supabase.rpc('acquire_scoring_lock', {
    p_match_id:   matchId,
    p_session_id: sessionId,
    p_user_id:    userId,
  })

  if (error) console.error('[acquireLock] failed:', error.code, error.message, error.details, error.hint)
  return !error && data === true
}

/**
 * Renew the lock. Must be called every HEARTBEAT_MS while scoring.
 * Only updates if this session still owns the lock.
 */
export async function renewLock(
  supabase: SupabaseClient,
  matchId: string,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('matches')
    .update({ scorer_locked_at: new Date().toISOString() })
    .eq('id', matchId)
    .eq('scorer_session_id', sessionId)
    .select('id')
    .single()

  return !error && !!data
}

/**
 * Release the lock on clean exit (page close / match complete).
 * Only clears if this session owns it.
 */
export async function releaseLock(
  supabase: SupabaseClient,
  matchId: string,
  sessionId: string,
): Promise<void> {
  await supabase
    .from('matches')
    .update({
      scorer_session_id: null,
      scorer_locked_at: null,
      scorer_user_id: null,
    })
    .eq('id', matchId)
    .eq('scorer_session_id', sessionId)
}

/**
 * Initiate a handover to another user.
 * Only succeeds if the caller currently holds the lock.
 */
export async function initiateHandover(
  supabase: SupabaseClient,
  matchId: string,
  sessionId: string,
  recipientUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('matches')
    .update({
      pending_handover_to: recipientUserId,
      pending_handover_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('scorer_session_id', sessionId)
    .select('id')
    .single()

  return !error && !!data
}

/**
 * Cancel a pending handover (called by the lock holder).
 */
export async function cancelHandover(
  supabase: SupabaseClient,
  matchId: string,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('matches')
    .update({ pending_handover_to: null, pending_handover_at: null })
    .eq('id', matchId)
    .eq('scorer_session_id', sessionId)
    .select('id')
    .single()

  return !error && !!data
}

/**
 * Accept a pending handover.
 * Clears the pending handover fields, releases the old lock, and acquires
 * the lock for the new session/user.
 */
export async function acceptHandover(
  supabase: SupabaseClient,
  matchId: string,
  newSessionId: string,
  userId: string,
): Promise<boolean> {
  // Atomically take ownership: only if pending_handover_to matches this user
  const { data, error } = await supabase
    .from('matches')
    .update({
      scorer_session_id:  newSessionId,
      scorer_locked_at:   new Date().toISOString(),
      scorer_user_id:     userId,
      pending_handover_to: null,
      pending_handover_at: null,
    })
    .eq('id', matchId)
    .eq('pending_handover_to', userId)
    .select('id')
    .single()

  return !error && !!data
}

/**
 * Read the current lock state for a match (to show who's scoring).
 */
export async function getLockState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<LockState> {
  const { data } = await supabase
    .from('matches')
    .select('scorer_session_id, scorer_locked_at, scorer_user_id')
    .eq('id', matchId)
    .single()

  if (!data?.scorer_session_id || !data?.scorer_locked_at) {
    return { held: false, lockedByUser: null, lockedAt: null }
  }

  const lockedAt = new Date(data.scorer_locked_at)
  const expired  = Date.now() - lockedAt.getTime() > LOCK_TTL_MS

  if (expired) {
    return { held: false, lockedByUser: null, lockedAt: null }
  }

  // Fetch the user's email for display
  let displayName: string | null = null
  if (data.scorer_user_id) {
    const { data: userData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', data.scorer_user_id)
      .single()
    displayName = userData ? `User ${data.scorer_user_id.slice(0, 8)}` : null
  }

  return { held: true, lockedByUser: displayName, lockedAt }
}
