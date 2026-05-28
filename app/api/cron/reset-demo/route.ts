import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase/server'
import { getClubConfig } from '@/lib/club-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Wipes all demo data. Re-seeding requires running `npx tsx scripts/seed-demo.ts`
 * separately (e.g. via a GitHub Actions workflow triggered after this endpoint fires).
 */
async function handleReset(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = await getClubConfig()
  if (!config.is_demo) {
    return NextResponse.json({ error: 'Not a demo instance' }, { status: 400 })
  }

  const tables = [
    'ball_events', 'innings', 'match_players', 'selections',
    'player_availability', 'availability_windows',
    'matches', 'players', 'seasons', 'competitions',
    'opponents', 'grounds', 'notifications',
  ] as const

  for (const table of tables) {
    const { error } = await serverSupabase.from(table as any).delete().not('id', 'is', null)
    if (error) {
      return NextResponse.json(
        { error: `Failed wiping ${table}: ${error.message}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'Demo data wiped. Run seed-demo.ts to repopulate.',
  })
}

export async function GET(req: NextRequest) {
  return handleReset(req)
}

export async function POST(req: NextRequest) {
  return handleReset(req)
}
