import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 * Never import this in client components.
 */
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** Convenience — single shared instance for server components / route handlers */
export const serverSupabase = createServerClient()

export async function getCurrentUserRole(userId: string): Promise<string | null> {
  const { data } = await serverSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('role')   // 'admin' < 'scorer' alphabetically, but we want admin first
    .limit(1)
    .single()
  return data?.role ?? null
}

export async function hasRole(userId: string, role: 'scorer' | 'admin'): Promise<boolean> {
  const { data } = await serverSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', role === 'scorer' ? ['scorer', 'admin'] : ['admin'])
    .limit(1)
  return (data?.length ?? 0) > 0
}
