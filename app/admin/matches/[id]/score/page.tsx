import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentPlayerServer } from '@/lib/supabase-server'
import ScorerShell from '@/components/scorer/ScorerShell'

export const dynamic = 'force-dynamic'

export default async function ScorerPage({ params }: { params: Promise<{ id: string }> }) {
  const player = await getCurrentPlayerServer()
  if (!player || (player.role !== 'scorer' && player.role !== 'admin')) {
    redirect('/dashboard')
  }

  const { id: matchId } = await params
  const sb = createServerClient()

  const [matchRes, inningsRes, matchPlayersRes, selectionsRes, allPlayersRes] = await Promise.all([
    sb.from('matches').select('*, opponent:opponents(canonical_name), competition:competitions(name)').eq('id', matchId).single(),
    sb.from('innings').select('*').eq('match_id', matchId).order('innings_number'),
    sb.from('match_players').select('*').eq('match_id', matchId),
    // Selections: pre-selected XI for this match (from coach's selection workflow)
    sb.from('selections')
      .select('position, player_id, players(id, first_name, last_name)')
      .eq('match_id', matchId)
      .eq('status', 'selected')
      .eq('role', 'player')
      .order('position'),
    // Full active roster — used as fallback (legacy matches) or swap pool
    sb.from('players').select('id, first_name, last_name').eq('is_active', true).order('last_name'),
  ])

  if (matchRes.error || !matchRes.data) notFound()

  const match = matchRes.data
  const allInnings: any[] = inningsRes.data ?? []
  const allPlayers: any[] = matchPlayersRes.data ?? []

  const selectionsData = selectionsRes.data ?? []
  const hasSelections = selectionsData.length > 0

  // If a coach has already selected the XI, pre-populate with those players
  // (tagged _preselected so SetupBccXi can check them all by default).
  // Fall back to the full active roster for legacy matches with no selections.
  const availablePlayers: any[] = hasSelections
    ? selectionsData.map((s: any) => ({
        ...s.players,
        _preselected: true,
        _position: s.position,
      }))
    : (allPlayersRes.data ?? [])

  const activeInnings = allInnings.find(i => i.status === 'in_progress')
    ?? allInnings[allInnings.length - 1]
    ?? null

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
        opponentName: (match.opponent as any)?.canonical_name,
        competitionName: (match.competition as any)?.name,
        matchDate: match.match_date,
      }}
      innings={activeInnings}
      initialBalls={initialBalls}
      allPlayers={allPlayers}
      availablePlayers={availablePlayers}
    />
  )
}
