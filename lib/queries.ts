/**
 * Isomorphic query helpers.
 * Uses anon key (public data only).
 */
import { anonSupabase as db } from './supabase/server'

export async function getMatches(status?: string) {
  // 'upcoming' should surface the soonest fixtures first; everything else
  // (completed results, or no filter) reads most-recent-first.
  let query = db
    .from('matches')
    .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name,match_format,overs_per_innings)')
    .order('match_date', { ascending: status === 'upcoming' })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((m: any) => ({
    ...m,
    date: m.match_date,
    venue: m.ground?.name ?? null,
    overs: m.overs_per_innings,
    home_team: m.our_team_side === 'home' ? 'BCC' : m.opponent?.canonical_name ?? 'Unknown',
    away_team: m.our_team_side === 'away' ? 'BCC' : m.opponent?.canonical_name ?? 'Unknown',
    result: m.result_text,
  }))
}
