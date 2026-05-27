interface OverData {
  over: number        // 1-indexed over label
  runs: number        // runs scored in that over
  wickets: number     // wickets that fell in that over
}

interface Props {
  data: OverData[]
  title?: string
}

export default function MatchRunRateChart({ data, title }: Props) {
  if (!data.length) return null
  const maxRuns = Math.max(...data.map(d => d.runs), 1)
  const W = 500, H = 170
  const PAD = { top: 20, bottom: 36, left: 28, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const barW = Math.max(innerW / data.length - 2, 3)

  return (
    <div className="chart-wrap">
      {title && <div className="chart-label-top">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Gridlines */}
        {[0, 0.5, 1].map(pct => {
          const y = PAD.top + (1 - pct) * innerH
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">
                {Math.round(pct * maxRuns)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = PAD.left + (i / data.length) * innerW + 1
          const barH = maxRuns > 0 ? (d.runs / maxRuns) * innerH : 0
          const y = PAD.top + innerH - barH
          const isPP = d.over <= 6
          const isDeath = d.over >= 16
          const fill = isPP ? '#38bdf8' : isDeath ? '#60a5fa' : '#3b82f6'
          return (
            <g key={d.over}>
              <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} fill={fill} opacity="0.8" rx="1" />
              {/* Wicket marker — vertical line through full bar height */}
              {d.wickets > 0 && (
                <line
                  x1={x + barW / 2} y1={PAD.top}
                  x2={x + barW / 2} y2={PAD.top + innerH}
                  stroke="#f87171"
                  strokeWidth={1.5}
                  opacity={0.7}
                />
              )}
              {d.wickets > 0 && (
                <text
                  x={x + barW / 2} y={PAD.top - 4}
                  textAnchor="middle" fontSize="8"
                  fill="#f87171" fontFamily="Syne,sans-serif" fontWeight="700"
                >
                  {d.wickets > 1 ? `${d.wickets}w` : 'w'}
                </text>
              )}
              <text x={x + barW / 2} y={H - 22} fill="rgba(147,197,253,0.3)" fontSize="7" fontFamily="Outfit,sans-serif" textAnchor="middle">
                {d.over}
              </text>
              {barH > 14 && (
                <text x={x + barW / 2} y={y + 10} fill="white" fontSize="7" fontFamily="Syne,sans-serif" fontWeight="700" textAnchor="middle">
                  {d.runs}
                </text>
              )}
            </g>
          )
        })}

        {/* Phase labels */}
        <text x={PAD.left + (3 / 20) * innerW} y={H - 8} fill="rgba(56,189,248,0.5)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Powerplay</text>
        <text x={PAD.left + (10.5 / 20) * innerW} y={H - 8} fill="rgba(59,130,246,0.5)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Middle Overs</text>
        <text x={PAD.left + (17.5 / 20) * innerW} y={H - 8} fill="rgba(96,165,250,0.5)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Death</text>
      </svg>
    </div>
  )
}
