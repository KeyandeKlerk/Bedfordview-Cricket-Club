'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, string>
  read_at: string | null
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  availability_window_open: '📅',
  availability_deadline_reminder: '⏰',
  selection_announced: '🏏',
  selection_confirmed_by_player: '✅',
  selection_withdrawn: '🚫',
  match_started: '▶️',
  match_completed: '🏆',
  order_confirmed: '🛒',
  membership_activated: '⭐',
}

const TYPE_LINK = (type: string, data: Record<string, string>): string | null => {
  if (type === 'availability_window_open' || type === 'availability_deadline_reminder') {
    return data.window_id ? `/availability/${data.window_id}` : null
  }
  if (type === 'selection_announced') {
    return data.match_id ? `/selection/${data.match_id}` : null
  }
  if (type === 'match_completed' || type === 'match_started') {
    return data.match_id ? `/matches/${data.match_id}` : null
  }
  if (type === 'order_confirmed' || type === 'membership_activated') {
    return data.order_id ? `/membership/order/${data.order_id}` : null
  }
  return null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const loadNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data ?? []) as Notification[])
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      await loadNotifications(user.id)
      setLoading(false)

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`notif-page:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => loadNotifications(user.id)
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [router, loadNotifications])

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
  }

  async function markAllRead() {
    if (!userId) return
    setMarkingAll(true)
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
    setNotifications(ns => ns.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
    setMarkingAll(false)
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <>
      <style>{`
        .notif-wrap { min-height: 100vh; padding-bottom: 60px; }
        .notif-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid var(--border);
          padding: 40px 0 32px; margin-bottom: 0;
        }
        .notif-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase; color: var(--sky);
          margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
        }
        .notif-eyebrow::before { content:''; display:inline-block; width:20px; height:1px; background:var(--sky); }
        .notif-title { font-family: var(--font-display); font-size: clamp(22px,4vw,36px); font-weight: 800; color: #f0f8ff; margin: 0 0 6px; }
        .notif-body { max-width: 600px; margin: 0 auto; }
        .notif-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border);
          position: sticky; top: 0; background: #050c1a; z-index: 10;
        }
        .notif-item {
          display: flex; gap: 14px; padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer; transition: background 0.1s; text-decoration: none;
          align-items: flex-start;
        }
        .notif-item:hover { background: rgba(255,255,255,0.02); }
        .notif-item.unread { background: rgba(59,130,246,0.04); }
        .notif-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          background: rgba(255,255,255,0.05); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .notif-content { flex: 1; min-width: 0; }
        .notif-item-title { font-weight: 600; font-size: 14px; color: var(--text); margin-bottom: 3px; }
        .notif-item-body { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .notif-time { font-size: 11px; color: var(--muted); white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
        .unread-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;
          flex-shrink: 0; margin-top: 6px;
        }
        .empty-state { padding: 80px 20px; text-align: center; color: var(--muted); font-size: 14px; }
      `}</style>

      <div className="notif-wrap">
        <div className="notif-hero">
          <div className="container">
            <div className="notif-eyebrow">Inbox</div>
            <h1 className="notif-title">
              Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft: 12, fontSize: 16, fontWeight: 700, color: '#93c5fd' }}>
                  {unreadCount} unread
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="notif-body">
          <div className="notif-toolbar">
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={() => router.back()}
            >
              ← Back
            </button>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: 13 }}
                disabled={markingAll}
                onClick={markAllRead}
              >
                {markingAll ? 'Marking…' : 'Mark all read'}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div>No notifications yet</div>
            </div>
          ) : (
            notifications.map(n => {
              const isUnread = !n.read_at
              const href = TYPE_LINK(n.type, n.data)
              const icon = TYPE_ICON[n.type] ?? '🔔'

              const content = (
                <>
                  <div className={`notif-icon`}>{icon}</div>
                  <div className="notif-content">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-body">{n.body}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                    {isUnread && <span className="unread-dot" />}
                  </div>
                </>
              )

              if (href) {
                return (
                  <Link
                    key={n.id}
                    href={href}
                    className={`notif-item${isUnread ? ' unread' : ''}`}
                    onClick={() => { if (isUnread) markRead(n.id) }}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <div
                  key={n.id}
                  className={`notif-item${isUnread ? ' unread' : ''}`}
                  onClick={() => { if (isUnread) markRead(n.id) }}
                >
                  {content}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
