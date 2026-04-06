// ── ENUMS (mirror DB enums) ────────────────────────────────────────────────────

export type ExtrasType = 'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty'

export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'handled_ball'
  | 'obstructing_field'
  | 'timed_out'
  | 'retired_hurt'
  | 'retired_out'

export type Role = 'scorer' | 'admin' | 'shop' | 'player' | 'coach'

export type MatchStatus = 'upcoming' | 'in_progress' | 'completed' | 'abandoned' | 'cancelled'
export type InningsStatus = 'pending' | 'in_progress' | 'completed' | 'declared'
export type TeamSide = 'home' | 'away'
export type TossDecision = 'bat' | 'field'

// ── CORE DB TYPES ─────────────────────────────────────────────────────────────

/**
 * A single delivery in the append-only event log.
 *
 * CRITICAL: batter_id, non_striker_id, bowler_id, dismissed_player_id, fielder_id
 * are ALL match_players.id values — NEVER players.id.
 */
export type BallEvent = {
  id: string
  innings_id: string
  match_id: string
  sequence_number: number
  over_number: number     // 0-indexed
  ball_in_over: number    // sequential position within over (includes wides/no-balls)
  batter_id: string       // match_players.id — THE ID BOUNDARY
  non_striker_id: string  // match_players.id
  bowler_id: string       // match_players.id
  runs_off_bat: number
  extras_type: ExtrasType | null
  extras_runs: number
  is_boundary_four: boolean
  is_boundary_six: boolean
  dismissal_type: DismissalType | null
  dismissed_player_id: string | null  // match_players.id
  fielder_id: string | null           // match_players.id
  fielder_substitute_name: string | null
  commentary: string | null
  created_at: string
}

/** A player entry for a specific match — used for both home team and opposition */
export type MatchPlayer = {
  id: string              // THE ID BOUNDARY — use this everywhere in ball_events
  match_id: string
  player_id: string | null        // null for opposition players
  opposition_name: string | null  // null for registered players
  side: TeamSide
  batting_position: number | null
  actual_batting_position: number | null
  is_captain: boolean
  is_keeper: boolean
}

// ── ENGINE STATE TYPES ────────────────────────────────────────────────────────

export type BatterStats = {
  matchPlayerId: string   // match_players.id
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  isStriker: boolean
  isOut: boolean
  dismissalType: DismissalType | null
  dismissalText: string | null
  battingPosition: number | null
}

export type BowlerStats = {
  matchPlayerId: string   // match_players.id
  name: string
  overs: string           // formatted "4.2"
  legalBalls: number
  runs: number
  wickets: number
  economy: number
  wides: number
  noBalls: number
  maidens: number
}

export type Partnership = {
  batter1Id: string   // match_players.id
  batter2Id: string   // match_players.id
  runs: number
  balls: number
}

export type FallOfWicket = {
  wicketNumber: number
  runs: number
  matchPlayerId: string  // match_players.id of dismissed batter
  over: string           // "4.2" format
}

export type InningsState = {
  inningsId: string | null
  inningsNumber: number
  battingSide: TeamSide
  totalRuns: number
  wickets: number
  legalBalls: number
  oversDisplay: string    // e.g. "4.2"
  extras: {
    wide: number
    no_ball: number
    bye: number
    leg_bye: number
    penalty: number
    total: number
  }
  batterStats: Record<string, BatterStats>   // keyed by match_players.id
  bowlerStats: Record<string, BowlerStats>   // keyed by match_players.id
  currentStrikerId: string | null    // match_players.id of who should face next
  currentNonStrikerId: string | null // match_players.id
  currentBowlerId: string | null     // match_players.id
  currentOverBalls: BallEvent[]       // balls of the CURRENT (or last completed) over
  completedOvers: BallEvent[][]
  fallOfWickets: FallOfWicket[]
  currentPartnership: Partnership | null
  nextBallIsFreeHit: boolean
}

// ── MATCH CONFIG (for validators) ─────────────────────────────────────────────

export type MatchConfig = {
  overs_per_innings: number
  free_hit_on_no_ball: boolean
}

// ── MATCH RESULT ──────────────────────────────────────────────────────────────

export type MatchResult = {
  status: 'in_progress' | 'complete'
  winner: 'team1' | 'team2' | 'tie' | null
  marginRuns: number | null
  marginWickets: number | null
}
