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

  let body: { record?: { id: string; status: string; order_type: string; user_id: string | null; customer_name: string } }
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

  // Idempotency: check if this order was already processed
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('order_id', order.id)
    .single()

  if (existingMembership) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_activated' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  // Create memberships row
  const { error: membershipErr } = await supabase
    .from('memberships')
    .insert({
      user_id: order.user_id,
      order_id: order.id,
      status: 'active',
      tier: 'standard',
      valid_from: now.toISOString(),
      valid_until: oneYearLater.toISOString(),
    })

  if (membershipErr) {
    console.error('Failed to create membership:', membershipErr)
    return new Response('Internal Server Error', { status: 500 })
  }

  // Assign 'player' role (ON CONFLICT DO NOTHING — safe to call multiple times)
  await supabase
    .from('user_roles')
    .upsert({ user_id: order.user_id, role: 'player' }, { onConflict: 'user_id,role', ignoreDuplicates: true })

  // Send in-app notification
  await supabase
    .from('notifications')
    .upsert({
      user_id: order.user_id,
      type: 'membership_activated',
      title: 'Membership Activated',
      body: `Welcome to BCC! Your membership is active until ${oneYearLater.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      data: { order_id: order.id, valid_until: oneYearLater.toISOString() },
      idempotency_key: `membership_activated:${order.id}:${order.user_id}`,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

  return new Response(
    JSON.stringify({ activated: true, user_id: order.user_id }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
