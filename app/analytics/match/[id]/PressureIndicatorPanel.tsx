'use client'
import RequiredRateChart from '@/components/analytics/charts/RequiredRateChart'
import type { BallEvent } from '@/lib/cricket/types'

interface Props {
  balls: Pick<BallEvent, 'over_number' | 'runs_off_bat' | 'extras_runs' | 'extras_type'>[]
  target: number
  overs_per_innings: number
}

export default function PressureIndicatorPanel({ balls, target, overs_per_innings }: Props) {
  // Build cumulative run data per over
  const overMap = new Map<number, number>()
  for (const b of balls) {
    const runs = b.runs_off_bat + b.extras_runs
    overMap.set(b.over_number, (overMap.get(b.over_number) ?? 0) + runs)
  }

  const data: Array<{ over: number; actualRuns: number; requiredRate: number }> = []
  let cumulative = 0
  for (let ov = 0; ov < overs_per_innings; ov++) {
    cumulative += overMap.get(ov) ?? 0
    const oversLeft = overs_per_innings - ov - 1
    const runsNeeded = target - cumulative
    const rr = oversLeft > 0 ? runsNeeded / oversLeft : runsNeeded > 0 ? 99 : 0
    data.push({ over: ov + 1, actualRuns: cumulative, requiredRate: Math.max(0, rr) })
    if (ov >= Math.max(...[...overMap.keys()]) && ov > 0) break
  }

  if (data.length < 2) return null

  return (
    <div style={{ marginTop: 24 }}>
      <RequiredRateChart data={data} target={target} totalOvers={overs_per_innings} />
    </div>
  )
}
