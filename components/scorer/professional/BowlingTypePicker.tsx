'use client'
import type { BowlingType } from '@/lib/cricket/types'

const TYPES: { value: BowlingType; label: string }[] = [
  { value: 'right_arm_fast',    label: 'RAP' },
  { value: 'right_arm_medium',  label: 'RAM' },
  { value: 'left_arm_fast',     label: 'LAP' },
  { value: 'left_arm_medium',   label: 'LAM' },
  { value: 'right_arm_off_spin', label: 'OBS' },
  { value: 'right_arm_leg_spin', label: 'LBS' },
  { value: 'left_arm_orthodox', label: 'SLA' },
  { value: 'left_arm_chinaman', label: 'CHN' },
]

const FULL_LABELS: Record<BowlingType, string> = {
  right_arm_fast: 'Right Arm Pace',
  right_arm_medium: 'Right Arm Medium',
  left_arm_fast: 'Left Arm Pace',
  left_arm_medium: 'Left Arm Medium',
  right_arm_off_spin: 'Off Spin',
  right_arm_leg_spin: 'Leg Spin',
  left_arm_orthodox: 'Left Arm Orthodox',
  left_arm_chinaman: 'Chinaman',
}

interface Props {
  selected: BowlingType | null
  onChange: (t: BowlingType | null) => void
}

export default function BowlingTypePicker({ selected, onChange }: Props) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Bowling Type {selected && <span style={{ color: 'var(--highlight)', textTransform: 'none', letterSpacing: 0 }}>— {FULL_LABELS[selected]}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(selected === value ? null : value)}
            title={FULL_LABELS[value]}
            style={{
              padding: '6px 10px', fontSize: 12, borderRadius: 6,
              border: '1px solid',
              borderColor: selected === value ? 'var(--blue-mid)' : 'var(--border)',
              background: selected === value ? 'rgba(37,99,235,0.18)' : 'var(--surface)',
              color: selected === value ? 'var(--highlight)' : 'var(--muted)',
              cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
