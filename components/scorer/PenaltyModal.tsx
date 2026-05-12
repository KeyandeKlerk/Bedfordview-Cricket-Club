'use client'
import { useState } from 'react'

interface Props {
  battingTeamName: string
  fieldingTeamName: string
  onConfirm: (reason: string, toFielding: boolean) => void
  onClose: () => void
}

const BATTING_REASONS = [
  'Helmet on field struck by ball (Law 28)',
  'Illegal fielding — fielder used clothing or equipment (Law 28)',
  'Fielder returned to field without umpire permission (Law 41)',
  'Deliberate distraction or obstruction of batsman (Law 41)',
  'Pitch damage or time wasting by fielding side — after warning (Law 41)',
  'Ball tampering by fielding side (Law 41.3)',
  'Other unfair play by fielding side (Law 41.2.1)',
  'Player conduct Level 1 — dissent, obscene language, excessive appealing (Law 42)',
  'Player conduct Level 2 — serious dissent, physical contact, throwing ball dangerously (Law 42)',
  'Player conduct Level 3 — intimidating umpire, threatening to assault (Law 42)',
  'Player conduct Level 4 — assaulting umpire or physical assault (Law 42)',
]

const FIELDING_REASONS = [
  'Deliberate short run or stealing a run (Law 41)',
  'Time wasting by batting side — after warning (Law 41)',
  'Pitch damage by batting side — after warning (Law 41)',
  'Ball tampering by batting side (Law 41.3)',
  'Other unfair play by batting side (Law 41.2.1)',
  'Player conduct Level 1 — dissent, obscene language, excessive appealing (Law 42)',
  'Player conduct Level 2 — serious dissent, physical contact, throwing ball dangerously (Law 42)',
  'Player conduct Level 3 — intimidating umpire, threatening to assault (Law 42)',
  'Player conduct Level 4 — assaulting umpire or physical assault (Law 42)',
]

export default function PenaltyModal({ battingTeamName, fieldingTeamName, onConfirm, onClose }: Props) {
  const [toFielding, setToFielding] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)

  const reasons = toFielding ? FIELDING_REASONS : BATTING_REASONS
  const recipientName = toFielding ? fieldingTeamName : battingTeamName

  function handleToggleSide(fielding: boolean) {
    setToFielding(fielding)
    setSelectedReason(null)
  }

  return (
    <>
      <style>{`
        .penalty-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 16px;
        }
        .penalty-panel {
          background: var(--panel);
          border: 1px solid rgba(184,240,0,0.3);
          border-radius: 12px;
          padding: 24px 24px 20px;
          width: 100%;
          max-width: 440px;
          max-height: 88vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 40px rgba(184,240,0,0.08);
        }
        @media (max-width: 600px) {
          .penalty-overlay { align-items: flex-end; padding: 0; }
          .penalty-panel {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            padding: 20px 20px 32px;
            max-height: 92vh;
          }
        }
      `}</style>
      <div className="penalty-overlay" onClick={onClose}>
        <div className="penalty-panel" onClick={e => e.stopPropagation()}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(184,240,0,0.2)', margin: '0 auto 16px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(184,240,0,0.12)', border: '1px solid var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: 'var(--lime)', fontFamily: 'var(--font-display)' }}>
              P
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: 'var(--lime)', margin: 0 }}>
                Penalty Runs · 5
              </h3>
            </div>
          </div>

          {/* Who receives the runs */}
          <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Runs awarded to
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button
              onClick={() => handleToggleSide(false)}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: !toFielding ? 'rgba(184,240,0,0.12)' : 'var(--surface)',
                border: !toFielding ? '2px solid var(--lime)' : '1px solid var(--border)',
                color: !toFielding ? 'var(--lime)' : 'var(--muted)',
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase' }}>Batting</div>
              {battingTeamName}
            </button>
            <button
              onClick={() => handleToggleSide(true)}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: toFielding ? 'rgba(184,240,0,0.12)' : 'var(--surface)',
                border: toFielding ? '2px solid var(--lime)' : '1px solid var(--border)',
                color: toFielding ? 'var(--lime)' : 'var(--muted)',
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase' }}>Fielding</div>
              {fieldingTeamName}
            </button>
          </div>

          {/* Reason list */}
          <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Reason ({recipientName} receives 5 runs)
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {reasons.map(reason => {
              const selected = selectedReason === reason
              return (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  style={{
                    padding: '11px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: selected ? 600 : 400,
                    background: selected ? 'rgba(184,240,0,0.1)' : 'var(--surface)',
                    border: selected ? '2px solid var(--lime)' : '1px solid var(--border)',
                    color: selected ? 'var(--lime)' : 'var(--text)',
                    lineHeight: 1.4,
                  }}
                >
                  {reason}
                  {selected && <span style={{ float: 'right', fontSize: 15 }}>✓</span>}
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              disabled={!selectedReason}
              onClick={() => selectedReason && onConfirm(selectedReason, toFielding)}
              style={{
                flex: 2, padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: selectedReason ? 'pointer' : 'not-allowed',
                background: selectedReason ? 'rgba(184,240,0,0.15)' : 'transparent',
                border: '1px solid var(--lime)', color: 'var(--lime)',
                opacity: selectedReason ? 1 : 0.4,
              }}
            >
              Award 5 penalty runs
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
