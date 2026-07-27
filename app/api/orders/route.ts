import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await serverSupabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roles } = await serverSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'shop'])
    .limit(1)
  if (!roles || roles.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  let query = serverSupabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') query = query.eq('status', status)
  if (type && type !== 'all') query = query.eq('order_type', type)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')
  if (search) {
    const safeSearch = search.replace(/[%_,().'"`\\]/g, '')
    if (safeSearch) {
      query = query.or(
        `customer_name.ilike.%${safeSearch}%,reference.ilike.%${safeSearch}%,customer_email.ilike.%${safeSearch}%`
      )
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('Orders fetch failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
  return NextResponse.json({ orders: data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  let userId: string | null = null

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await serverSupabase.auth.getUser(token)
    userId = user?.id ?? null
  }

  const body = await req.json()
  const { orderType, lineItems, shippingAddress, customerName, customerEmail, playerId } = body

  if (!orderType || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ error: 'Invalid order data' }, { status: 400 })
  }

  // If the order is placed on behalf of a specific player (self or a linked
  // child), verify the caller is actually authorized to act for them —
  // this route uses the service-role client, so RLS's
  // current_actable_player_ids() doesn't apply and must be re-implemented
  // here explicitly.
  if (playerId) {
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to order for a specific player.' }, { status: 401 })
    }
    const [{ data: ownPlayer }, { data: guardianLink }] = await Promise.all([
      serverSupabase.from('players').select('id').eq('id', playerId).eq('user_id', userId).maybeSingle(),
      serverSupabase.from('player_guardians').select('player_id').eq('guardian_user_id', userId).eq('player_id', playerId).maybeSingle(),
    ])
    if (!ownPlayer && !guardianLink) {
      return NextResponse.json({ error: 'You are not authorized to order for this player.' }, { status: 403 })
    }
  }

  // Validate products and prices from DB
  const productIds = lineItems.map((li: { productId: string }) => li.productId)
  const { data: products, error: prodError } = await serverSupabase
    .from('products')
    .select('id, price_zar, is_active')
    .in('id', productIds)

  if (prodError) {
    console.error('Product lookup failed:', prodError)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  for (const item of lineItems) {
    if (!item.qty || item.qty < 1 || !Number.isInteger(item.qty)) {
      return NextResponse.json({ error: 'Invalid item quantity.' }, { status: 400 })
    }
    const product = products?.find((p) => p.id === item.productId)
    if (!product || !product.is_active) {
      return NextResponse.json({ error: `Product ${item.productId} not found or inactive` }, { status: 400 })
    }
    if (product.price_zar !== item.unitPrice) {
      return NextResponse.json({ error: 'Price mismatch — please refresh the page' }, { status: 400 })
    }
  }

  const amountTotal = lineItems.reduce(
    (sum: number, li: { unitPrice: number; qty: number }) => sum + li.unitPrice * li.qty,
    0
  )

  // Generate reference BCC-YYYY-NNN
  const year = new Date().getFullYear()
  const { count } = await serverSupabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .like('reference', `BCC-${year}-%`)
  const seq = ((count || 0) + 1).toString().padStart(3, '0')
  const reference = `BCC-${year}-${seq}`

  const { data: order, error: orderError } = await serverSupabase
    .from('orders')
    .insert({
      reference,
      user_id: userId,
      player_id: playerId || null,
      order_type: orderType,
      amount_total: amountTotal,
      line_items: lineItems,
      shipping_address: shippingAddress || null,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
    })
    .select()
    .single()

  if (orderError) {
    console.error('Order insert failed:', orderError)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }

  // If membership order with logged-in user, create pending membership.
  // supabase-js's .upsert({ onConflict }) can't express the partial-index
  // WHERE predicate (status = 'active') that memberships_one_active_self /
  // memberships_one_active_per_player require for ON CONFLICT inference —
  // see 036_flow_audit_fixes.sql for the RPC that does this in plain SQL.
  if (orderType === 'membership' && userId) {
    const tier = lineItems[0]?.tier || 'standard'
    const { error: membershipErr } = await serverSupabase.rpc('upsert_pending_membership', {
      p_user_id: userId,
      p_player_id: playerId || null,
      p_order_id: order.id,
      p_tier: tier,
    })
    if (membershipErr) console.error('Pending membership upsert failed:', membershipErr)
  }

  return NextResponse.json({ orderId: order.id, reference, total: amountTotal }, { status: 201 })
}
