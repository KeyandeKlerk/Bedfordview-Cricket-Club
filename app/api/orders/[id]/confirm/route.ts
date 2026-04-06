import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params
  const { action } = await req.json()

  const validActions = ['paid', 'fulfilled', 'canceled']
  if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const updates: Record<string, unknown> = { status: action }
  if (action === 'paid') updates.paid_at = new Date().toISOString()

  const { data: order, error } = await serverSupabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Activate membership if this is a membership order being paid
  if (action === 'paid' && order.order_type === 'membership' && order.user_id) {
    const validFrom = new Date()
    const validUntil = new Date(validFrom)
    validUntil.setFullYear(validUntil.getFullYear() + 1)
    await serverSupabase
      .from('memberships')
      .update({
        status: 'active',
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
      })
      .eq('order_id', id)
  }

  return NextResponse.json({ success: true, order })
}
