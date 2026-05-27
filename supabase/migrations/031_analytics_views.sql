-- 031_analytics_views.sql
-- Tier 1 analytics views — pure query, zero schema change.
-- All views join ball_events → match_players → players → matches → competitions
-- following the existing convention in career_batting_stats and bowling_scorecard.
--
-- Phase boundaries use absolute T20 over numbers (not % of total overs):
--   powerplay = overs 0-5, middle = 6-14, death = 15+
-- This avoids a join back to matches.overs_per_innings in every view.

-- ── 1. batter_bowler_matchups ─────────────────────────────────────────────────
-- Per (batter player, bowler player) career aggregate.
-- Only counts BCC players as batters (player_id IS NOT NULL on batter side).

CREATE OR REPLACE VIEW batter_bowler_matchups AS
SELECT
  mp_bat.player_id                                              AS batter_player_id,
  pb.first_name || ' ' || pb.last_name                         AS batter_name,
  mp_bowl.player_id                                            AS bowler_player_id,
  COALESCE(pbwl.first_name || ' ' || pbwl.last_name,
           mp_bowl.opposition_name)                            AS bowler_name,
  COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide') AS balls,
  SUM(be.runs_off_bat)                                         AS runs,
  COUNT(*) FILTER (WHERE be.dismissed_player_id = mp_bat.id)   AS dismissals,
  COUNT(*) FILTER (WHERE be.is_boundary_four OR be.is_boundary_six) AS boundaries,
  CASE
    WHEN COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide') > 0
    THEN ROUND(
      SUM(be.runs_off_bat)::numeric /
      COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide') * 100, 1)
    ELSE NULL
  END AS strike_rate
FROM ball_events be
JOIN match_players mp_bat  ON mp_bat.id  = be.batter_id
JOIN players pb             ON pb.id     = mp_bat.player_id
JOIN match_players mp_bowl ON mp_bowl.id = be.bowler_id
LEFT JOIN players pbwl     ON pbwl.id   = mp_bowl.player_id
WHERE mp_bat.player_id IS NOT NULL
GROUP BY
  mp_bat.player_id, pb.first_name, pb.last_name,
  mp_bowl.player_id, pbwl.first_name, pbwl.last_name, mp_bowl.opposition_name;

-- ── 2. phase_batting_stats ────────────────────────────────────────────────────
-- Per player per phase batting breakdown, split by season and team_category.

CREATE OR REPLACE VIEW phase_batting_stats AS
WITH phase_balls AS (
  SELECT
    mp.player_id,
    m.season_id,
    c.category AS team_category,
    CASE
      WHEN be.over_number BETWEEN 0 AND 5  THEN 'powerplay'
      WHEN be.over_number BETWEEN 6 AND 14 THEN 'middle'
      ELSE 'death'
    END AS phase,
    be.runs_off_bat,
    be.extras_type,
    mp.id AS match_player_id,
    be.dismissed_player_id,
    be.is_boundary_four,
    be.is_boundary_six
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.batter_id
  JOIN matches m         ON m.id = be.match_id
  JOIN competitions c    ON c.id = m.competition_id
  WHERE mp.player_id IS NOT NULL
)
SELECT
  player_id,
  season_id,
  team_category,
  phase,
  COUNT(*) FILTER (WHERE extras_type IS DISTINCT FROM 'wide')        AS balls,
  SUM(runs_off_bat)                                                  AS runs,
  COUNT(*) FILTER (WHERE dismissed_player_id = match_player_id)      AS dismissals,
  COUNT(*) FILTER (
    WHERE runs_off_bat = 0 AND extras_type IS DISTINCT FROM 'wide')  AS dot_balls,
  COUNT(*) FILTER (WHERE is_boundary_four OR is_boundary_six)        AS boundaries,
  CASE
    WHEN COUNT(*) FILTER (WHERE extras_type IS DISTINCT FROM 'wide') > 0
    THEN ROUND(
      SUM(runs_off_bat)::numeric /
      COUNT(*) FILTER (WHERE extras_type IS DISTINCT FROM 'wide') * 100, 1)
    ELSE NULL
  END AS strike_rate
FROM phase_balls
GROUP BY player_id, season_id, team_category, phase;

-- ── 3. phase_bowling_stats ────────────────────────────────────────────────────
-- Per player per phase bowling breakdown.

CREATE OR REPLACE VIEW phase_bowling_stats AS
WITH phase_balls AS (
  SELECT
    mp.player_id,
    m.season_id,
    c.category AS team_category,
    CASE
      WHEN be.over_number BETWEEN 0 AND 5  THEN 'powerplay'
      WHEN be.over_number BETWEEN 6 AND 14 THEN 'middle'
      ELSE 'death'
    END AS phase,
    be.runs_off_bat,
    be.extras_type,
    be.extras_runs,
    be.dismissal_type,
    be.is_boundary_four,
    be.is_boundary_six
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.bowler_id
  JOIN matches m         ON m.id = be.match_id
  JOIN competitions c    ON c.id = m.competition_id
  WHERE mp.player_id IS NOT NULL
)
SELECT
  player_id,
  season_id,
  team_category,
  phase,
  COUNT(*) FILTER (
    WHERE extras_type NOT IN ('wide', 'no_ball') OR extras_type IS NULL)   AS legal_balls,
  SUM(runs_off_bat +
      CASE WHEN extras_type IN ('wide', 'no_ball') THEN extras_runs ELSE 0 END
  )                                                                         AS runs_conceded,
  COUNT(*) FILTER (
    WHERE dismissal_type IS NOT NULL
      AND dismissal_type NOT IN (
        'run_out', 'retired_hurt', 'retired_out',
        'timed_out', 'handled_ball', 'obstructing_field'))                 AS wickets,
  COUNT(*) FILTER (
    WHERE runs_off_bat = 0
      AND (extras_type NOT IN ('wide', 'no_ball') OR extras_type IS NULL)) AS dot_balls,
  COUNT(*) FILTER (WHERE is_boundary_four OR is_boundary_six)              AS boundaries,
  CASE
    WHEN COUNT(*) FILTER (
      WHERE extras_type NOT IN ('wide', 'no_ball') OR extras_type IS NULL) > 0
    THEN ROUND(
      SUM(runs_off_bat +
          CASE WHEN extras_type IN ('wide', 'no_ball') THEN extras_runs ELSE 0 END)::numeric /
      (COUNT(*) FILTER (
        WHERE extras_type NOT IN ('wide', 'no_ball') OR extras_type IS NULL)::numeric / 6), 2)
    ELSE NULL
  END AS economy
FROM phase_balls
GROUP BY player_id, season_id, team_category, phase;

-- ── 4. partnership_stats ──────────────────────────────────────────────────────
-- Per innings partnership aggregate. Canonicalised via LEAST/GREATEST so (A,B)
-- and (B,A) collapse to a single row. Only includes BCC registered players.

CREATE OR REPLACE VIEW partnership_stats AS
WITH batter_runs AS (
  SELECT
    be.innings_id,
    mp_bat.player_id  AS batter_player_id,
    mp_ns.player_id   AS partner_player_id,
    pb.first_name || ' ' || pb.last_name  AS batter_name,
    pns.first_name || ' ' || pns.last_name AS partner_name,
    SUM(be.runs_off_bat)  AS batter_runs,
    COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide') AS batter_balls
  FROM ball_events be
  JOIN match_players mp_bat ON mp_bat.id = be.batter_id
  JOIN match_players mp_ns  ON mp_ns.id  = be.non_striker_id
  JOIN players pb             ON pb.id   = mp_bat.player_id
  JOIN players pns            ON pns.id  = mp_ns.player_id
  WHERE mp_bat.player_id IS NOT NULL
    AND mp_ns.player_id IS NOT NULL
  GROUP BY
    be.innings_id, mp_bat.player_id, mp_ns.player_id,
    pb.first_name, pb.last_name, pns.first_name, pns.last_name
)
SELECT
  LEAST(batter_player_id::text, partner_player_id::text)::uuid    AS player1_id,
  GREATEST(batter_player_id::text, partner_player_id::text)::uuid AS player2_id,
  MIN(batter_name)                                                 AS player1_name,
  MIN(partner_name)                                                AS player2_name,
  innings_id,
  SUM(batter_runs)  AS partnership_runs,
  SUM(batter_balls) AS partnership_balls,
  CASE WHEN SUM(batter_balls) > 0
    THEN ROUND(SUM(batter_runs)::numeric / SUM(batter_balls) * 100, 1)
    ELSE NULL
  END AS strike_rate
FROM batter_runs
GROUP BY
  LEAST(batter_player_id::text, partner_player_id::text),
  GREATEST(batter_player_id::text, partner_player_id::text),
  innings_id;

-- ── 5. dismissal_analysis ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW dismissal_analysis AS
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name AS player_name,
  m.season_id,
  c.category                          AS team_category,
  be.dismissal_type,
  COUNT(*)                            AS dismissal_count
FROM ball_events be
JOIN match_players mp ON mp.id = be.dismissed_player_id
JOIN players p         ON p.id = mp.player_id
JOIN matches m         ON m.id = be.match_id
JOIN competitions c    ON c.id = m.competition_id
WHERE mp.player_id IS NOT NULL
  AND be.dismissal_type IS NOT NULL
GROUP BY mp.player_id, p.first_name, p.last_name, m.season_id, c.category, be.dismissal_type;

-- ── 6. scoring_intent ─────────────────────────────────────────────────────────
-- Per player per season: absolute counts for each run value bucket.

CREATE OR REPLACE VIEW scoring_intent AS
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name AS player_name,
  m.season_id,
  c.category AS team_category,
  COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide')          AS legal_balls,
  COUNT(*) FILTER (
    WHERE be.runs_off_bat = 0 AND be.extras_type IS DISTINCT FROM 'wide') AS dots,
  COUNT(*) FILTER (WHERE be.runs_off_bat = 1)                             AS singles,
  COUNT(*) FILTER (WHERE be.runs_off_bat = 2)                             AS twos,
  COUNT(*) FILTER (WHERE be.runs_off_bat = 3)                             AS threes,
  COUNT(*) FILTER (WHERE be.is_boundary_four)                             AS fours,
  COUNT(*) FILTER (WHERE be.is_boundary_six)                              AS sixes
FROM ball_events be
JOIN match_players mp ON mp.id = be.batter_id
JOIN players p         ON p.id = mp.player_id
JOIN matches m         ON m.id = be.match_id
JOIN competitions c    ON c.id = m.competition_id
WHERE mp.player_id IS NOT NULL
GROUP BY mp.player_id, p.first_name, p.last_name, m.season_id, c.category;

-- ── 7. bowling_pair_stats ─────────────────────────────────────────────────────
-- Two BCC bowlers who bowled in the same innings: combined economy + wickets.
-- Self-join on bowling_scorecard (existing view). player_id > ensures no duplicate pairs.

CREATE OR REPLACE VIEW bowling_pair_stats AS
SELECT
  b1.player_id                                           AS player1_id,
  b2.player_id                                           AS player2_id,
  b1.player_name                                         AS player1_name,
  b2.player_name                                         AS player2_name,
  b1.innings_id,
  b1.match_id,
  b1.legal_balls + b2.legal_balls                        AS combined_balls,
  b1.runs_conceded + b2.runs_conceded                    AS combined_runs,
  b1.wickets + b2.wickets                                AS combined_wickets,
  CASE WHEN (b1.legal_balls + b2.legal_balls) > 0
    THEN ROUND(
      (b1.runs_conceded + b2.runs_conceded)::numeric /
      ((b1.legal_balls + b2.legal_balls)::numeric / 6), 2)
    ELSE NULL
  END AS combined_economy
FROM bowling_scorecard b1
JOIN bowling_scorecard b2
  ON  b2.innings_id = b1.innings_id
  AND b2.player_id  > b1.player_id
WHERE b1.player_id IS NOT NULL
  AND b2.player_id IS NOT NULL
  AND b1.legal_balls > 0
  AND b2.legal_balls > 0;
