'use client'
import { useState } from 'react'

interface Props {
  labels: string[]
  children: React.ReactNode[]
}

export default function InningsTabSwitcher({ labels, children }: Props) {
  const [active, setActive] = useState(0)
  if (labels.length <= 1) return <>{children[0]}</>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13,
              border: '1px solid',
              borderColor: active === i ? 'var(--blue-mid)' : 'var(--border)',
              background: active === i ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: active === i ? 'var(--highlight)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {children[active]}
    </div>
  )
}
