/**
 * Isomorphic query helpers — re-exported from lib/supabase.ts for compat.
 * Uses anon key (public data only).
 */
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getPlayers() {
  const { data, error } = await db
    .from('players')
    .select('*')
    .eq('is_active', true)
    .order('last_name')
  if (error) throw error
  // Normalise to legacy shape
  return (data ?? []).map((p: any) => ({
    ...p,
    full_name: `${p.first_name} ${p.last_name}`.trim(),
    active: p.is_active,
  }))
}

export async function getPlayer(id: string) {
  const { data, error } = await db.from('players').select('*').eq('id', id).single()
  if (error) throw error
  return { ...data, full_name: `${data.first_name} ${data.last_name}`.trim(), active: data.is_active }
}

export async function getMatches(status?: string) {
  let query = db
    .from('matches')
    .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name,match_format,overs_per_innings)')
    .order('match_date', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((m: any) => ({
    ...m,
    // Normalise legacy fields
    date: m.match_date,
    venue: m.ground?.name ?? null,
    overs: m.overs_per_innings,
    home_team: m.our_team_side === 'home' ? 'BCC' : m.opponent?.canonical_name ?? 'Unknown',
    away_team: m.our_team_side === 'away' ? 'BCC' : m.opponent?.canonical_name ?? 'Unknown',
    result: m.result_text,
  }))
}

export async function getMatch(id: string) {
  const { data, error } = await db
    .from('matches')
    .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name,match_format,overs_per_innings)')
    .eq('id', id)
    .single()
  if (error) throw error
  return {
    ...data,
    date: data.match_date,
    venue: data.ground?.name ?? null,
    overs: data.overs_per_innings,
    home_team: data.our_team_side === 'home' ? 'BCC' : data.opponent?.canonical_name ?? 'Unknown',
    away_team: data.our_team_side === 'away' ? 'BCC' : data.opponent?.canonical_name ?? 'Unknown',
    result: data.result_text,
  }
}

// Legacy stat functions — now reads from materialized views
export async function getBattingStats() {
  const { data, error } = await db
    .from('career_batting_stats')
    .select('*')
    .order('total_runs', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    ...p,
    full_name: p.player_name,
    high_score: p.highest_score,
  }))
}

export async function getBowlingStats() {
  const { data, error } = await db
    .from('career_bowling_stats')
    .select('*')
    .order('wickets', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    ...p,
    full_name: p.player_name,
    total_wickets: p.wickets,
    total_runs: p.runs_conceded,
    overs: p.legal_balls != null ? `${Math.floor(p.legal_balls / 6)}.${p.legal_balls % 6}` : '0.0',
  }))
}
