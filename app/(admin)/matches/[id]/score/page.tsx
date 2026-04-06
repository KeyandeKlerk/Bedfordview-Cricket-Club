import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createServerClient } from '@/lib/supabase/server'
import ScorerShell from '@/components/scorer/ScorerShell'

export const dynamic = 'force-dynamic'

export default async function ScorerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params

  // Auth check using cookie-based anon client
  const cookieStore = await cookies()
  const authClient = createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createServerClient()

  const [matchRes, inningsRes, playersRes, availableRes] = await Promise.all([
    sb.from('matches').select('*, opponent:opponents(canonical_name), competition:competitions(name)').eq('id', matchId).single(),
    sb.from('innings').select('*').eq('match_id', matchId).order('innings_number'),
    sb.from('match_players').select('*').eq('match_id', matchId),
    sb.from('players').select('id, first_name, last_name'),
  ])

  if (matchRes.error || !matchRes.data) notFound()

  const match = matchRes.data
  const allInnings: any[] = inningsRes.data ?? []
  const allPlayers: any[] = playersRes.data ?? []

  // Get active innings (in_progress, or last if none in progress)
  const activeInnings = allInnings.find(i => i.status === 'in_progress')
    ?? allInnings[allInnings.length - 1]
    ?? null

  // Fetch initial balls
  let initialBalls: any[] = []
  if (activeInnings) {
    const { data } = await sb
      .from('ball_events')
      .select('*')
      .eq('innings_id', activeInnings.id)
      .order('sequence_number')
    initialBalls = data ?? []
  }

  return (
    <ScorerShell
      match={{
        id: match.id,
        overs_per_innings: match.overs_per_innings,
        free_hit_on_no_ball: match.free_hit_on_no_ball,
        our_team_side: match.our_team_side,
        opponentName: match.opponent?.canonical_name,
        competitionName: match.competition?.name,
        matchDate: match.match_date,
      }}
      innings={activeInnings}
      initialBalls={initialBalls}
      allPlayers={allPlayers}
      availablePlayers={availableRes.data ?? []}
    />
  )
}
