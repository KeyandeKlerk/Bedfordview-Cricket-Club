import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key (bypasses RLS).
 * Use for admin API routes. Never import this in client components.
 */
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder',
    { auth: { persistSession: false } }
  )
}

/** Lazy singleton — deferred so module evaluation doesn't throw when env vars are absent at build time */
let _serverSupabase: ReturnType<typeof createServerClient> | undefined
export const serverSupabase = new Proxy({} as ReturnType<typeof createServerClient>, {
  get(_, prop) { return (_serverSupabase ??= createServerClient())[prop as keyof ReturnType<typeof createServerClient>] },
})

/**
 * Server-only Supabase client using the anon key (respects RLS).
 * Use for public server components and pages. Never import this in client components.
 */
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  )
}

let _anonSupabase: ReturnType<typeof createAnonClient> | undefined
export const anonSupabase = new Proxy({} as ReturnType<typeof createAnonClient>, {
  get(_, prop) { return (_anonSupabase ??= createAnonClient())[prop as keyof ReturnType<typeof createAnonClient>] },
})

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
