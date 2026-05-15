'use client'
import { useState } from 'react'
import type { ExtrasType } from '@/lib/cricket/types'
import ExtraRunsModal from './ExtraRunsModal'

interface Props {
  onExtra: (type: ExtrasType, extrasRuns: number, batRuns: number) => void
  onPenalty?: () => void
  disabled?: boolean
}

export default function ExtrasRow({ onExtra, onPenalty, disabled }: Props) {
  const [open, setOpen] = useState<ExtrasType | null>(null)

  const btnBase: React.CSSProperties = {
    fontSize: 'clamp(12px, 1.85dvh, 16px)' as any,
    height: 'clamp(36px, 5.5dvh, 50px)' as any,
    padding: 0,
    minHeight: 'clamp(36px, 5.5dvh, 50px)' as any,
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'transparent',
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

      {/* Penalty: full width, minimal — rarely used */}
      <button
        disabled={disabled}
        onClick={() => !disabled && onPenalty?.()}
        style={{ ...btnBase, width: '100%', fontSize: 'clamp(10px, 1.5dvh, 13px)' as any, opacity: disabled ? 0.4 : 0.5, height: 'clamp(28px, 4dvh, 38px)' as any, minHeight: 'clamp(28px, 4dvh, 38px)' as any }}
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
