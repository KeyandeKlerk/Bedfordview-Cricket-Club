'use client'
import { usePathname } from 'next/navigation'
import NotificationBell from './NotificationBell'

interface Props {
  userId: string
}

// Hidden on the scorer page — the bell's fixed position overlaps the scorer header.
const SCORER_ROUTE = /\/admin\/matches\/[^/]+\/score/

export default function ConditionalNotificationBell({ userId }: Props) {
  const pathname = usePathname()
  if (SCORER_ROUTE.test(pathname)) return null
  return <NotificationBell userId={userId} />
}
