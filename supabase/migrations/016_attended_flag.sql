-- ============================================================
-- 016_attended_flag.sql
-- Tracks whether a selected player actually participated in a match.
-- Set automatically via trigger on ball_events INSERT — zero scorer action needed.
-- Used for reliability stats and 'did_not_play' detection. NOT used in stats views
-- (those are already correct by construction via ball_events aggregation).
-- ============================================================

-- ── STEP 1: Add attended column ───────────────────────────────────────────────

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;


-- ── STEP 2: Trigger function ──────────────────────────────────────────────────
-- Fires after every ball_events INSERT.
-- Sets attended = true for the batter, non-striker, and bowler on that ball.
-- Uses IN clause for efficiency — handles nulls gracefully (id IN (a, null) works).

CREATE OR REPLACE FUNCTION set_attended_flag()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE match_players
  SET attended = true
  WHERE id IN (NEW.batter_id, NEW.non_striker_id, NEW.bowler_id)
    AND attended = false;  -- skip update if already true (avoids unnecessary writes)
  RETURN NEW;
END;
$$;


-- ── STEP 3: Attach trigger ────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_ball_events_attended ON ball_events;

CREATE TRIGGER trg_ball_events_attended
  AFTER INSERT ON ball_events
  FOR EACH ROW EXECUTE FUNCTION set_attended_flag();
