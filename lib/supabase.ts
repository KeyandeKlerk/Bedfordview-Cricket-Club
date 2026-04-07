/**
 * Legacy compatibility re-exports.
 * New code should import from:
 *   - lib/supabase/client.ts  (browser)
 *   - lib/supabase/server.ts  (server)
 *   - lib/cricket/types.ts    (types)
 */

export { supabase } from './supabase/client'

// ── LEGACY TYPES (for pages not yet migrated) ──────────────────────────────────

export type Player = {
  id: string
  email: string
  full_name: string
  role: 'member' | 'scorer' | 'admin' | 'shop' | 'player' | 'coach'
  batting_style: string | null
  bowling_style: string | null
  joined_date: string
  // Linked player record (null if not yet claimed)
  player_id?: string | null
  is_linked?: boolean
  is_captain_club?: boolean
  is_vice_captain?: boolean
  jersey_number?: number | null
  active?: boolean
  avatar_url?: string | null
}

// Role helpers
export function isScorer(player: { role: string } | null) {
  return player?.role === 'scorer' || player?.role === 'admin'
}

export function isAdmin(player: { role: string } | null) {
  return player?.role === 'admin'
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const { supabase } = await import('./supabase/client')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle()

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    full_name: session.user.user_metadata?.full_name ?? session.user.email ?? 'User',
    role: (roles?.role ?? 'member') as Player['role'],
    batting_style: null,
    bowling_style: null,
    joined_date: session.user.created_at,
  }
}

// Keep re-exports for any existing imports from '@/lib/supabase'
export { getPlayers, getPlayer, getMatches, getMatch } from './queries'
