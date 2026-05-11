import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [playerRes, batRes, bowlRes] = await Promise.all([
    supabase.from('players').select('first_name, last_name, batting_style, bowling_style').eq('id', id).single(),
    supabase.from('career_batting_stats').select('total_runs, average, highest_score, hundreds, fifties').eq('player_id', id).maybeSingle(),
    supabase.from('career_bowling_stats').select('wickets, average, economy').eq('player_id', id).maybeSingle(),
  ])

  const player = playerRes.data
  if (!player) return new ImageResponse(<div>Not found</div>, size)

  const name = `${player.first_name} ${player.last_name}`
  const initials = `${player.first_name[0]}${player.last_name[0]}`.toUpperCase()
  const bat = batRes.data
  const bowl = bowlRes.data

  return new ImageResponse(
    <div
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #050c1a 0%, #0a1628 60%, #061020 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '60px 72px', fontFamily: 'sans-serif',
      }}
    >
      {/* Club name */}
      <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 48 }}>
        Bedfordview Cricket Club
      </div>

      {/* Player hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginBottom: 48 }}>
        <div style={{
          width: 120, height: 120, borderRadius: 24,
          background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, fontWeight: 900, color: '#fff',
          boxShadow: '0 0 0 2px rgba(59,130,246,0.4)',
        }}>{initials}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 60, fontWeight: 900, color: '#f0f8ff', letterSpacing: '-0.03em', lineHeight: 1 }}>{name}</div>
          {(player.batting_style || player.bowling_style) && (
            <div style={{ fontSize: 18, color: 'rgba(147,197,253,0.6)' }}>
              {[player.batting_style, player.bowling_style].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20 }}>
        {bat && Number(bat.total_runs) > 0 && (
          <>
            <div style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 20px', minWidth: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'rgba(147,197,253,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Runs</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{bat.total_runs}</div>
            </div>
            <div style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 20px', minWidth: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'rgba(147,197,253,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Avg</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{bat.average != null ? Number(bat.average).toFixed(1) : '—'}</div>
            </div>
            <div style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 20px', minWidth: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'rgba(147,197,253,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Best</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#60a5fa' }}>{bat.highest_score ?? '—'}</div>
            </div>
          </>
        )}
        {bowl && Number(bowl.wickets) > 0 && (
          <>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 20px', minWidth: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'rgba(252,165,165,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Wickets</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fca5a5' }}>{bowl.wickets}</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 20px', minWidth: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'rgba(252,165,165,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Econ</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fca5a5' }}>{bowl.economy != null ? Number(bowl.economy).toFixed(2) : '—'}</div>
            </div>
          </>
        )}
      </div>

      {/* Glow */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
      }} />
    </div>,
    { ...size }
  )
}
