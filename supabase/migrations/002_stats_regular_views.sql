-- Migration 002: Convert materialized stats views to regular views
-- Materialized views require manual refresh after each match; for a cricket club
-- dataset (thousands of rows max) regular views are fast enough and always fresh.

DROP MATERIALIZED VIEW IF EXISTS career_batting_stats;
DROP MATERIALIZED VIEW IF EXISTS career_bowling_stats;
DROP MATERIALIZED VIEW IF EXISTS season_batting_stats;
DROP MATERIALIZED VIEW IF EXISTS season_bowling_stats;

-- ── season_batting_stats ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW season_batting_stats AS
WITH innings_totals AS (
  SELECT
    be.innings_id,
    mp.player_id,
    m.season_id,
    SUM(be.runs_off_bat)  AS innings_runs,
    COUNT(*) FILTER (WHERE be.dismissed_player_id = mp.id) > 0 AS was_dismissed
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.batter_id
  JOIN matches m ON m.id = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY be.innings_id, mp.player_id, m.season_id
)
SELECT
  it.player_id,
  p.first_name || ' ' || p.last_name                               AS player_name,
  it.season_id,
  COUNT(DISTINCT it.innings_id)                                    AS innings,
  SUM(it.innings_runs)                                             AS total_runs,
  MAX(it.innings_runs)                                             AS highest_score,
  COUNT(*) FILTER (WHERE it.innings_runs >= 50)                    AS fifties,
  COUNT(*) FILTER (WHERE it.innings_runs >= 100)                   AS hundreds,
  SUM(be_agg.fours)                                                AS fours,
  SUM(be_agg.sixes)                                                AS sixes,
  SUM(be_agg.balls_faced)                                          AS balls_faced,
  COUNT(*) FILTER (WHERE it.was_dismissed)                         AS dismissals,
  CASE WHEN COUNT(*) FILTER (WHERE it.was_dismissed) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric /
            NULLIF(COUNT(*) FILTER (WHERE it.was_dismissed), 0), 2)
       ELSE NULL
  END                                                              AS average,
  CASE WHEN SUM(be_agg.balls_faced) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric / SUM(be_agg.balls_faced) * 100, 2)
       ELSE 0
  END                                                              AS strike_rate
FROM innings_totals it
JOIN players p ON p.id = it.player_id
JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE be2.is_boundary_four) AS fours,
    COUNT(*) FILTER (WHERE be2.is_boundary_six)  AS sixes,
    COUNT(*) FILTER (WHERE be2.extras_type IS DISTINCT FROM 'wide') AS balls_faced
  FROM ball_events be2
  JOIN match_players mp2 ON mp2.id = be2.batter_id
  WHERE be2.innings_id = it.innings_id AND mp2.player_id = it.player_id
) be_agg ON true
GROUP BY it.player_id, p.first_name, p.last_name, it.season_id;

-- ── season_bowling_stats ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW season_bowling_stats AS
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name AS player_name,
  m.season_id,
  COUNT(DISTINCT m.id)                AS matches,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) AS legal_balls,
  SUM(be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                   AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                   AS wickets,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')    AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball') AS no_balls,
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
JOIN match_players mp ON mp.id = be.bowler_id
JOIN players p ON p.id = mp.player_id
JOIN matches m ON m.id = be.match_id
WHERE mp.player_id IS NOT NULL
GROUP BY mp.player_id, p.first_name, p.last_name, m.season_id;

-- ── career_batting_stats ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW career_batting_stats AS
SELECT
  player_id,
  player_name,
  SUM(innings)       AS innings,
  SUM(total_runs)    AS total_runs,
  MAX(highest_score) AS highest_score,
  SUM(fifties)       AS fifties,
  SUM(hundreds)      AS hundreds,
  SUM(fours)         AS fours,
  SUM(sixes)         AS sixes,
  SUM(balls_faced)   AS balls_faced,
  SUM(dismissals)    AS dismissals,
  CASE WHEN SUM(dismissals) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(dismissals), 2)
       ELSE NULL
  END AS average,
  CASE WHEN SUM(balls_faced) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(balls_faced) * 100, 2)
       ELSE 0
  END AS strike_rate
FROM season_batting_stats
GROUP BY player_id, player_name;

-- ── career_bowling_stats ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW career_bowling_stats AS
SELECT
  player_id,
  player_name,
  SUM(matches)         AS matches,
  SUM(legal_balls)     AS legal_balls,
  SUM(runs_conceded)   AS runs_conceded,
  SUM(wickets)         AS wickets,
  SUM(wides)           AS wides,
  SUM(no_balls)        AS no_balls,
  CASE WHEN SUM(legal_balls) > 0
       THEN ROUND(SUM(runs_conceded)::numeric / (SUM(legal_balls)::numeric / 6), 2)
       ELSE NULL
  END AS economy
FROM season_bowling_stats
GROUP BY player_id, player_name;
