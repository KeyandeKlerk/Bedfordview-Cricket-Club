import { serverSupabase as adminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// No outbound email/SMS infrastructure exists in this codebase beyond
// Supabase Auth's own emails, so this endpoint does not send anything
// automatically — it just returns a hand-off link/message for the
// guardian to relay to their child directly, and logs the action.
export async function POST(req: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: link } = await adminClient
    .from('player_guardians')
    .select('id')
    .eq('guardian_user_id', user.id)
    .eq('player_id', playerId)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: player } = await adminClient
    .from('players')
    .select('id, first_name, last_name, user_id')
    .eq('id', playerId)
    .maybeSingle()
  if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (player.user_id != null) {
    return NextResponse.json({ error: 'This player already has their own login.' }, { status: 409 })
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    action: 'claim_invite_sent',
    entity_type: 'players',
    entity_id: player.id,
    new_data: { player_id: player.id },
  })

  const message = `Hi ${player.first_name}! You can now claim your own Bedfordview CC login — go to /claim-profile, ` +
    `create an account (or sign in), and select "${player.first_name} ${player.last_name}" from the list.`

  return NextResponse.json({ claimUrl: '/claim-profile', message })
}
