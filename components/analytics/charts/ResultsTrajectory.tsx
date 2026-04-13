export default function ResultsTrajectory({ results }: { results: Array<{ isWin: boolean; isTie: boolean }> }) {
  if (results.length < 2) return null
  const W = 480, H = 100
  const PAD = { top: 10, bottom: 10, left: 10, right: 10 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  let cumWins = 0
  const points = results.map((r, i) => {
    if (r.isWin) cumWins++
    return {
      x: PAD.left + (results.length === 1 ? 0 : (i / (results.length - 1)) * innerW),
      y: PAD.top + (1 - cumWins / results.length) * innerH,
      cumWins,
      isWin: r.isWin,
    }
  })

  const poly = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">Cumulative win rate over the season</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        <defs>
          <linearGradient id="trajGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${PAD.left},${PAD.top + innerH} ${poly} ${PAD.left + innerW},${PAD.top + innerH}`}
          fill="url(#trajGrad)"
          opacity="0.15"
        />
        <polyline points={poly} fill="none" stroke="#4ade80" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={results[i].isWin ? '#4ade80' : results[i].isTie ? '#fbbf24' : '#f87171'}
            stroke="#050c1a"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  )
}
