-- ============================================================
-- 017_reliability_view.sql
-- Player reliability: availability rate + commitment rate per season.
-- Meaningful only from migration 016 onward (historical attended = false).
-- ============================================================

CREATE OR REPLACE VIEW player_reliability AS
WITH window_totals AS (
  -- How many windows did each player respond to, and with what status?
  SELECT
    pa.player_id,
    aw.season_id,
    COUNT(*)                                          AS total_windows,
    COUNT(*) FILTER (WHERE pa.status = 'available')   AS available_count,
    COUNT(*) FILTER (WHERE pa.status = 'unavailable') AS unavailable_count,
    COUNT(*) FILTER (WHERE pa.status = 'tentative')   AS tentative_count
  FROM player_availability pa
  JOIN availability_windows aw ON aw.id = pa.window_id
  GROUP BY pa.player_id, aw.season_id
),
selection_totals AS (
  -- How many times was each player selected, withdrawn, or marked did_not_play?
  SELECT
    s.player_id,
    m.season_id,
    COUNT(*) FILTER (WHERE s.status = 'selected')      AS times_selected,
    COUNT(*) FILTER (WHERE s.status = 'withdrawn')     AS times_withdrawn,
    COUNT(*) FILTER (WHERE s.status = 'did_not_play')  AS times_did_not_play
  FROM selections s
  JOIN matches m ON m.id = s.match_id
  GROUP BY s.player_id, m.season_id
)
SELECT
  p.id                                                                          AS player_id,
  p.first_name || ' ' || p.last_name                                            AS player_name,
  t.season_id,
  -- Availability rate: % of windows where player said "available"
  t.total_windows,
  t.available_count,
  t.unavailable_count,
  t.tentative_count,
  ROUND(
    t.available_count::numeric / NULLIF(t.total_windows, 0) * 100, 1
  )                                                                             AS availability_rate,
  -- Commitment rate: % of selections where player actually played
  COALESCE(st.times_selected, 0)                                               AS times_selected,
  COALESCE(st.times_withdrawn, 0)                                              AS times_withdrawn,
  COALESCE(st.times_did_not_play, 0)                                           AS times_did_not_play,
  ROUND(
    (COALESCE(st.times_selected, 0)
      - COALESCE(st.times_withdrawn, 0)
      - COALESCE(st.times_did_not_play, 0))::numeric
    / NULLIF(COALESCE(st.times_selected, 0), 0) * 100,
    1
  )                                                                             AS commitment_rate
FROM window_totals t
JOIN players p ON p.id = t.player_id
LEFT JOIN selection_totals st
  ON st.player_id = t.player_id AND st.season_id = t.season_id;
