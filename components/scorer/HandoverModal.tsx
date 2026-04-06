'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface ScorerUser {
  user_id: string
  display: string
}

interface Props {
  matchId: string
  sessionId: string
  currentUserId: string
  onInitiated: (recipientId: string, recipientDisplay: string) => void
  onClose: () => void
}

export default function HandoverModal({ matchId, sessionId, currentUserId, onInitiated, onClose }: Props) {
  const [scorers, setScorers]     = useState<ScorerUser[]>([])
  const [selected, setSelected]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    async function fetchScorers() {
      // Get all users with scorer or admin role, excluding the current user
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['scorer', 'admin'])
        .neq('user_id', currentUserId)

      if (!data) { setLoading(false); return }

      // Deduplicate by user_id
      const unique = Array.from(new Map(data.map((r: any) => [r.user_id, r])).values())
      setScorers(unique.map((r: any) => ({
        user_id: r.user_id,
        display: `Scorer ${r.user_id.slice(0, 8)}`,
      })))
      setLoading(false)
    }
    fetchScorers()
  }, [currentUserId])

  async function handleConfirm() {
    if (!selected) return
    setSubmitting(true)
    setError(null)

    const { initiateHandover } = await import('@/lib/scoring-lock')
    const ok = await initiateHandover(supabase, matchId, sessionId, selected)
    if (!ok) {
      setError('Failed to initiate handover. Do you still hold the lock?')
      setSubmitting(false)
      return
    }

    const recipient = scorers.find(s => s.user_id === selected)
    onInitiated(selected, recipient?.display ?? 'them')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a1628',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 14,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 400,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
            Hand Over Scoring
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Select a scorer to hand control to. They will see an "Accept Hand Over" prompt on their device.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>Loading scorers…</div>
        ) : scorers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(147,197,253,0.35)', fontSize: 13 }}>
            No other scorers available.
          </div>
        ) : (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scorers.map(s => (
              <button
                key={s.user_id}
                onClick={() => setSelected(s.user_id)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${selected === s.user_id ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.15)'}`,
                  background: selected === s.user_id ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: selected === s.user_id ? '#93c5fd' : 'var(--muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: selected === s.user_id ? 700 : 400,
                }}
              >
                {s.display}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || submitting}
            style={{ flex: 2, padding: '11px', borderRadius: 8, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', cursor: !selected || submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: !selected || submitting ? 0.5 : 1 }}
          >
            {submitting ? 'Sending…' : 'Hand Over'}
          </button>
        </div>
      </div>
    </div>
  )
}
