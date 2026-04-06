-- 006_enhanced_stats_and_fielding.sql
--
-- Replaces the views created in 002 with enhanced versions, and adds
-- new fielding stats views. Uses regular views (not materialized) to
-- match the pattern established in 002.
--
-- Enhancements:
--   Batting  → adds not_outs, ducks, matches
--   Bowling  → adds maidens, best_bowling_wickets, best_bowling_runs
--   Fielding → new season_fielding_stats + career_fielding_stats views
--   Bug fix  → season_batting_stats was joining matches by season_id in
--              the outer query, multiplying rows by match count per season.
--              Fixed by carrying match_id through the CTE.

-- ── DROP OLD VIEWS (handle both regular and materialized) ─────
-- Career views depend on season views — drop career first.

DROP VIEW             IF EXISTS career_batting_stats  CASCADE;
DROP VIEW             IF EXISTS career_bowling_stats  CASCADE;
DROP MATERIALIZED VIEW IF EXISTS career_batting_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS career_bowling_stats CASCADE;

DROP VIEW             IF EXISTS season_batting_stats  CASCADE;
DROP VIEW             IF EXISTS season_bowling_stats  CASCADE;
DROP MATERIALIZED VIEW IF EXISTS season_batting_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS season_bowling_stats CASCADE;

DROP VIEW             IF EXISTS season_fielding_stats CASCADE;
DROP VIEW             IF EXISTS career_fielding_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS season_fielding_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS career_fielding_stats CASCADE;

-- ── SEASON BATTING STATS ──────────────────────────────────────

CREATE OR REPLACE VIEW season_batting_stats AS
WITH innings_totals AS (
  SELECT
    be.innings_id,
    be.match_id,
    mp.player_id,
    m.season_id,
    SUM(be.runs_off_bat)                                             AS innings_runs,
    COUNT(*) FILTER (WHERE be.dismissed_player_id = mp.id) > 0      AS was_dismissed
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.batter_id
  JOIN matches m        ON m.id  = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY be.innings_id, be.match_id, mp.player_id, m.season_id
)
SELECT
  it.player_id,
  p.first_name || ' ' || p.last_name                                 AS player_name,
  it.season_id,
  COUNT(DISTINCT it.match_id)                                        AS matches,
  COUNT(DISTINCT it.innings_id)                                      AS innings,
  COUNT(*) FILTER (WHERE NOT it.was_dismissed)                       AS not_outs,
  SUM(it.innings_runs)                                               AS total_runs,
  MAX(it.innings_runs)                                               AS highest_score,
  COUNT(*) FILTER (WHERE it.innings_runs >= 50)                      AS fifties,
  COUNT(*) FILTER (WHERE it.innings_runs >= 100)                     AS hundreds,
  COUNT(*) FILTER (WHERE it.innings_runs = 0 AND it.was_dismissed)   AS ducks,
  SUM(be_agg.fours)                                                  AS fours,
  SUM(be_agg.sixes)                                                  AS sixes,
  SUM(be_agg.balls_faced)                                            AS balls_faced,
  COUNT(*) FILTER (WHERE it.was_dismissed)                           AS dismissals,
  CASE WHEN COUNT(*) FILTER (WHERE it.was_dismissed) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric /
            NULLIF(COUNT(*) FILTER (WHERE it.was_dismissed), 0), 2)
       ELSE NULL
  END                                                                AS average,
  CASE WHEN SUM(be_agg.balls_faced) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric / SUM(be_agg.balls_faced) * 100, 2)
       ELSE 0
  END                                                                AS strike_rate
FROM innings_totals it
JOIN players p ON p.id = it.player_id
JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE be2.is_boundary_four)                          AS fours,
    COUNT(*) FILTER (WHERE be2.is_boundary_six)                           AS sixes,
    COUNT(*) FILTER (WHERE be2.extras_type IS DISTINCT FROM 'wide')       AS balls_faced
  FROM ball_events be2
  JOIN match_players mp2 ON mp2.id = be2.batter_id
  WHERE be2.innings_id = it.innings_id AND mp2.player_id = it.player_id
) be_agg ON true
GROUP BY it.player_id, p.first_name, p.last_name, it.season_id;

-- ── SEASON BOWLING STATS ──────────────────────────────────────

CREATE OR REPLACE VIEW season_bowling_stats AS
WITH over_summary AS (
  SELECT
    mp.player_id,
    m.season_id,
    be.innings_id,
    be.over_number,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                    AS over_runs,
    COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                        OR be.extras_type IS NULL)                       AS legal_in_over
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m         ON m.id  = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.season_id, be.innings_id, be.over_number
),
maiden_counts AS (
  SELECT
    player_id,
    season_id,
    COUNT(*) FILTER (WHERE over_runs = 0 AND legal_in_over >= 6) AS maidens
  FROM over_summary
  GROUP BY player_id, season_id
),
innings_figures AS (
  SELECT
    mp.player_id,
    m.season_id,
    be.innings_id,
    COUNT(*) FILTER (
      WHERE be.dismissal_type IS NOT NULL
        AND be.dismissal_type NOT IN (
          'run_out','retired_hurt','retired_out',
          'timed_out','handled_ball','obstructing_field'
        )
    )                                                                    AS inn_wickets,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                    AS inn_runs
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m         ON m.id  = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.season_id, be.innings_id
),
best_figures AS (
  SELECT DISTINCT ON (player_id, season_id)
    player_id,
    season_id,
    inn_wickets AS best_bowling_wickets,
    inn_runs    AS best_bowling_runs
  FROM innings_figures
  ORDER BY player_id, season_id, inn_wickets DESC, inn_runs ASC
)
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name                                 AS player_name,
  m.season_id,
  COUNT(DISTINCT m.id)                                               AS matches,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                      OR be.extras_type IS NULL)                     AS legal_balls,
  SUM(
    be.runs_off_bat +
    CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                                                  AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                                                  AS wickets,
  COALESCE(mc.maidens, 0)                                            AS maidens,
  COALESCE(bf.best_bowling_wickets, 0)                               AS best_bowling_wickets,
  bf.best_bowling_runs                                               AS best_bowling_runs,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')                    AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball')                 AS no_balls,
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
  END                                                                AS economy
FROM ball_events be
JOIN match_players mp ON mp.id = be.bowler_id
JOIN players p         ON p.id  = mp.player_id
JOIN matches m         ON m.id  = be.match_id
LEFT JOIN maiden_counts mc ON mc.player_id = mp.player_id AND mc.season_id = m.season_id
LEFT JOIN best_figures  bf ON bf.player_id = mp.player_id AND bf.season_id = m.season_id
WHERE mp.player_id IS NOT NULL
GROUP BY
  mp.player_id, p.first_name, p.last_name, m.season_id,
  mc.maidens, bf.best_bowling_wickets, bf.best_bowling_runs;

-- ── SEASON FIELDING STATS ─────────────────────────────────────

CREATE OR REPLACE VIEW season_fielding_stats AS
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name                                 AS player_name,
  m.season_id,
  COUNT(DISTINCT m.id)                                               AS matches,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'caught'
      AND be.fielder_id = mp.id
      AND be.fielder_id != be.bowler_id
  )                                                                  AS catches,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'caught'
      AND be.fielder_id = mp.id
      AND be.fielder_id = be.bowler_id
  )                                                                  AS caught_bowled,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'stumped'
      AND be.fielder_id = mp.id
  )                                                                  AS stumpings,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'run_out'
      AND be.fielder_id = mp.id
  )                                                                  AS run_outs,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IN ('caught','stumped','run_out')
      AND be.fielder_id = mp.id
  )                                                                  AS total_dismissals
FROM ball_events be
JOIN match_players mp ON mp.id = be.fielder_id
JOIN players p         ON p.id  = mp.player_id
JOIN matches m         ON m.id  = be.match_id
WHERE mp.player_id IS NOT NULL
  AND be.fielder_id IS NOT NULL
GROUP BY mp.player_id, p.first_name, p.last_name, m.season_id;

-- ── CAREER BATTING STATS ──────────────────────────────────────

CREATE OR REPLACE VIEW career_batting_stats AS
SELECT
  player_id,
  player_name,
  SUM(matches)        AS matches,
  SUM(innings)        AS innings,
  SUM(not_outs)       AS not_outs,
  SUM(total_runs)     AS total_runs,
  MAX(highest_score)  AS highest_score,
  SUM(fifties)        AS fifties,
  SUM(hundreds)       AS hundreds,
  SUM(ducks)          AS ducks,
  SUM(fours)          AS fours,
  SUM(sixes)          AS sixes,
  SUM(balls_faced)    AS balls_faced,
  SUM(dismissals)     AS dismissals,
  CASE WHEN SUM(dismissals) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(dismissals), 2)
       ELSE NULL
  END                 AS average,
  CASE WHEN SUM(balls_faced) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(balls_faced) * 100, 2)
       ELSE 0
  END                 AS strike_rate
FROM season_batting_stats
GROUP BY player_id, player_name;

-- ── CAREER BOWLING STATS ──────────────────────────────────────

CREATE OR REPLACE VIEW career_bowling_stats AS
WITH totals AS (
  SELECT
    player_id,
    player_name,
    SUM(matches)       AS matches,
    SUM(legal_balls)   AS legal_balls,
    SUM(runs_conceded) AS runs_conceded,
    SUM(wickets)       AS wickets,
    SUM(maidens)       AS maidens,
    SUM(wides)         AS wides,
    SUM(no_balls)      AS no_balls
  FROM season_bowling_stats
  GROUP BY player_id, player_name
),
career_best AS (
  -- Best single-innings figures across all seasons
  SELECT DISTINCT ON (player_id)
    player_id,
    best_bowling_wickets,
    best_bowling_runs
  FROM season_bowling_stats
  ORDER BY player_id, best_bowling_wickets DESC, best_bowling_runs ASC
)
SELECT
  t.player_id,
  t.player_name,
  t.matches,
  t.legal_balls,
  t.runs_conceded,
  t.wickets,
  t.maidens,
  COALESCE(cb.best_bowling_wickets, 0) AS best_bowling_wickets,
  cb.best_bowling_runs                 AS best_bowling_runs,
  t.wides,
  t.no_balls,
  CASE WHEN t.legal_balls > 0
       THEN ROUND(t.runs_conceded::numeric / (t.legal_balls::numeric / 6), 2)
       ELSE NULL
  END                                  AS economy
FROM totals t
LEFT JOIN career_best cb ON cb.player_id = t.player_id;

-- ── CAREER FIELDING STATS ─────────────────────────────────────

CREATE OR REPLACE VIEW career_fielding_stats AS
SELECT
  player_id,
  player_name,
  SUM(matches)                              AS matches,
  SUM(catches)                              AS catches,
  SUM(caught_bowled)                        AS caught_bowled,
  SUM(stumpings)                            AS stumpings,
  SUM(run_outs)                             AS run_outs,
  SUM(total_dismissals)                     AS total_dismissals
FROM season_fielding_stats
GROUP BY player_id, player_name;

-- ── COMPETITION (LEAGUE) BATTING STATS ───────────────────────
-- Same structure as season_batting_stats but keyed by competition_id.

DROP VIEW             IF EXISTS competition_batting_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS competition_batting_stats CASCADE;

CREATE OR REPLACE VIEW competition_batting_stats AS
WITH innings_totals AS (
  SELECT
    be.innings_id,
    be.match_id,
    mp.player_id,
    m.competition_id,
    SUM(be.runs_off_bat)                                             AS innings_runs,
    COUNT(*) FILTER (WHERE be.dismissed_player_id = mp.id) > 0      AS was_dismissed
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.batter_id
  JOIN matches m        ON m.id  = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY be.innings_id, be.match_id, mp.player_id, m.competition_id
)
SELECT
  it.player_id,
  p.first_name || ' ' || p.last_name                                 AS player_name,
  it.competition_id,
  COUNT(DISTINCT it.match_id)                                        AS matches,
  COUNT(DISTINCT it.innings_id)                                      AS innings,
  COUNT(*) FILTER (WHERE NOT it.was_dismissed)                       AS not_outs,
  SUM(it.innings_runs)                                               AS total_runs,
  MAX(it.innings_runs)                                               AS highest_score,
  COUNT(*) FILTER (WHERE it.innings_runs >= 50)                      AS fifties,
  COUNT(*) FILTER (WHERE it.innings_runs >= 100)                     AS hundreds,
  COUNT(*) FILTER (WHERE it.innings_runs = 0 AND it.was_dismissed)   AS ducks,
  SUM(be_agg.fours)                                                  AS fours,
  SUM(be_agg.sixes)                                                  AS sixes,
  SUM(be_agg.balls_faced)                                            AS balls_faced,
  COUNT(*) FILTER (WHERE it.was_dismissed)                           AS dismissals,
  CASE WHEN COUNT(*) FILTER (WHERE it.was_dismissed) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric /
            NULLIF(COUNT(*) FILTER (WHERE it.was_dismissed), 0), 2)
       ELSE NULL
  END                                                                AS average,
  CASE WHEN SUM(be_agg.balls_faced) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric / SUM(be_agg.balls_faced) * 100, 2)
       ELSE 0
  END                                                                AS strike_rate
FROM innings_totals it
JOIN players p ON p.id = it.player_id
JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE be2.is_boundary_four)                    AS fours,
    COUNT(*) FILTER (WHERE be2.is_boundary_six)                     AS sixes,
    COUNT(*) FILTER (WHERE be2.extras_type IS DISTINCT FROM 'wide') AS balls_faced
  FROM ball_events be2
  JOIN match_players mp2 ON mp2.id = be2.batter_id
  WHERE be2.innings_id = it.innings_id AND mp2.player_id = it.player_id
) be_agg ON true
GROUP BY it.player_id, p.first_name, p.last_name, it.competition_id;

-- ── COMPETITION (LEAGUE) BOWLING STATS ───────────────────────

DROP VIEW             IF EXISTS competition_bowling_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS competition_bowling_stats CASCADE;

CREATE OR REPLACE VIEW competition_bowling_stats AS
WITH over_summary AS (
  SELECT
    mp.player_id,
    m.competition_id,
    be.innings_id,
    be.over_number,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                    AS over_runs,
    COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                        OR be.extras_type IS NULL)                       AS legal_in_over
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m         ON m.id  = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.competition_id, be.innings_id, be.over_number
),
maiden_counts AS (
  SELECT
    player_id,
    competition_id,
    COUNT(*) FILTER (WHERE over_runs = 0 AND legal_in_over >= 6) AS maidens
  FROM over_summary
  GROUP BY player_id, competition_id
),
innings_figures AS (
  SELECT
    mp.player_id,
    m.competition_id,
    be.innings_id,
    COUNT(*) FILTER (
      WHERE be.dismissal_type IS NOT NULL
        AND be.dismissal_type NOT IN (
          'run_out','retired_hurt','retired_out',
          'timed_out','handled_ball','obstructing_field'
        )
    )                                                                    AS inn_wickets,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    )                                                                    AS inn_runs
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m         ON m.id  = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY mp.player_id, m.competition_id, be.innings_id
),
best_figures AS (
  SELECT DISTINCT ON (player_id, competition_id)
    player_id,
    competition_id,
    inn_wickets AS best_bowling_wickets,
    inn_runs    AS best_bowling_runs
  FROM innings_figures
  ORDER BY player_id, competition_id, inn_wickets DESC, inn_runs ASC
)
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name                                 AS player_name,
  m.competition_id,
  COUNT(DISTINCT m.id)                                               AS matches,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball')
                      OR be.extras_type IS NULL)                     AS legal_balls,
  SUM(
    be.runs_off_bat +
    CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                                                  AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                                                  AS wickets,
  COALESCE(mc.maidens, 0)                                            AS maidens,
  COALESCE(bf.best_bowling_wickets, 0)                               AS best_bowling_wickets,
  bf.best_bowling_runs                                               AS best_bowling_runs,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')                    AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball')                 AS no_balls,
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
  END                                                                AS economy
FROM ball_events be
JOIN match_players mp ON mp.id = be.bowler_id
JOIN players p         ON p.id  = mp.player_id
JOIN matches m         ON m.id  = be.match_id
LEFT JOIN maiden_counts mc ON mc.player_id = mp.player_id AND mc.competition_id = m.competition_id
LEFT JOIN best_figures  bf ON bf.player_id = mp.player_id AND bf.competition_id = m.competition_id
WHERE mp.player_id IS NOT NULL
GROUP BY
  mp.player_id, p.first_name, p.last_name, m.competition_id,
  mc.maidens, bf.best_bowling_wickets, bf.best_bowling_runs;

-- ── COMPETITION (LEAGUE) FIELDING STATS ──────────────────────

DROP VIEW             IF EXISTS competition_fielding_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS competition_fielding_stats CASCADE;

CREATE OR REPLACE VIEW competition_fielding_stats AS
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name                                 AS player_name,
  m.competition_id,
  COUNT(DISTINCT m.id)                                               AS matches,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'caught'
      AND be.fielder_id = mp.id
      AND be.fielder_id != be.bowler_id
  )                                                                  AS catches,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'caught'
      AND be.fielder_id = mp.id
      AND be.fielder_id = be.bowler_id
  )                                                                  AS caught_bowled,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'stumped'
      AND be.fielder_id = mp.id
  )                                                                  AS stumpings,
  COUNT(*) FILTER (
    WHERE be.dismissal_type = 'run_out'
      AND be.fielder_id = mp.id
  )                                                                  AS run_outs,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IN ('caught','stumped','run_out')
      AND be.fielder_id = mp.id
  )                                                                  AS total_dismissals
FROM ball_events be
JOIN match_players mp ON mp.id = be.fielder_id
JOIN players p         ON p.id  = mp.player_id
JOIN matches m         ON m.id  = be.match_id
WHERE mp.player_id IS NOT NULL
  AND be.fielder_id IS NOT NULL
GROUP BY mp.player_id, p.first_name, p.last_name, m.competition_id;
