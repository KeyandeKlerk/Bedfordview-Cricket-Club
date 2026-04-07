// Legacy compatibility shim — new code should import from lib/supabase/server.ts
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* read-only in Server Components */ }
        },
      },
    }
  )
}

export async function getCurrentPlayerServer() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch all roles + linked player record in parallel
  const [rolesRes, playerRes] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase
      .from('players')
      .select('id, first_name, last_name, batting_style, bowling_style, is_captain_club, is_vice_captain, jersey_number')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  // Role hierarchy: highest-privilege role wins
  const roles = (rolesRes.data ?? []).map((r: any) => r.role as string)
  const HIERARCHY = ['admin', 'coach', 'scorer', 'shop', 'player'] as const
  type AppRole = 'admin' | 'coach' | 'scorer' | 'shop' | 'player' | 'member'
  const role: AppRole = (HIERARCHY.find(r => roles.includes(r)) ?? 'member') as AppRole

  const player = playerRes.data

  return {
    id: user.id,
    email: user.email ?? '',
    full_name: player
      ? `${player.first_name} ${player.last_name}`
      : (user.user_metadata?.full_name ?? user.email ?? 'User'),
    role,
    // Linked player record (null if player hasn't claimed their profile yet)
    player_id: player?.id ?? null,
    batting_style: player?.batting_style ?? null,
    bowling_style: player?.bowling_style ?? null,
    is_captain_club: player?.is_captain_club ?? false,
    is_vice_captain: player?.is_vice_captain ?? false,
    jersey_number: player?.jersey_number ?? null,
    is_linked: !!player,
    joined_date: user.created_at,
  }
}
