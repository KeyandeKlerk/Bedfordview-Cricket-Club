import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { computeInningsState, deriveResultText } from '@/lib/cricket/engine'
import type { BallEvent } from '@/lib/cricket/types'

export const runtime = 'nodejs'
export const revalidate = 60

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [matchRes, inningsRes, playersRes] = await Promise.all([
    supabase.from('matches').select('*, opponent:opponents(canonical_name), competition:competitions(name)').eq('id', id).single(),
    supabase.from('innings').select('*').eq('match_id', id).order('innings_number'),
    supabase.from('match_players').select('*').eq('match_id', id),
  ])

  const match = matchRes.data
  const opponent = match?.opponent?.canonical_name ?? 'Opposition'
  const competition = match?.competition?.name ?? ''
  const date = match?.match_date ? new Date(match.match_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  const allPlayers = playersRes.data ?? []
  const playerNameMap = new Map(allPlayers.map((p: any) => [p.id, p.opposition_name ?? p.id]))

  let score1 = '', score2 = '', resultText = match?.result_text ?? ''

  for (const inn of (inningsRes.data ?? [])) {
    const { data: balls } = await supabase.from('ball_events').select('*').eq('innings_id', inn.id).order('sequence_number')
    const state = computeInningsState((balls ?? []) as BallEvent[], playerNameMap)
    const label = inn.innings_number === 1 ? score1 : score2
    const scoreStr = `${state.totalRuns}/${state.wickets} (${state.oversDisplay})`
    if (inn.innings_number === 1) score1 = scoreStr
    else score2 = scoreStr
  }

  if (!resultText && inningsRes.data?.length === 2) {
    const s1 = inningsRes.data[0], s2 = inningsRes.data[1]
    const { data: b1 } = await supabase.from('ball_events').select('*').eq('innings_id', s1.id).order('sequence_number')
    const { data: b2 } = await supabase.from('ball_events').select('*').eq('innings_id', s2.id).order('sequence_number')
    const st1 = computeInningsState((b1 ?? []) as BallEvent[], playerNameMap)
    const st2 = computeInningsState((b2 ?? []) as BallEvent[], playerNameMap)
    resultText = deriveResultText(st1.totalRuns, st2.totalRuns, st2.wickets, s2.batting_side === match?.our_team_side)
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #050c1a 0%, #0a1628 60%, #061020 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '60px 72px', fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Bedfordview Cricket Club
        </div>
        {competition && (
          <div style={{ fontSize: 14, color: 'rgba(147,197,253,0.5)', letterSpacing: '0.1em' }}>{competition}</div>
        )}
      </div>

      {/* Main matchup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
        <div style={{ fontSize: 64, fontWeight: 900, color: '#f0f8ff', letterSpacing: '-0.03em', lineHeight: 1 }}>BCC</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#38bdf8', padding: '6px 18px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}>vs</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: '#f0f8ff', letterSpacing: '-0.03em', lineHeight: 1 }}>{opponent}</div>
      </div>

      {/* Scores */}
      {(score1 || score2) && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 36 }}>
          {score1 && (
            <div style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: '14px 24px' }}>
              <div style={{ fontSize: 12, color: 'rgba(147,197,253,0.5)', marginBottom: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>1st Innings</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.02em' }}>{score1}</div>
            </div>
          )}
          {score2 && (
            <div style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: '14px 24px' }}>
              <div style={{ fontSize: 12, color: 'rgba(147,197,253,0.5)', marginBottom: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>2nd Innings</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.02em' }}>{score2}</div>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {resultText && (
        <div style={{ fontSize: 28, fontWeight: 700, color: '#38bdf8', marginBottom: 24 }}>{resultText}</div>
      )}

      {/* Date */}
      <div style={{ marginTop: 'auto', fontSize: 16, color: 'rgba(147,197,253,0.4)' }}>{date}</div>

      {/* Decorative glow */}
      <div style={{
        position: 'absolute', top: -80, right: -80,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
      }} />
    </div>,
    { ...size }
  )
}
