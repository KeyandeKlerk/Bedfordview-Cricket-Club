'use client'

interface OverPoint {
  over: number          // 0-indexed — over just bowled
  actualRuns: number    // cumulative actual runs scored
  requiredRate: number  // required run rate after this over
}

interface Props {
  data: OverPoint[]
  target: number
  totalOvers: number
}

export default function RequiredRateChart({ data, target, totalOvers }: Props) {
  if (!data.length) return null
  const W = 500, H = 160
  const PAD = { top: 20, bottom: 36, left: 32, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxRR = Math.max(...data.map(d => d.requiredRate), 12, 1)
  const maxActualRR = Math.max(...data.slice(1).map((d, i) => {
    const prev = data[i]
    return (d.actualRuns - prev.actualRuns) || 0
  }), 1)
  const maxY = Math.max(maxRR, maxActualRR)

  const toX = (over: number) => PAD.left + (over / totalOvers) * innerW
  const toY = (rate: number) => PAD.top + innerH - Math.min((rate / maxY) * innerH, innerH)

  // Actual run-rate per over (runs scored that over)
  const actualRR: Array<{ over: number; rate: number }> = []
  for (let i = 1; i < data.length; i++) {
    actualRR.push({ over: data[i].over, rate: data[i].actualRuns - data[i - 1].actualRuns })
  }

  const reqPoints = data.map(d => `${toX(d.over)},${toY(d.requiredRate)}`).join(' ')
  const actPoints = actualRR.map(d => `${toX(d.over)},${toY(d.rate)}`).join(' ')

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">Required Rate vs Actual Run Rate</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Grid */}
        {[0, 6, 12].map(rr => {
          const y = toY(rr)
          if (y < PAD.top || y > PAD.top + innerH) return null
          return (
            <g key={rr}>
              <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="rgba(59,130,246,0.07)" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} fill="rgba(147,197,253,0.25)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">
                {rr}
              </text>
            </g>
          )
        })}

        {/* Required rate line */}
        {data.length > 1 && (
          <polyline
            points={reqPoints}
            fill="none"
            stroke="#f87171"
            strokeWidth="2"
            opacity="0.7"
          />
        )}

        {/* Actual run-rate bars */}
        {actualRR.map((d, i) => {
          const x = toX(d.over) - (innerW / totalOvers) * 0.5
          const bW = Math.max((innerW / totalOvers) * 0.6, 3)
          const y = toY(d.rate)
          const bH = (PAD.top + innerH) - y
          const isAhead = i < data.length && d.rate >= data[i + 1]?.requiredRate
          return (
            <rect
              key={d.over}
              x={x - bW / 2} y={y}
              width={bW} height={Math.max(bH, 1)}
              fill={isAhead ? '#4ade80' : '#38bdf8'}
              opacity="0.5"
              rx="1"
            />
          )
        })}

        {/* Legend */}
        <g>
          <line x1={PAD.left + innerW - 90} y1={PAD.top + 8} x2={PAD.left + innerW - 74} y2={PAD.top + 8} stroke="#f87171" strokeWidth="2" />
          <text x={PAD.left + innerW - 70} y={PAD.top + 11} fill="rgba(248,113,113,0.7)" fontSize="8" fontFamily="Outfit,sans-serif">Req. Rate</text>
          <rect x={PAD.left + innerW - 90} y={PAD.top + 18} width={12} height={6} fill="#38bdf8" opacity="0.5" rx="1" />
          <text x={PAD.left + innerW - 70} y={PAD.top + 23} fill="rgba(147,197,253,0.6)" fontSize="8" fontFamily="Outfit,sans-serif">Actual</text>
        </g>

        {/* X-axis over labels */}
        {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map(d => (
          <text
            key={d.over}
            x={toX(d.over)} y={H - 8}
            textAnchor="middle" fontSize="7"
            fill="rgba(147,197,253,0.3)" fontFamily="Outfit,sans-serif"
          >
            {d.over}
          </text>
        ))}
      </svg>
    </div>
  )
}
