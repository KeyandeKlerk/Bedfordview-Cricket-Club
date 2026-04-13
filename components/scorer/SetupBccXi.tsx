'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { MatchPlayer } from '@/lib/cricket/types'

interface AvailablePlayer {
  id: string
  first_name: string
  last_name: string
  _preselected?: boolean
  _position?: number
}

interface Props {
  matchId: string
  ourSide: 'home' | 'away'
  availablePlayers: AvailablePlayer[]
  onComplete: (inserted: MatchPlayer[]) => void
}

export default function SetupBccXi({ matchId, ourSide, availablePlayers, onComplete }: Props) {
  const isPrePopulated = availablePlayers.some(p => p._preselected)

  const initialSelected = new Set(
    availablePlayers
      .filter(p => p._preselected)
      .sort((a, b) => (a._position ?? 99) - (b._position ?? 99))
      .map(p => p.id)
  )

  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Set<string>>(initialSelected)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const filtered = availablePlayers.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleConfirm() {
    if (selected.size < 11) { setError(`Select at least 11 players (${selected.size} selected).`); return }
    setSaving(true); setError(null)

    const orderedIds = [
      ...availablePlayers
        .filter(p => p._preselected && selected.has(p.id))
        .sort((a, b) => (a._position ?? 99) - (b._position ?? 99))
        .map(p => p.id),
      ...Array.from(selected).filter(id => !availablePlayers.find(p => p.id === id && p._preselected)),
    ]

    const rows = orderedIds.map((playerId, i) => ({
      match_id: matchId,
      player_id: playerId,
      side: ourSide,
      batting_position: i + 1,
    }))

    const { error: delError } = await supabase
      .from('match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('side', ourSide)
      .not('player_id', 'is', null)

    if (delError) { setSaving(false); setError(delError.message); return }

    const { data, error } = await supabase
      .from('match_players')
      .insert(rows)
      .select()
    setSaving(false)
    if (error) { setError(error.message); return }
    onComplete(data as MatchPlayer[])
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', maxWidth: 560, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: isPrePopulated ? 8 : 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
          BCC XI
        </h2>
        {selected.size > 0 && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--lime)' }}>{selected.size}/11</span>
        )}
      </div>

      {isPrePopulated && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Pre-selected from coach&apos;s XI. Uncheck a player to replace them.
        </p>
      )}

      <input
        className="input"
        style={{ marginBottom: 12 }}
        placeholder="Search players..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />

      <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--muted)', textAlign: 'center', fontSize: 14 }}>No players found.</div>
        ) : (
          filtered.map(p => {
            const isSelected = selected.has(p.id)
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', minHeight: 52, cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent', touchAction: 'manipulation' }}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(p.id)} style={{ accentColor: 'var(--lime)', width: 20, height: 20, flexShrink: 0 }} />
                <span style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--text)' : 'var(--muted)', fontSize: 15 }}>
                  {p.first_name} {p.last_name}
                </span>
                {isSelected && <span style={{ marginLeft: 'auto', color: 'var(--lime)', fontSize: 16, flexShrink: 0 }}>✓</span>}
              </label>
            )
          })
        )}
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <button className="btn btn-primary" disabled={saving || selected.size < 11}
        style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
        onClick={handleConfirm}>
        {saving ? 'Saving...' : `Confirm Squad (${selected.size}/11) →`}
      </button>
    </div>
  )
}
