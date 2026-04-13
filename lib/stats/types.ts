// Shared types for stats pages and chart components

export interface BattingInning {
  runs: number | null
  balls_faced: number | null
  fours: number | null
  sixes: number | null
  strike_rate: number | null
  dismissal_type: string | null
  actual_batting_position: number | null
  opposition_name: string | null
  match_id: string | null
  match_date?: string | null
}

export interface SeasonBatting {
  player_id: string
  player_name: string
  matches: number
  innings: number
  not_outs: number
  total_runs: number
  highest_score: number | null
  fifties: number
  hundreds: number
  ducks: number
  fours: number
  sixes: number
  balls_faced: number
  dismissals: number
  average: number | null
  strike_rate: number | null
  season_id: string
  seasons: { name: string } | null
}
