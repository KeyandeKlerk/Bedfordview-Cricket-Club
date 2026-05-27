interface Wicket {
  score: number    // team score when wicket fell
  over: string     // e.g. "4.2"
  player: string   // dismissed batter name
  how: string      // dismissal type label
}

interface Props {
  wickets: Wicket[]
  totalRuns: number
}

export default function FallOfWicketsTimeline({ wickets, totalRuns }: Props) {
  if (!wickets.length) return null
  const W = 500, H = 80
  const PAD = { left: 16, right: 16, top: 24, bottom: 20 }
  const innerW = W - PAD.left - PAD.right
  const max = Math.max(totalRuns, ...wickets.map(w => w.score), 1)

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">Fall of Wickets</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Baseline */}
        <line x1={PAD.left} y1={PAD.top + 20} x2={PAD.left + innerW} y2={PAD.top + 20} stroke="rgba(59,130,246,0.15)" strokeWidth="1" />

        {wickets.map((w, i) => {
          const x = PAD.left + (w.score / max) * innerW
          const isTop = i % 2 === 0
          return (
            <g key={i}>
              <circle cx={x} cy={PAD.top + 20} r={4} fill="#f87171" opacity="0.85" />
              <line x1={x} y1={PAD.top + 16} x2={x} y2={isTop ? PAD.top + 4 : PAD.top + 36} stroke="#f87171" strokeWidth="0.8" opacity="0.5" />
              <text
                x={x} y={isTop ? PAD.top : PAD.top + 46}
                textAnchor="middle" fontSize="8" fontFamily="Syne,sans-serif" fontWeight="700"
                fill="rgba(147,197,253,0.8)"
              >
                {w.score}
              </text>
              <text
                x={x} y={isTop ? PAD.top - 8 : PAD.top + 55}
                textAnchor="middle" fontSize="7" fontFamily="Outfit,sans-serif"
                fill="rgba(100,116,139,0.8)"
              >
                {w.player.split(' ').pop()}
              </text>
            </g>
          )
        })}

        {/* Start marker */}
        <circle cx={PAD.left} cy={PAD.top + 20} r={2} fill="rgba(59,130,246,0.4)" />
        {/* End score */}
        <text
          x={PAD.left + innerW} y={PAD.top + 34}
          textAnchor="end" fontSize="8" fontFamily="Syne,sans-serif" fontWeight="700"
          fill="rgba(147,197,253,0.5)"
        >
          {totalRuns}
        </text>
      </svg>
    </div>
  )
}
