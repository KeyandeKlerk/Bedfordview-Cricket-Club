'use client'
import type { ShotType } from '@/lib/cricket/types'

const SHOTS: ShotType[] = ['drive', 'cut', 'pull', 'sweep', 'glance', 'block', 'leave', 'slog', 'ramp']

interface Props {
  selected: ShotType | null
  onChange: (s: ShotType | null) => void
}

export default function ShotTypePicker({ selected, onChange }: Props) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Shot Type
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SHOTS.map(shot => (
          <button
            key={shot}
            type="button"
            onClick={() => onChange(selected === shot ? null : shot)}
            style={{
              padding: '6px 10px', fontSize: 12, borderRadius: 6,
              border: '1px solid',
              borderColor: selected === shot ? 'var(--blue-mid)' : 'var(--border)',
              background: selected === shot ? 'rgba(37,99,235,0.18)' : 'var(--surface)',
              color: selected === shot ? 'var(--highlight)' : 'var(--muted)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {shot}
          </button>
        ))}
      </div>
    </div>
  )
}
