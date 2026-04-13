// on-selection-announced
// Called via HTTP POST from the coach UI when they click "Announce Selection".
// Notifies each selected player and sets selections.notified_at.
// Returns 207 Partial Content if some notifications fail (coach can retry).
// Idempotency: skips players already notified for this selection.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body: { match_id: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  if (!body.match_id) return new Response('Missing match_id', { status: 400 })

  // Fetch the match details for the notification copy
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, match_date, opponent:opponents(canonical_name)')
    .eq('id', body.match_id)
    .single()

  if (matchErr || !match) return new Response('Match not found', { status: 404 })

  // Fetch all selected players with their user accounts
  const { data: selections, error: selErr } = await supabase
    .from('selections')
    .select('id, player_id, position, role, players(user_id, first_name, last_name)')
    .eq('match_id', body.match_id)
    .eq('status', 'selected')

  if (selErr) {
    console.error('Failed to fetch selections:', selErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  if (!selections || selections.length === 0) {
    return new Response(JSON.stringify({ notified: 0, failed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const matchDate = new Date(match.match_date).toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
  const opponentName = (match.opponent as any)?.canonical_name ?? 'Opponent'

  const succeeded: string[] = []
  const failed: string[] = []

  for (const sel of selections) {
    const player = sel.players as any
    if (!player?.user_id) {
      // Player has no account — skip notification (no delivery channel)
      continue
    }

    const roleLabel = sel.role === 'reserve' ? ' (Reserve)' : sel.role === '12th_man' ? ' (12th Man)' : ''
    const positionLabel = sel.position ? `#${sel.position}` : ''

    const { error } = await supabase
      .from('notifications')
      .upsert({
        user_id: player.user_id,
        type: 'selection_announced',
        title: `You've been selected${roleLabel}`,
        body: `BCC vs ${opponentName} · ${matchDate}${positionLabel ? ` · Position ${positionLabel}` : ''}`,
        data: { match_id: body.match_id, selection_id: sel.id, position: sel.position, role: sel.role },
        idempotency_key: `selection_announced:${sel.id}:${player.user_id}`,
      }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

    if (error) {
      console.error(`Failed to notify player ${sel.player_id}:`, error)
      failed.push(sel.player_id)
    } else {
      succeeded.push(sel.id)
    }
  }

  // Mark notified_at on all successfully notified selections
  if (succeeded.length > 0) {
    await supabase
      .from('selections')
      .update({ notified_at: new Date().toISOString() })
      .in('id', succeeded)
      .is('notified_at', null) // only update those not already notified
  }

  const status = failed.length > 0 ? 207 : 200
  return new Response(
    JSON.stringify({ notified: succeeded.length, failed: failed.length, failed_player_ids: failed }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
})
