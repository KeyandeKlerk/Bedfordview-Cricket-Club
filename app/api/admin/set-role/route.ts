import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Verify the requester is authenticated
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin role from user_roles table
  const { data: roles } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin'])
    .limit(1)

  if (!roles || roles.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, role } = await req.json()
  if (!userId || !['scorer', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid request — role must be scorer or admin' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await adminClient.from('audit_log').insert({
    user_id: user.id,
    action: 'role_assigned',
    entity_type: 'user_roles',
    entity_id: data.id,
    new_data: { user_id: userId, role },
  })

  return NextResponse.json({ ok: true })
}
