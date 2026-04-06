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

  // Look up role from user_roles table
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .order('role')   // 'admin' < 'scorer' alphabetically
    .limit(1)
    .maybeSingle()

  const role = roleData?.role ?? 'member'

  // Return a player-like object for dashboard compatibility
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name ?? user.email ?? 'User',
    role,
    batting_style: user.user_metadata?.batting_style ?? null,
    bowling_style: user.user_metadata?.bowling_style ?? null,
    joined_date: user.created_at,
  }
}
