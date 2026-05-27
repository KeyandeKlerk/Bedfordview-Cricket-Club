'use client'
import { useState } from 'react'

export default function CollapsiblePanel({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="profile-panel">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '16px 22px', boxSizing: 'border-box',
          background: 'transparent', border: 'none',
          borderBottom: open ? '1px solid rgba(59,130,246,0.1)' : 'none',
          cursor: 'pointer', textAlign: 'left', outline: 'none', color: 'inherit',
          minHeight: 52,
        }}
      >
        <span className="panel-title">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{
            color: 'rgba(147,197,253,0.35)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0, marginLeft: 12,
          }}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && children}
    </div>
  )
}
