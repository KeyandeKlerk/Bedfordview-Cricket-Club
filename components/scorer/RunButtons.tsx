'use client'
import { useRef } from 'react'

interface Props {
  onRun: (runs: number, isBoundaryFour: boolean, isBoundarySix: boolean) => void
  disabled?: boolean
}

function RunBtn({ r, disabled, onClick }: { r: number; disabled?: boolean; onClick: () => void }) {
  const isFour = r === 4
  const isSix = r === 6

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 'clamp(56px, 10vw, 80px)',
        borderRadius: 10,
        border: isFour
          ? '2px solid var(--lime)'
          : isSix
          ? '2px solid var(--gold)'
          : '1px solid var(--border)',
        background: isFour
          ? 'rgba(59,130,246,0.18)'
          : isSix
          ? 'rgba(255,200,0,0.15)'
          : 'var(--surface)',
        color: isFour ? 'var(--lime)' : isSix ? 'var(--gold)' : 'var(--text)',
        fontFamily: 'var(--font-display)',
        fontSize: r === 0 ? 26 : 30,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.1s',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {r === 0 ? '0' : r}
    </button>
  )
}

export default function RunButtons({ onRun, disabled }: Props) {
  const lastClickTime = useRef(0)
  const DEBOUNCE_MS = 400

  function handleClick(runs: number) {
    const now = Date.now()
    if (now - lastClickTime.current < DEBOUNCE_MS) return
    lastClickTime.current = now
    onRun(runs, runs === 4, runs === 6)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Top row: 0–3 (most common, equal width) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[0, 1, 2, 3].map(r => (
          <RunBtn key={r} r={r} disabled={disabled} onClick={() => handleClick(r)} />
        ))}
      </div>
      {/* Bottom row: 4 and 6 take 2/5 each, 5 takes 1/5 (visually de-prioritised) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 10 }}>
        {[4, 5, 6].map(r => (
          <RunBtn key={r} r={r} disabled={disabled} onClick={() => handleClick(r)} />
        ))}
      </div>
    </div>
  )
}
