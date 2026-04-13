-- ============================================================
-- 015_notifications.sql
-- In-app notification feed. All system events write here.
-- Edge functions deliver them; Supabase Realtime surfaces them.
-- ============================================================

-- ── STEP 1: notifications table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              text        NOT NULL CHECK (type IN (
                                  'availability_window_open',
                                  'availability_deadline_reminder',
                                  'selection_announced',
                                  'selection_confirmed_by_player',
                                  'selection_withdrawn',
                                  'match_started',
                                  'match_completed',
                                  'order_confirmed',
                                  'membership_activated'
                                )),
  title             text        NOT NULL,
  body              text        NOT NULL,
  data              jsonb       NOT NULL DEFAULT '{}',
  -- idempotency_key prevents duplicate notifications on webhook retry.
  -- Format: '{type}:{entity_id}:{user_id}'
  -- Only set for system-generated notifications; null for manual/admin ones.
  idempotency_key   text        UNIQUE,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Fast unread count lookup per user
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Idempotency check (prevents duplicate writes from webhook retries)
CREATE INDEX IF NOT EXISTS notifications_idempotency
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ── STEP 2: RLS — notifications ──────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users read and mark-read only their own notifications
CREATE POLICY notif_own_read ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notif_own_update ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can read all notifications (for debugging / support)
CREATE POLICY notif_admin_read ON notifications
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- INSERT is via service role from Edge Functions — no policy needed for anon/authed users
