import type { BallEvent, InningsState, MatchConfig } from './types'

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

/**
 * Validates a ball before it is submitted.
 * Used on both client (scorer) and Edge Function (server).
 *
 * @param ball        - partial ball event being submitted
 * @param state       - current innings state (from computeInningsState)
 * @param matchConfig - overs_per_innings + free_hit_on_no_ball from matches table
 */
export function validateBall(
  ball: Partial<BallEvent>,
  state: InningsState,
  matchConfig: MatchConfig
): ValidationResult {
  // Innings already over by overs
  const maxBalls = matchConfig.overs_per_innings * 6
  if (state.legalBalls >= maxBalls) {
    return { valid: false, error: 'Innings is complete — all overs bowled.' }
  }

  // All out
  if (state.wickets >= 10) {
    return { valid: false, error: 'Innings is complete — all out.' }
  }

  // Wide: bat runs must be 0
  if (ball.extras_type === 'wide' && (ball.runs_off_bat ?? 0) > 0) {
    return { valid: false, error: 'Bat runs cannot be scored off a wide.' }
  }

  // Wide: only run-out and stumped are valid dismissals
  if (
    ball.extras_type === 'wide' &&
    ball.dismissal_type &&
    ball.dismissal_type !== 'run_out' &&
    ball.dismissal_type !== 'stumped'
  ) {
    return {
      valid: false,
      error: `${ball.dismissal_type} is not valid on a wide — only run-out or stumped are possible.`,
    }
  }

  // No-ball: only run-out is valid (cannot be stumped off a no-ball)
  if (
    ball.extras_type === 'no_ball' &&
    ball.dismissal_type &&
    ball.dismissal_type !== 'run_out'
  ) {
    return {
      valid: false,
      error: `${ball.dismissal_type} is not valid on a no-ball — only run-out is possible.`,
    }
  }

  // Free hit: only run-out dismissal is valid
  if (state.nextBallIsFreeHit && matchConfig.free_hit_on_no_ball) {
    if (ball.dismissal_type && ball.dismissal_type !== 'run_out') {
      return {
        valid: false,
        error: `${ball.dismissal_type} is not valid on a free hit — only run-out is allowed.`,
      }
    }
  }

  // Bye / leg-bye: the ball passed the bat without contact, so dismissals that require
  // bat contact (caught) or ball hitting wicket via bat path (bowled, hit_wicket) or
  // ball hitting pad in line (lbw) are physically impossible.
  if (ball.extras_type === 'bye' || ball.extras_type === 'leg_bye') {
    const impossible = ['caught', 'bowled', 'lbw', 'hit_wicket']
    if (impossible.includes(ball.dismissal_type ?? '')) {
      return {
        valid: false,
        error: `${ball.dismissal_type} cannot occur on a ${ball.extras_type} — only run-out or stumped are possible.`,
      }
    }
  }

  // Fielder required for caught, stumped, run_out
  const FIELDER_REQUIRED = ['caught', 'stumped', 'run_out']
  if (FIELDER_REQUIRED.includes(ball.dismissal_type ?? '') && !ball.fielder_id && !ball.fielder_substitute_name) {
    return { valid: false, error: 'Fielder required for this dismissal type.' }
  }

  // Fielder XOR substitute (caught, stumped, run-out only need one source)
  if (ball.fielder_id && ball.fielder_substitute_name) {
    return {
      valid: false,
      error: 'Cannot specify both a registered fielder and a substitute fielder name.',
    }
  }

  // dismissed_player_id requires dismissal_type and vice versa
  if (!!ball.dismissed_player_id !== !!ball.dismissal_type) {
    return {
      valid: false,
      error: 'dismissed_player_id and dismissal_type must both be set or both be null.',
    }
  }

  // Boundary flags are mutually exclusive
  if (ball.is_boundary_four && ball.is_boundary_six) {
    return { valid: false, error: 'A delivery cannot be both a four and a six.' }
  }

  // Boundary runs must match
  if (ball.is_boundary_four && (ball.runs_off_bat ?? 0) !== 4) {
    return { valid: false, error: 'Boundary four requires runs_off_bat = 4.' }
  }
  if (ball.is_boundary_six && (ball.runs_off_bat ?? 0) !== 6) {
    return { valid: false, error: 'Boundary six requires runs_off_bat = 6.' }
  }

  return { valid: true }
}
