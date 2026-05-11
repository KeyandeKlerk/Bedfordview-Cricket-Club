import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return null
  const { data: roles } = await adminClient
    .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1)
  return roles?.length ? user : null
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: authData }, { data: userRoles }, { data: players }] = await Promise.all([
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    adminClient.from('user_roles').select('id, user_id, role, assigned_at'),
    adminClient.from('players').select('id, first_name, last_name, user_id').not('user_id', 'is', null),
  ])

  const rolesMap = new Map<string, { id: string; role: string; assigned_at: string }[]>()
  for (const r of userRoles ?? []) {
    const list = rolesMap.get(r.user_id) ?? []
    list.push({ id: r.id, role: r.role, assigned_at: r.assigned_at })
    rolesMap.set(r.user_id, list)
  }

  const playerMap = new Map<string, string>()
  for (const p of players ?? []) {
    if (p.user_id) playerMap.set(p.user_id, `${p.first_name} ${p.last_name}`.trim())
  }

  const result = (authData?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '',
    full_name: playerMap.get(u.id) ?? (u.user_metadata?.full_name as string | undefined) ?? null,
    created_at: u.created_at,
    roles: rolesMap.get(u.id) ?? [],
  }))

  result.sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email))

  return NextResponse.json(result)
}
