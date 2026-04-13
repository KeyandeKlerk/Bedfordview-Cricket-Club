import type { BattingInning } from '@/lib/stats/types'

export default function ScatterPlot({ innings }: { innings: BattingInning[] }) {
  const valid = innings.filter(i => i.balls_faced != null && i.runs != null && i.balls_faced > 0)
  if (valid.length < 3) return null
  const maxBalls = Math.max(...valid.map(i => i.balls_faced!), 10)
  const maxRuns = Math.max(...valid.map(i => i.runs!), 10)
  const W = 380, H = 200
  const PAD = { top: 10, bottom: 32, left: 38, right: 10 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom
  const toX = (b: number) => PAD.left + (b / maxBalls) * iW
  const toY = (r: number) => PAD.top + (1 - r / maxRuns) * iH
  const diagEnd = Math.min(maxBalls, maxRuns)

  const yTicks = [0, Math.round(maxRuns * 0.5), maxRuns]
  const xTicks = [0, Math.round(maxBalls * 0.5), maxBalls]

  return (
    <div className="chart-wrap">
      <div className="chart-label-top">Runs vs Balls Faced — dots above diagonal = SR &gt; 100</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={PAD.left + iW} y2={toY(v)} stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
            <text x={PAD.left - 4} y={toY(v) + 3} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">{v}</text>
          </g>
        ))}
        {xTicks.map(v => (
          <g key={v}>
            <line x1={toX(v)} y1={PAD.top} x2={toX(v)} y2={PAD.top + iH} stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
            <text x={toX(v)} y={H - 14} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">{v}</text>
          </g>
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + iH} stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH} stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1={toX(0)} y1={toY(0)} x2={toX(diagEnd)} y2={toY(diagEnd)} stroke="rgba(56,189,248,0.25)" strokeWidth="1" strokeDasharray="4,3" />
        <text x={toX(diagEnd)} y={toY(diagEnd) - 5} fill="rgba(56,189,248,0.4)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="end">SR=100</text>
        <text x={8} y={PAD.top + iH / 2} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle" transform={`rotate(-90,8,${PAD.top + iH / 2})`}>Runs</text>
        <text x={PAD.left + iW / 2} y={H - 2} fill="rgba(147,197,253,0.3)" fontSize="8" fontFamily="Outfit,sans-serif" textAnchor="middle">Balls</text>
        {valid.map((inn, i) => {
          const x = toX(inn.balls_faced!)
          const y = toY(inn.runs!)
          const big = (inn.runs ?? 0) >= 50
          const notOut = !inn.dismissal_type
          return (
            <circle key={i} cx={x} cy={y} r={big ? 5 : 3}
              fill={big ? '#fbbf24' : notOut ? 'rgba(74,222,128,0.75)' : 'rgba(59,130,246,0.65)'}
              stroke={big ? 'rgba(245,158,11,0.5)' : 'none'} strokeWidth="1.5" />
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, padding: '6px 0 0', fontSize: 10, fontFamily: 'Outfit,sans-serif', color: 'rgba(147,197,253,0.4)' }}>
        <span><span style={{ color: '#fbbf24' }}>●</span> 50+</span>
        <span><span style={{ color: 'rgba(74,222,128,0.75)' }}>●</span> Not out</span>
        <span><span style={{ color: 'rgba(59,130,246,0.65)' }}>●</span> Dismissed</span>
      </div>
    </div>
  )
}
