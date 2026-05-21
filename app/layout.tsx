import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/layout/Nav'
import { getClubConfig, hexToRgb } from '@/lib/club-config'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const config = await getClubConfig()
  return {
    title: config.club_name,
    description: `Official home of ${config.club_name} — fixtures, results, stats and live scoring.`,
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050c1a',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getClubConfig()
  const primaryRgb = hexToRgb(config.primary_color)
  const highlightRgb = hexToRgb(config.highlight_color)
  const bgRgb = hexToRgb(config.bg_color)

  // Inject all colour CSS variables derived from config
  const cssVars: Record<string, string> = {
    '--blue':       config.primary_color,
    '--blue-mid':   config.primary_color,
    '--blue-dim':   `rgba(${primaryRgb},0.15)`,
    '--blue-glow':  `rgba(${primaryRgb},0.35)`,
    '--sky':        config.highlight_color,
    '--sky-dim':    `rgba(${highlightRgb},0.15)`,
    '--black':      config.bg_color,
    '--deep':       config.bg_color,
    '--bg':         config.bg_color,
  }

  // The mesh grid uses rgba() in a CSS background-image — CSS vars don't work
  // there, so we inject it dynamically with the real colour value.
  const gridStyle = `
    body::before {
      background-image:
        linear-gradient(rgba(${primaryRgb},0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(${primaryRgb},0.035) 1px, transparent 1px);
    }`

  return (
    <html lang="en" style={cssVars as React.CSSProperties}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: gridStyle }} />
        {config.favicon_url && <link rel="icon" href={config.favicon_url} />}
      </head>
      <body>
        <Nav config={config} />
        {children}
      </body>
    </html>
  )
}
