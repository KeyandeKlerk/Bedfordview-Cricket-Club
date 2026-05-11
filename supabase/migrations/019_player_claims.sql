-- ============================================================
-- 019_player_claims.sql
-- Player profile claim requests with admin approval
-- ============================================================

CREATE TABLE player_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_email text NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid REFERENCES auth.users(id)
);

-- One pending claim per player at a time
CREATE UNIQUE INDEX player_claims_one_pending_per_player
  ON player_claims (player_id) WHERE status = 'pending';

-- One pending claim per user at a time
CREATE UNIQUE INDEX player_claims_one_pending_per_user
  ON player_claims (user_id) WHERE status = 'pending';

ALTER TABLE player_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_claims_select ON player_claims
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY player_claims_insert ON player_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY player_claims_admin_update ON player_claims
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
