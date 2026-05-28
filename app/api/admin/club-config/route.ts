import { serverSupabase as adminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return null
  const { data } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
  return data && data.length > 0 ? user : null
}

// Intentionally public — branding, plan, and is_demo are all needed by
// client-side components (stats tabs, demo banner). contact_email is low-sensitivity.
export async function GET() {
  const { data, error } = await adminClient
    .from('club_config')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('club_config GET failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { club_name, club_short_name, logo_url, favicon_url, primary_color, highlight_color, bg_color, default_scoring_mode, contact_email } = body

  const hexRe = /^#[0-9a-fA-F]{6}$/
  if (primary_color && !hexRe.test(primary_color))
    return NextResponse.json({ error: 'Invalid primary_color' }, { status: 400 })
  if (highlight_color && !hexRe.test(highlight_color))
    return NextResponse.json({ error: 'Invalid highlight_color' }, { status: 400 })
  if (bg_color && !hexRe.test(bg_color))
    return NextResponse.json({ error: 'Invalid bg_color' }, { status: 400 })
  if (default_scoring_mode !== undefined && !['club', 'professional'].includes(default_scoring_mode))
    return NextResponse.json({ error: 'Invalid default_scoring_mode' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (club_name !== undefined)            updates.club_name             = String(club_name).slice(0, 100)
  if (club_short_name !== undefined)      updates.club_short_name       = String(club_short_name).slice(0, 10)
  if (logo_url !== undefined)             updates.logo_url              = logo_url || null
  if (favicon_url !== undefined)          updates.favicon_url           = favicon_url || null
  if (primary_color !== undefined)        updates.primary_color         = primary_color
  if (highlight_color !== undefined)      updates.highlight_color       = highlight_color
  if (bg_color !== undefined)             updates.bg_color              = bg_color
  if (default_scoring_mode !== undefined) updates.default_scoring_mode  = default_scoring_mode
  if (contact_email !== undefined)        updates.contact_email         = contact_email || null

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const { data, error } = await adminClient
    .from('club_config')
    .update(updates)
    .not('id', 'is', null)
    .select()
    .single()

  if (error) {
    console.error('club_config update failed:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
