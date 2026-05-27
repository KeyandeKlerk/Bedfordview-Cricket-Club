'use client'
import type { PitchLength, PitchLine } from '@/lib/cricket/types'

// Lengths ordered from batter end (full_toss) to bowler end (bouncer) — top to bottom visually
const LENGTHS: PitchLength[] = ['bouncer', 'short', 'good_length', 'full', 'yorker', 'full_toss']
const LENGTH_LABELS: Record<PitchLength, string> = {
  bouncer:      'Bouncer',
  short:        'Short',
  good_length:  'Good Length',
  full:         'Full',
  yorker:       'Yorker',
  full_toss:    'Full Toss',
}

// 3 line columns: off side → middle → leg side
const LINES: PitchLine[] = ['outside_off', 'middle', 'outside_leg']
const LINE_LABELS: Record<PitchLine, string> = {
  wide_outside_off: 'W-OO',
  outside_off:      'Off',
  off_stump:        'OS',
  middle:           'Mid',
  leg_stump:        'LS',
  outside_leg:      'Leg',
}

const PITCH_W = 120   // SVG units — pitch rectangle width
const PITCH_H = 280   // SVG units — pitch rectangle height
const CELL_W  = PITCH_W / 3
const CELL_H  = PITCH_H / 6
const PAD_L   = 40    // left padding for row labels
const PAD_T   = 24    // top padding for column labels
const VIEW_W  = PAD_L + PITCH_W + 8
const VIEW_H  = PAD_T + PITCH_H + 8

interface Props {
  length: PitchLength | null
  line: PitchLine | null
  handedness?: 'right' | 'left'
  onSelect: (length: PitchLength, line: PitchLine) => void
}

export default function PitchMapPicker({ length, line, handedness = 'right', onSelect }: Props) {
  // For left-handed batters, off side is on the left, so visual column order reverses
  // but stored PitchLine values remain semantically correct (outside_off = batter's off side)
  const orderedLines = handedness === 'left' ? [...LINES].reverse() : LINES

  function handleTap(e: React.MouseEvent<SVGRectElement>) {
    const svg = (e.currentTarget.closest('svg') as SVGSVGElement)
    const rect = svg.getBoundingClientRect()
    const scaleX = VIEW_W / rect.width
    const scaleY = VIEW_H / rect.height
    const svgX = (e.clientX - rect.left) * scaleX - PAD_L
    const svgY = (e.clientY - rect.top)  * scaleY - PAD_T
    const col = Math.max(0, Math.min(2, Math.floor(svgX / CELL_W)))
    const row = Math.max(0, Math.min(5, Math.floor(svgY / CELL_H)))
    onSelect(LENGTHS[row], orderedLines[col])
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Pitch Map — tap landing zone
        {length && line && (
          <span style={{ color: 'var(--highlight)', textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
            {LENGTH_LABELS[length]} · {LINE_LABELS[line]}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ height: 160, width: 160 * (VIEW_W / VIEW_H), display: 'block', touchAction: 'none', flexShrink: 0 }}
      >
        {/* Column labels */}
        {orderedLines.map((l, ci) => (
          <text
            key={l}
            x={PAD_L + ci * CELL_W + CELL_W / 2}
            y={PAD_T - 6}
            textAnchor="middle"
            fontSize={9}
            fill={line === l ? '#38bdf8' : '#64748b'}
          >
            {LINE_LABELS[l]}
          </text>
        ))}

        {/* Row labels */}
        {LENGTHS.map((len, ri) => (
          <text
            key={len}
            x={PAD_L - 4}
            y={PAD_T + ri * CELL_H + CELL_H / 2 + 4}
            textAnchor="end"
            fontSize={8}
            fill={length === len ? '#38bdf8' : '#475569'}
          >
            {LENGTH_LABELS[len]}
          </text>
        ))}

        {/* Pitch background */}
        <rect x={PAD_L} y={PAD_T} width={PITCH_W} height={PITCH_H} fill="#1e293b" rx={3} />

        {/* Crease lines */}
        {/* Popping crease near batter (bottom) */}
        <line x1={PAD_L} y1={PAD_T + PITCH_H - CELL_H * 0.8} x2={PAD_L + PITCH_W} y2={PAD_T + PITCH_H - CELL_H * 0.8} stroke="#64748b" strokeWidth={1} strokeDasharray="3,3" />
        {/* Popping crease near bowler (top) */}
        <line x1={PAD_L} y1={PAD_T + CELL_H * 0.5} x2={PAD_L + PITCH_W} y2={PAD_T + CELL_H * 0.5} stroke="#64748b" strokeWidth={1} strokeDasharray="3,3" />

        {/* Stumps at each end */}
        {[PAD_T + 4, PAD_T + PITCH_H - 4].map((y, i) => (
          <g key={i}>
            {[-8, 0, 8].map(dx => (
              <line
                key={dx}
                x1={PAD_L + PITCH_W / 2 + dx} y1={y}
                x2={PAD_L + PITCH_W / 2 + dx} y2={y + (i === 0 ? 10 : -10)}
                stroke="#94a3b8" strokeWidth={1.5}
              />
            ))}
          </g>
        ))}

        {/* Grid cells (tap targets + highlight) */}
        {LENGTHS.map((len, ri) =>
          orderedLines.map((ln, ci) => {
            const isSelected = length === len && line === ln
            return (
              <rect
                key={`${len}-${ln}`}
                x={PAD_L + ci * CELL_W}
                y={PAD_T + ri * CELL_H}
                width={CELL_W}
                height={CELL_H}
                fill={isSelected ? 'rgba(37,99,235,0.45)' : 'transparent'}
                stroke={isSelected ? '#38bdf8' : '#334155'}
                strokeWidth={0.5}
                rx={1}
                style={{ cursor: 'pointer' }}
                onClick={handleTap}
              />
            )
          })
        )}

        {/* Pitch border */}
        <rect x={PAD_L} y={PAD_T} width={PITCH_W} height={PITCH_H} fill="none" stroke="#475569" strokeWidth={1} rx={3} />
      </svg>
    </div>
  )
}
