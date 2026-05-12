import { createBrowserClient } from '@supabase/ssr'

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Lazy singleton — deferred so module evaluation doesn't throw at build time / during SSR */
let _supabase: ReturnType<typeof createClient> | undefined
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) { return (_supabase ??= createClient())[prop as keyof ReturnType<typeof createClient>] },
})
