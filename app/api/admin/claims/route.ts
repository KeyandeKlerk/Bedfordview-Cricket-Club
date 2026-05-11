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

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req)
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const adminClient = getAdminClient()

  const { claimId, action } = await req.json()
  if (!claimId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: claim, error: fetchError } = await adminClient
    .from('player_claims')
    .select('id, player_id, user_id, claimant_email, status')
    .eq('id', claimId)
    .single()

  if (fetchError || !claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  if (claim.status !== 'pending') return NextResponse.json({ error: 'Claim already reviewed' }, { status: 409 })

  if (action === 'approve') {
    // Link player to account — only if still unclaimed (guards against races)
    const { error: linkError } = await adminClient
      .from('players')
      .update({ user_id: claim.user_id, email: claim.claimant_email })
      .eq('id', claim.player_id)
      .is('user_id', null)

    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  // Mark claim reviewed
  await adminClient
    .from('player_claims')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: caller.id })
    .eq('id', claimId)

  // Notify the user
  const notifTitle = action === 'approve' ? 'Profile claim approved' : 'Profile claim rejected'
  const notifBody  = action === 'approve'
    ? 'Your player profile has been linked. Your stats are now on your dashboard.'
    : 'Your player profile claim was not approved. Contact an admin for help.'
  await adminClient.from('notifications').upsert({
    user_id: claim.user_id,
    title: notifTitle,
    body: notifBody,
    href: action === 'approve' ? '/dashboard' : '/claim-profile',
    idempotency_key: `claim_${action}:${claimId}:${claim.user_id}`,
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  await adminClient.from('audit_log').insert({
    user_id: caller.id,
    action: `claim_${action}d`,
    entity_type: 'player_claims',
    entity_id: claimId,
    new_data: { player_id: claim.player_id, claimant: claim.claimant_email },
  })

  return NextResponse.json({ ok: true })
}
