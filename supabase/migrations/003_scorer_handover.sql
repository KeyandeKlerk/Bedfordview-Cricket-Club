-- Add scoring lock columns (required by lib/scoring-lock.ts)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scorer_session_id  text,
  ADD COLUMN IF NOT EXISTS scorer_locked_at   timestamptz,
  ADD COLUMN IF NOT EXISTS scorer_user_id     uuid REFERENCES auth.users(id);

-- Add pending handover columns
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS pending_handover_to  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS pending_handover_at  timestamptz;

-- Allow scorers to UPDATE ball_events (for score corrections)
CREATE POLICY "Scorers can update ball_events"
  ON ball_events FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'admin'));
