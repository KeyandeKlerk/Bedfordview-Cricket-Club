import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

  // Auth check — must be coach or admin
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
  const { match_id } = body
  if (!match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

  // Call the Supabase Edge Function using the service role key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const edgeFnUrl = `${supabaseUrl}/functions/v1/on-selection-announced`

  const fnRes = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ match_id }),
  })

  const data = await fnRes.json().catch(() => ({}))

  // 207 = partial success — pass it through
  return NextResponse.json(data, { status: fnRes.ok || fnRes.status === 207 ? fnRes.status : 502 })
}
