-- Allow scorers (and admins) to update the lock columns on matches.
-- The admin_write_matches policy (FOR ALL) already covers admin.
-- Scorers need UPDATE access to acquire/release/renew the scoring lock.
CREATE POLICY "scorer_update_matches"
  ON matches FOR UPDATE
  TO authenticated
  USING    (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'scorer') OR has_role(auth.uid(), 'admin'));
