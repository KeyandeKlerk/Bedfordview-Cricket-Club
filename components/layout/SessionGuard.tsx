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

    // Also validate on mount — handles the case where the page loaded with a
    // stale server cookie but the browser client has no valid session at all.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return null
}
