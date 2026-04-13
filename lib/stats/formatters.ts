// Shared formatting utilities used across stats pages and StatsContent

export function overs(legalBalls: number | null): string {
  if (legalBalls == null) return '—'
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

export function fmt(val: any, dp = 2): string {
  if (val == null || val === '') return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(dp)
}

export function bestFigures(wkts: any, runs: any): string {
  if (wkts == null || Number(wkts) === 0) return '—'
  if (runs == null) return `${wkts}/—`
  return `${wkts}/${runs}`
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function labelDismissal(type: string | null): string {
  if (!type) return 'Not Out'
  const map: Record<string, string> = {
    bowled: 'Bowled', caught: 'Caught', lbw: 'LBW',
    run_out: 'Run Out', stumped: 'Stumped', hit_wicket: 'Hit Wicket',
    caught_bowled: 'C&B', retired_hurt: 'Retired', retired_out: 'Retired Out',
    timed_out: 'Timed Out', handled_ball: 'Handled Ball',
    obstructing_field: 'Obstruction',
  }
  return map[type] ?? type
}

export function getPhaseLabel(overNumber: number, totalOvers: number): 'early' | 'middle' | 'death' {
  const pct = overNumber / Math.max(totalOvers, 1)
  if (pct < 0.3) return 'early'
  if (pct < 0.8) return 'middle'
  return 'death'
}

export function bowlingAvgFmt(runs: number | null, wickets: number | null): string {
  if (!wickets || wickets === 0 || runs == null) return '—'
  return (runs / wickets).toFixed(2)
}

// ── Stats table column definitions ───────────────────────────────────────────

export const BATTING_COLS = [
  { key: 'matches',       label: 'M',    title: 'Matches' },
  { key: 'innings',       label: 'Inn',  title: 'Innings batted' },
  { key: 'not_outs',      label: 'NO',   title: 'Not outs' },
  { key: 'total_runs',    label: 'Runs', title: 'Total runs', primary: true },
  { key: 'highest_score', label: 'HS',   title: 'Highest score' },
  { key: 'average',       label: 'Avg',  title: 'Batting average (runs per dismissal)' },
  { key: 'strike_rate',   label: 'SR',   title: 'Strike rate (runs per 100 balls)' },
  { key: 'fifties',       label: '50s',  title: 'Half centuries' },
  { key: 'hundreds',      label: '100s', title: 'Centuries' },
  { key: 'ducks',         label: '0s',   title: 'Dismissed for a duck' },
  { key: 'fours',         label: '4s',   title: 'Fours hit' },
  { key: 'sixes',         label: '6s',   title: 'Sixes hit' },
  { key: 'balls_faced',   label: 'BF',   title: 'Balls faced' },
]

export const BOWLING_COLS = [
  { key: 'matches',              label: 'M',    title: 'Matches' },
  { key: 'legal_balls',          label: 'O',    title: 'Overs bowled' },
  { key: 'maidens',              label: 'Mdns', title: 'Maiden overs' },
  { key: 'wickets',              label: 'Wkts', title: 'Wickets', primary: true },
  { key: 'runs_conceded',        label: 'Runs', title: 'Runs conceded' },
  { key: 'best_bowling',         label: 'Best', title: 'Best bowling figures in an innings' },
  { key: 'bowling_avg',          label: 'Avg',  title: 'Bowling average (runs per wicket)' },
  { key: 'economy',              label: 'Econ', title: 'Economy rate (runs per over)' },
  { key: 'wides',                label: 'Wd',   title: 'Wides bowled' },
  { key: 'no_balls',             label: 'NB',   title: 'No balls bowled' },
]

export const FIELDING_COLS = [
  { key: 'matches',          label: 'M',     title: 'Matches' },
  { key: 'total_dismissals', label: 'Total', title: 'Total dismissals (catches + stumpings + run outs)', primary: true },
  { key: 'catches',          label: 'Ct',    title: 'Catches taken' },
  { key: 'caught_bowled',    label: 'C&B',   title: 'Caught and bowled (bowler takes own catch)' },
  { key: 'stumpings',        label: 'St',    title: 'Stumpings (keeper)' },
  { key: 'run_outs',         label: 'RO',    title: 'Run outs' },
]
