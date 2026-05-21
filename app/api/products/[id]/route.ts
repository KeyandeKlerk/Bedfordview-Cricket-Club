import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase/server'

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await serverSupabase.auth.getUser(token)
  return user
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roles } = await serverSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'shop'])
    .limit(1)
  if (!roles || roles.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { name, description, image_url, category, price_zar, sizes, benefits, is_active, sort_order } = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (image_url !== undefined) updates.image_url = image_url
  if (category !== undefined) updates.category = category
  if (price_zar !== undefined) updates.price_zar = price_zar
  if (sizes !== undefined) updates.sizes = sizes
  if (benefits !== undefined) updates.benefits = benefits
  if (is_active !== undefined) updates.is_active = is_active
  if (sort_order !== undefined) updates.sort_order = sort_order
  const { data, error } = await serverSupabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('Product update failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roles } = await serverSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin'])
    .limit(1)
  if (!roles || roles.length === 0) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const { id } = await params

  const { error } = await serverSupabase.from('products').delete().eq('id', id)
  if (error) {
    console.error('Product delete failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
