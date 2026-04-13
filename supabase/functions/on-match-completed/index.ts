// on-match-completed
// Triggered by DB Webhook on matches UPDATE WHERE status = 'completed'.
// 1. Sends match_completed notification to all attending players.
// 2. Updates selections.status = 'did_not_play' for selected but non-attending players.
// 3. Auto-generates and publishes a match report article.
// Idempotency: uses idempotency_key to skip if already processed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body: { record?: { id: string; status: string } }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const match = body.record
  // Only process when status transitions to 'completed'
  if (!match?.id || match.status !== 'completed') {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Idempotency check — has this match already been processed?
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .like('idempotency_key', `match_completed:${match.id}:%`)
    .limit(1)
    .single()

  if (existing) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_processed' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch match details for notification copy
  const { data: matchDetails } = await supabase
    .from('matches')
    .select('id, result_text, match_date, opponent:opponents(canonical_name)')
    .eq('id', match.id)
    .single()

  const opponentName = (matchDetails?.opponent as any)?.canonical_name ?? 'Opponent'
  const resultText = matchDetails?.result_text ?? 'Match completed'

  // Fetch all match_players who attended (attended = true), joined to players.user_id
  const { data: attendees, error: attendeesErr } = await supabase
    .from('match_players')
    .select('player_id, attended, players(user_id)')
    .eq('match_id', match.id)
    .not('player_id', 'is', null)

  if (attendeesErr) {
    console.error('Failed to fetch attendees:', attendeesErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  const attending = (attendees ?? []).filter((mp: any) => mp.attended && mp.players?.user_id)
  const notAttending = (attendees ?? []).filter((mp: any) => !mp.attended && mp.player_id)

  // Send notifications to attending players
  if (attending.length > 0) {
    const notifRows = attending.map((mp: any) => ({
      user_id: mp.players.user_id,
      type: 'match_completed',
      title: `BCC vs ${opponentName} — Result`,
      body: resultText,
      data: { match_id: match.id },
      idempotency_key: `match_completed:${match.id}:${mp.players.user_id}`,
    }))

    const { error } = await supabase
      .from('notifications')
      .upsert(notifRows, { onConflict: 'idempotency_key', ignoreDuplicates: true })

    if (error) console.error('Failed to insert match_completed notifications:', error)
  }

  // Mark non-attending selected players as 'did_not_play'
  if (notAttending.length > 0) {
    const nonAttendingPlayerIds = notAttending.map((mp: any) => mp.player_id)
    await supabase
      .from('selections')
      .update({ status: 'did_not_play' })
      .eq('match_id', match.id)
      .eq('status', 'selected') // only update still-selected (not withdrawn)
      .in('player_id', nonAttendingPlayerIds)
  }

  // ── Auto-generate match report article ────────────────────────────────────────
  // Skip if an article for this match already exists (idempotency)
  const { data: existingArticle } = await supabase
    .from('articles')
    .select('id')
    .eq('match_id', match.id)
    .maybeSingle()

  if (!existingArticle) {
    const siteUrl = Deno.env.get('SITE_URL') ?? Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? ''
    if (siteUrl) {
      try {
        const reportRes = await fetch(`${siteUrl}/api/match-report/${match.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (reportRes.ok) {
          const { report } = await reportRes.json()
          if (report) {
            const matchDate = matchDetails?.match_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
            const slug = `${slugify(`bcc-vs-${opponentName}`)}-${matchDate}`
            await supabase
              .from('articles')
              .insert({
                title: `Match Report: BCC vs ${opponentName}`,
                slug,
                content: report,
                match_id: match.id,
                published_at: new Date().toISOString(),
              })
              // ON CONFLICT (slug) — ignore if slug already exists (retry safety)
          }
        } else {
          console.error('Report API returned', reportRes.status)
        }
      } catch (err) {
        // Non-fatal — notifications already sent, article generation is best-effort
        console.error('Failed to generate match report article:', err)
      }
    } else {
      console.warn('SITE_URL not set — skipping match report generation')
    }
  }

  return new Response(
    JSON.stringify({ notified: attending.length, did_not_play: notAttending.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
