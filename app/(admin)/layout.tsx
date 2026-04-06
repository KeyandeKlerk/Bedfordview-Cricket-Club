import { redirect } from 'next/navigation'
import { getCurrentPlayerServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function LegacyAdminLayout({ children }: { children: React.ReactNode }) {
  const player = await getCurrentPlayerServer()
  if (!player) redirect('/login')
  if (player.role !== 'admin' && player.role !== 'scorer') redirect('/dashboard')
  return <>{children}</>
}
