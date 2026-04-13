'use client'
import { useState } from 'react'
import type { BallEvent } from '@/lib/cricket/types'
import { totalBallRuns, isLegalDelivery } from '@/lib/cricket/engine'

interface Props {
  lastBall: BallEvent | null
  playerName: (id: string) => string
  onUndo: (ballId: string) => void
  disabled?: boolean
}

export default function UndoButton({ lastBall, playerName, onUndo, disabled }: Props) {
  const [confirming, setConfirming] = useState(false)

  if (!lastBall) return null

  function preview(): string {
    if (!lastBall) return ''
    const runs = totalBallRuns(lastBall)
    const legal = isLegalDelivery(lastBall)
    const parts: string[] = []
    if (lastBall.extras_type) parts.push(lastBall.extras_type.replace('_', '-'))
    else if (runs === 0) parts.push('dot')
    else parts.push(`${runs} run${runs !== 1 ? 's' : ''}`)
    if (lastBall.dismissal_type) parts.push(`W (${lastBall.dismissal_type.replace('_', ' ')})`)
    if (!legal) {
      if (lastBall.extras_type === 'wide') parts.push('(wide)')
      else if (lastBall.extras_type === 'no_ball') parts.push('(no ball)')
      else parts.push('(extra)')
    }
    return parts.join(', ')
  }

  if (!confirming) {
    return (
      <button
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        style={{
          fontSize: 12,
          color: 'var(--red)',
          borderColor: 'rgba(224,60,46,0.4)',
          minHeight: 40,
          width: '100%',
          justifyContent: 'center',
          opacity: 0.75,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Undo last ball
      </button>
    )
  }

  return (
    <div style={{
      background: 'rgba(224,60,46,0.08)', border: '1px solid rgba(224,60,46,0.35)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.4 }}>
        Undo: <strong style={{ color: 'var(--text)' }}>{preview()}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-ghost"
          onClick={() => setConfirming(false)}
          style={{ flex: 1, justifyContent: 'center', fontSize: 14, minHeight: 46 }}
        >
          Cancel
        </button>
        <button
          className="btn btn-outline"
          onClick={() => { onUndo(lastBall.id); setConfirming(false) }}
          style={{ flex: 2, justifyContent: 'center', fontSize: 14, minHeight: 46, color: 'var(--red)', borderColor: 'var(--red)' }}
        >
          Confirm Undo
        </button>
      </div>
    </div>
  )
}
