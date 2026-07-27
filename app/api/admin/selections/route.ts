import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverSupabase } from '@/lib/supabase/server'

// Coach XI selection writes must go through the service-role client.
// 027_security_hardening.sql intentionally revoked broad UPDATE on
// `selections` from authenticated users (column-level grant covers only
// confirmed_at/status/withdrawn_at — the fields a player sets on
// themselves) and its own comment says full write access is reserved
// for "coach API routes (which use service role)". That route never
// existed until now — the select page previously wrote position/role/
// selected_by/override_reason directly from the browser session, which
// Postgres rejected on any UPDATE (i.e. any save after the first).

interface IncomingSelection {
  playerId: string
  position: number | null
  role: string
  overrideReason: string | null
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roleCheck } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'coach'])
    .limit(1)
    .maybeSingle()

  if (!roleCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { matchId, selections } = body as { matchId?: string; selections?: IncomingSelection[] }

  if (!matchId || !Array.isArray(selections)) {
    return NextResponse.json({ error: 'matchId and selections are required' }, { status: 400 })
  }

  const rows = selections.map((s) => ({
    match_id: matchId,
    player_id: s.playerId,
    position: s.position,
    role: s.role || 'player',
    status: 'selected',
    selected_by: user.id,
    override_reason: s.overrideReason ?? null,
  }))

  if (rows.length > 0) {
    const { error: upsertErr } = await serverSupabase
      .from('selections')
      .upsert(rows, { onConflict: 'match_id,player_id' })

    if (upsertErr) {
      console.error('Selection upsert failed:', upsertErr)
      return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
    }
  }

  // Clean up players who were selected before but are no longer part of
  // this XI. Only touches rows that haven't been announced yet — once a
  // selection has been notified, removing it here would silently drop a
  // player's record of having been told they were selected.
  const keptPlayerIds = rows.map((r) => r.player_id)
  let staleQuery = serverSupabase
    .from('selections')
    .delete()
    .eq('match_id', matchId)
    .eq('status', 'selected')
    .is('notified_at', null)

  staleQuery = keptPlayerIds.length > 0
    ? staleQuery.not('player_id', 'in', `(${keptPlayerIds.join(',')})`)
    : staleQuery

  const { error: cleanupErr } = await staleQuery
  if (cleanupErr) {
    console.error('Selection cleanup failed:', cleanupErr)
    // Non-fatal — the actual XI was saved successfully above.
  }

  return NextResponse.json({ success: true })
}
