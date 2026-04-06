'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '13px 20px', borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.02)',
        color: 'var(--muted)',
        fontFamily: 'var(--font-display)',
        fontSize: 13, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.15s',
        minHeight: 48,
        width: '100%',
        touchAction: 'manipulation',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
      </svg>
      Print / Save PDF
    </button>
  )
}
