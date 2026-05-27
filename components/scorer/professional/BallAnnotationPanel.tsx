'use client'
import { useState } from 'react'
import type { BallAnnotation, BowlingType, PitchLength, PitchLine, ShotType } from '@/lib/cricket/types'
import { isInBallQueue, mergeAnnotationIntoBallQueue, queueAnnotation } from '@/lib/offline/queue'
import { supabase } from '@/lib/supabase/client'
import WagonWheelPicker from './WagonWheelPicker'
import PitchMapPicker from './PitchMapPicker'
import ShotTypePicker from './ShotTypePicker'
import BowlingTypePicker from './BowlingTypePicker'
import QualityPicker from './QualityPicker'

const BOWLING_TYPE_LABELS: Record<BowlingType, string> = {
  right_arm_fast: 'Right arm fast',
  right_arm_medium: 'Right arm medium',
  left_arm_fast: 'Left arm fast',
  left_arm_medium: 'Left arm medium',
  right_arm_off_spin: 'Off spin',
  right_arm_leg_spin: 'Leg spin',
  left_arm_orthodox: 'Left arm orthodox',
  left_arm_chinaman: 'Chinaman',
}

interface Props {
  ballId: string
  knownBowlingType: BowlingType | null
  onAnnotated: (annotation: BallAnnotation) => void
  onSkip: () => void
}

export default function BallAnnotationPanel({ ballId, knownBowlingType, onAnnotated, onSkip }: Props) {
  const [wagX, setWagX] = useState<number | null>(null)
  const [wagY, setWagY] = useState<number | null>(null)
  const [pitchLength, setPitchLength] = useState<PitchLength | null>(null)
  const [pitchLine, setPitchLine]     = useState<PitchLine | null>(null)
  const [shotType, setShotType]       = useState<ShotType | null>(null)
  const [bowlingType, setBowlingType] = useState<BowlingType | null>(knownBowlingType)
  const [changingBowlingType, setChangingBowlingType] = useState(knownBowlingType === null)
  const [execQuality, setExecQuality] = useState<string | null>(null)
  const [decQuality, setDecQuality]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const hasAny = wagX != null || pitchLength != null || shotType != null || bowlingType != null || execQuality != null || decQuality != null

  async function handleSave() {
    setSaving(true)
    const annotation: BallAnnotation = {
      wagon_x:           wagX,
      wagon_y:           wagY,
      pitch_length:      pitchLength,
      pitch_line:        pitchLine,
      shot_type:         shotType,
      bowling_type:      bowlingType,
      execution_quality: execQuality as BallAnnotation['execution_quality'],
      decision_quality:  decQuality as BallAnnotation['decision_quality'],
    }

    try {
      const queued = await isInBallQueue(ballId)
      if (queued) {
        await mergeAnnotationIntoBallQueue(ballId, annotation)
      } else if (typeof navigator !== 'undefined' && navigator.onLine) {
        supabase.from('ball_events').update(annotation).eq('id', ballId).then()
      } else {
        await queueAnnotation(ballId, annotation)
      }
    } catch {
      // Annotation is non-critical — never block the scorer on failure
    }

    onAnnotated(annotation)
    setSaving(false)
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100 }}
        onClick={onSkip}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1101,
        background: 'var(--panel)', borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        maxHeight: '92dvh',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 1,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em' }}>
            ANNOTATE BALL
          </span>
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)',
              fontSize: 14, cursor: 'pointer', padding: '4px 8px',
            }}
          >
            Skip →
          </button>
        </div>

        {/* Content — flex column, no scroll needed on normal phones */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          {/* Row: Wagon wheel + Pitch map — both pinned to 160px height */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div>
              <WagonWheelPicker
                wagX={wagX}
                wagY={wagY}
                onChange={(wx, wy) => { setWagX(wx); setWagY(wy) }}
              />
            </div>
            <div>
              <PitchMapPicker
                length={pitchLength}
                line={pitchLine}
                onSelect={(len, ln) => { setPitchLength(len); setPitchLine(ln) }}
              />
            </div>
          </div>

          <ShotTypePicker selected={shotType} onChange={setShotType} />

          {/* Bowling type — full picker on first ball, compact row thereafter */}
          {changingBowlingType ? (
            <BowlingTypePicker
              selected={bowlingType}
              onChange={(t) => {
                setBowlingType(t)
                if (t !== null) setChangingBowlingType(false)
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Bowling type</span>
                {bowlingType ? BOWLING_TYPE_LABELS[bowlingType] : 'Not set'}
              </div>
              <button
                type="button"
                onClick={() => setChangingBowlingType(true)}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '5px 12px',
                  flexShrink: 0,
                }}
              >
                Change
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <QualityPicker
              label="Execution"
              options={['excellent', 'good', 'poor']}
              selected={execQuality}
              onChange={setExecQuality}
            />
            <QualityPicker
              label="Decision"
              options={['good', 'poor']}
              selected={decQuality}
              onChange={setDecQuality}
            />
          </div>
        </div>

        {/* Footer — stays pinned at bottom of sheet */}
        <div style={{ padding: '10px 20px 16px', display: 'flex', gap: 10, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onSkip}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !hasAny}
            onClick={handleSave}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {saving ? 'Saving…' : 'Save Annotation'}
          </button>
        </div>
      </div>
    </>
  )
}
