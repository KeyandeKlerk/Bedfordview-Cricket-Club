'use client'
import { useState } from 'react'
import type { MatchPlayer } from '@/lib/cricket/types'

interface Props {
  players: MatchPlayer[]
  playerName: (id: string) => string
  exclude: string[]
  selected: string | null
  onSelect: (id: string) => void
}

export default function SearchSelect({ players, playerName, exclude, selected, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  const filtered = players.filter(p =>
    !exclude.includes(p.id) &&
    playerName(p.id).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position: 'relative' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{
          padding: '12px 14px', minHeight: 48, background: 'var(--surface)', border: `1px solid ${open ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer', fontSize: 15, color: selected ? 'var(--text)' : 'var(--dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? playerName(selected) : 'Select player...'}
        </span>
        <span style={{ color: 'var(--dim)', fontSize: 12, marginLeft: 8, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--panel)', border: '1px solid var(--border-bright)', borderRadius: 8, zIndex: 100, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 }}>
          <div style={{ position: 'sticky', top: 0, background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
            <input
              autoFocus
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, outline: 'none' }}
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); setSearch('') }}
              style={{ padding: '13px 16px', minHeight: 48, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', color: selected === p.id ? 'var(--lime)' : 'var(--text)', background: selected === p.id ? 'rgba(59,130,246,0.08)' : 'transparent', borderBottom: '1px solid var(--border)' }}
            >
              {selected === p.id && <span style={{ marginRight: 8, fontSize: 13 }}>✓</span>}
              {playerName(p.id)}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: '14px 16px', color: 'var(--dim)', fontSize: 14 }}>No players found.</div>}
        </div>
      )}
    </div>
  )
}
