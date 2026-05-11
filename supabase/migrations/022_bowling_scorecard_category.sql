-- 022_bowling_scorecard_category.sql
-- Add team_category to bowling_scorecard so best-figures can be filtered
-- by senior / junior.

DROP VIEW IF EXISTS bowling_scorecard;

CREATE VIEW bowling_scorecard AS
WITH over_runs AS (
  SELECT
    innings_id,
    bowler_id,
    over_number,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    ) AS over_total,
    COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) AS legal_in_over
  FROM ball_events be
  GROUP BY innings_id, bowler_id, over_number
)
SELECT
  be.innings_id,
  be.match_id,
  mp.id   AS match_player_id,
  mp.player_id,
  mp.opposition_name,
  mp.side,
  COALESCE(p.first_name || ' ' || p.last_name, mp.opposition_name) AS player_name,
  c.category                                                         AS team_category,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) AS legal_balls,
  SUM(be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                                                  AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                                                  AS wickets,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')                   AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball')                AS no_balls,
  (
    SELECT COUNT(*) FROM over_runs r
    WHERE r.innings_id = be.innings_id
      AND r.bowler_id  = mp.id
      AND r.over_total = 0
      AND r.legal_in_over >= 6
  )                                                                  AS maidens,
  CASE
    WHEN COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) > 0
    THEN ROUND(
      SUM(be.runs_off_bat +
          CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END)::numeric /
      (COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL)::numeric / 6),
      2
    )
    ELSE NULL
  END AS economy
FROM ball_events be
JOIN match_players mp  ON mp.id  = be.bowler_id
JOIN matches m         ON m.id   = be.match_id
JOIN competitions c    ON c.id   = m.competition_id
LEFT JOIN players p    ON p.id   = mp.player_id
GROUP BY be.innings_id, be.match_id,
         mp.id, mp.player_id, mp.opposition_name, mp.side,
         p.first_name, p.last_name, c.category;
