import { redirect } from 'next/navigation'
import { getCurrentPlayerServer } from '@/lib/supabase-server'
import ConditionalNotificationBell from '@/components/ConditionalNotificationBell'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'scorer', 'coach', 'shop']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const player = await getCurrentPlayerServer()
  if (!player) redirect('/login')
  if (!ALLOWED_ROLES.includes(player.role)) redirect('/dashboard')
  return (
    <>
      {/* Notification bell — floats top-right on admin pages, hidden on scorer */}
      <div style={{
        position: 'fixed',
        top: 14,
        right: 14,
        zIndex: 200,
      }}>
        <ConditionalNotificationBell userId={player.id} />
      </div>
      {children}
    </>
  )
}
