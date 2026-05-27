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

interface Props {
  ballId: string
  currentOverBowlingType: BowlingType | null
  onAnnotated: (annotation: BallAnnotation, overBowlingType: BowlingType | null) => void
  onSkip: () => void
}

export default function BallAnnotationPanel({ ballId, currentOverBowlingType, onAnnotated, onSkip }: Props) {
  const [wagX, setWagX] = useState<number | null>(null)
  const [wagY, setWagY] = useState<number | null>(null)
  const [pitchLength, setPitchLength] = useState<PitchLength | null>(null)
  const [pitchLine, setPitchLine]     = useState<PitchLine | null>(null)
  const [shotType, setShotType]       = useState<ShotType | null>(null)
  const [bowlingType, setBowlingType] = useState<BowlingType | null>(currentOverBowlingType)
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
        // Ball not yet synced — merge annotation so they go together in one upsert
        await mergeAnnotationIntoBallQueue(ballId, annotation)
      } else if (typeof navigator !== 'undefined' && navigator.onLine) {
        // Ball already synced, we're online — fire a direct UPDATE (fire-and-forget)
        supabase.from('ball_events').update(annotation).eq('id', ballId).then()
      } else {
        // Ball already synced but we're offline — queue annotation for later
        await queueAnnotation(ballId, annotation)
      }
    } catch {
      // Annotation is non-critical — never block the scorer on failure
    }

    onAnnotated(annotation, bowlingType)
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
        maxHeight: '90dvh', overflowY: 'auto',
        padding: '0 0 env(safe-area-inset-bottom)',
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

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Row: Wagon wheel + Pitch map side by side */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <WagonWheelPicker
                wagX={wagX}
                wagY={wagY}
                onChange={(wx, wy) => { setWagX(wx); setWagY(wy) }}
              />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <PitchMapPicker
                length={pitchLength}
                line={pitchLine}
                onSelect={(len, ln) => { setPitchLength(len); setPitchLine(ln) }}
              />
            </div>
          </div>

          <ShotTypePicker selected={shotType} onChange={setShotType} />

          <BowlingTypePicker selected={bowlingType} onChange={setBowlingType} />

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

        {/* Footer */}
        <div style={{ padding: '12px 20px 20px', display: 'flex', gap: 10, borderTop: '1px solid var(--border)' }}>
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
