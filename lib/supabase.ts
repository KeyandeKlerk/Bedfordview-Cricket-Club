/**
 * Legacy compatibility re-exports.
 * New code should import from:
 *   - lib/supabase/client.ts  (browser)
 *   - lib/supabase/server.ts  (server)
 *   - lib/cricket/types.ts    (types)
 */

export { supabase } from './supabase/client'
import type { Role } from './cricket/types'

// ── LEGACY TYPES (for pages not yet migrated) ──────────────────────────────────

export type Player = {
  id: string
  email: string
  full_name: string
  role: Role
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

export { getMatches } from './queries'
