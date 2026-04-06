'use client'
import { useState } from 'react'
import type { DismissalType, MatchPlayer } from '@/lib/cricket/types'

interface Props {
  strikerId: string
  nonStrikerId: string
  fieldingPlayers: MatchPlayer[]      // players on the fielding side
  isFreeHit: boolean
  playerName: (id: string) => string
  onConfirm: (args: {
    dismissalType: DismissalType
    dismissedPlayerId: string
    fielderId: string | null
    fielderSubstituteName: string | null
  }) => void
  onClose: () => void
}

type Step = 'type' | 'fielder'

const ALL_DISMISSAL_TYPES: { type: DismissalType; label: string; needsFielder: boolean; noNullBowler: boolean }[] = [
  { type: 'bowled',            label: 'Bowled',           needsFielder: false, noNullBowler: true  },
  { type: 'caught',            label: 'Caught',           needsFielder: true,  noNullBowler: true  },
  { type: 'lbw',               label: 'LBW',              needsFielder: false, noNullBowler: true  },
  { type: 'run_out',           label: 'Run Out',          needsFielder: true,  noNullBowler: true  },
  { type: 'stumped',           label: 'Stumped',          needsFielder: true,  noNullBowler: true  },
  { type: 'hit_wicket',        label: 'Hit Wicket',       needsFielder: false, noNullBowler: true  },
  { type: 'handled_ball',      label: 'Handled Ball',     needsFielder: false, noNullBowler: false },
  { type: 'obstructing_field', label: 'Obstructing',      needsFielder: false, noNullBowler: false },
  { type: 'timed_out',         label: 'Timed Out',        needsFielder: false, noNullBowler: false },
  { type: 'retired_hurt',      label: 'Retired Hurt',     needsFielder: false, noNullBowler: false },
  { type: 'retired_out',       label: 'Retired Out',      needsFielder: false, noNullBowler: false },
]

export default function WicketModal({
  strikerId,
  nonStrikerId,
  fieldingPlayers,
  isFreeHit,
  playerName,
  onConfirm,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<DismissalType | null>(null)
  const [isNonStrikerOut, setIsNonStrikerOut] = useState(false)
  const [fielderId, setFielderId] = useState<string | null>(null)
  const [substituteMode, setSubstituteMode] = useState(false)
  const [substituteName, setSubstituteName] = useState('')

  const dismissedId = isNonStrikerOut ? nonStrikerId : strikerId

  // On free hit: only run_out is allowed
  const availableTypes = isFreeHit
    ? ALL_DISMISSAL_TYPES.filter(d => d.type === 'run_out')
    : ALL_DISMISSAL_TYPES

  const keeperId = fieldingPlayers.find(p => p.is_keeper)?.id ?? null

  function handleSelectType(type: DismissalType) {
    setSelectedType(type)
    const meta = ALL_DISMISSAL_TYPES.find(d => d.type === type)!

    if (meta.needsFielder) {
      // Pre-select keeper for stumped
      if (type === 'stumped' && keeperId) setFielderId(keeperId)
      setStep('fielder')
    } else {
      // Confirm immediately
      onConfirm({
        dismissalType: type,
        dismissedPlayerId: dismissedId,
        fielderId: null,
        fielderSubstituteName: null,
      })
      onClose()
    }
  }

  function handleConfirmFielder() {
    if (!selectedType) return
    onConfirm({
      dismissalType: selectedType,
      dismissedPlayerId: dismissedId,
      fielderId: substituteMode ? null : fielderId,
      fielderSubstituteName: substituteMode ? substituteName.trim() || null : null,
    })
    onClose()
  }

  return (
    <>
      <style>{`
        .wicket-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .wicket-panel {
          background: var(--panel);
          border: 1px solid rgba(224,60,46,0.4);
          border-radius: 12px;
          padding: 24px 24px 20px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 8px 40px rgba(224,60,46,0.15);
          max-height: 90vh;
          overflow-y: auto;
        }
        @media (max-width: 600px) {
          .wicket-overlay { align-items: flex-end; padding: 0; }
          .wicket-panel {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            padding: 20px 20px 32px;
            max-height: 92vh;
          }
        }
      `}</style>
      <div className="wicket-overlay" onClick={onClose}>
      <div className="wicket-panel" onClick={e => e.stopPropagation()}>
        {/* Drag handle — mobile bottom sheet affordance */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(224,60,46,0.3)', margin: '0 auto 16px' }} />
        {isFreeHit && (
          <div style={{ background: 'rgba(184,240,0,0.1)', border: '1px solid var(--lime)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--lime)', fontWeight: 600 }}>
            FREE HIT — only run-out is allowed
          </div>
        )}

        {step === 'type' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(224,60,46,0.15)', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--red)' }}>W</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, textTransform: 'uppercase', color: 'var(--red)', margin: 0 }}>
                Wicket
              </h3>
            </div>

            {/* Who's dismissed */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Dismissed</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setIsNonStrikerOut(false)}
                  style={{
                    flex: 1, padding: '12px 14px', minHeight: 56, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'left',
                    background: !isNonStrikerOut ? 'rgba(224,60,46,0.12)' : 'var(--surface)',
                    border: !isNonStrikerOut ? '2px solid var(--red)' : '1px solid var(--border)',
                    color: !isNonStrikerOut ? 'var(--red)' : 'var(--muted)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'inherit', opacity: 0.7, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Striker *</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName(strikerId)}</div>
                </button>
                <button
                  onClick={() => setIsNonStrikerOut(true)}
                  style={{
                    flex: 1, padding: '12px 14px', minHeight: 56, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'left',
                    background: isNonStrikerOut ? 'rgba(224,60,46,0.12)' : 'var(--surface)',
                    border: isNonStrikerOut ? '2px solid var(--red)' : '1px solid var(--border)',
                    color: isNonStrikerOut ? 'var(--red)' : 'var(--muted)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'inherit', opacity: 0.7, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non-striker</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName(nonStrikerId)}</div>
                </button>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Dismissal type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {availableTypes.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleSelectType(type)}
                  style={{
                    padding: '13px 14px', minHeight: 48, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              style={{ width: '100%', marginTop: 16, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}
            >
              Cancel
            </button>
          </>
        )}

        {step === 'fielder' && selectedType && (
          <>
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: 'var(--red)', margin: '0 0 4px' }}>
                {selectedType === 'caught' ? 'Caught by' : selectedType === 'stumped' ? 'Stumped by' : 'Run out by'}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{playerName(dismissedId)}</span>
                {' — '}{selectedType.replace(/_/g, ' ')}
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                checked={substituteMode}
                onChange={e => setSubstituteMode(e.target.checked)}
                style={{ accentColor: 'var(--lime)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Substitute fielder</span>
            </label>

            {substituteMode ? (
              <input
                type="text"
                placeholder="Substitute fielder name"
                value={substituteName}
                onChange={e => setSubstituteName(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', marginBottom: 14,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '40vh', overflowY: 'auto', marginBottom: 14 }}>
                {fieldingPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFielderId(p.id)}
                    style={{
                      padding: '13px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 600,
                      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                      minHeight: 50,
                      background: fielderId === p.id ? 'rgba(184,240,0,0.1)' : 'var(--surface)',
                      border: fielderId === p.id ? '1px solid var(--lime)' : '1px solid var(--border)',
                      color: fielderId === p.id ? 'var(--lime)' : 'var(--text)',
                    }}
                  >
                    {p.is_keeper && <span style={{ fontSize: 13, opacity: 0.7 }}>†</span>}
                    {p.is_captain && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>(C)</span>}
                    {playerName(p.id)}
                    {fielderId === p.id && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setStep('type')
                  setFielderId(null)
                  setSubstituteMode(false)
                  setSubstituteName('')
                }}
                style={{ flex: 1, padding: '14px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, minHeight: 52 }}
              >
                Back
              </button>
              <button
                onClick={handleConfirmFielder}
                disabled={!substituteMode && !fielderId && selectedType !== 'run_out'}
                style={{
                  flex: 2, padding: '14px', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700,
                  minHeight: 52,
                  background: (!substituteMode && !fielderId && selectedType !== 'run_out') ? 'rgba(184,240,0,0.05)' : 'rgba(184,240,0,0.15)',
                  border: '1px solid var(--lime)', color: 'var(--lime)',
                  opacity: (!substituteMode && !fielderId && selectedType !== 'run_out') ? 0.4 : 1,
                }}
              >
                Confirm Wicket
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </>
  )
}
