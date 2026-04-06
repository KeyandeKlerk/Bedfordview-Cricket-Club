'use client'
import { useState } from 'react'
import type { ExtrasType } from '@/lib/cricket/types'
import ExtraRunsModal from './ExtraRunsModal'

interface Props {
  onExtra: (type: ExtrasType, extrasRuns: number, batRuns: number) => void
  disabled?: boolean
}

export default function ExtrasRow({ onExtra, disabled }: Props) {
  const [open, setOpen] = useState<ExtrasType | null>(null)

  const btnBase: React.CSSProperties = {
    fontSize: 14,
    padding: '13px 8px',
    minHeight: 48,
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    touchAction: 'manipulation',
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 6, marginBottom: 8 }}>
        {/* Wide — single tap = +1 instantly */}
        <button
          disabled={disabled}
          onClick={() => !disabled && onExtra('wide', 1, 0)}
          style={btnBase}
        >
          Wide
        </button>
        {/* Wide +more runs */}
        <button
          disabled={disabled}
          onClick={() => !disabled && setOpen('wide')}
          style={{ ...btnBase, padding: '13px 10px', color: 'var(--dim)', fontSize: 16, letterSpacing: 0 }}
          title="Wide with extra runs"
        >
          +
        </button>

        {/* No Ball — single tap = +1, 0 bat runs */}
        <button
          disabled={disabled}
          onClick={() => !disabled && onExtra('no_ball', 1, 0)}
          style={btnBase}
        >
          No Ball
        </button>
        {/* NB + bat runs */}
        <button
          disabled={disabled}
          onClick={() => !disabled && setOpen('no_ball')}
          style={{ ...btnBase, padding: '13px 10px', color: 'var(--dim)', fontSize: 16, letterSpacing: 0 }}
          title="No ball with bat runs"
        >
          +
        </button>

        {/* Bye always opens modal */}
        <button
          disabled={disabled}
          onClick={() => !disabled && setOpen('bye')}
          style={btnBase}
        >
          Bye
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          disabled={disabled}
          onClick={() => !disabled && setOpen('leg_bye')}
          style={btnBase}
        >
          Leg Bye
        </button>
        <button
          disabled={disabled}
          onClick={() => !disabled && setOpen('penalty')}
          style={btnBase}
        >
          Penalty
        </button>
      </div>

      {open && (
        <ExtraRunsModal
          extrasType={open}
          onConfirm={(extrasRuns, batRuns) => {
            onExtra(open, extrasRuns, batRuns)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
