'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

/**
 * Listens for client-side session expiry and redirects to /login.
 * Prevents the split-session edge case where the page renders (server cookie
 * valid) but subsequent mutations fail with RLS errors (browser JWT expired).
 */
export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') {
          router.replace('/login')
        }
      }
    })

    // Validate against the server on mount — catches stale or forged cookies
    // that pass the server layout check but are rejected by Supabase auth.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return null
}
