import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key (bypasses RLS).
 * Use for admin API routes. Never import this in client components.
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Throw at request time (not build time) if env vars are missing in production
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!supabaseUrl) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL')
    if (!serviceRoleKey) throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl ?? '', serviceRoleKey ?? '', { auth: { persistSession: false } })
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!supabaseUrl) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL')
    if (!supabaseAnonKey) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
}

let _anonSupabase: ReturnType<typeof createAnonClient> | undefined
export const anonSupabase = new Proxy({} as ReturnType<typeof createAnonClient>, {
  get(_, prop) { return (_anonSupabase ??= createAnonClient())[prop as keyof ReturnType<typeof createAnonClient>] },
})
