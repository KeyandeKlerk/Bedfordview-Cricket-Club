-- 021_bowling_average.sql
-- Add average column to career_bowling_stats view.
-- The 019 migration omitted it, causing the records page query to fail silently.

CREATE OR REPLACE VIEW career_bowling_stats AS
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
  CASE WHEN t.wickets > 0
       THEN ROUND(t.runs_conceded::numeric / t.wickets::numeric, 2)
       ELSE NULL END                   AS average,
  CASE WHEN t.legal_balls > 0
       THEN ROUND(t.runs_conceded::numeric / (t.legal_balls::numeric / 6), 2)
       ELSE NULL END                   AS economy
FROM totals t
LEFT JOIN career_best cb ON cb.player_id = t.player_id AND cb.team_category = t.team_category;
