import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge-safe versions of validator types
type ExtrasType = 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty'
type DismissalType = 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'handled_ball' | 'obstructing_field' | 'timed_out' | 'retired_hurt' | 'retired_out'

interface BallPayload {
  innings_id: string
  batter_id: string
  non_striker_id: string
  bowler_id: string
  runs_off_bat: number
  extras_type?: ExtrasType | null
  extras_runs?: number
  is_boundary_four?: boolean
  is_boundary_six?: boolean
  dismissal_type?: DismissalType | null
  dismissed_player_id?: string | null
  fielder_id?: string | null
  fielder_substitute_name?: string | null
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') ?? '*'

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { authorization: authHeader } } }
  )

  // Get user from JWT
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  // Check scorer or admin role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['scorer', 'admin'])
    .limit(1)

  if (!roles || roles.length === 0) {
    return new Response(JSON.stringify({ error: 'Forbidden — scorer or admin role required' }), {
      status: 403,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const ball: BallPayload = await req.json()

  // Verify sequence_number = MAX(sequence_number) + 1
  const { data: maxSeq } = await supabase
    .from('ball_events')
    .select('sequence_number')
    .eq('innings_id', ball.innings_id)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const expectedSeq = (maxSeq?.sequence_number ?? 0) + 1

  // Verify all player IDs belong to this match
  const { data: innings } = await supabase
    .from('innings')
    .select('match_id')
    .eq('id', ball.innings_id)
    .single()

  if (!innings) {
    return new Response(JSON.stringify({ error: 'Innings not found' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const playerIds = [
    ball.batter_id,
    ball.non_striker_id,
    ball.bowler_id,
    ball.dismissed_player_id,
    ball.fielder_id,
  ].filter(Boolean) as string[]

  const { data: validPlayers } = await supabase
    .from('match_players')
    .select('id')
    .eq('match_id', innings.match_id)
    .in('id', playerIds)

  const validIds = new Set((validPlayers ?? []).map((p: any) => p.id))
  for (const id of playerIds) {
    if (!validIds.has(id)) {
      return new Response(JSON.stringify({ error: `Player ${id} does not belong to this match` }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }
  }

  // Basic validation
  if (ball.extras_type === 'wide' && (ball.runs_off_bat ?? 0) > 0) {
    return new Response(JSON.stringify({ error: 'Bat runs cannot be scored off a wide' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  if (ball.fielder_id && ball.fielder_substitute_name) {
    return new Response(JSON.stringify({ error: 'Cannot have both fielder_id and fielder_substitute_name' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  if (ball.is_boundary_four && ball.is_boundary_six) {
    return new Response(JSON.stringify({ error: 'Cannot be both a four and a six' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ valid: true, expectedSequenceNumber: expectedSeq }), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
})
