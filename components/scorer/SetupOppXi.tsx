'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { MatchPlayer } from '@/lib/cricket/types'

interface Props {
  matchId: string
  oppSide: 'home' | 'away'
  onComplete: (inserted: MatchPlayer[]) => void
}

export default function SetupOppXi({ matchId, oppSide, onComplete }: Props) {
  const [names, setNames] = useState<string[]>(['', '', '', '', '', '', '', '', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const filled = names.filter(n => n.trim())

  function updateName(i: number, val: string) {
    setNames(prev => prev.map((n, idx) => idx === i ? val : n))
  }

  function addRow() { setNames(prev => [...prev, '']) }
  function removeRow(i: number) { setNames(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleConfirm() {
    if (filled.length < 11) { setError(`Enter at least 11 player names (${filled.length} entered).`); return }
    setSaving(true); setError(null)
    const rows = filled.map((name, i) => ({
      match_id: matchId,
      opposition_name: name.trim(),
      side: oppSide,
      batting_position: i + 1,
    }))
    const { data, error } = await supabase.from('match_players').insert(rows).select()
    setSaving(false)
    if (error) { setError(error.message); return }
    onComplete(data as MatchPlayer[])
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', maxWidth: 480, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
          Opposition XI
        </h2>
        {filled.length > 0 && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--lime)' }}>{filled.length}/11</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {names.map((name, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--dim)', fontSize: 13, width: 22, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
            <input
              className="input"
              style={{ flex: 1, padding: '11px 12px' }}
              placeholder={`Player ${i + 1}`}
              value={name}
              onChange={e => updateName(i, e.target.value)}
            />
            {names.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 8 }}
                aria-label={`Remove player ${i + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={addRow} style={{ fontSize: 13, marginBottom: 20 }}>+ Add player</button>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button className="btn btn-primary" disabled={saving || filled.length < 11}
        style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
        onClick={handleConfirm}>
        {saving ? 'Saving...' : `Confirm (${filled.length}/11) →`}
      </button>
    </div>
  )
}
