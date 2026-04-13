export default function RunRateChart({ data }: { data: Array<{ over: number; avgRuns: number }> }) {
  if (!data.length) return null
  const maxVal = Math.max(...data.map(d => d.avgRuns), 1)
  const W = 500, H = 160
  const PAD = { top: 20, bottom: 36, left: 32, right: 8 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const barW = Math.max(innerW / data.length - 3, 4)

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">Average runs scored per over (BCC batting)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {[0, 0.5, 1].map(pct => {
          const y = PAD.top + (1 - pct) * innerH
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">
                {(pct * maxVal).toFixed(1)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const x = PAD.left + (i / data.length) * innerW + 1.5
          const barH = maxVal > 0 ? (d.avgRuns / maxVal) * innerH : 0
          const y = PAD.top + innerH - barH
          const isPP = d.over <= 6
          const isDeath = d.over >= 16
          const fill = isPP ? '#38bdf8' : isDeath ? '#60a5fa' : '#3b82f6'
          return (
            <g key={d.over}>
              <rect x={x} y={y} width={barW} height={barH} fill={fill} opacity="0.8" rx="2" />
              <text x={x + barW / 2} y={H - 22} fill="rgba(147,197,253,0.35)" fontSize="7" fontFamily="Outfit,sans-serif" textAnchor="middle">
                {d.over}
              </text>
              {barH > 16 && (
                <text x={x + barW / 2} y={y + 11} fill="white" fontSize="7" fontFamily="Syne,sans-serif" fontWeight="700" textAnchor="middle">
                  {d.avgRuns}
                </text>
              )}
            </g>
          )
        })}
        <text x={PAD.left + (3 / 20) * innerW} y={H - 8} fill="rgba(56,189,248,0.5)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Powerplay</text>
        <text x={PAD.left + (10.5 / 20) * innerW} y={H - 8} fill="rgba(59,130,246,0.5)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Middle Overs</text>
        <text x={PAD.left + (17.5 / 20) * innerW} y={H - 8} fill="rgba(96,165,250,0.5)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Death</text>
      </svg>
    </div>
  )
}
