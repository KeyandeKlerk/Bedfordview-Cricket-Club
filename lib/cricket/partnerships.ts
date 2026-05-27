import type { BallEvent } from './types'

export interface Partnership {
  wicket: number    // 0 = unbroken current partnership
  runs: number
  balls: number
  batter1: string   // dismissed (or current striker if unbroken)
  batter2: string   // surviving partner (or current non-striker)
}

export function computePartnerships(balls: BallEvent[], playerNameMap: Map<string, string>): Partnership[] {
  const ps: Partnership[] = []
  let start = 0

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]
    if (!b.dismissal_type) continue

    const seg = balls.slice(start, i + 1)
    const runs = seg.reduce((s, x) => s + x.runs_off_bat + x.extras_runs, 0)
    const legalBalls = seg.filter(x => x.extras_type !== 'wide' && x.extras_type !== 'no_ball').length

    ps.push({
      wicket: ps.length + 1,
      runs, balls: legalBalls,
      batter1: playerNameMap.get(b.batter_id) ?? '?',
      batter2: playerNameMap.get(b.non_striker_id) ?? '?',
    })
    start = i + 1
  }

  // Unbroken current partnership
  if (start < balls.length) {
    const seg = balls.slice(start)
    const runs = seg.reduce((s, x) => s + x.runs_off_bat + x.extras_runs, 0)
    const legalBalls = seg.filter(x => x.extras_type !== 'wide' && x.extras_type !== 'no_ball').length
    const last = seg[seg.length - 1]
    ps.push({
      wicket: 0, runs, balls: legalBalls,
      batter1: playerNameMap.get(last.batter_id) ?? '?',
      batter2: playerNameMap.get(last.non_striker_id) ?? '?',
    })
  }

  return ps
}
