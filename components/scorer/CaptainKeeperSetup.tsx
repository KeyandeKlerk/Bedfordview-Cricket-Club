'use client'
import { useState } from 'react'
import type { MatchPlayer } from '@/lib/cricket/types'
import { supabase } from '@/lib/supabase/client'

interface Props {
  matchId: string
  homePlayers: MatchPlayer[]
  awayPlayers: MatchPlayer[]
  playerName: (id: string) => string
  onComplete: () => void
}

interface SideState {
  captainId: string | null
  keeperId: string | null
}

export default function CaptainKeeperSetup({ matchId, homePlayers, awayPlayers, playerName, onComplete }: Props) {
  const [home, setHome] = useState<SideState>({
    captainId: homePlayers.find(p => p.is_captain)?.id ?? null,
    keeperId: homePlayers.find(p => p.is_keeper)?.id ?? null,
  })
  const [away, setAway] = useState<SideState>({
    captainId: awayPlayers.find(p => p.is_captain)?.id ?? null,
    keeperId: awayPlayers.find(p => p.is_keeper)?.id ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setSide(
    side: 'home' | 'away',
    field: 'captainId' | 'keeperId',
    newId: string
  ) {
    const dbField = field === 'captainId' ? 'is_captain' : 'is_keeper'
    const current = side === 'home' ? home : away
    const previousId = current[field]
    if (previousId && previousId !== newId) {
      await supabase.from('match_players').update({ [dbField]: false }).eq('id', previousId)
    }
    await supabase.from('match_players').update({ [dbField]: true }).eq('id', newId)
    if (side === 'home') setHome(s => ({ ...s, [field]: newId }))
    else setAway(s => ({ ...s, [field]: newId }))
  }

  async function handleSave() {
    setError(null)
    if (!home.captainId || !home.keeperId) {
      setError('Select captain and keeper for your team.')
      return
    }
    if (!away.captainId || !away.keeperId) {
      setError('Select captain and keeper for the opposition.')
      return
    }
    setSaving(true)
    try {
      for (const [side, state] of [['home', home], ['away', away]] as const) {
        if (state.captainId) await setSide(side, 'captainId', state.captainId)
        if (state.keeperId)  await setSide(side, 'keeperId',  state.keeperId)
      }
      onComplete()
    } catch (e: any) {
      setError(e.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const selectStyle = (hasValue: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '11px 12px',
    background: 'var(--surface)',
    border: `1px solid ${hasValue ? 'var(--lime)' : 'var(--border)'}`,
    borderRadius: 8,
    color: hasValue ? 'var(--text)' : 'var(--dim)',
    fontSize: 15,
    cursor: 'pointer',
    colorScheme: 'dark',
    appearance: 'auto',
  })

  function SidePicker({ title, players, state, onSet }: {
    title: string
    players: MatchPlayer[]
    state: SideState
    onSet: (field: 'captainId' | 'keeperId', id: string) => void
  }) {
    return (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 14 }}>
          {title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([
            { field: 'captainId' as const, label: 'Captain (C)' },
            { field: 'keeperId'  as const, label: 'Keeper (†)' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                {label}
              </div>
              <select
                value={state[field] ?? ''}
                onChange={e => { if (e.target.value) onSet(field, e.target.value) }}
                style={selectStyle(!!state[field])}
              >
                <option value="">Select player…</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{playerName(p.id)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, textTransform: 'uppercase', marginBottom: 20 }}>
        Captain &amp; Keeper
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <SidePicker
          title="BCC"
          players={homePlayers}
          state={home}
          onSet={(field, id) => setSide('home', field, id)}
        />
        <SidePicker
          title="Opposition"
          players={awayPlayers}
          state={away}
          onSet={(field, id) => setSide('away', field, id)}
        />
      </div>

      {error && (
        <div style={{ color: 'var(--red)', marginBottom: 14, fontSize: 14 }}>{error}</div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving || !home.captainId || !home.keeperId || !away.captainId || !away.keeperId}
        style={{ width: '100%', justifyContent: 'center', fontSize: 16, minHeight: 52 }}
      >
        {saving ? 'Saving…' : 'Continue →'}
      </button>
    </div>
  )
}
