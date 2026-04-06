'use client'
import { useState } from 'react'
import type { InningsState, MatchPlayer } from '@/lib/cricket/types'
import { oversDisplay } from '@/lib/cricket/engine'
import { supabase } from '@/lib/supabase/client'
import PlayerSelectModal from './PlayerSelectModal'

interface Props {
  matchId: string
  completedInningsId: string
  completedState: InningsState
  innings2Id: string | null    // null = not created yet
  innings2BattingSide: 'home' | 'away'  // correct side for innings 2 (passed from ScorerShell)
  battingPlayers: MatchPlayer[]
  bowlingPlayers: MatchPlayer[]
  playerName: (id: string) => string
  onResumeScoring: (innings2Id: string, openerId1: string, openerId2: string, openingBowlerId: string, target: number) => void
  onMatchComplete: () => void
}

type Phase = 'result' | 'pre_match'

export default function InningsBreakFlow({
  matchId,
  completedInningsId,
  completedState,
  innings2Id: initialInnings2Id,
  innings2BattingSide,
  battingPlayers,
  bowlingPlayers,
  playerName,
  onResumeScoring,
  onMatchComplete,
}: Props) {
  const [phase, setPhase] = useState<Phase>(initialInnings2Id ? 'pre_match' : 'result')
  const [innings2Id, setInnings2Id] = useState<string | null>(initialInnings2Id)
  const [opener1, setOpener1] = useState<string | null>(null)
  const [opener2, setOpener2] = useState<string | null>(null)
  const [openingBowler, setOpeningBowler] = useState<string | null>(null)
  const [selectingFor, setSelectingFor] = useState<'opener1' | 'opener2' | 'bowler' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = completedState.totalRuns + 1

  async function handleSetupInnings2() {
    setSaving(true)
    setError(null)
    try {
      // Mark innings 1 completed
      const { error: e1 } = await supabase
        .from('innings')
        .update({ status: 'completed' })
        .eq('id', completedInningsId)
      if (e1) throw e1

      // Create innings 2
      const { data, error: e2 } = await supabase
        .from('innings')
        .insert({
          match_id: matchId,
          innings_number: 2,
          batting_side: innings2BattingSide,
          status: 'pending',
          target,
        })
        .select('id')
        .single()
      if (e2) throw e2

      setInnings2Id(data.id)
      setPhase('pre_match')
    } catch (e: any) {
      setError(e.message ?? 'Failed to set up innings 2')
    } finally {
      setSaving(false)
    }
  }

  async function handleResume() {
    if (!innings2Id || !opener1 || !opener2 || !openingBowler) return
    setSaving(true)
    setError(null)
    try {
      const { error: e1 } = await supabase
        .from('innings').update({ status: 'in_progress' }).eq('id', innings2Id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('match_players').update({ actual_batting_position: 1 }).eq('id', opener1)
      if (e2) throw e2
      const { error: e3 } = await supabase
        .from('match_players').update({ actual_batting_position: 2 }).eq('id', opener2)
      if (e3) throw e3
      onResumeScoring(innings2Id, opener1, opener2, openingBowler, target)
    } catch (e: any) {
      setError(e.message ?? 'Failed to start innings 2')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'calc(var(--nav-h) + 24px) 20px 48px' }}>

      {/* Phase: result — innings 1 summary + single CTA */}
      {phase === 'result' && (
        <>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
            Innings 1 Complete
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 900, color: 'var(--lime)', lineHeight: 1, marginBottom: 4 }}>
            {completedState.totalRuns}<span style={{ fontSize: 36, color: 'var(--muted)' }}>/{completedState.wickets}</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 28 }}>
            {oversDisplay(completedState.legalBalls)} overs
          </div>

          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Target to win</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: 'var(--gold)' }}>{target}</span>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSetupInnings2}
            disabled={saving}
            style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 16, minHeight: 54 }}
          >
            {saving ? 'Setting up...' : 'Set Up Innings 2 →'}
          </button>
          {error && <p style={{ color: 'var(--red)', marginTop: 10, fontSize: 14 }}>{error}</p>}
        </>
      )}

      {/* Phase: pre_match — select openers + bowler */}
      {phase === 'pre_match' && (
        <>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
            Innings 2
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, marginBottom: 20 }}>
            Select openers &amp; bowler
          </div>

          {[
            { label: 'Opening Batter 1', value: opener1, setter: () => setSelectingFor('opener1') },
            { label: 'Opening Batter 2', value: opener2, setter: () => setSelectingFor('opener2') },
            { label: 'Opening Bowler',   value: openingBowler, setter: () => setSelectingFor('bowler') },
          ].map(({ label, value, setter }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
              <button
                className={value ? 'btn btn-outline' : 'btn btn-ghost'}
                onClick={setter}
                style={{ width: '100%', justifyContent: 'flex-start', minHeight: 50, fontSize: 15 }}
              >
                {value ? playerName(value) : `Select ${label}…`}
              </button>
            </div>
          ))}

          <button
            className="btn btn-primary"
            onClick={handleResume}
            disabled={!opener1 || !opener2 || !openingBowler || saving}
            style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 16, minHeight: 54, marginTop: 8 }}
          >
            {saving ? 'Starting...' : 'Start Scoring →'}
          </button>
          {error && <p style={{ color: 'var(--red)', marginTop: 10, fontSize: 14 }}>{error}</p>}
        </>
      )}

      {/* Player select modals */}
      {selectingFor === 'opener1' && (
        <PlayerSelectModal
          purpose="new_batter"
          players={battingPlayers}
          playerName={playerName}
          excludeIds={[opener2].filter(Boolean) as string[]}
          onSelect={id => { setOpener1(id); setSelectingFor(null) }}
          onClose={() => setSelectingFor(null)}
        />
      )}
      {selectingFor === 'opener2' && (
        <PlayerSelectModal
          purpose="new_batter"
          players={battingPlayers}
          playerName={playerName}
          excludeIds={[opener1].filter(Boolean) as string[]}
          onSelect={id => { setOpener2(id); setSelectingFor(null) }}
          onClose={() => setSelectingFor(null)}
        />
      )}
      {selectingFor === 'bowler' && (
        <PlayerSelectModal
          purpose="change_bowler"
          players={bowlingPlayers}
          playerName={playerName}
          onSelect={id => { setOpeningBowler(id); setSelectingFor(null) }}
          onClose={() => setSelectingFor(null)}
        />
      )}
    </div>
  )
}
