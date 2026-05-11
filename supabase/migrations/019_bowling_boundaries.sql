-- 019_bowling_boundaries.sql
--
-- Adds a `boundaries` column (fours + sixes conceded) to all three bowling stats
-- views: season_bowling_stats, career_bowling_stats, competition_bowling_stats.
-- Enables per-over rates (Wd/Ov, NB/Ov, Bdry/Ov) to be computed in the frontend.

DROP VIEW IF EXISTS career_bowling_stats      CASCADE;
DROP VIEW IF EXISTS season_bowling_stats      CASCADE;
DROP VIEW IF EXISTS competition_bowling_stats CASCADE;


-- ── season_bowling_stats ──────────────────────────────────────────────────────

CREATE VIEW season_bowling_stats AS
WITH over_summary AS (
  SELECT
    mp.player_id,
    m.season_id,
    c.category                                                             AS team_category,
    be.innings_id,
    be.over_number,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                      AS over_runs,
    COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                        OR be.extras_type IS NULL)                         AS legal_in_over
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m        ON m.id  = be.match_id
  JOIN competitions c   ON c.id  = m.competition_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.season_id, c.category, be.innings_id, be.over_number
),
maiden_counts AS (
  SELECT player_id, season_id, team_category,
    COUNT(*) FILTER (WHERE over_runs = 0 AND legal_in_over >= 6)          AS maidens
  FROM over_summary
  GROUP BY player_id, season_id, team_category
),
innings_figures AS (
  SELECT
    mp.player_id,
    m.season_id,
    c.category                                                             AS team_category,
    be.innings_id,
    COUNT(*) FILTER (
      WHERE be.dismissal_type IS NOT NULL
        AND be.dismissal_type NOT IN (
          'run_out','retired_hurt','retired_out',
          'timed_out','handled_ball','obstructing_field'
        )
    )                                                                      AS inn_wickets,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                      AS inn_runs
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m        ON m.id  = be.match_id
  JOIN competitions c   ON c.id  = m.competition_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.season_id, c.category, be.innings_id
),
best_figures AS (
  SELECT DISTINCT ON (player_id, season_id, team_category)
    player_id, season_id, team_category,
    inn_wickets AS best_bowling_wickets,
    inn_runs    AS best_bowling_runs
  FROM innings_figures
  ORDER BY player_id, season_id, team_category, inn_wickets DESC, inn_runs ASC
)
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name                                      AS player_name,
  m.season_id,
  c.category                                                               AS team_category,
  COUNT(DISTINCT m.id)                                                     AS matches,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                      OR be.extras_type IS NULL)                           AS legal_balls,
  SUM(
    be.runs_off_bat +
    CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                                                        AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                                                        AS wickets,
  COALESCE(mc.maidens, 0)                                                  AS maidens,
  COALESCE(bf.best_bowling_wickets, 0)                                     AS best_bowling_wickets,
  bf.best_bowling_runs                                                     AS best_bowling_runs,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')                          AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball')                       AS no_balls,
  COUNT(*) FILTER (WHERE be.is_boundary_four OR be.is_boundary_six)        AS boundaries,
  CASE
    WHEN COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                              OR be.extras_type IS NULL) > 0
    THEN ROUND(
      SUM(
        be.runs_off_bat +
        CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
      )::numeric /
      (COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                            OR be.extras_type IS NULL)::numeric / 6),
      2
    )
    ELSE NULL
  END                                                                      AS economy
FROM ball_events be
JOIN match_players mp ON mp.id = be.bowler_id
JOIN players p        ON p.id  = mp.player_id
JOIN matches m        ON m.id  = be.match_id
JOIN competitions c   ON c.id  = m.competition_id
LEFT JOIN maiden_counts mc ON mc.player_id    = mp.player_id
                          AND mc.season_id    = m.season_id
                          AND mc.team_category = c.category
LEFT JOIN best_figures  bf ON bf.player_id    = mp.player_id
                          AND bf.season_id    = m.season_id
                          AND bf.team_category = c.category
WHERE mp.player_id IS NOT NULL
GROUP BY
  mp.player_id, p.first_name, p.last_name, m.season_id, c.category,
  mc.maidens, bf.best_bowling_wickets, bf.best_bowling_runs;


-- ── career_bowling_stats ──────────────────────────────────────────────────────

CREATE VIEW career_bowling_stats AS
WITH totals AS (
  SELECT
    player_id, player_name, team_category,
    SUM(matches)       AS matches,
    SUM(legal_balls)   AS legal_balls,
    SUM(runs_conceded) AS runs_conceded,
    SUM(wickets)       AS wickets,
    SUM(maidens)       AS maidens,
    SUM(wides)         AS wides,
    SUM(no_balls)      AS no_balls,
    SUM(boundaries)    AS boundaries
  FROM season_bowling_stats
  GROUP BY player_id, player_name, team_category
),
career_best AS (
  SELECT DISTINCT ON (player_id, team_category)
    player_id, team_category, best_bowling_wickets, best_bowling_runs
  FROM season_bowling_stats
  ORDER BY player_id, team_category, best_bowling_wickets DESC, best_bowling_runs ASC
)
SELECT
  t.player_id, t.player_name, t.team_category,
  t.matches, t.legal_balls, t.runs_conceded, t.wickets, t.maidens,
  COALESCE(cb.best_bowling_wickets, 0) AS best_bowling_wickets,
  cb.best_bowling_runs                 AS best_bowling_runs,
  t.wides, t.no_balls, t.boundaries,
  CASE WHEN t.legal_balls > 0
       THEN ROUND(t.runs_conceded::numeric / (t.legal_balls::numeric / 6), 2)
       ELSE NULL END                   AS economy
FROM totals t
LEFT JOIN career_best cb ON cb.player_id = t.player_id AND cb.team_category = t.team_category;


-- ── competition_bowling_stats ─────────────────────────────────────────────────

CREATE VIEW competition_bowling_stats AS
WITH over_summary AS (
  SELECT
    mp.player_id,
    m.competition_id,
    c.category                                                             AS team_category,
    be.innings_id,
    be.over_number,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                      AS over_runs,
    COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                        OR be.extras_type IS NULL)                         AS legal_in_over
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m        ON m.id  = be.match_id
  JOIN competitions c   ON c.id  = m.competition_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.competition_id, c.category, be.innings_id, be.over_number
),
maiden_counts AS (
  SELECT player_id, competition_id, team_category,
    COUNT(*) FILTER (WHERE over_runs = 0 AND legal_in_over >= 6)          AS maidens
  FROM over_summary
  GROUP BY player_id, competition_id, team_category
),
innings_figures AS (
  SELECT
    mp.player_id, m.competition_id,
    c.category                                                             AS team_category,
    be.innings_id,
    COUNT(*) FILTER (
      WHERE be.dismissal_type IS NOT NULL
        AND be.dismissal_type NOT IN (
          'run_out','retired_hurt','retired_out',
          'timed_out','handled_ball','obstructing_field'
        )
    )                                                                      AS inn_wickets,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                      AS inn_runs
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m        ON m.id  = be.match_id
  JOIN competitions c   ON c.id  = m.competition_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.competition_id, c.category, be.innings_id
),
best_figures AS (
  SELECT DISTINCT ON (player_id, competition_id, team_category)
    player_id, competition_id, team_category,
    inn_wickets AS best_bowling_wickets,
    inn_runs    AS best_bowling_runs
  FROM innings_figures
  ORDER BY player_id, competition_id, team_category, inn_wickets DESC, inn_runs ASC
)
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name                                      AS player_name,
  m.competition_id,
  c.category                                                               AS team_category,
  COUNT(DISTINCT m.id)                                                     AS matches,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                      OR be.extras_type IS NULL)                           AS legal_balls,
  SUM(
    be.runs_off_bat +
    CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                                                        AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                                                        AS wickets,
  COALESCE(mc.maidens, 0)                                                  AS maidens,
  COALESCE(bf.best_bowling_wickets, 0)                                     AS best_bowling_wickets,
  bf.best_bowling_runs                                                     AS best_bowling_runs,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')                          AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball')                       AS no_balls,
  COUNT(*) FILTER (WHERE be.is_boundary_four OR be.is_boundary_six)        AS boundaries,
  CASE
    WHEN COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                              OR be.extras_type IS NULL) > 0
    THEN ROUND(
      SUM(
        be.runs_off_bat +
        CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
      )::numeric /
      (COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                            OR be.extras_type IS NULL)::numeric / 6),
      2
    )
    ELSE NULL
  END                                                                      AS economy
FROM ball_events be
JOIN match_players mp ON mp.id = be.bowler_id
JOIN players p        ON p.id  = mp.player_id
JOIN matches m        ON m.id  = be.match_id
JOIN competitions c   ON c.id  = m.competition_id
LEFT JOIN maiden_counts mc ON mc.player_id      = mp.player_id
                          AND mc.competition_id  = m.competition_id
                          AND mc.team_category   = c.category
LEFT JOIN best_figures  bf ON bf.player_id      = mp.player_id
                          AND bf.competition_id  = m.competition_id
                          AND bf.team_category   = c.category
WHERE mp.player_id IS NOT NULL
GROUP BY
  mp.player_id, p.first_name, p.last_name, m.competition_id, c.category,
  mc.maidens, bf.best_bowling_wickets, bf.best_bowling_runs;
