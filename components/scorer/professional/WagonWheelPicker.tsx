'use client'

// Field circle constants (SVG units)
const CX = 150        // centre x
const CY = 150        // centre y
const R_BOUNDARY = 130 // outer boundary radius
const R_CIRCLE = 60   // inner circle (30 yards)
const BATTER_Y = 150  // batter crease y (centre of field for simplicity)

// 8 sector divider angles (degrees from 12 o'clock, clockwise)
const SECTOR_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315]

// Sector labels (outside the field)
const SECTOR_LABELS = [
  { deg: 22,  label: 'Straight' },
  { deg: 68,  label: 'Mid-off' },
  { deg: 113, label: 'Cover' },
  { deg: 158, label: 'Point' },
  { deg: 202, label: 'Fine leg' },
  { deg: 248, label: 'Sq. leg' },
  { deg: 293, label: 'Mid-on' },
  { deg: 338, label: 'Long-on' },
]

function polar(deg: number, r: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function normToSvg(wx: number, wy: number): { x: number; y: number } {
  // wagon_x: positive = off side (right in SVG), wagon_y: positive = toward bowler (up in SVG)
  return { x: CX + wx * R_BOUNDARY, y: CY - wy * R_BOUNDARY }
}

function svgToNorm(svgX: number, svgY: number): { wx: number; wy: number } {
  const wx = Math.max(-1, Math.min(1, (svgX - CX) / R_BOUNDARY))
  const wy = Math.max(-1, Math.min(1, -(svgY - CY) / R_BOUNDARY))
  return { wx, wy }
}

interface Props {
  wagX: number | null
  wagY: number | null
  onChange: (wx: number, wy: number) => void
}

export default function WagonWheelPicker({ wagX, wagY, onChange }: Props) {
  function handleTap(e: React.MouseEvent<SVGElement>) {
    const svg = e.currentTarget.closest('svg') as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    const scale = 300 / rect.width
    const svgX = (e.clientX - rect.left) * scale
    const svgY = (e.clientY - rect.top)  * scale
    // Only register taps inside the boundary circle
    const dist = Math.hypot(svgX - CX, svgY - CY)
    if (dist > R_BOUNDARY) return
    const { wx, wy } = svgToNorm(svgX, svgY)
    onChange(wx, wy)
  }

  const dotPos = wagX != null && wagY != null ? normToSvg(wagX, wagY) : null

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Wagon Wheel — tap where the ball went
        {wagX != null && wagY != null && (
          <span style={{ color: 'var(--highlight)', textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
            {wagX > 0.3 ? 'Off side' : wagX < -0.3 ? 'Leg side' : 'Straight'}
            {wagY > 0.5 ? ' · Straight' : wagY > 0 ? ' · Long' : ' · Fine leg/3rd man'}
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 300 300"
        style={{ width: '100%', maxWidth: 240, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        onClick={handleTap}
      >
        {/* Outfield */}
        <circle cx={CX} cy={CY} r={R_BOUNDARY} fill="#0f2a1a" stroke="#1e4d2b" strokeWidth={2} />

        {/* 30-yard circle */}
        <circle cx={CX} cy={CY} r={R_CIRCLE} fill="none" stroke="#1e4d2b" strokeWidth={1} strokeDasharray="4,4" />

        {/* Sector divider lines */}
        {SECTOR_ANGLES_DEG.map(deg => {
          const p = polar(deg, R_BOUNDARY)
          return (
            <line
              key={deg}
              x1={CX} y1={CY}
              x2={p.x} y2={p.y}
              stroke="rgba(71,85,105,0.5)"
              strokeWidth={0.8}
            />
          )
        })}

        {/* Pitch rectangle */}
        <rect x={CX - 8} y={CY - 40} width={16} height={80} fill="#3d2b12" rx={2} />

        {/* Batter crease */}
        <line x1={CX - 14} y1={BATTER_Y + 30} x2={CX + 14} y2={BATTER_Y + 30} stroke="#94a3b8" strokeWidth={1} />

        {/* Stumps */}
        {[-4, 0, 4].map(dx => (
          <line key={dx} x1={CX + dx} y1={BATTER_Y + 30} x2={CX + dx} y2={BATTER_Y + 22} stroke="#94a3b8" strokeWidth={1.2} />
        ))}
        {[-4, 0, 4].map(dx => (
          <line key={dx} x1={CX + dx} y1={BATTER_Y - 30} x2={CX + dx} y2={BATTER_Y - 22} stroke="#94a3b8" strokeWidth={1.2} />
        ))}

        {/* Sector labels */}
        {SECTOR_LABELS.map(({ deg, label }) => {
          const p = polar(deg, R_BOUNDARY + 0)
          // Place label just inside the boundary
          const labelP = polar(deg, R_BOUNDARY - 18)
          return (
            <text
              key={deg}
              x={labelP.x}
              y={labelP.y + 3}
              textAnchor="middle"
              fontSize={7}
              fill="rgba(100,116,139,0.8)"
            >
              {label}
            </text>
          )
        })}

        {/* Shot line from crease to tap point */}
        {dotPos && (
          <line
            x1={CX} y1={BATTER_Y + 30}
            x2={dotPos.x} y2={dotPos.y}
            stroke="#38bdf8"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}

        {/* Dot at tap point */}
        {dotPos && (
          <>
            <circle cx={dotPos.x} cy={dotPos.y} r={8} fill="rgba(37,99,235,0.15)" stroke="#38bdf8" strokeWidth={1} />
            <circle cx={dotPos.x} cy={dotPos.y} r={4} fill="#38bdf8" />
          </>
        )}
      </svg>
    </div>
  )
}
