-- Atomic scoring lock acquisition via RPC.
-- Replaces the JS-client .or() filter on UPDATE which generates invalid
-- table-qualified column references in PostgREST PATCH mutations.
-- Drop old signature if it exists
DROP FUNCTION IF EXISTS acquire_scoring_lock(uuid, text, uuid);

-- Accept all params as text and cast internally — Supabase JS sends UUIDs as strings
CREATE OR REPLACE FUNCTION acquire_scoring_lock(
  p_match_id   text,
  p_session_id text,
  p_user_id    text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_expiry timestamptz := now() - interval '2 minutes';
  v_updated int;
BEGIN
  UPDATE matches
  SET
    scorer_session_id = p_session_id,
    scorer_locked_at  = now(),
    scorer_user_id    = p_user_id::uuid
  WHERE id = p_match_id::uuid
    AND (
      scorer_session_id IS NULL
      OR scorer_session_id = p_session_id
      OR scorer_locked_at < v_expiry
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_scoring_lock(text, text, text) TO authenticated;
