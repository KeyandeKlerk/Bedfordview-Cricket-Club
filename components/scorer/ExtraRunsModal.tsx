'use client'
import { useState } from 'react'
import type { ExtrasType } from '@/lib/cricket/types'

interface Props {
  extrasType: ExtrasType
  onConfirm: (extrasRuns: number, batRuns: number) => void
  onClose: () => void
}

export default function ExtraRunsModal({ extrasType, onConfirm, onClose }: Props) {
  const isWide   = extrasType === 'wide'
  const isNoBall = extrasType === 'no_ball'

  const [extraRuns, setExtraRuns] = useState(1)
  const [batRuns, setBatRuns]     = useState(0)

  const title: Record<ExtrasType, string> = {
    wide:    'Wide',
    no_ball: 'No Ball',
    bye:     'Bye',
    leg_bye: 'Leg Bye',
    penalty: 'Penalty Runs',
  }

  function submit() {
    if (isWide) {
      onConfirm(extraRuns, 0)
    } else if (isNoBall) {
      onConfirm(1, batRuns)
    } else {
      onConfirm(extraRuns, 0)
    }
    onClose()
  }

  const runOptions = [1, 2, 3, 4, 5, 6]

  // For bye/leg-bye/penalty: tapping a run count confirms immediately — no separate Confirm button.
  // For wide/no-ball: still need explicit confirm (NB needs bat runs too; wide for extra runs)
  const autoConfirm = !isWide && !isNoBall

  return (
    <>
      <style>{`
        .extras-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.75);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 1000;
        }
        .extras-sheet {
          background: var(--panel); border: 1px solid var(--border);
          border-top-left-radius: 16px; border-top-right-radius: 16px;
          border-bottom-left-radius: 0; border-bottom-right-radius: 0;
          padding: 20px 20px 32px;
          width: 100%; max-width: 480px;
        }
        @media (min-width: 600px) {
          .extras-overlay { align-items: center; }
          .extras-sheet { border-radius: 12px; max-width: 400px; padding: 24px; }
        }
      `}</style>
      <div className="extras-overlay" onClick={onClose}>
        <div className="extras-sheet" onClick={e => e.stopPropagation()}>
          {/* Drag handle */}
          <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(147,197,253,0.2)', margin: '0 auto 16px' }} />

          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, textTransform: 'uppercase', marginBottom: autoConfirm ? 6 : 20 }}>
            {title[extrasType]}
          </h3>

          {autoConfirm && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Tap runs to confirm</div>
          )}

          {/* Extra runs */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              {isWide ? 'Total runs (penalty + overthrows)' :
               isNoBall ? 'No-ball penalty (fixed at 1)' :
               'Runs scored'}
            </div>
            {isNoBall ? (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--muted)', padding: '8px 0' }}>1</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {runOptions.map(n => {
                  // For wide: pre-highlight 1 as the default (most common case)
                  const isSelected = !autoConfirm && extraRuns === n
                  const isWideDefault = isWide && n === 1 && extraRuns === 1
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        if (autoConfirm) {
                          onConfirm(n, 0)
                          onClose()
                        } else {
                          setExtraRuns(n)
                        }
                      }}
                      className={isSelected || isWideDefault ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ height: 56, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, padding: '0', justifyContent: 'center' }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* No-ball: bat runs batter scored */}
          {isNoBall && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Bat runs scored</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                {[0, 1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setBatRuns(n)}
                    className={batRuns === n ? 'btn btn-primary' : 'btn btn-ghost'}
                    style={{ height: 56, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, padding: '0', justifyContent: 'center' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 8 }}>
                {[4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setBatRuns(n)}
                    className={batRuns === n ? 'btn btn-primary' : 'btn btn-ghost'}
                    style={{ height: 56, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, padding: '0', justifyContent: 'center' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Wide: bat runs locked to 0 */}
          {isWide && (
            <div style={{ marginBottom: 20, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>Batter runs: <strong style={{ color: 'var(--text)' }}>0</strong></span>
              <span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 8 }}>(bat cannot score off a wide)</span>
            </div>
          )}

          {/* Confirm button only for wide and no-ball */}
          {!autoConfirm && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center', minHeight: 50 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submit} style={{ flex: 2, justifyContent: 'center', minHeight: 50, fontSize: 16 }}>
                Confirm
              </button>
            </div>
          )}

          {/* Cancel-only for bye/leg-bye/penalty (auto-confirm on run tap) */}
          {autoConfirm && (
            <button className="btn btn-ghost" onClick={onClose} style={{ width: '100%', justifyContent: 'center', minHeight: 46, marginTop: 4 }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </>
  )
}
