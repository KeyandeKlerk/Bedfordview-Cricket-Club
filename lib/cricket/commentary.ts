import type { BallEvent, InningsState } from './types'

/**
 * Generates a commentary string for a ball at submission time.
 * Uses the innings state BEFORE the ball is applied.
 *
 * @param ball         The ball being submitted (with all fields populated)
 * @param stateBefore  InningsState computed BEFORE this ball
 * @param playerName   Resolver: match_players.id → display name
 */
export function generateCommentary(
  ball: BallEvent,
  stateBefore: InningsState,
  playerName: (id: string) => string,
): string {
  const batter  = playerName(ball.batter_id)
  const bowler  = playerName(ball.bowler_id)
  const fielder = ball.fielder_id ? playerName(ball.fielder_id) : (ball.fielder_substitute_name ?? null)

  let text = buildBase(ball, batter, bowler, fielder)

  // Milestone detection: batter's runs before this ball + runs_off_bat
  const batterBefore = stateBefore.batterStats[ball.batter_id]?.runs ?? 0
  const batterAfter  = batterBefore + ball.runs_off_bat
  if (!ball.dismissal_type) {
    if (batterBefore < 100 && batterAfter >= 100) {
      text += ` ${batter} brings up a century!`
    } else if (batterBefore < 50 && batterAfter >= 50) {
      text += ` ${batter} reaches 50!`
    }
  }

  return text
}

function buildBase(
  ball: BallEvent,
  batter: string,
  bowler: string,
  fielder: string | null,
): string {
  // Dismissals
  if (ball.dismissal_type) {
    const dismissed = ball.dismissed_player_id
      ? batter  // batter_id IS the striker; dismissed_player_id may differ for run-outs
      : batter
    switch (ball.dismissal_type) {
      case 'bowled':
        return `OUT! ${dismissed} is bowled by ${bowler}!`
      case 'caught':
        return fielder
          ? `OUT! ${dismissed} caught by ${fielder} off ${bowler}!`
          : `OUT! ${dismissed} caught off ${bowler}!`
      case 'lbw':
        return `OUT! ${dismissed} lbw to ${bowler}!`
      case 'run_out':
        return fielder
          ? `RUN OUT! ${dismissed} is run out by ${fielder}!`
          : `RUN OUT! ${dismissed} is run out!`
      case 'stumped':
        return fielder
          ? `OUT! ${dismissed} stumped by ${fielder} off ${bowler}!`
          : `OUT! ${dismissed} stumped off ${bowler}!`
      case 'hit_wicket':
        return `OUT! ${dismissed} hit wicket off ${bowler}!`
      case 'retired_hurt':
        return `${dismissed} retires hurt.`
      case 'retired_out':
        return `${dismissed} retires out.`
      default:
        return `OUT! ${dismissed} dismissed — ${ball.dismissal_type.replace(/_/g, ' ')}.`
    }
  }

  // Extras (no runs off bat unless no-ball with bat runs)
  if (ball.extras_type === 'wide') {
    return `Wide ball. ${bowler} strays down the leg side.`
  }
  if (ball.extras_type === 'no_ball') {
    const extra = ball.runs_off_bat > 0
      ? ` ${batter} hits it for ${ball.runs_off_bat}.`
      : ''
    return `No ball! Free hit to follow.${extra}`
  }
  if (ball.extras_type === 'bye') {
    const n = ball.extras_runs
    return `Bye — ${n} run${n !== 1 ? 's' : ''} to the total.`
  }
  if (ball.extras_type === 'leg_bye') {
    const n = ball.extras_runs
    return `Leg bye — ${n} run${n !== 1 ? 's' : ''} off the pad.`
  }
  if (ball.extras_type === 'penalty') {
    return `Penalty — ${ball.extras_runs} run${ball.extras_runs !== 1 ? 's' : ''} awarded.`
  }

  // Runs off bat
  const runs = ball.runs_off_bat
  if (ball.is_boundary_six) {
    return `SIX! ${batter} sends it over the rope!`
  }
  if (ball.is_boundary_four) {
    return `FOUR! ${batter} drives it through the covers.`
  }
  if (runs === 0) {
    return `Dot ball. ${bowler} to ${batter}.`
  }
  if (runs === 1) {
    return `${batter} works it away for a single.`
  }
  if (runs === 2) {
    return `${batter} finds the gap — 2 runs.`
  }
  if (runs === 3) {
    return `${batter} finds the gap — 3 runs.`
  }
  return `${batter} hits it for ${runs} runs.`
}
