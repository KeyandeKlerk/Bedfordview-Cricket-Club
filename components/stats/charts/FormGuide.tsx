import type { BattingInning } from '@/lib/stats/types'

export default function FormGuide({ innings, average }: { innings: BattingInning[], average: number | null }) {
  const shown = [...innings].slice(0, 10).reverse()
  if (!shown.length) return null
  const maxRuns = Math.max(...shown.map(i => i.runs ?? 0), 1)
  return (
    <div className="form-guide">
      <div className="form-guide-bars">
        {shown.map((inn, i) => {
          const runs = inn.runs ?? 0
          const isOut = !!inn.dismissal_type
          const color = (runs === 0 && isOut) ? '#ef4444'
            : runs >= 100 ? '#fbbf24'
            : runs >= 50 ? '#38bdf8'
            : (average && runs >= Number(average)) ? '#4ade80'
            : 'rgba(59,130,246,0.55)'
          const height = Math.max((runs / maxRuns) * 84, runs === 0 ? 6 : 3)
          return (
            <div key={i} className="form-bar-wrap" title={`${runs}${!isOut ? '*' : ''} vs ${inn.opposition_name ?? '?'} — ${inn.match_date ? new Date(inn.match_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : ''}`}>
              <div className="form-bar-runs">{runs}{!isOut ? '*' : ''}</div>
              <div className="form-bar-body" style={{ height, background: color }} />
              <div className="form-bar-opp">{(inn.opposition_name ?? '?').slice(0, 8)}</div>
            </div>
          )
        })}
      </div>
      <div className="form-legend">
        <span style={{ color: '#fbbf24' }}>■</span> 100+&nbsp;&nbsp;
        <span style={{ color: '#38bdf8' }}>■</span> 50+&nbsp;&nbsp;
        <span style={{ color: '#4ade80' }}>■</span> Above avg&nbsp;&nbsp;
        <span style={{ color: 'rgba(59,130,246,0.55)' }}>■</span> Below avg&nbsp;&nbsp;
        <span style={{ color: '#ef4444' }}>■</span> Duck
      </div>
    </div>
  )
}
