// on-order-paid
// Triggered by DB Webhook on orders UPDATE WHERE status = 'paid'.
// For membership orders:
//   1. Activates or creates memberships record
//   2. Assigns 'player' role to the user
//   3. Sends membership_activated in-app notification
// Idempotency: checks memberships.order_id before processing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // Verify webhook secret — without this, a crafted unauthenticated POST could
  // grant a free membership + 'player' role for any user_id (same convention
  // as on-selection-announced; must be configured as a custom HTTP header on
  // this DB Webhook in the Supabase dashboard).
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (!webhookSecret) {
    return new Response('Webhook secret not configured', { status: 500 })
  }
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { record?: { id: string; status: string; order_type: string; user_id: string | null; player_id: string | null; customer_name: string } }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const order = body.record
  if (!order?.id || order.status !== 'paid') {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Only process membership orders
  if (order.order_type !== 'membership') {
    return new Response(JSON.stringify({ skipped: true, reason: 'not_membership' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!order.user_id) {
    // Guest checkout — no account to activate
    return new Response(JSON.stringify({ skipped: true, reason: 'no_user_id' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Idempotency: the checkout route (app/api/orders/route.ts) always creates a
  // 'pending' membership row for this order_id before payment, so checking mere
  // *existence* of a row is always true and would skip every real payment.
  // Check for an already-*active* row instead.
  const { data: existingActive } = await supabase
    .from('memberships')
    .select('id')
    .eq('order_id', order.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existingActive) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_activated' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  // Activate the pending row created at checkout (preserves its tier/player_id).
  // Falls back to inserting one if it's missing for any reason (e.g. a manual
  // 'paid' status flip with no prior checkout row).
  const { data: activated, error: membershipErr } = await supabase
    .from('memberships')
    .update({
      status: 'active',
      valid_from: now.toISOString(),
      valid_until: oneYearLater.toISOString(),
    })
    .eq('order_id', order.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (membershipErr) {
    console.error('Failed to activate membership:', membershipErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  if (!activated) {
    const { error: insertErr } = await supabase
      .from('memberships')
      .insert({
        user_id: order.user_id,
        order_id: order.id,
        status: 'active',
        tier: 'standard',
        valid_from: now.toISOString(),
        valid_until: oneYearLater.toISOString(),
      })
    if (insertErr) {
      console.error('Failed to create membership:', insertErr)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  // If this membership was bought for a specific player (a guardian buying for
  // their child — see 035_guardians.sql), the role/notification belongs on
  // that player's OWN account if they've claimed one, not the paying
  // guardian's — otherwise the child's own login never reflects the
  // membership they hold. Falls back to the guardian's account when the
  // child hasn't claimed a login yet (common for young kids), since there's
  // nowhere else to put it.
  let targetUserId = order.user_id
  let beneficiaryName: string | null = null
  if (order.player_id) {
    const { data: player } = await supabase
      .from('players')
      .select('user_id, first_name')
      .eq('id', order.player_id)
      .maybeSingle()
    if (player?.user_id) {
      targetUserId = player.user_id
      beneficiaryName = player.first_name
    }
  }

  // Assign 'player' role (ON CONFLICT DO NOTHING — safe to call multiple times)
  await supabase
    .from('user_roles')
    .upsert({ user_id: targetUserId, role: 'player' }, { onConflict: 'user_id,role', ignoreDuplicates: true })

  // Send in-app notification
  const validUntilStr = oneYearLater.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  await supabase
    .from('notifications')
    .upsert({
      user_id: targetUserId,
      type: 'membership_activated',
      title: 'Membership Activated',
      body: beneficiaryName
        ? `${beneficiaryName}'s membership is active until ${validUntilStr}.`
        : `Welcome to BCC! Your membership is active until ${validUntilStr}.`,
      data: { order_id: order.id, valid_until: oneYearLater.toISOString() },
      idempotency_key: `membership_activated:${order.id}:${targetUserId}`,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  return new Response(
    JSON.stringify({ activated: true, user_id: targetUserId }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
