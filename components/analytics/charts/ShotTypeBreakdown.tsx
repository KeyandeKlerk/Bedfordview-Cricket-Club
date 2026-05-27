'use client'

type ShotType = 'drive' | 'cut' | 'pull' | 'sweep' | 'glance' | 'block' | 'leave' | 'slog' | 'ramp'

const SHOT_ORDER: ShotType[] = ['drive', 'cut', 'pull', 'sweep', 'glance', 'block', 'leave', 'slog', 'ramp']

const SHOT_LABELS: Record<ShotType, string> = {
  drive: 'Drive', cut: 'Cut', pull: 'Pull', sweep: 'Sweep',
  glance: 'Glance', block: 'Block', leave: 'Leave', slog: 'Slog', ramp: 'Ramp',
}

interface ShotTypeBreakdownProps {
  balls: Array<{
    shot_type: string | null
    runs_off_bat: number
    is_boundary_four?: boolean
    is_boundary_six?: boolean
    dismissal_type?: string | null
  }>
}

interface ShotStats {
  total: number
  dots: number
  singles: number
  boundaries: number
  sixes: number
  dismissals: number
}

export default function ShotTypeBreakdown({ balls }: ShotTypeBreakdownProps) {
  const annotated = balls.filter(b => b.shot_type)

  if (annotated.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>
        No shot type data recorded yet.
      </div>
    )
  }

  const stats = new Map<string, ShotStats>()
  for (const b of annotated) {
    const s = b.shot_type!
    const cur = stats.get(s) ?? { total: 0, dots: 0, singles: 0, boundaries: 0, sixes: 0, dismissals: 0 }
    cur.total++
    if (b.runs_off_bat === 0 && !b.dismissal_type) cur.dots++
    else if (b.runs_off_bat === 1) cur.singles++
    if (b.is_boundary_four) cur.boundaries++
    if (b.is_boundary_six) cur.sixes++
    if (b.dismissal_type) cur.dismissals++
    stats.set(s, cur)
  }

  const rows = SHOT_ORDER.filter(s => stats.has(s)).map(s => ({ shot: s, ...stats.get(s)! }))
  if (rows.length === 0) return null

  const maxTotal = Math.max(...rows.map(r => r.total), 1)

  return (
    <div>
      {rows.map(r => {
        const w = (n: number) => `${((n / maxTotal) * 100).toFixed(1)}%`
        return (
          <div key={r.shot} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--text)' }}>{SHOT_LABELS[r.shot as ShotType]}</span>
              <span style={{ color: 'var(--muted)' }}>{r.total} balls</span>
            </div>
            <div style={{ display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden', background: 'rgba(15,23,42,0.4)' }}>
              <div title={`Dots: ${r.dots}`} style={{ width: w(r.dots), background: 'rgba(148,163,184,0.35)', transition: 'width 0.3s' }} />
              <div title={`Singles: ${r.singles}`} style={{ width: w(r.singles), background: '#3b82f6', transition: 'width 0.3s' }} />
              <div title={`Fours: ${r.boundaries}`} style={{ width: w(r.boundaries), background: '#f59e0b', transition: 'width 0.3s' }} />
              <div title={`Sixes: ${r.sixes}`} style={{ width: w(r.sixes), background: '#22c55e', transition: 'width 0.3s' }} />
              <div title={`Dismissals: ${r.dismissals}`} style={{ width: w(r.dismissals), background: '#ef4444', transition: 'width 0.3s' }} />
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {[
          { label: 'Dot', color: 'rgba(148,163,184,0.6)' },
          { label: 'Single', color: '#3b82f6' },
          { label: 'Four', color: '#f59e0b' },
          { label: 'Six', color: '#22c55e' },
          { label: 'Wicket', color: '#ef4444' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span style={{ color: 'var(--muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
