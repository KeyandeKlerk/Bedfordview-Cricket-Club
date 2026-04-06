'use client'
import { createContext, useContext } from 'react'
import type { Player } from '@/lib/supabase'

const PlayerContext = createContext<Player | null>(null)

export function PlayerProvider({
  player,
  children,
}: {
  player: Player
  children: React.ReactNode
}) {
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
}

export function usePlayer(): Player {
  const p = useContext(PlayerContext)
  if (!p) throw new Error('usePlayer must be used inside the dashboard layout')
  return p
}
