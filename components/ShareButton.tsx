'use client'
import { useState } from 'react'

interface Props {
  title: string
  text?: string
}

export default function ShareButton({ title, text }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title, text, url }) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 7,
        border: '1px solid rgba(59,130,246,0.25)',
        background: 'rgba(37,99,235,0.08)',
        color: 'rgba(147,197,253,0.7)',
        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied' : '↗ Share'}
    </button>
  )
}
