// ── ENUMS (mirror DB enums) ────────────────────────────────────────────────────

export type ScoringMode = 'club' | 'professional'

export type PitchLength = 'full_toss' | 'yorker' | 'full' | 'good_length' | 'short' | 'bouncer'
export type PitchLine   = 'wide_outside_off' | 'outside_off' | 'off_stump' | 'middle' | 'leg_stump' | 'outside_leg'
export type ShotType    = 'drive' | 'cut' | 'pull' | 'sweep' | 'glance' | 'block' | 'leave' | 'slog' | 'ramp'
export type BowlingType =
  | 'right_arm_fast' | 'right_arm_medium'
  | 'left_arm_fast'  | 'left_arm_medium'
  | 'right_arm_off_spin' | 'right_arm_leg_spin'
  | 'left_arm_orthodox'  | 'left_arm_chinaman'
export type ExecutionQuality = 'excellent' | 'good' | 'poor'
export type DecisionQuality  = 'good' | 'poor'

export type BallAnnotation = {
  wagon_x?: number | null
  wagon_y?: number | null
  pitch_length?: PitchLength | null
  pitch_line?: PitchLine | null
  shot_type?: ShotType | null
  bowling_type?: BowlingType | null
  execution_quality?: ExecutionQuality | null
  decision_quality?: DecisionQuality | null
}

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

export type Role = 'admin' | 'coach' | 'scorer' | 'shop' | 'player' | 'member'

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
  fielder2_id?: string | null         // match_players.id — second fielder for run-outs
  fielder2_substitute_name?: string | null
  penalty_reason: string | null
  penalty_to_fielding: boolean
  commentary: string | null
  created_at: string
  // Tier 2 — professional scoring mode only; null for club matches
  wagon_x?: number | null
  wagon_y?: number | null
  pitch_length?: PitchLength | null
  pitch_line?: PitchLine | null
  shot_type?: ShotType | null
  bowling_type?: BowlingType | null
  execution_quality?: ExecutionQuality | null
  decision_quality?: DecisionQuality | null
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
  dismissalBowlerId: string | null
  dismissalFielderId: string | null
  dismissalFielderSubName: string | null
  dismissalFielder2Id: string | null
  dismissalFielder2SubName: string | null
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
  currentOverLegalBalls?: number      // legal deliveries in the current over (0 if new over, 6 when over just ended)
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
