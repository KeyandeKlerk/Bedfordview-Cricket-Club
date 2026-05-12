'use client'
import { useState } from 'react'
import type { BallEvent, MatchPlayer } from '@/lib/cricket/types'
import { totalBallRuns } from '@/lib/cricket/engine'

interface Props {
  overs: BallEvent[][]
  fieldingPlayers: MatchPlayer[]
  playerName: (id: string) => string
  onConfirm: (overNumber: number, newBowlerId: string) => void
  onClose: () => void
}

export default function CorrectOverBowlerModal({
  overs,
  fieldingPlayers,
  playerName,
  onConfirm,
  onClose,
}: Props) {
  const [step, setStep] = useState<'pick_over' | 'pick_bowler'>('pick_over')
  const [selectedOverIndex, setSelectedOverIndex] = useState<number | null>(null)
  const [selectedBowlerId, setSelectedBowlerId] = useState<string | null>(null)

  const selectedOver = selectedOverIndex !== null ? overs[selectedOverIndex] : null
  const selectedOverNumber = selectedOver ? selectedOver[0].over_number : null
  const currentBowlerId = selectedOver ? selectedOver[0].bowler_id : null

  function handleConfirm() {
    if (selectedOverNumber === null || !selectedBowlerId) return
    onConfirm(selectedOverNumber, selectedBowlerId)
  }

  return (
    <>
      <style>{`
        .correct-bowler-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .correct-bowler-panel {
          background: var(--panel);
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 12px;
          padding: 24px 24px 20px;
          width: 100%;
          max-width: 440px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 40px rgba(56,189,248,0.1);
        }
        @media (max-width: 600px) {
          .correct-bowler-overlay { align-items: flex-end; padding: 0; }
          .correct-bowler-panel {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            padding: 20px 20px 32px;
            max-height: 92vh;
          }
        }
      `}</style>
      <div className="correct-bowler-overlay" onClick={onClose}>
        <div className="correct-bowler-panel" onClick={e => e.stopPropagation()}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(56,189,248,0.2)', margin: '0 auto 16px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(56,189,248,0.12)', border: '1px solid var(--sky)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--sky)' }}>
              ⟳
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: 'var(--sky)', margin: 0 }}>
              Correct bowler
            </h3>
          </div>

          {step === 'pick_over' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Select over to correct
              </div>

              {overs.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>
                  No overs bowled yet.
                </div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {overs.map((ovBalls, idx) => {
                    const overNum = ovBalls[0].over_number
                    const bowlerId = ovBalls[0].bowler_id
                    const runs = ovBalls.reduce((s, b) => s + totalBallRuns(b), 0)
                    const wkts = ovBalls.filter(b => b.dismissal_type !== null).length
                    const selected = selectedOverIndex === idx
                    return (
                      <button
                        key={overNum}
                        onClick={() => {
                          setSelectedOverIndex(idx)
                          setSelectedBowlerId(bowlerId)
                        }}
                        style={{
                          padding: '12px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          background: selected ? 'rgba(56,189,248,0.1)' : 'var(--surface)',
                          border: selected ? '2px solid var(--sky)' : '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: selected ? 'var(--sky)' : 'var(--text)' }}>
                            Over {overNum + 1}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {playerName(bowlerId)}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--dim)', textAlign: 'right' }}>
                          <div>{runs} runs</div>
                          {wkts > 0 && <div style={{ color: 'var(--red)', fontWeight: 600 }}>{wkts}W</div>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  disabled={selectedOverIndex === null}
                  onClick={() => setStep('pick_bowler')}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 8, cursor: selectedOverIndex !== null ? 'pointer' : 'not-allowed',
                    fontSize: 14, fontWeight: 700,
                    background: selectedOverIndex !== null ? 'rgba(56,189,248,0.15)' : 'transparent',
                    border: '1px solid var(--sky)', color: 'var(--sky)',
                    opacity: selectedOverIndex !== null ? 1 : 0.4,
                  }}
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {step === 'pick_bowler' && selectedOver && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Over {selectedOverNumber! + 1} · replacing
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {playerName(currentBowlerId!)}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                New bowler
              </div>
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {fieldingPlayers.map(p => {
                  const isCurrent = p.id === currentBowlerId
                  const isSelected = p.id === selectedBowlerId
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedBowlerId(p.id)}
                      style={{
                        padding: '13px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600,
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, minHeight: 50,
                        background: isSelected ? 'rgba(56,189,248,0.1)' : 'var(--surface)',
                        border: isSelected ? '2px solid var(--sky)' : '1px solid var(--border)',
                        color: isSelected ? 'var(--sky)' : isCurrent ? 'var(--dim)' : 'var(--text)',
                        opacity: isCurrent ? 0.5 : 1,
                      }}
                    >
                      {p.is_keeper && <span style={{ fontSize: 13, opacity: 0.7 }}>†</span>}
                      {p.is_captain && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>(C)</span>}
                      {playerName(p.id)}
                      {isCurrent && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dim)' }}>current</span>}
                      {isSelected && !isCurrent && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => { setStep('pick_over'); setSelectedBowlerId(currentBowlerId) }}
                  style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                  Back
                </button>
                <button
                  disabled={!selectedBowlerId || selectedBowlerId === currentBowlerId}
                  onClick={handleConfirm}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                    cursor: (selectedBowlerId && selectedBowlerId !== currentBowlerId) ? 'pointer' : 'not-allowed',
                    background: (selectedBowlerId && selectedBowlerId !== currentBowlerId) ? 'rgba(56,189,248,0.15)' : 'transparent',
                    border: '1px solid var(--sky)', color: 'var(--sky)',
                    opacity: (selectedBowlerId && selectedBowlerId !== currentBowlerId) ? 1 : 0.4,
                  }}
                >
                  Confirm change
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
