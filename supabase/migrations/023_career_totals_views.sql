-- 023_career_totals_views.sql
-- Aggregate career stats across ALL team categories (no team_category grouping).
-- Used by the Records page "All" tab to avoid showing players twice
-- when they have both senior and junior rows in the category-scoped views.

CREATE VIEW career_batting_totals AS
SELECT
  player_id,
  player_name,
  SUM(matches)       AS matches,
  SUM(innings)       AS innings,
  SUM(not_outs)      AS not_outs,
  SUM(total_runs)    AS total_runs,
  MAX(highest_score) AS highest_score,
  SUM(fifties)       AS fifties,
  SUM(hundreds)      AS hundreds,
  SUM(ducks)         AS ducks,
  SUM(fours)         AS fours,
  SUM(sixes)         AS sixes,
  SUM(balls_faced)   AS balls_faced,
  SUM(dismissals)    AS dismissals,
  CASE WHEN SUM(dismissals) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(dismissals), 2)
       ELSE NULL END  AS average,
  CASE WHEN SUM(balls_faced) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(balls_faced) * 100, 2)
       ELSE 0 END     AS strike_rate
FROM career_batting_stats
GROUP BY player_id, player_name;


CREATE VIEW career_bowling_totals AS
SELECT
  player_id,
  player_name,
  SUM(matches)       AS matches,
  SUM(legal_balls)   AS legal_balls,
  SUM(runs_conceded) AS runs_conceded,
  SUM(wickets)       AS wickets,
  SUM(maidens)       AS maidens,
  SUM(wides)         AS wides,
  SUM(no_balls)      AS no_balls,
  SUM(boundaries)    AS boundaries,
  CASE WHEN SUM(wickets) > 0
       THEN ROUND(SUM(runs_conceded)::numeric / SUM(wickets)::numeric, 2)
       ELSE NULL END  AS average,
  CASE WHEN SUM(legal_balls) > 0
       THEN ROUND(SUM(runs_conceded)::numeric / (SUM(legal_balls)::numeric / 6), 2)
       ELSE NULL END  AS economy
FROM career_bowling_stats
GROUP BY player_id, player_name;
