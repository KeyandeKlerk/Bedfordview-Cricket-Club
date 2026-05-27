'use client'

type PitchLength = 'full_toss' | 'yorker' | 'full' | 'good_length' | 'short' | 'bouncer'
type PitchLine = 'wide_outside_off' | 'outside_off' | 'off_stump' | 'middle' | 'leg_stump' | 'outside_leg'

const LENGTHS: PitchLength[] = ['bouncer', 'short', 'good_length', 'full', 'yorker', 'full_toss']
const LINES: PitchLine[] = ['wide_outside_off', 'outside_off', 'off_stump', 'middle', 'leg_stump', 'outside_leg']

const LENGTH_LABELS: Record<PitchLength, string> = {
  bouncer: 'Bouncer',
  short: 'Short',
  good_length: 'Good len.',
  full: 'Full',
  yorker: 'Yorker',
  full_toss: 'Full toss',
}

const LINE_LABELS: Record<PitchLine, string> = {
  wide_outside_off: 'WO Off',
  outside_off: 'Out Off',
  off_stump: 'Off',
  middle: 'Mid',
  leg_stump: 'Leg',
  outside_leg: 'Out Leg',
}

interface LengthHeatmapProps {
  balls: Array<{
    pitch_length: string | null
    pitch_line: string | null
    runs_off_bat: number
    extras_runs?: number
    dismissal_type?: string | null
  }>
  metric?: 'count' | 'runs' | 'wickets'
}

export default function LengthHeatmap({ balls, metric = 'count' }: LengthHeatmapProps) {
  const annotated = balls.filter(b => b.pitch_length && b.pitch_line)

  if (annotated.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>
        No pitch map data recorded yet.
      </div>
    )
  }

  // Build cell values
  type CellKey = `${string}:${string}`
  const cells = new Map<CellKey, number>()
  for (const b of annotated) {
    const key = `${b.pitch_length}:${b.pitch_line}` as CellKey
    const delta = metric === 'wickets'
      ? (b.dismissal_type ? 1 : 0)
      : metric === 'runs'
      ? b.runs_off_bat + (b.extras_runs ?? 0)
      : 1
    cells.set(key, (cells.get(key) ?? 0) + delta)
  }

  const maxVal = Math.max(...cells.values(), 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 4 }}>
        <div style={{ width: 64 }} />
        {LINES.map(line => (
          <div key={line} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--dim)', lineHeight: 1.2 }}>
            {LINE_LABELS[line]}
          </div>
        ))}
      </div>
      {LENGTHS.map(length => (
        <div key={length} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: 64, fontSize: 10, color: 'var(--muted)', textAlign: 'right', paddingRight: 8, flexShrink: 0 }}>
            {LENGTH_LABELS[length]}
          </div>
          {LINES.map(line => {
            const key = `${length}:${line}` as CellKey
            const val = cells.get(key) ?? 0
            const intensity = val / maxVal
            const bg = `rgba(37,99,235,${(0.1 + intensity * 0.85).toFixed(2)})`
            return (
              <div
                key={line}
                title={`${LENGTH_LABELS[length]} × ${LINE_LABELS[line]}: ${val}`}
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  background: val > 0 ? bg : 'rgba(15,23,42,0.3)',
                  border: '1px solid rgba(51,65,85,0.3)',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: intensity > 0.5 ? '#fff' : 'var(--muted)',
                  margin: '0 1px',
                  minHeight: 28,
                }}
              >
                {val > 0 ? val : ''}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
