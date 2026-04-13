import type { SeasonBatting } from '@/lib/stats/types'

export default function SVGLineChart({ data, valueKey, label }: {
  data: SeasonBatting[]
  valueKey: 'total_runs' | 'average' | 'strike_rate'
  label: string
}) {
  if (data.length < 2) return null

  const values = data.map(d => Number((d as any)[valueKey]) || 0)
  const maxVal = Math.max(...values, 1)
  const W = 480, H = 130
  const PAD = { top: 18, bottom: 28, left: 8, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW),
    y: PAD.top + (1 - (Number((d as any)[valueKey]) || 0) / maxVal) * innerH,
    val: Number((d as any)[valueKey]) || 0,
    season: d.seasons?.name ?? d.season_id,
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(pct => (
          <line
            key={pct}
            x1={PAD.left} y1={PAD.top + (1 - pct) * innerH}
            x2={W - PAD.right} y2={PAD.top + (1 - pct) * innerH}
            stroke="rgba(59,130,246,0.1)" strokeWidth="1"
          />
        ))}
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${polyline} ${W - PAD.right},${PAD.top + innerH}`}
          fill={`url(#grad-${valueKey})`}
          opacity="0.2"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="#050c1a" strokeWidth="2" />
            <text x={p.x} y={p.y - 9} textAnchor="middle" fill="#93c5fd" fontSize="9" fontFamily="Syne, sans-serif" fontWeight="700">
              {p.val}
            </text>
            <text x={p.x} y={H - 4} textAnchor="middle" fill="rgba(147,197,253,0.4)" fontSize="8" fontFamily="Outfit, sans-serif">
              {p.season}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
