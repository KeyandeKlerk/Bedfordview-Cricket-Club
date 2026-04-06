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
  if (search) query = query.or(`customer_name.ilike.%${search}%,reference.ilike.%${search}%,customer_email.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  const { orderType, lineItems, shippingAddress, customerName, customerEmail } = body

  if (!orderType || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ error: 'Invalid order data' }, { status: 400 })
  }

  // Validate products and prices from DB
  const productIds = lineItems.map((li: { productId: string }) => li.productId)
  const { data: products, error: prodError } = await serverSupabase
    .from('products')
    .select('id, price_zar, is_active')
    .in('id', productIds)

  if (prodError) return NextResponse.json({ error: prodError.message }, { status: 500 })

  for (const item of lineItems) {
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
      order_type: orderType,
      amount_total: amountTotal,
      line_items: lineItems,
      shipping_address: shippingAddress || null,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
    })
    .select()
    .single()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // If membership order with logged-in user, create pending membership
  if (orderType === 'membership' && userId) {
    const tier = lineItems[0]?.tier || 'standard'
    await serverSupabase
      .from('memberships')
      .upsert({ user_id: userId, order_id: order.id, status: 'pending', tier }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ orderId: order.id, reference, total: amountTotal }, { status: 201 })
}
