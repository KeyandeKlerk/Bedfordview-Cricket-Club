import { serverSupabase as adminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roles } = await adminClient
    .from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'coach', 'scorer']).limit(1)
  if (!roles || roles.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { first_name, last_name, nickname, batting_style, bowling_style } = await req.json()
  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 })
  }

  const { data: player, error: dbError } = await adminClient
    .from('players')
    .insert({ first_name, last_name, nickname: nickname || null, batting_style: batting_style || null, bowling_style: bowling_style || null })
    .select()
    .single()

  if (dbError) {
    console.error('Player insert failed:', dbError)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  await adminClient.from('audit_log').insert({
    user_id: user.id,
    action: 'player_created',
    entity_type: 'players',
    entity_id: player.id,
    new_data: { first_name, last_name },
  })

  return NextResponse.json({ player })
}
