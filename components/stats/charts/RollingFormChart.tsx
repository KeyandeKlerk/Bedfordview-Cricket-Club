import type { BattingInning } from '@/lib/stats/types'

export default function RollingFormChart({ innings }: { innings: BattingInning[] }) {
  const WINDOW = 8
  const chrono = [...innings].reverse()
  if (chrono.length < WINDOW) return null
  const points = chrono.slice(WINDOW - 1).map((_, i) => {
    const slice = chrono.slice(i, i + WINDOW)
    const avg = slice.reduce((s, inn) => s + (inn.runs ?? 0), 0) / WINDOW
    return {
      avg: Math.round(avg),
      label: chrono[i + WINDOW - 1].match_date
        ? new Date(chrono[i + WINDOW - 1].match_date!).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
        : '',
    }
  })
  const maxVal = Math.max(...points.map(p => p.avg), 1)
  const W = 480, H = 130
  const PAD = { top: 18, bottom: 28, left: 8, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const pts = points.map((p, i) => ({
    x: PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW),
    y: PAD.top + (1 - p.avg / maxVal) * innerH,
    ...p,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <div className="chart-wrap">
      <div className="chart-label-top">8-Innings Rolling Average</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id="grad-rolling" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(pct => (
          <line key={pct}
            x1={PAD.left} y1={PAD.top + (1 - pct) * innerH}
            x2={W - PAD.right} y2={PAD.top + (1 - pct) * innerH}
            stroke="rgba(56,189,248,0.1)" strokeWidth="1" />
        ))}
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${polyline} ${W - PAD.right},${PAD.top + innerH}`}
          fill="url(#grad-rolling)" opacity="0.18" />
        <polyline points={polyline} fill="none" stroke="#38bdf8" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#38bdf8" stroke="#050c1a" strokeWidth="2" />
            <text x={p.x} y={p.y - 9} textAnchor="middle" fill="#7dd3fc" fontSize="9"
              fontFamily="Syne, sans-serif" fontWeight="700">{p.avg}</text>
            <text x={p.x} y={H - 4} textAnchor="middle" fill="rgba(147,197,253,0.35)"
              fontSize="8" fontFamily="Outfit, sans-serif">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
