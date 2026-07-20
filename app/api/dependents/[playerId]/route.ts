import { serverSupabase as adminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireGuardianOfUnclaimedPlayer(req: NextRequest, playerId: string) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return { error: 'Unauthorized' as const, status: 401 }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401 }

  const { data: link } = await adminClient
    .from('player_guardians')
    .select('id')
    .eq('guardian_user_id', user.id)
    .eq('player_id', playerId)
    .maybeSingle()
  if (!link) return { error: 'Forbidden' as const, status: 403 }

  const { data: player } = await adminClient
    .from('players')
    .select('id, user_id')
    .eq('id', playerId)
    .maybeSingle()
  if (!player) return { error: 'Not found' as const, status: 404 }
  if (player.user_id != null) {
    // Guardian access is read-only once the player has claimed their own login
    return { error: 'This player has claimed their own account and can no longer be edited by a guardian.' as const, status: 403 }
  }

  return { user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params
  const check = await requireGuardianOfUnclaimedPlayer(req, playerId)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of ['first_name', 'last_name', 'nickname', 'batting_style', 'bowling_style', 'date_of_birth'] as const) {
    if (key in body) updates[key] = body[key] || null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  }

  const { data: player, error } = await adminClient
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .select()
    .single()

  if (error) {
    console.error('Dependent update failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  return NextResponse.json({ player })
}
