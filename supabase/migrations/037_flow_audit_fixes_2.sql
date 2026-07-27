-- 037_flow_audit_fixes_2.sql
-- Second follow-up from the 2026-07-27 end-to-end flow audit.

-- ============================================================
-- FIX 1: let scorer/coach accounts start matches.
-- ScorerShell's "Start Scoring" flow creates an `innings` row and updates
-- `matches.status`. `innings` had no scorer/coach write policy at all
-- (only admin_write_innings, FOR ALL, admin-only) — a scorer- or
-- coach-only account's innings INSERT silently failed under RLS, leaving
-- the UI in a "scoring" state with no real innings row. `matches` UPDATE
-- already allowed 'scorer' (004_scorer_lock_policy.sql) but not 'coach'.
-- ============================================================

CREATE POLICY "scorer_coach_insert_innings" ON innings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'coach'));

CREATE POLICY "scorer_coach_update_innings" ON innings
  FOR UPDATE TO authenticated
  USING      (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'coach'))
  WITH CHECK (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'coach'));

DROP POLICY IF EXISTS "scorer_update_matches" ON matches;
CREATE POLICY "scorer_update_matches"
  ON matches FOR UPDATE
  TO authenticated
  USING      (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));


-- ============================================================
-- FIX 2: real server-side ball validation.
-- `validate-ball` edge function covers ~3 of the ~12 rules in
-- lib/cricket/validators.ts and is never invoked — zero real enforcement
-- exists on ball_events writes. Most rules only depend on the row's own
-- columns and are expressed as CHECK constraints (added NOT VALID so
-- existing historical rows — which predate these rules — can't block this
-- migration; every new/edited row is still checked). The remaining three
-- rules (innings already complete, all out, free-hit dismissal) depend on
-- other rows in the same innings and need a BEFORE INSERT trigger.
--
-- Rules already enforced elsewhere (not duplicated here):
--   fielder XOR substitute, dismissed_player_id<->dismissal_type,
--   boundary four/six mutually exclusive — all via CHECK constraints
--   added in 001_initial_schema.sql.
-- ============================================================

ALTER TABLE ball_events
  ADD CONSTRAINT ball_wide_no_bat_runs
    CHECK (NOT (extras_type = 'wide' AND runs_off_bat > 0)) NOT VALID;

ALTER TABLE ball_events
  ADD CONSTRAINT ball_wide_dismissal_restriction
    CHECK (NOT (extras_type = 'wide' AND dismissal_type IS NOT NULL AND dismissal_type NOT IN ('run_out', 'stumped'))) NOT VALID;

ALTER TABLE ball_events
  ADD CONSTRAINT ball_no_ball_dismissal_restriction
    CHECK (NOT (extras_type = 'no_ball' AND dismissal_type IS NOT NULL AND dismissal_type <> 'run_out')) NOT VALID;

ALTER TABLE ball_events
  ADD CONSTRAINT ball_bye_legbye_dismissal_restriction
    CHECK (NOT (extras_type IN ('bye', 'leg_bye') AND dismissal_type IN ('caught', 'bowled', 'lbw', 'hit_wicket'))) NOT VALID;

ALTER TABLE ball_events
  ADD CONSTRAINT ball_fielder_required_for_dismissal
    CHECK (NOT (dismissal_type IN ('caught', 'stumped', 'run_out') AND fielder_id IS NULL AND fielder_substitute_name IS NULL)) NOT VALID;

ALTER TABLE ball_events
  ADD CONSTRAINT ball_boundary_four_runs_match
    CHECK (NOT (is_boundary_four AND runs_off_bat <> 4)) NOT VALID;

ALTER TABLE ball_events
  ADD CONSTRAINT ball_boundary_six_runs_match
    CHECK (NOT (is_boundary_six AND runs_off_bat <> 6)) NOT VALID;

-- Stateful rules: innings-complete, all-out, free-hit dismissal restriction.
-- retired_hurt is deliberately excluded from the wicket count, matching the
-- lib/cricket/engine.ts computeInningsState fix (retired_hurt is not a real
-- dismissal — the batter can return later).

CREATE OR REPLACE FUNCTION validate_ball_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_overs_per_innings   int;
  v_free_hit_on_no_ball boolean;
  v_legal_balls         int;
  v_wickets             int;
  v_last_extras_type    extras_type;
BEGIN
  SELECT m.overs_per_innings, m.free_hit_on_no_ball
    INTO v_overs_per_innings, v_free_hit_on_no_ball
    FROM matches m WHERE m.id = NEW.match_id;

  SELECT count(*) INTO v_legal_balls
    FROM ball_events
    WHERE innings_id = NEW.innings_id
      AND (extras_type IS NULL OR extras_type NOT IN ('wide', 'no_ball'));

  IF v_legal_balls >= v_overs_per_innings * 6 THEN
    RAISE EXCEPTION 'Innings is complete — all overs bowled.';
  END IF;

  SELECT count(*) INTO v_wickets
    FROM ball_events
    WHERE innings_id = NEW.innings_id
      AND dismissal_type IS NOT NULL
      AND dismissal_type <> 'retired_hurt';

  IF v_wickets >= 10 THEN
    RAISE EXCEPTION 'Innings is complete — all out.';
  END IF;

  SELECT extras_type INTO v_last_extras_type
    FROM ball_events
    WHERE innings_id = NEW.innings_id
    ORDER BY sequence_number DESC
    LIMIT 1;

  IF v_free_hit_on_no_ball AND v_last_extras_type = 'no_ball'
     AND NEW.dismissal_type IS NOT NULL AND NEW.dismissal_type <> 'run_out' THEN
    RAISE EXCEPTION '% is not valid on a free hit — only run-out is allowed.', NEW.dismissal_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ball_event ON ball_events;
CREATE TRIGGER trg_validate_ball_event
  BEFORE INSERT ON ball_events
  FOR EACH ROW EXECUTE FUNCTION validate_ball_event();
