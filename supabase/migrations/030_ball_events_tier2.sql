-- 030_ball_events_tier2.sql
-- Optional annotation columns for professional scoring mode.
-- All columns are nullable — no change to engine, validators, or offline queue.
-- wagon_x / wagon_y store raw tap coordinates (normalised -1.0 to 1.0) for true
-- scatter-plot analytics. Zone can always be derived from coordinates.
-- pitch_length / pitch_line store the snapped zone label after a tap.

ALTER TABLE ball_events
  ADD COLUMN IF NOT EXISTS wagon_x           REAL,
  ADD COLUMN IF NOT EXISTS wagon_y           REAL,
  ADD COLUMN IF NOT EXISTS pitch_length      TEXT,
  ADD COLUMN IF NOT EXISTS pitch_line        TEXT,
  ADD COLUMN IF NOT EXISTS shot_type         TEXT,
  ADD COLUMN IF NOT EXISTS bowling_type      TEXT,
  ADD COLUMN IF NOT EXISTS execution_quality TEXT,
  ADD COLUMN IF NOT EXISTS decision_quality  TEXT;

ALTER TABLE ball_events
  ADD CONSTRAINT chk_wagon_x
    CHECK (wagon_x IS NULL OR (wagon_x BETWEEN -1.0 AND 1.0)),
  ADD CONSTRAINT chk_wagon_y
    CHECK (wagon_y IS NULL OR (wagon_y BETWEEN -1.0 AND 1.0)),
  ADD CONSTRAINT chk_pitch_length
    CHECK (pitch_length IS NULL OR pitch_length IN (
      'full_toss', 'yorker', 'full', 'good_length', 'short', 'bouncer')),
  ADD CONSTRAINT chk_pitch_line
    CHECK (pitch_line IS NULL OR pitch_line IN (
      'wide_outside_off', 'outside_off', 'off_stump',
      'middle', 'leg_stump', 'outside_leg')),
  ADD CONSTRAINT chk_shot_type
    CHECK (shot_type IS NULL OR shot_type IN (
      'drive', 'cut', 'pull', 'sweep', 'glance',
      'block', 'leave', 'slog', 'ramp')),
  ADD CONSTRAINT chk_bowling_type
    CHECK (bowling_type IS NULL OR bowling_type IN (
      'right_arm_fast', 'right_arm_medium',
      'left_arm_fast', 'left_arm_medium',
      'right_arm_off_spin', 'right_arm_leg_spin',
      'left_arm_orthodox', 'left_arm_chinaman')),
  ADD CONSTRAINT chk_execution_quality
    CHECK (execution_quality IS NULL OR execution_quality IN ('excellent', 'good', 'poor')),
  ADD CONSTRAINT chk_decision_quality
    CHECK (decision_quality IS NULL OR decision_quality IN ('good', 'poor'));

-- No new RLS policies needed.
-- INSERT: existing scorer_insert_ball_events covers any column in the row.
-- UPDATE: existing "Scorers can update ball_events" policy covers all columns.
-- SELECT: public_read_ball_events covers all columns.
