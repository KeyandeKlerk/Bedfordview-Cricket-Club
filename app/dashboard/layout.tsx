import { redirect } from 'next/navigation'
import { getCurrentPlayerServer } from '@/lib/supabase-server'
import { PlayerProvider } from './PlayerProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const player = await getCurrentPlayerServer()
  if (!player) redirect('/login')
  return <PlayerProvider player={player}>{children}</PlayerProvider>
}
