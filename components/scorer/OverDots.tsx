'use client'
import type { BallEvent } from '@/lib/cricket/types'
import { totalBallRuns, isLegalDelivery } from '@/lib/cricket/engine'

interface Props {
  balls: BallEvent[]
  onBallTap?: (ball: BallEvent) => void
  compact?: boolean
}

function ballSymbol(ball: BallEvent): { symbol: string; color?: string } {
  if (ball.dismissal_type)                return { symbol: 'W', color: 'var(--red)' }
  if (ball.extras_type === 'wide')        return { symbol: 'Wd', color: 'var(--muted)' }
  if (ball.extras_type === 'no_ball')     return { symbol: 'NB', color: 'var(--gold)' }
  if (ball.extras_type === 'bye')         return { symbol: 'B', color: 'var(--muted)' }
  if (ball.extras_type === 'leg_bye')     return { symbol: 'LB', color: 'var(--muted)' }
  const runs = totalBallRuns(ball)
  if (runs === 0)                         return { symbol: '·' }
  if (ball.is_boundary_four)             return { symbol: '4', color: 'var(--lime)' }
  if (ball.is_boundary_six)              return { symbol: '6', color: 'var(--gold)' }
  return { symbol: String(runs) }
}

export default function OverDots({ balls, onBallTap, compact }: Props) {
  if (balls.length === 0) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minHeight: compact ? 22 : 36 }}>
        <span style={{ color: 'var(--dim)', fontSize: compact ? 11 : 13 }}>Start of over</span>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .ball-dot { transition: filter 0.1s; }
        .ball-dot.tappable:hover { filter: brightness(1.25); }
        .ball-dot.tappable:active { filter: brightness(0.85); }
      `}</style>
      <div style={{ display: 'flex', gap: compact ? 3 : 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {balls.map((ball, i) => {
          const { symbol, color } = ballSymbol(ball)
          const legal = isLegalDelivery(ball)
          const tappable = !!onBallTap
          return (
            /* Outer wrapper provides the touch target; inner span keeps the visual size */
            <span
              key={ball.id ?? i}
              className={`ball-dot${tappable ? ' tappable' : ''}`}
              onClick={tappable ? () => onBallTap!(ball) : undefined}
              title={tappable ? 'Tap to correct this ball' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: compact ? 30 : 44,
                minHeight: compact ? 30 : 44,
                padding: compact ? '0 2px' : '0 4px',
                cursor: tappable ? 'pointer' : 'default',
                pointerEvents: tappable ? 'auto' : 'none',
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: legal ? (compact ? 22 : 34) : (compact ? 26 : 38),
                height: compact ? 22 : 34,
                borderRadius: compact ? 4 : 6,
                background: 'var(--surface)',
                border: `1px solid ${color ?? 'var(--border)'}`,
                fontFamily: 'var(--font-display)',
                fontSize: compact ? 10 : 13,
                fontWeight: 800,
                color: color ?? 'var(--text)',
              }}>
                {symbol}
              </span>
            </span>
          )
        })}
      </div>
    </>
  )
}
