'use client'
import type { MatchPlayer } from '@/lib/cricket/types'

interface Props {
  purpose: 'new_batter' | 'change_bowler' | 'change_batter'
  players: MatchPlayer[]
  playerName: (id: string) => string
  previousBowlerId?: string   // grey out bowler who bowled previous over
  excludeIds?: string[]       // already out / on field
  onSelect: (matchPlayerId: string) => void
  onClose: () => void
}

const TITLE: Record<Props['purpose'], string> = {
  new_batter:    'Select Next Batter',
  change_bowler: 'Select Bowler',
  change_batter: 'Change Batter',
}

export default function PlayerSelectModal({
  purpose,
  players,
  playerName,
  previousBowlerId,
  excludeIds = [],
  onSelect,
  onClose,
}: Props) {
  const available = players.filter(p => !excludeIds.includes(p.id))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
          padding: '20px 20px 8px',
          width: '100%', maxWidth: 480,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', marginBottom: 16 }}>
          {TITLE[purpose]}
        </h3>

        {available.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>No players available.</p>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingBottom: 8 }}>
          {available.map(p => {
            const isPreviousBowler = purpose === 'change_bowler' && p.id === previousBowlerId
            return (
              <button
                key={p.id}
                onClick={() => { onSelect(p.id); onClose() }}
                disabled={isPreviousBowler}
                className="btn btn-ghost"
                style={{
                  justifyContent: 'flex-start',
                  fontSize: 15,
                  padding: '14px 16px',
                  minHeight: 54,
                  opacity: isPreviousBowler ? 0.45 : 1,
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <span>{p.is_captain ? '(C) ' : ''}{p.is_keeper ? '† ' : ''}{playerName(p.id)}</span>
                {isPreviousBowler && (
                  <span style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', fontWeight: 400 }}>
                    Can&apos;t bowl consecutive overs
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button className="btn btn-ghost" onClick={onClose} style={{ width: '100%', justifyContent: 'center', marginTop: 8, marginBottom: 12, minHeight: 50 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
