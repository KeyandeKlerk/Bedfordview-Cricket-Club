'use client'
import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '11px 18px', borderRadius: 8,
        border: copied ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(59,130,246,0.35)',
        background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(37,99,235,0.1)',
        color: copied ? '#86efac' : '#93c5fd',
        fontFamily: 'var(--font-display)',
        fontSize: 12, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.2s',
        minHeight: 44,
        letterSpacing: '0.05em',
        width: '100%',
        touchAction: 'manipulation',
      }}
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy Reference
        </>
      )}
    </button>
  )
}
