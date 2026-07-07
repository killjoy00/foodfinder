-- Migration for the "everyone nominates" feature.
-- Run this once in the Supabase SQL Editor on an existing database
-- (new databases created from schema.sql already include these objects).
--
-- Until this runs, starting a nomination round will error; the rest of
-- the app is unaffected.

-- vote sessions gain a pre-vote 'nominating' phase and a close timestamp
alter table vote_sessions drop constraint if exists vote_sessions_status_check;
alter table vote_sessions
  add constraint vote_sessions_status_check
  check (status in ('nominating', 'open', 'closed'));
alter table vote_sessions add column if not exists closed_at timestamptz;

-- who nominated which brand into a session
create table if not exists vote_nominations (
  session_id uuid not null references vote_sessions(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, profile_id, brand_id)
);

alter table vote_nominations enable row level security;
