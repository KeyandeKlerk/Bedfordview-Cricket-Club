import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const adminClient = getAdminClient()
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return null
  const { data: roles } = await adminClient
    .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1)
  return roles?.length ? user : null
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(req)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = getAdminClient()
  const { id: targetId } = await params

  if (targetId === caller.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await adminClient.from('players').update({ is_active: false }).eq('user_id', targetId)

  const { error } = await adminClient.auth.admin.deleteUser(targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient.from('audit_log').insert({
    user_id: caller.id,
    action: 'user_deleted',
    entity_type: 'auth.users',
    entity_id: targetId,
    new_data: { soft_deleted: true },
  })

  return NextResponse.json({ ok: true })
}
