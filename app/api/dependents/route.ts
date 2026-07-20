import { serverSupabase as adminClient } from '@/lib/supabase/server'
import { validateDependentForm, isOldEnoughToClaim } from '@/lib/family'
import { NextRequest, NextResponse } from 'next/server'

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await adminClient
    .from('player_guardians')
    .select('id, relationship, created_at, player:players(id, first_name, last_name, date_of_birth, user_id, batting_style, bowling_style)')
    .eq('guardian_user_id', user.id)
    .order('created_at')

  if (error) {
    console.error('Dependents fetch failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  const dependents = (data ?? []).map((row: any) => ({
    linkId: row.id,
    relationship: row.relationship,
    player: row.player,
    isClaimed: row.player?.user_id != null,
    canClaim: row.player?.user_id == null && isOldEnoughToClaim(row.player?.date_of_birth ?? null),
  }))

  return NextResponse.json({ dependents })
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstName, lastName, dateOfBirth } = await req.json()
  const validationError = validateDependentForm({ firstName, lastName, dateOfBirth })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth,
      is_active: true,
    })
    .select()
    .single()

  if (playerError) {
    console.error('Dependent player insert failed:', playerError)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  const { error: guardianError } = await adminClient
    .from('player_guardians')
    .insert({ guardian_user_id: user.id, player_id: player.id, relationship: 'parent', created_by: user.id })

  if (guardianError) {
    // Roll back the orphaned player row so retrying doesn't leave debris
    await adminClient.from('players').delete().eq('id', player.id)
    console.error('Guardian link insert failed:', guardianError)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    action: 'dependent_added',
    entity_type: 'players',
    entity_id: player.id,
    new_data: { first_name: firstName, last_name: lastName },
  })

  return NextResponse.json({ player }, { status: 201 })
}
