'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface Window {
  id: string
  title: string
  window_start: string
  window_end: string
  deadline: string
  season_id: string
}

interface ExistingResponse {
  status: 'available' | 'unavailable' | 'tentative'
  note: string | null
}

type Status = 'available' | 'unavailable' | 'tentative'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

function deadlineCountdown(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return { label: 'Deadline passed', urgent: false, expired: true }
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours < 2) return { label: `${hours}h ${mins}m left`, urgent: true, expired: false }
  if (hours < 24) return { label: `${hours}h left`, urgent: true, expired: false }
  const days = Math.floor(hours / 24)
  return { label: `${days}d ${hours % 24}h left`, urgent: false, expired: false }
}

export default function AvailabilityPage() {
  const { windowId } = useParams<{ windowId: string }>()
  const router = useRouter()

  const [window, setWindow] = useState<Window | null>(null)
  const [existing, setExisting] = useState<ExistingResponse | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Status | null>(null)
  const [saved, setSaved] = useState<Status | null>(null)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState({ label: '', urgent: false, expired: false })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [windowRes, playerRes] = await Promise.all([
        supabase.from('availability_windows').select('*').eq('id', windowId).single(),
        supabase.from('players').select('id').eq('user_id', user.id).maybeSingle(),
      ])

      if (!windowRes.data) { router.push('/dashboard'); return }
      setWindow(windowRes.data)
      setCountdown(deadlineCountdown(windowRes.data.deadline))

      if (!playerRes.data) { setLoading(false); return }
      setPlayerId(playerRes.data.id)

      const { data: resp } = await supabase
        .from('player_availability')
        .select('status, note')
        .eq('window_id', windowId)
        .eq('player_id', playerRes.data.id)
        .maybeSingle()

      if (resp) {
        setExisting(resp as ExistingResponse)
        setSaved(resp.status as Status)
        setNote(resp.note ?? '')
      }
      setLoading(false)
    }
    load()
  }, [windowId, router])

  // Update countdown every minute
  useEffect(() => {
    if (!window) return
    const interval = setInterval(() => setCountdown(deadlineCountdown(window.deadline)), 60000)
    return () => clearInterval(interval)
  }, [window])

  async function submit(status: Status) {
    if (!playerId || !window) return
    setSaving(status); setError(null)

    const { error: err } = await supabase
      .from('player_availability')
      .upsert(
        { window_id: windowId, player_id: playerId, status, note: note || null, updated_at: new Date().toISOString() },
        { onConflict: 'window_id,player_id' }
      )

    setSaving(null)
    if (err) { setError(err.message); return }
    setSaved(status)
    setExisting({ status, note: note || null })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  if (!playerId) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#f0f8ff', textAlign: 'center' }}>
        No Player Profile
      </div>
      <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 300 }}>
        You need to claim your player profile before submitting availability.
      </div>
      <button className="btn btn-primary" onClick={() => router.push('/admin/profile/claim')}>
        Claim Profile →
      </button>
    </div>
  )

  const isExpired = countdown.expired

  const STATUS_CONFIG: Record<Status, { label: string; emoji: string; bg: string; border: string; activeBg: string }> = {
    available: {
      label: 'Available',
      emoji: '✅',
      bg: 'rgba(34,197,94,0.05)',
      border: 'rgba(34,197,94,0.25)',
      activeBg: 'rgba(34,197,94,0.15)',
    },
    tentative: {
      label: 'Tentative',
      emoji: '❓',
      bg: 'rgba(234,179,8,0.05)',
      border: 'rgba(234,179,8,0.25)',
      activeBg: 'rgba(234,179,8,0.15)',
    },
    unavailable: {
      label: 'Unavailable',
      emoji: '❌',
      bg: 'rgba(239,68,68,0.05)',
      border: 'rgba(239,68,68,0.25)',
      activeBg: 'rgba(239,68,68,0.15)',
    },
  }

  return (
    <>
      <style>{`
        .avail-wrap { min-height: 100vh; padding-bottom: 60px; }
        .avail-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid var(--border);
          padding: 40px 0 32px;
          margin-bottom: 32px;
        }
        .avail-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase; color: var(--sky);
          margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
        }
        .avail-eyebrow::before { content:''; display:inline-block; width:20px; height:1px; background:var(--sky); }
        .avail-title {
          font-family: var(--font-display); font-size: clamp(22px,4vw,36px);
          font-weight: 800; color: #f0f8ff; margin: 0 0 8px;
        }
        .avail-dates { font-size: 14px; color: var(--muted); margin-bottom: 12px; }
        .deadline-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
        }
        .avail-body { max-width: 480px; margin: 0 auto; padding: 0 20px; }
        .status-btn {
          width: 100%; padding: 20px 16px; border-radius: 14px;
          border: 2px solid; cursor: pointer; margin-bottom: 12px;
          display: flex; align-items: center; gap: 16px;
          font-family: var(--font-display); font-size: 20px; font-weight: 800;
          transition: all 0.15s; background: none; text-align: left;
          letter-spacing: -0.01em;
        }
        .status-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .status-btn .emoji { font-size: 28px; flex-shrink: 0; }
        .saved-banner {
          padding: 16px 20px; border-radius: 12px; margin-bottom: 24px;
          background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.25);
          font-size: 14px; color: var(--muted);
        }
        .note-toggle {
          background: none; border: none; cursor: pointer;
          color: var(--sky); font-size: 13px; padding: 0;
          margin-bottom: 16px; display: flex; align-items: center; gap: 6px;
        }
        .note-area {
          width: 100%; min-height: 80px; resize: vertical;
          background: rgba(255,255,255,0.03); border: 1px solid var(--border);
          border-radius: 10px; color: var(--text); font-size: 14px;
          padding: 12px; font-family: inherit; box-sizing: border-box;
          margin-bottom: 16px;
        }
        .note-area:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .expired-banner {
          padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: center;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3);
          font-size: 14px; color: #fca5a5;
        }
      `}</style>

      <div className="avail-wrap">
        <div className="avail-hero">
          <div className="container">
            <div className="avail-eyebrow">Availability</div>
            <h1 className="avail-title">{window?.title}</h1>
            <div className="avail-dates">
              {window && `${formatDate(window.window_start)} — ${formatDate(window.window_end)}`}
            </div>
            <div
              className="deadline-pill"
              style={{
                background: countdown.urgent ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${countdown.urgent ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                color: countdown.urgent ? '#fca5a5' : 'var(--muted)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {countdown.label}
            </div>
          </div>
        </div>

        <div className="avail-body">
          {isExpired && (
            <div className="expired-banner">
              The deadline for this window has passed. Responses are now locked.
            </div>
          )}

          {saved && !isExpired && (
            <div className="saved-banner">
              <strong style={{ color: '#93c5fd' }}>Response saved.</strong> You can change it anytime before the deadline.
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            {((['available', 'tentative', 'unavailable'] as Status[])).map(status => {
              const cfg = STATUS_CONFIG[status]
              const isActive = saved === status
              const isLoading = saving === status
              return (
                <button
                  key={status}
                  className="status-btn"
                  disabled={isExpired || saving !== null}
                  onClick={() => submit(status)}
                  style={{
                    background: isActive ? cfg.activeBg : cfg.bg,
                    borderColor: isActive ? cfg.border.replace('0.25', '0.7') : cfg.border,
                    color: '#f0f8ff',
                    opacity: isExpired ? 0.5 : 1,
                  }}
                >
                  <span className="emoji">{isLoading ? '…' : cfg.emoji}</span>
                  <span>{cfg.label}</span>
                  {isActive && (
                    <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          {!isExpired && (
            <>
              <button className="note-toggle" onClick={() => setShowNote(s => !s)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {showNote ? 'Hide note' : existing?.note ? 'Edit note' : 'Add a note (optional)'}
              </button>

              {showNote && (
                <>
                  <textarea
                    className="note-area"
                    placeholder="e.g. Available from 12pm, or can make Saturday only…"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                  {saved && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={saving !== null}
                      onClick={() => submit(saved)}
                    >
                      Save Note
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {existing?.note && !showNote && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              <span style={{ color: '#93c5fd', fontWeight: 600 }}>Your note: </span>
              {existing.note}
            </div>
          )}

          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', marginTop: 32 }}
            onClick={() => router.push('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </>
  )
}
