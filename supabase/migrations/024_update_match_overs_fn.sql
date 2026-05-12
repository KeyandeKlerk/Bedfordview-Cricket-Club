-- Allows scorer (and higher) roles to correct overs_per_innings mid-match.
-- Uses SECURITY DEFINER to bypass the admin-only RLS on the matches table,
-- same pattern as acquire_scoring_lock.
CREATE OR REPLACE FUNCTION update_match_overs(p_match_id uuid, p_new_overs int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'scorer') THEN
    RAISE EXCEPTION 'Unauthorized: scorer role required';
  END IF;
  IF p_new_overs < 1 THEN
    RAISE EXCEPTION 'overs_per_innings must be at least 1';
  END IF;
  UPDATE matches SET overs_per_innings = p_new_overs WHERE id = p_match_id;
END;
$$;
