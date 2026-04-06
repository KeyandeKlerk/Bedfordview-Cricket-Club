'use client'
import { useState } from 'react'
import type { BallEvent, ExtrasType } from '@/lib/cricket/types'

interface Props {
  ball: BallEvent
  playerName: (id: string) => string
  onSave: (updated: BallEvent) => void
  onClose: () => void
}

const EXTRAS: (ExtrasType | '')[] = ['', 'wide', 'no_ball', 'bye', 'leg_bye', 'penalty']
const EXTRAS_LABELS: Record<string, string> = {
  '': 'None',
  wide: 'Wide',
  no_ball: 'No Ball',
  bye: 'Bye',
  leg_bye: 'Leg Bye',
  penalty: 'Penalty',
}

export default function CorrectBallModal({ ball, playerName, onSave, onClose }: Props) {
  const [runsOffBat, setRunsOffBat]     = useState(ball.runs_off_bat)
  const [extrasType, setExtrasType]     = useState<ExtrasType | ''>(ball.extras_type ?? '')
  const [extrasRuns, setExtrasRuns]     = useState(ball.extras_runs)
  const [isFour, setIsFour]             = useState(ball.is_boundary_four)
  const [isSix, setIsSix]               = useState(ball.is_boundary_six)
  const [saving, setSaving]             = useState(false)

  const overLabel = `Over ${ball.over_number + 1}, ball ${ball.ball_in_over + 1}`

  async function handleSave() {
    setSaving(true)
    const updated: BallEvent = {
      ...ball,
      runs_off_bat: runsOffBat,
      extras_type: extrasType === '' ? null : extrasType,
      extras_runs: extrasRuns,
      is_boundary_four: isFour,
      is_boundary_six: isSix,
    }
    onSave(updated)
  }

  // When a boundary flag is toggled, set runs accordingly
  function handleFour(checked: boolean) {
    setIsFour(checked)
    if (checked) { setIsSix(false); setRunsOffBat(4) }
  }
  function handleSix(checked: boolean) {
    setIsSix(checked)
    if (checked) { setIsFour(false); setRunsOffBat(6) }
  }

  // Extras with no bat runs
  const extrasNoRuns = extrasType === 'wide' || extrasType === 'bye' || extrasType === 'leg_bye'

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a1628',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 14,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 420,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
              Correct Ball
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {overLabel} · {playerName(ball.bowler_id)} to {playerName(ball.batter_id)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {ball.dismissal_type && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#fca5a5' }}>
            Dismissals cannot be edited — use Undo and re-enter the ball.
          </div>
        )}

        {/* Extras type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Extras Type
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXTRAS.map(e => (
              <button
                key={e}
                onClick={() => { setExtrasType(e); if (e) setRunsOffBat(0) }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${extrasType === e ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.15)'}`,
                  background: extrasType === e ? 'rgba(37,99,235,0.2)' : 'transparent',
                  color: extrasType === e ? '#93c5fd' : 'var(--muted)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {EXTRAS_LABELS[e]}
              </button>
            ))}
          </div>
        </div>

        {/* Extras runs */}
        {extrasType !== '' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Extras Runs
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setExtrasRuns(n)}
                  style={{
                    width: 38, height: 38,
                    borderRadius: 6,
                    border: `1px solid ${extrasRuns === n ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.15)'}`,
                    background: extrasRuns === n ? 'rgba(37,99,235,0.2)' : 'transparent',
                    color: extrasRuns === n ? '#93c5fd' : 'var(--muted)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Runs off bat (hidden for wide/bye/leg_bye) */}
        {!extrasNoRuns && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Runs off Bat
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => { setRunsOffBat(n); if (n !== 4) setIsFour(false); if (n !== 6) setIsSix(false) }}
                  style={{
                    width: 38, height: 38,
                    borderRadius: 6,
                    border: `1px solid ${runsOffBat === n ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.15)'}`,
                    background: runsOffBat === n ? 'rgba(37,99,235,0.2)' : 'transparent',
                    color: runsOffBat === n ? '#93c5fd' : 'var(--muted)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boundary flags */}
        {!extrasNoRuns && extrasType !== 'penalty' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={isFour}
                onChange={e => handleFour(e.target.checked)}
                style={{ accentColor: 'var(--blue-mid)', width: 16, height: 16 }}
              />
              Boundary 4
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={isSix}
                onChange={e => handleSix(e.target.checked)}
                style={{ accentColor: 'var(--blue-mid)', width: 16, height: 16 }}
              />
              Boundary 6
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !!ball.dismissal_type}
            style={{ flex: 2, padding: '11px', borderRadius: 8, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', cursor: saving || ball.dismissal_type ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: saving || ball.dismissal_type ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Correction'}
          </button>
        </div>
      </div>
    </div>
  )
}
