'use client'

interface WagonWheelProps {
  balls: Array<{
    wagon_x: number | null
    wagon_y: number | null
    runs_off_bat: number
    is_boundary_four?: boolean
    is_boundary_six?: boolean
    dismissal_type?: string | null
  }>
  size?: number
}

const COLORS: Record<string, string> = {
  six: '#22c55e',
  four: '#f59e0b',
  two_three: '#38bdf8',
  one: '#3b82f6',
  dot: 'rgba(148,163,184,0.5)',
  wicket: '#ef4444',
}

function ballColor(b: WagonWheelProps['balls'][0]): string {
  if (b.dismissal_type && b.dismissal_type !== 'run_out') return COLORS.wicket
  if (b.is_boundary_six) return COLORS.six
  if (b.is_boundary_four) return COLORS.four
  if (b.runs_off_bat >= 2) return COLORS.two_three
  if (b.runs_off_bat === 1) return COLORS.one
  return COLORS.dot
}

export default function WagonWheel({ balls, size = 300 }: WagonWheelProps) {
  const cx = size / 2
  const cy = size / 2
  const fieldR = (size / 2) - 8
  const annotated = balls.filter(b => b.wagon_x != null && b.wagon_y != null)

  if (annotated.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>
        No wagon wheel data recorded yet.
      </div>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Outer boundary */}
      <circle cx={cx} cy={cy} r={fieldR} fill="rgba(15,23,42,0.6)" stroke="rgba(51,65,85,0.6)" strokeWidth={1.5} />
      {/* Inner circle (30-yard) */}
      <circle cx={cx} cy={cy} r={fieldR * 0.55} fill="none" stroke="rgba(51,65,85,0.35)" strokeWidth={1} strokeDasharray="4 3" />
      {/* Sector dividers — 8 lines from centre */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(angle) * fieldR}
            y2={cy + Math.sin(angle) * fieldR}
            stroke="rgba(51,65,85,0.25)" strokeWidth={1}
          />
        )
      })}
      {/* Crease (batter position) */}
      <circle cx={cx} cy={cy} r={6} fill="rgba(37,99,235,0.25)" stroke="rgba(37,99,235,0.5)" strokeWidth={1} />

      {/* Ball dots */}
      {annotated.map((b, i) => {
        // wagon_x: positive = off side (right on SVG), wagon_y: positive = straight (up on SVG = negative y)
        const bx = cx + (b.wagon_x ?? 0) * fieldR
        const by = cy - (b.wagon_y ?? 0) * fieldR
        const isBoundary = b.is_boundary_four || b.is_boundary_six
        const color = ballColor(b)
        const r = isBoundary ? 5 : 3.5
        return (
          <g key={i}>
            {isBoundary && (
              <line x1={cx} y1={cy} x2={bx} y2={by} stroke={color} strokeWidth={1} strokeOpacity={0.4} />
            )}
            <circle cx={bx} cy={by} r={r} fill={color} fillOpacity={0.85} />
          </g>
        )
      })}
    </svg>
  )
}
