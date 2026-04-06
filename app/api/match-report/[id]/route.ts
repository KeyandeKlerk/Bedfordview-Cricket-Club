import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeInningsState } from '@/lib/cricket/engine'
import { buildInningsSummary, generateMatchReport } from '@/lib/cricket/reportGenerator'
import type { BallEvent } from '@/lib/cricket/types'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch match metadata
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name)')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  // Fetch innings
  const { data: allInnings } = await supabase
    .from('innings')
    .select('*')
    .eq('match_id', matchId)
    .order('innings_number')

  if (!allInnings || allInnings.length === 0) {
    return NextResponse.json({ error: 'No innings data found' }, { status: 404 })
  }

  // Fetch match players to build name map
  const { data: matchPlayers } = await supabase
    .from('match_players')
    .select('*')
    .eq('match_id', matchId)

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')

  const registeredNames = new Map(
    (players ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`.trim()])
  )
  const playerNameMap = new Map(
    (matchPlayers ?? []).map((p: any) => [
      p.id,
      p.opposition_name ?? registeredNames.get(p.player_id) ?? 'Unknown',
    ])
  )

  // Build innings summaries
  const inningsSummaries = []
  for (const inn of allInnings) {
    const { data: balls } = await supabase
      .from('ball_events')
      .select('*')
      .eq('innings_id', inn.id)
      .order('sequence_number')

    const state = computeInningsState((balls ?? []) as BallEvent[], playerNameMap)
    const battingSide: 'home' | 'away' = inn.batting_side
    const battingTeamName =
      battingSide === match.our_team_side
        ? 'BCC'
        : match.opponent?.canonical_name ?? 'Opponents'

    inningsSummaries.push(buildInningsSummary(state, battingSide, battingTeamName))
  }

  const report = generateMatchReport({
    matchDate: match.match_date,
    ground: match.ground?.name ?? null,
    competition: match.competition?.name ?? null,
    opponentName: match.opponent?.canonical_name ?? 'Opponents',
    ourTeamSide: match.our_team_side,
    resultText: match.result_text ?? null,
    innings: inningsSummaries,
  })

  return NextResponse.json({ report })
}
