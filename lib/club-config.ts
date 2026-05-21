import { cache } from 'react'
import { anonSupabase } from './supabase/server'

export type ClubConfig = {
  club_name: string
  club_short_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  highlight_color: string
  bg_color: string
}

export const DEFAULT_CONFIG: ClubConfig = {
  club_name: 'Bedfordview Cricket Club',
  club_short_name: 'BCC',
  logo_url: '/img/bcc-logo.png',
  favicon_url: null,
  primary_color: '#2563eb',
  highlight_color: '#38bdf8',
  bg_color: '#050c1a',
}

export const getClubConfig = cache(async (): Promise<ClubConfig> => {
  try {
    const { data } = await anonSupabase
      .from('club_config')
      .select('club_name, club_short_name, logo_url, favicon_url, primary_color, highlight_color, bg_color')
      .limit(1)
      .maybeSingle()
    return data ?? DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
})

/** Convert #rrggbb hex to "r,g,b" for use in rgba() */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '37,99,235'
  return `${r},${g},${b}`
}
