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
  default_scoring_mode: 'club' | 'professional'
  plan: 'club' | 'pro'
  contact_email: string | null
  is_demo: boolean
}

export const DEFAULT_CONFIG: ClubConfig = {
  club_name: 'Cricket Club',
  club_short_name: 'CC',
  logo_url: null,
  favicon_url: null,
  primary_color: '#2563eb',
  highlight_color: '#38bdf8',
  bg_color: '#050c1a',
  default_scoring_mode: 'club',
  plan: 'club',
  contact_email: null,
  is_demo: false,
}

export const getClubConfig = cache(async (): Promise<ClubConfig> => {
  try {
    const { data } = await anonSupabase
      .from('club_config')
      .select('club_name, club_short_name, logo_url, favicon_url, primary_color, highlight_color, bg_color, default_scoring_mode, plan, contact_email, is_demo')
      .limit(1)
      .maybeSingle()
    return data ? { ...DEFAULT_CONFIG, ...data } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
})

export function isPro(config: ClubConfig): boolean {
  return config.plan === 'pro'
}

/** Convert #rrggbb hex to "r,g,b" for use in rgba() */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '37,99,235'
  return `${r},${g},${b}`
}
