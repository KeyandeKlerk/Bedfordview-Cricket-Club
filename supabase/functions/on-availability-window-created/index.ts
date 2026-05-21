// on-availability-window-created
// Triggered by DB Webhook on availability_windows INSERT.
// Sends an in-app notification to every active player who has a linked user account.
// Idempotency: skips players who already have a notification for this window.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body: { record?: { id: string; title: string; window_start: string; window_end: string; deadline: string } }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const window = body.record
  if (!window?.id) return new Response('Missing record', { status: 400 })

  // Fetch all active players who have a linked auth account
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('id, user_id, first_name')
    .eq('is_active', true)
    .not('user_id', 'is', null)

  if (playersErr) {
    console.error('Failed to fetch players:', playersErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  if (!players || players.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const deadline = new Date(window.deadline).toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const rows = players.map((p) => ({
    user_id: p.user_id,
    type: 'availability_window_open',
    title: `Availability: ${window.title}`,
    body: `Are you available? Respond by ${deadline}`,
    data: { window_id: window.id, window_start: window.window_start, window_end: window.window_end },
    idempotency_key: `availability_window_open:${window.id}:${p.user_id}`,
  }))

  // INSERT ... ON CONFLICT DO NOTHING for idempotency on webhook retry
  const { error: insertErr } = await supabase
    .from('notifications')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  if (insertErr) {
    console.error('Failed to insert notifications:', insertErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  return new Response(JSON.stringify({ notified: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
