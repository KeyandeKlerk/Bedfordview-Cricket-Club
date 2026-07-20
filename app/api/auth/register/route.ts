import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase as supabaseAdmin } from '@/lib/supabase/server'
import { validateDependentForm } from '@/lib/family'

interface RegisterBody {
  mode?: 'self' | 'child'
  email: string
  password: string
  full_name: string
  batting_style?: string
  bowling_style?: string
  child?: { firstName: string; lastName: string; dateOfBirth: string }
  parentAlsoPlays?: { battingStyle?: string; bowlingStyle?: string }
}

export async function POST(req: NextRequest) {
  let body: RegisterBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const mode = body.mode === 'child' ? 'child' : 'self'
  const { email, password, full_name, batting_style, bowling_style } = body

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  if (mode === 'child') {
    if (!body.child) {
      return NextResponse.json({ error: "Child details are required." }, { status: 400 })
    }
    const validationError = validateDependentForm({
      firstName: body.child.firstName,
      lastName: body.child.lastName,
      dateOfBirth: body.child.dateOfBirth,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
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
    console.error('Auth user creation failed:', authError)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 400 })
  }

  const userId = authData.user.id

  if (mode === 'self') {
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

  // mode === 'child': register a guardian (the caller) plus an unclaimed
  // child player record, linked via player_guardians. The guardian only
  // gets their own player row if they opted in via parentAlsoPlays.
  let parentPlayerId: string | null = null
  let childPlayerId: string | null = null

  try {
    if (body.parentAlsoPlays) {
      const { data: parentPlayer, error: parentPlayerError } = await supabaseAdmin
        .from('players')
        .insert({
          first_name,
          last_name,
          email,
          user_id: userId,
          batting_style: body.parentAlsoPlays.battingStyle || null,
          bowling_style: body.parentAlsoPlays.bowlingStyle || null,
          is_active: true,
        })
        .select('id')
        .single()
      if (parentPlayerError) throw parentPlayerError
      parentPlayerId = parentPlayer.id
    }

    // Every registering guardian gets the 'player' role, since RLS on
    // player_availability/selections gates on player_id, not has_role —
    // this just keeps role semantics honest for a guardian acting on a
    // child's behalf.
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'player' })
    if (roleError) console.error('Role insert failed:', roleError) // non-fatal

    const { data: childPlayer, error: childPlayerError } = await supabaseAdmin
      .from('players')
      .insert({
        first_name: body.child!.firstName.trim(),
        last_name: body.child!.lastName.trim(),
        date_of_birth: body.child!.dateOfBirth,
        is_active: true,
      })
      .select('id')
      .single()
    if (childPlayerError) throw childPlayerError
    childPlayerId = childPlayer.id

    const { error: guardianError } = await supabaseAdmin
      .from('player_guardians')
      .insert({ guardian_user_id: userId, player_id: childPlayerId, relationship: 'parent', created_by: userId })
    if (guardianError) throw guardianError

    return NextResponse.json({ success: true, childId: childPlayerId }, { status: 201 })
  } catch (err) {
    console.error('Child registration failed:', err)
    // Roll back whatever was created so the guardian can retry cleanly
    if (childPlayerId) await supabaseAdmin.from('players').delete().eq('id', childPlayerId)
    if (parentPlayerId) await supabaseAdmin.from('players').delete().eq('id', parentPlayerId)
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to register your child. Please try again.' }, { status: 500 })
  }
}
