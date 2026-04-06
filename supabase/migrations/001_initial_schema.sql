-- ============================================================
-- 001_initial_schema.sql
-- BCC Production Schema — run once in Supabase SQL Editor
-- ============================================================

-- ── CLEAN SLATE ──────────────────────────────────────────────
DROP TABLE IF EXISTS ball_events CASCADE;
DROP TABLE IF EXISTS match_players CASCADE;
DROP TABLE IF EXISTS innings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS grounds CASCADE;
DROP TABLE IF EXISTS opponents CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS players CASCADE;

DROP TYPE IF EXISTS match_status CASCADE;
DROP TYPE IF EXISTS match_format CASCADE;
DROP TYPE IF EXISTS innings_status CASCADE;
DROP TYPE IF EXISTS extras_type CASCADE;
DROP TYPE IF EXISTS dismissal_type CASCADE;
DROP TYPE IF EXISTS competition_type CASCADE;
DROP TYPE IF EXISTS toss_decision CASCADE;
DROP TYPE IF EXISTS team_side CASCADE;

-- ── ENUMS ─────────────────────────────────────────────────────
CREATE TYPE match_status    AS ENUM ('upcoming','in_progress','completed','abandoned','cancelled');
CREATE TYPE match_format    AS ENUM ('t20','odi','test','hundred','club');
CREATE TYPE innings_status  AS ENUM ('pending','in_progress','completed','declared');
CREATE TYPE extras_type     AS ENUM ('wide','no_ball','bye','leg_bye','penalty');
CREATE TYPE dismissal_type  AS ENUM (
  'bowled','caught','lbw','run_out','stumped','hit_wicket',
  'handled_ball','obstructing_field','timed_out','retired_hurt','retired_out'
);
CREATE TYPE competition_type AS ENUM ('league','cup','friendly','tour');
CREATE TYPE toss_decision    AS ENUM ('bat','field');
CREATE TYPE team_side        AS ENUM ('home','away');

-- ── TABLES ────────────────────────────────────────────────────

CREATE TABLE seasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Only one active season at a time
CREATE UNIQUE INDEX seasons_one_active ON seasons (is_active) WHERE is_active = true;

CREATE TABLE players (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  nickname      text,
  batting_style text,
  bowling_style text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  short_name text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE competitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  season_id        uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  type             competition_type NOT NULL DEFAULT 'league',
  overs_per_innings int NOT NULL DEFAULT 20,
  match_format     match_format NOT NULL DEFAULT 't20',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grounds (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  location   text,
  capacity   int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE opponents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL UNIQUE,
  short_name     text,
  aliases        text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('scorer','admin')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id           uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  competition_id      uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES teams(id),
  opponent_id         uuid NOT NULL REFERENCES opponents(id),
  ground_id           uuid REFERENCES grounds(id),
  match_date          timestamptz NOT NULL,
  status              match_status NOT NULL DEFAULT 'upcoming',
  match_format        match_format NOT NULL DEFAULT 't20',
  overs_per_innings   int NOT NULL DEFAULT 20,
  toss_won_by         team_side,
  toss_decision       toss_decision,
  our_team_side       team_side NOT NULL DEFAULT 'home',
  free_hit_on_no_ball boolean NOT NULL DEFAULT true,
  result_text         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE innings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id       uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_number int NOT NULL CHECK (innings_number BETWEEN 1 AND 2),
  batting_side   team_side NOT NULL,
  status         innings_status NOT NULL DEFAULT 'pending',
  target         int,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, innings_number)
);

-- THE ID BOUNDARY: match_players.id is used in ball_events — never players.id
CREATE TABLE match_players (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id               uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id              uuid REFERENCES players(id),
  opposition_name        text,
  side                   team_side NOT NULL,
  batting_position       int,
  actual_batting_position int,
  is_captain             boolean NOT NULL DEFAULT false,
  is_keeper              boolean NOT NULL DEFAULT false,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_or_opposition CHECK (
    (player_id IS NOT NULL AND opposition_name IS NULL) OR
    (player_id IS NULL AND opposition_name IS NOT NULL)
  )
);
-- Exactly one captain per side per match
CREATE UNIQUE INDEX match_players_one_captain ON match_players (match_id, side, is_captain)
  WHERE is_captain = true;
-- Exactly one keeper per side per match
CREATE UNIQUE INDEX match_players_one_keeper ON match_players (match_id, side, is_keeper)
  WHERE is_keeper = true;

CREATE TABLE ball_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id            uuid NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  match_id              uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sequence_number       int NOT NULL,
  over_number           int NOT NULL,   -- 0-indexed
  ball_in_over          int NOT NULL,   -- position within over (including wides/no-balls)
  batter_id             uuid NOT NULL REFERENCES match_players(id),
  non_striker_id        uuid NOT NULL REFERENCES match_players(id),
  bowler_id             uuid NOT NULL REFERENCES match_players(id),
  runs_off_bat          int NOT NULL DEFAULT 0 CHECK (runs_off_bat >= 0),
  extras_type           extras_type,
  extras_runs           int NOT NULL DEFAULT 0 CHECK (extras_runs >= 0),
  is_boundary_four      boolean NOT NULL DEFAULT false,
  is_boundary_six       boolean NOT NULL DEFAULT false,
  dismissal_type        dismissal_type,
  dismissed_player_id   uuid REFERENCES match_players(id),
  fielder_id            uuid REFERENCES match_players(id),
  fielder_substitute_name text,
  commentary            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (innings_id, sequence_number),
  CONSTRAINT boundary_mutually_exclusive   CHECK (NOT (is_boundary_four AND is_boundary_six)),
  CONSTRAINT fielder_xor_substitute        CHECK (NOT (fielder_id IS NOT NULL AND fielder_substitute_name IS NOT NULL)),
  CONSTRAINT dismissed_requires_type       CHECK ((dismissed_player_id IS NULL) = (dismissal_type IS NULL))
);

-- ── updated_at TRIGGER ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_innings_updated_at
  BEFORE UPDATE ON innings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── VIEWS ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW batting_scorecard AS
SELECT
  be.innings_id,
  be.match_id,
  mp.id          AS match_player_id,
  mp.player_id,
  mp.opposition_name,
  mp.actual_batting_position,
  mp.is_captain,
  mp.is_keeper,
  mp.side,
  COALESCE(p.first_name || ' ' || p.last_name, mp.opposition_name) AS player_name,
  p.nickname,
  SUM(be.runs_off_bat)                                               AS runs,
  COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide')    AS balls_faced,
  COUNT(*) FILTER (WHERE be.is_boundary_four)                       AS fours,
  COUNT(*) FILTER (WHERE be.is_boundary_six)                        AS sixes,
  MAX(CASE WHEN be.dismissed_player_id = mp.id THEN be.dismissal_type::text END) AS dismissal_type,
  MAX(CASE WHEN be.dismissed_player_id = mp.id THEN be.commentary    END)        AS dismissal_text,
  CASE WHEN COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide') > 0
       THEN ROUND(SUM(be.runs_off_bat)::numeric /
            COUNT(*) FILTER (WHERE be.extras_type IS DISTINCT FROM 'wide') * 100, 2)
       ELSE 0
  END AS strike_rate
FROM ball_events be
JOIN match_players mp ON mp.id = be.batter_id
LEFT JOIN players p ON p.id = mp.player_id
GROUP BY be.innings_id, be.match_id,
         mp.id, mp.player_id, mp.opposition_name,
         mp.actual_batting_position, mp.is_captain, mp.is_keeper, mp.side,
         p.first_name, p.last_name, p.nickname;

CREATE OR REPLACE VIEW bowling_scorecard AS
WITH over_runs AS (
  SELECT
    innings_id,
    bowler_id,
    over_number,
    SUM(
      be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
    ) AS over_total,
    COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) AS legal_in_over
  FROM ball_events be
  GROUP BY innings_id, bowler_id, over_number
)
SELECT
  be.innings_id,
  be.match_id,
  mp.id   AS match_player_id,
  mp.player_id,
  mp.opposition_name,
  mp.side,
  COALESCE(p.first_name || ' ' || p.last_name, mp.opposition_name) AS player_name,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) AS legal_balls,
  SUM(be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                                                  AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                                                  AS wickets,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')                   AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball')                AS no_balls,
  (
    SELECT COUNT(*) FROM over_runs r
    WHERE r.innings_id = be.innings_id
      AND r.bowler_id  = mp.id
      AND r.over_total = 0
      AND r.legal_in_over >= 6
  )                                                                  AS maidens,
  CASE
    WHEN COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) > 0
    THEN ROUND(
      SUM(be.runs_off_bat +
          CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END)::numeric /
      (COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL)::numeric / 6),
      2
    )
    ELSE NULL
  END AS economy
FROM ball_events be
JOIN match_players mp ON mp.id = be.bowler_id
LEFT JOIN players p ON p.id = mp.player_id
GROUP BY be.innings_id, be.match_id,
         mp.id, mp.player_id, mp.opposition_name, mp.side,
         p.first_name, p.last_name;

CREATE OR REPLACE VIEW live_match_state AS
WITH totals AS (
  SELECT
    innings_id,
    SUM(runs_off_bat + extras_runs)                                                    AS total_runs,
    COUNT(*) FILTER (WHERE dismissal_type IS NOT NULL)                                 AS wickets,
    COUNT(*) FILTER (WHERE extras_type NOT IN ('wide','no_ball') OR extras_type IS NULL) AS legal_balls,
    COUNT(*) FILTER (WHERE extras_type = 'wide')    AS wides,
    COUNT(*) FILTER (WHERE extras_type = 'no_ball') AS no_balls,
    COUNT(*) FILTER (WHERE extras_type = 'bye')     AS byes,
    COUNT(*) FILTER (WHERE extras_type = 'leg_bye') AS leg_byes
  FROM ball_events
  GROUP BY innings_id
),
latest AS (
  SELECT DISTINCT ON (innings_id)
    innings_id, batter_id, non_striker_id, bowler_id, extras_type
  FROM ball_events
  ORDER BY innings_id, sequence_number DESC
)
SELECT
  i.id             AS innings_id,
  i.match_id,
  i.innings_number,
  i.batting_side,
  i.status,
  COALESCE(t.total_runs,  0) AS total_runs,
  COALESCE(t.wickets,     0) AS wickets,
  COALESCE(t.legal_balls, 0) AS legal_balls,
  COALESCE(t.wides,       0) AS extras_wides,
  COALESCE(t.no_balls,    0) AS extras_no_balls,
  COALESCE(t.byes,        0) AS extras_byes,
  COALESCE(t.leg_byes,    0) AS extras_leg_byes,
  l.batter_id           AS current_striker_id,
  l.non_striker_id      AS current_non_striker_id,
  l.bowler_id           AS current_bowler_id,
  (l.extras_type = 'no_ball') AS next_ball_is_free_hit
FROM innings i
LEFT JOIN totals t ON t.innings_id = i.id
LEFT JOIN latest l ON l.innings_id = i.id;

-- ── MATERIALIZED VIEWS ────────────────────────────────────────

CREATE MATERIALIZED VIEW season_batting_stats AS
WITH innings_totals AS (
  SELECT
    be.innings_id,
    mp.player_id,
    m.season_id,
    SUM(be.runs_off_bat)  AS innings_runs,
    COUNT(*) FILTER (WHERE be.dismissed_player_id = mp.id) > 0 AS was_dismissed
  FROM ball_events be
  JOIN match_players mp ON mp.id = be.batter_id
  JOIN matches m ON m.id = be.match_id
  WHERE mp.player_id IS NOT NULL
  GROUP BY be.innings_id, mp.player_id, m.season_id
)
SELECT
  it.player_id,
  p.first_name || ' ' || p.last_name                               AS player_name,
  it.season_id,
  COUNT(DISTINCT m.id)                                             AS matches,
  COUNT(DISTINCT it.innings_id)                                    AS innings,
  SUM(it.innings_runs)                                             AS total_runs,
  MAX(it.innings_runs)                                             AS highest_score,
  COUNT(*) FILTER (WHERE it.innings_runs >= 50)                    AS fifties,
  COUNT(*) FILTER (WHERE it.innings_runs >= 100)                   AS hundreds,
  SUM(be_agg.fours)                                                AS fours,
  SUM(be_agg.sixes)                                                AS sixes,
  SUM(be_agg.balls_faced)                                          AS balls_faced,
  COUNT(*) FILTER (WHERE it.was_dismissed)                         AS dismissals,
  CASE WHEN COUNT(*) FILTER (WHERE it.was_dismissed) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric /
            NULLIF(COUNT(*) FILTER (WHERE it.was_dismissed), 0), 2)
       ELSE NULL
  END                                                              AS average,
  CASE WHEN SUM(be_agg.balls_faced) > 0
       THEN ROUND(SUM(it.innings_runs)::numeric / SUM(be_agg.balls_faced) * 100, 2)
       ELSE 0
  END                                                              AS strike_rate
FROM innings_totals it
JOIN players p ON p.id = it.player_id
JOIN matches m ON m.season_id = it.season_id
JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE be2.is_boundary_four) AS fours,
    COUNT(*) FILTER (WHERE be2.is_boundary_six)  AS sixes,
    COUNT(*) FILTER (WHERE be2.extras_type IS DISTINCT FROM 'wide') AS balls_faced
  FROM ball_events be2
  JOIN match_players mp2 ON mp2.id = be2.batter_id
  WHERE be2.innings_id = it.innings_id AND mp2.player_id = it.player_id
) be_agg ON true
GROUP BY it.player_id, p.first_name, p.last_name, it.season_id;

CREATE MATERIALIZED VIEW season_bowling_stats AS
SELECT
  mp.player_id,
  p.first_name || ' ' || p.last_name AS player_name,
  m.season_id,
  COUNT(DISTINCT m.id)                AS matches,
  COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) AS legal_balls,
  SUM(be.runs_off_bat +
      CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END
  )                                   AS runs_conceded,
  COUNT(*) FILTER (
    WHERE be.dismissal_type IS NOT NULL
      AND be.dismissal_type NOT IN (
        'run_out','retired_hurt','retired_out',
        'timed_out','handled_ball','obstructing_field'
      )
  )                                   AS wickets,
  COUNT(*) FILTER (WHERE be.extras_type = 'wide')    AS wides,
  COUNT(*) FILTER (WHERE be.extras_type = 'no_ball') AS no_balls,
  CASE
    WHEN COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL) > 0
    THEN ROUND(
      SUM(be.runs_off_bat +
          CASE WHEN be.extras_type IN ('wide','no_ball') THEN be.extras_runs ELSE 0 END)::numeric /
      (COUNT(*) FILTER (WHERE be.extras_type NOT IN ('wide','no_ball') OR be.extras_type IS NULL)::numeric / 6),
      2
    )
    ELSE NULL
  END AS economy
FROM ball_events be
JOIN match_players mp ON mp.id = be.bowler_id
JOIN players p ON p.id = mp.player_id
JOIN matches m ON m.id = be.match_id
WHERE mp.player_id IS NOT NULL
GROUP BY mp.player_id, p.first_name, p.last_name, m.season_id;

CREATE MATERIALIZED VIEW career_batting_stats AS
SELECT
  player_id,
  player_name,
  SUM(matches)      AS matches,
  SUM(innings)      AS innings,
  SUM(total_runs)   AS total_runs,
  MAX(highest_score) AS highest_score,
  SUM(fifties)      AS fifties,
  SUM(hundreds)     AS hundreds,
  SUM(fours)        AS fours,
  SUM(sixes)        AS sixes,
  SUM(balls_faced)  AS balls_faced,
  SUM(dismissals)   AS dismissals,
  CASE WHEN SUM(dismissals) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(dismissals), 2)
       ELSE NULL
  END AS average,
  CASE WHEN SUM(balls_faced) > 0
       THEN ROUND(SUM(total_runs)::numeric / SUM(balls_faced) * 100, 2)
       ELSE 0
  END AS strike_rate
FROM season_batting_stats
GROUP BY player_id, player_name;

CREATE MATERIALIZED VIEW career_bowling_stats AS
SELECT
  player_id,
  player_name,
  SUM(matches)         AS matches,
  SUM(legal_balls)     AS legal_balls,
  SUM(runs_conceded)   AS runs_conceded,
  SUM(wickets)         AS wickets,
  SUM(wides)           AS wides,
  SUM(no_balls)        AS no_balls,
  CASE WHEN SUM(legal_balls) > 0
       THEN ROUND(SUM(runs_conceded)::numeric / (SUM(legal_balls)::numeric / 6), 2)
       ELSE NULL
  END AS economy
FROM season_bowling_stats
GROUP BY player_id, player_name;

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE seasons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE grounds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE opponents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE ball_events   ENABLE ROW LEVEL SECURITY;

-- has_role() — admin implies scorer
CREATE OR REPLACE FUNCTION has_role(user_uuid uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
      AND (
        role = required_role
        OR (required_role = 'scorer' AND role = 'admin')
      )
  );
END;
$$;

-- Public SELECT
CREATE POLICY "public_read_seasons"       ON seasons       FOR SELECT USING (true);
CREATE POLICY "public_read_players"       ON players       FOR SELECT USING (true);
CREATE POLICY "public_read_teams"         ON teams         FOR SELECT USING (true);
CREATE POLICY "public_read_competitions"  ON competitions  FOR SELECT USING (true);
CREATE POLICY "public_read_grounds"       ON grounds       FOR SELECT USING (true);
CREATE POLICY "public_read_opponents"     ON opponents     FOR SELECT USING (true);
CREATE POLICY "public_read_matches"       ON matches       FOR SELECT USING (true);
CREATE POLICY "public_read_innings"       ON innings       FOR SELECT USING (true);
CREATE POLICY "public_read_match_players" ON match_players FOR SELECT USING (true);
CREATE POLICY "public_read_ball_events"   ON ball_events   FOR SELECT USING (true);

-- Admin write
CREATE POLICY "admin_write_seasons"       ON seasons       FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_players"       ON players       FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_teams"         ON teams         FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_competitions"  ON competitions  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_grounds"       ON grounds       FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_opponents"     ON opponents     FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_matches"       ON matches       FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_innings"       ON innings       FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "admin_write_match_players" ON match_players FOR ALL USING (has_role(auth.uid(),'admin'));

-- Scorer can append/delete ball_events
CREATE POLICY "scorer_insert_ball_events" ON ball_events FOR INSERT
  WITH CHECK (has_role(auth.uid(),'scorer'));
CREATE POLICY "scorer_delete_ball_events" ON ball_events FOR DELETE
  USING (has_role(auth.uid(),'scorer'));

-- user_roles
CREATE POLICY "admin_manage_user_roles" ON user_roles FOR ALL
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "self_read_user_roles" ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- audit_log
CREATE POLICY "admin_read_audit_log" ON audit_log FOR SELECT
  USING (has_role(auth.uid(),'admin'));
