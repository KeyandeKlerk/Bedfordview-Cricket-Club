// availability-deadline-reminder
// Called by pg_cron at 18:00 daily (or Vercel cron → /api/cron/availability-reminder).
// Finds availability windows whose deadline is within the next 24 hours,
// then notifies players who HAVE NOT yet submitted a response.
// Idempotency: one reminder per (window, player) — skips if already sent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // Optional: validate a shared secret header to prevent unauthorized calls
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const authHeader = req.headers.get('x-cron-secret')
    if (authHeader !== cronSecret) return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // Find windows with deadline in the next 23–25 hour window
  // (using a 2-hour band to avoid missing the window due to cron timing drift)
  const { data: windows, error: windowsErr } = await supabase
    .from('availability_windows')
    .select('id, title, deadline')
    .gte('deadline', in23Hours.toISOString())
    .lte('deadline', in25Hours.toISOString())

  if (windowsErr) {
    console.error('Failed to fetch windows:', windowsErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  if (!windows || windows.length === 0) {
    return new Response(JSON.stringify({ reminders_sent: 0, reason: 'no_upcoming_deadlines' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch all active players with accounts
  const { data: players } = await supabase
    .from('players')
    .select('id, user_id')
    .eq('is_active', true)
    .not('user_id', 'is', null)

  if (!players || players.length === 0) {
    return new Response(JSON.stringify({ reminders_sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let totalSent = 0

  for (const window of windows) {
    // Find players who HAVE already responded for this window
    const { data: responded } = await supabase
      .from('player_availability')
      .select('player_id')
      .eq('window_id', window.id)

    const respondedIds = new Set((responded ?? []).map((r: any) => r.player_id))
    const notResponded = players.filter((p) => !respondedIds.has(p.id))

    if (notResponded.length === 0) continue

    const deadlineFormatted = new Date(window.deadline).toLocaleDateString('en-ZA', {
      weekday: 'short', hour: '2-digit', minute: '2-digit',
    })

    const reminderRows = notResponded.map((p) => ({
      user_id: p.user_id,
      type: 'availability_deadline_reminder',
      title: `Last chance: ${window.title}`,
      body: `Deadline is ${deadlineFormatted}. Tap to respond.`,
      data: { window_id: window.id },
      idempotency_key: `availability_deadline_reminder:${window.id}:${p.user_id}`,
    }))

    const { error } = await supabase
      .from('notifications')
      .upsert(reminderRows, { onConflict: 'idempotency_key', ignoreDuplicates: true })

    if (error) {
      console.error(`Failed to send reminders for window ${window.id}:`, error)
    } else {
      totalSent += reminderRows.length
    }
  }

  return new Response(
    JSON.stringify({ reminders_sent: totalSent, windows_checked: windows.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
