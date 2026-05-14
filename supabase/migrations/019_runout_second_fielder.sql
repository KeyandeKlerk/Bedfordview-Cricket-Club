-- Add optional second fielder for run-outs (relay throws, etc.)
ALTER TABLE ball_events
  ADD COLUMN fielder2_id              uuid REFERENCES match_players(id),
  ADD COLUMN fielder2_substitute_name text,
  ADD CONSTRAINT fielder2_xor_substitute CHECK (
    NOT (fielder2_id IS NOT NULL AND fielder2_substitute_name IS NOT NULL)
  );
