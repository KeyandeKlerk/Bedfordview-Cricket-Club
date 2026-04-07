import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS and can use auth admin API
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  let body: {
    email: string
    password: string
    full_name: string
    batting_style?: string
    bowling_style?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { email, password, full_name, batting_style, bowling_style } = body

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Split full name: first word = first_name, rest = last_name
  const nameParts = full_name.trim().split(/\s+/)
  const first_name = nameParts[0]
  const last_name = nameParts.slice(1).join(' ') || first_name // fallback for single-word names

  // 1. Create auth user — email_confirm: true skips the confirmation email
  //    so the user can sign in immediately after registration.
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, batting_style: batting_style || null, bowling_style: bowling_style || null },
  })

  if (authError) {
    // Supabase returns status 422 for duplicate email in admin.createUser.
    // Guard on both the numeric status and common message fragments for safety.
    const isDuplicate =
      (authError as any).status === 422 ||
      authError.message.toLowerCase().includes('already registered') ||
      authError.message.toLowerCase().includes('already been registered') ||
      authError.message.toLowerCase().includes('already exists')
    if (isDuplicate) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user.id

  // 2. Create player record linked to the new auth user
  const { error: playerError } = await supabaseAdmin
    .from('players')
    .insert({
      first_name,
      last_name,
      email,
      user_id: userId,
      batting_style: batting_style || null,
      bowling_style: bowling_style || null,
      is_active: true,
    })

  if (playerError) {
    // Roll back: delete the auth user so they can retry
    await supabaseAdmin.auth.admin.deleteUser(userId)
    console.error('Player insert failed:', playerError)
    return NextResponse.json({ error: 'Failed to create player profile.' }, { status: 500 })
  }

  // 3. Assign 'player' role
  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: userId, role: 'player' })

  if (roleError) {
    // Non-fatal — user can still sign in, admin can grant role manually
    console.error('Role insert failed:', roleError)
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
