// app/analytics/layout.tsx
import { redirect } from 'next/navigation'
import { getClubConfig, isPro } from '@/lib/club-config'

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const config = await getClubConfig()
  if (!isPro(config)) redirect('/dashboard')
  return <>{children}</>
}
