'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    // Fetch initial unread count
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0))

    // Subscribe to new notifications in real time
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => setUnread(n => n + 1)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        // Re-fetch count on any update (covers mark-as-read)
        () => {
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null)
            .then(({ count }) => setUnread(count ?? 0))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <Link
      href="/notifications"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        color: unread > 0 ? '#93c5fd' : 'var(--muted)',
        textDecoration: 'none',
        transition: 'border-color 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      title="Notifications"
    >
      {/* Bell icon */}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>

      {/* Unread badge */}
      {unread > 0 && (
        <span style={{
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          background: 'linear-gradient(135deg, #ef4444, #f97316)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          border: '2px solid var(--black)',
          lineHeight: 1,
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
