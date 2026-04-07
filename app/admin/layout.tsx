import { redirect } from 'next/navigation'
import { getCurrentPlayerServer } from '@/lib/supabase-server'
import NotificationBell from '@/components/NotificationBell'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'scorer', 'coach', 'shop']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const player = await getCurrentPlayerServer()
  if (!player) redirect('/login')
  if (!ALLOWED_ROLES.includes(player.role)) redirect('/dashboard')
  return (
    <>
      {/* Notification bell — floats top-right, only visible on admin pages */}
      <div style={{
        position: 'fixed',
        top: 14,
        right: 14,
        zIndex: 200,
      }}>
        <NotificationBell userId={player.id} />
      </div>
      {children}
    </>
  )
}
