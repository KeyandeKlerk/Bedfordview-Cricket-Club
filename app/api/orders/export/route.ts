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

  let query = serverSupabase.from('orders').select('*').order('created_at', { ascending: false })
  if (status && status !== 'all') query = query.eq('status', status)
  if (type && type !== 'all') query = query.eq('order_type', type)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []).map((o) => {
    const items = (o.line_items as Array<{ name?: string; size?: string; qty: number; unitPrice: number }> || [])
      .map((li) => `${li.name || ''} ${li.size ? `(${li.size})` : ''} x${li.qty}`)
      .join('; ')
    return [
      o.reference,
      o.order_type,
      o.customer_name || '',
      o.customer_email || '',
      items,
      `R${((o.amount_total || 0) / 100).toFixed(2)}`,
      o.status,
      o.created_at ? new Date(o.created_at).toLocaleDateString('en-ZA') : '',
      o.paid_at ? new Date(o.paid_at).toLocaleDateString('en-ZA') : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  })

  const csv = ['Reference,Type,Customer,Email,Items,Total,Status,Date,Paid At', ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="bcc-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
