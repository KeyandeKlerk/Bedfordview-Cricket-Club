import { NextRequest, NextResponse } from 'next/server'

// Nothing in this repo previously invoked the availability-deadline-reminder
// Supabase edge function — no pg_cron schedule, no Vercel cron entry. This
// route is what vercel.json's cron entry actually calls; it just forwards
// the CRON_SECRET straight through to the edge function, which already
// expects `Authorization: Bearer <CRON_SECRET>`.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const fnRes = await fetch(`${supabaseUrl}/functions/v1/availability-deadline-reminder`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${secret}` },
  })

  const data = await fnRes.json().catch(() => ({}))
  return NextResponse.json(data, { status: fnRes.status })
}
