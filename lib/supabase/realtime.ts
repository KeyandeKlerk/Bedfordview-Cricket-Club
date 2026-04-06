'use client'
import { supabase } from './client'
import type { BallEvent } from '../cricket/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type BallInsertHandler = (ball: BallEvent) => void
export type BallDeleteHandler = (ballId: string) => void

/**
 * Subscribe to ball_events for a given innings.
 * Returns the channel so the caller can unsubscribe.
 *
 * Race-condition prevention:
 *   1. Caller fetches existing balls and records lastKnownSequence BEFORE calling this.
 *   2. Pass lastKnownSequence here — events with sequence_number <= it are discarded.
 *   3. Caller deduplicates by ball.id on their end.
 */
export function subscribeBallEvents(
  inningsId: string,
  lastKnownSequence: number,
  onInsert: BallInsertHandler,
  onDelete: BallDeleteHandler,
  onError?: (status: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`innings:${inningsId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ball_events', filter: `innings_id=eq.${inningsId}` },
      (payload) => {
        const ball = payload.new as BallEvent
        if (ball.sequence_number <= lastKnownSequence) return   // already have it
        onInsert(ball)
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'ball_events', filter: `innings_id=eq.${inningsId}` },
      (payload) => {
        const old = payload.old as { id?: string }
        if (old.id) onDelete(old.id)
      }
    )
    .subscribe((status) => {
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && onError) {
        onError(status)
      }
    })

  return channel
}

export function subscribeInnings(
  matchId: string,
  onChange: (innings: any) => void
): RealtimeChannel {
  return supabase
    .channel(`match_innings:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'innings', filter: `match_id=eq.${matchId}` },
      (payload) => onChange(payload.new)
    )
    .subscribe()
}

export function subscribeMatch(
  matchId: string,
  onChange: (match: any) => void
): RealtimeChannel {
  return supabase
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      (payload) => onChange(payload.new)
    )
    .subscribe()
}
