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
    fontSize: 15,
    height: 56,
    padding: 0,
    minHeight: 56,
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
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  }

  return (
    <>
      {/* Primary extras: 4 equal columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
        <button disabled={disabled} onClick={() => !disabled && setOpen('wide')} style={btnBase}>
          Wide
        </button>
        <button disabled={disabled} onClick={() => !disabled && setOpen('no_ball')} style={btnBase}>
          No Ball
        </button>
        <button disabled={disabled} onClick={() => !disabled && setOpen('bye')} style={btnBase}>
          Bye
        </button>
        <button disabled={disabled} onClick={() => !disabled && setOpen('leg_bye')} style={btnBase}>
          Leg Bye
        </button>
      </div>

      {/* Penalty: full width, secondary */}
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen('penalty')}
        style={{ ...btnBase, width: '100%', fontSize: 13, opacity: disabled ? 0.4 : 0.7, height: 44, minHeight: 44 }}
      >
        Penalty
      </button>

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
