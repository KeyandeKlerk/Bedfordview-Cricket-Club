-- ─────────────────────────────────────────────────────────────────────────────
-- BEDFORDVIEW CC — SUPABASE SQL
-- Run this in your Supabase SQL editor AFTER the schema from Phase 1
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

-- Players: anyone can read, only the user can update their own row
alter table players enable row level security;
create policy "Public read" on players for select using (true);
create policy "Users can update own profile" on players for update using (auth.uid() = id);
create policy "Service role can insert" on players for insert with check (true);

-- Matches: public read
alter table matches enable row level security;
create policy "Public read" on matches for select using (true);
create policy "Scorers can insert/update" on matches for all
  using (exists (select 1 from players where id = auth.uid() and role in ('scorer','admin')));

-- Innings: public read
alter table innings enable row level security;
create policy "Public read" on innings for select using (true);
create policy "Scorers can write" on innings for all
  using (exists (select 1 from players where id = auth.uid() and role in ('scorer','admin')));

-- Deliveries: public read, scorers write
alter table deliveries enable row level security;
create policy "Public read" on deliveries for select using (true);
create policy "Scorers can write" on deliveries for all
  using (exists (select 1 from players where id = auth.uid() and role in ('scorer','admin')));

-- Opposition: public read, scorers write
alter table opposition enable row level security;
create policy "Public read" on opposition for select using (true);
create policy "Scorers can write" on opposition for all
  using (exists (select 1 from players where id = auth.uid() and role in ('scorer','admin')));


-- ── BATTING STATS VIEW ────────────────────────────────────────────────────────
create or replace view batting_stats as
select
  p.id as player_id,
  p.full_name,
  count(distinct d.innings_id) as innings,
  coalesce(sum(d.runs_off_bat), 0) as total_runs,
  coalesce(max(innings_scores.runs), 0) as high_score,
  case
    when count(case when d.is_wicket and d.dismissed_player_id = p.id then 1 end) > 0
    then round(sum(d.runs_off_bat)::numeric /
      count(case when d.is_wicket and d.dismissed_player_id = p.id then 1 end), 2)
    else null
  end as average,
  case
    when count(case when d.extra_type is null and d.batsman_id = p.id then 1 end) > 0
    then round(sum(d.runs_off_bat)::numeric /
      count(case when d.extra_type is null and d.batsman_id = p.id then 1 end) * 100, 1)
    else null
  end as strike_rate,
  count(case when d.runs_off_bat = 4 and d.batsman_id = p.id then 1 end) as fours,
  count(case when d.runs_off_bat = 6 and d.batsman_id = p.id then 1 end) as sixes
from players p
left join deliveries d on d.batsman_id = p.id
left join (
  select batsman_id, innings_id, sum(runs_off_bat) as runs
  from deliveries
  group by batsman_id, innings_id
) innings_scores on innings_scores.batsman_id = p.id
group by p.id, p.full_name
having coalesce(sum(d.runs_off_bat), 0) > 0;


-- ── BOWLING STATS VIEW ────────────────────────────────────────────────────────
create or replace view bowling_stats as
select
  p.id as player_id,
  p.full_name,
  count(distinct d.innings_id) as innings_bowled,
  -- legitimate balls only (not wides)
  count(case when d.extra_type != 'wide' or d.extra_type is null then 1 end) as total_balls,
  round(
    count(case when d.extra_type != 'wide' or d.extra_type is null then 1 end)::numeric / 6, 1
  ) as overs,
  coalesce(sum(d.runs_off_bat), 0) + coalesce(sum(case when d.extra_type in ('wide','no_ball') then d.extras else 0 end), 0) as total_runs,
  count(case when d.is_wicket and d.wicket_type not in ('Run Out','Retired') then 1 end) as total_wickets,
  case
    when count(case when d.is_wicket and d.wicket_type not in ('Run Out','Retired') then 1 end) > 0
    then round(
      (coalesce(sum(d.runs_off_bat), 0))::numeric /
      count(case when d.is_wicket and d.wicket_type not in ('Run Out','Retired') then 1 end), 2
    )
    else null
  end as average,
  case
    when count(case when d.extra_type != 'wide' or d.extra_type is null then 1 end) > 0
    then round(
      (coalesce(sum(d.runs_off_bat), 0))::numeric /
      count(case when d.extra_type != 'wide' or d.extra_type is null then 1 end) * 6, 2
    )
    else null
  end as economy
from players p
left join deliveries d on d.bowler_id = p.id
group by p.id, p.full_name
having count(d.id) > 0;


-- ── HELPER: PROMOTE USER TO SCORER OR ADMIN ───────────────────────────────────
-- Run this manually in the SQL editor to grant roles:
-- update players set role = 'scorer' where email = 'scorer@yourclub.com';
-- update players set role = 'admin' where email = 'keyandeklerk321@gmail.com';


-- ── MIGRATION: support opposition players in deliveries ────────────────────────
-- Opposition players are not in the players table, so batsman_id / bowler_id
-- must be nullable. NULL is valid in a FK column — no need to drop the constraint.
-- Run this once in the Supabase SQL editor.
alter table deliveries
  alter column batsman_id drop not null,
  alter column bowler_id drop not null;

-- If you previously dropped the FK constraints, re-add them so Supabase joins work:
alter table deliveries drop constraint if exists deliveries_batsman_id_fkey;
alter table deliveries drop constraint if exists deliveries_bowler_id_fkey;
alter table deliveries
  add constraint deliveries_batsman_id_fkey foreign key (batsman_id) references players(id) on delete set null,
  add constraint deliveries_bowler_id_fkey  foreign key (bowler_id)  references players(id) on delete set null;
