'use client'

interface Props {
  label: string
  options: string[]
  selected: string | null
  onChange: (v: string | null) => void
}

export default function QualityPicker({ label, options, selected, onChange }: Props) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(selected === opt ? null : opt)}
            style={{
              flex: 1, padding: '7px 4px', fontSize: 12, borderRadius: 6,
              border: '1px solid',
              borderColor: selected === opt ? 'var(--blue-mid)' : 'var(--border)',
              background: selected === opt ? 'rgba(37,99,235,0.18)' : 'var(--surface)',
              color: selected === opt ? 'var(--highlight)' : 'var(--muted)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
