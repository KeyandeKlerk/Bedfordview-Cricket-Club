/**
 * Phase detection for the scorer shell.
 *
 * Extracted here so it can be unit-tested independently of React.
 */

import type { MatchPlayer } from './types'

export type Phase =
  | 'setup_bcc_xi'
  | 'setup_opp_xi'
  | 'captain_keeper'
  | 'toss'
  | 'select_openers'
  | 'scoring'
  | 'innings_break'
  | 'match_complete'

/** Minimal innings shape needed by detectPhase */
export interface InningsInfo {
  innings_number: number
  status: string
}

/**
 * Pure function — determines which UI phase the scorer should be in.
 *
 * @param matchPlayers  - all match_players rows for this match
 * @param innings       - the active innings row (null if none created yet)
 * @param ballCount     - number of ball_events in the active innings
 * @param ourSide       - which side is BCC ('home' | 'away')
 */
export function detectPhase(
  matchPlayers: MatchPlayer[],
  innings: InningsInfo | null,
  ballCount: number,
  ourSide: 'home' | 'away'
): Phase {
  const oppSide = ourSide === 'home' ? 'away' : 'home'
  const bcc = matchPlayers.filter(p => p.side === ourSide)
  const opp = matchPlayers.filter(p => p.side === oppSide)

  if (bcc.length < 11) return 'setup_bcc_xi'
  if (opp.length < 11) return 'setup_opp_xi'
  if (
    !bcc.some(p => p.is_captain) || !bcc.some(p => p.is_keeper) ||
    !opp.some(p => p.is_captain) || !opp.some(p => p.is_keeper)
  ) return 'captain_keeper'
  if (!innings) return 'toss'
  if (innings.status === 'completed' || innings.status === 'declared') {
    return innings.innings_number >= 2 ? 'match_complete' : 'innings_break'
  }
  if (ballCount === 0) return 'select_openers'
  return 'scoring'
}
