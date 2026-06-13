-- 0003: multiple family groups (households)
--
-- Converts a single-family database to multi-group, folding all existing
-- data into one default group. SAFE TO RUN ON A LIVE DATABASE: it only adds
-- tables/columns and backfills; nothing is deleted.
--
-- ⬇️  BEFORE RUNNING, edit the two values on the marked lines below:
--     - your group's NAME (what you'll type to log in)
--     - your group's PASSWORD (keep using your current one, or pick a new one)
--
-- Run the whole file once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- create your default group (only if none exists yet)
insert into households (name, name_key, password_hash)
select
  'My Family',                                                  -- ⬅️ EDIT: your group name
  lower('My Family'),                                           -- ⬅️ EDIT: same name, lowercased
  encode(digest('foodfinder:' || 'CHANGE_THIS_PASSWORD', 'sha256'), 'hex')  -- ⬅️ EDIT: your password
where not exists (select 1 from households);

create table if not exists group_restaurants (
  household_id uuid not null references households(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'wishlist')),
  notes text,
  created_at timestamptz not null default now(),
  primary key (household_id, restaurant_id)
);

do $$
declare hid uuid;
begin
  select id into hid from households order by created_at limit 1;

  -- vote-defer columns (also added by 0002; harmless if already present)
  alter table profiles add column if not exists double_credits int not null default 0;
  alter table votes add column if not exists deferred boolean not null default false;

  -- attach per-group tables to the default household
  alter table profiles add column if not exists household_id uuid references households(id) on delete cascade;
  update profiles set household_id = hid where household_id is null;
  alter table profiles alter column household_id set not null;

  alter table visits add column if not exists household_id uuid references households(id) on delete cascade;
  update visits set household_id = hid where household_id is null;
  alter table visits alter column household_id set not null;

  alter table vote_sessions add column if not exists household_id uuid references households(id) on delete cascade;
  update vote_sessions set household_id = hid where household_id is null;
  alter table vote_sessions alter column household_id set not null;

  -- copy each restaurant's current status/notes into the default group's list
  insert into group_restaurants (household_id, restaurant_id, status, notes)
  select hid, id, coalesce(status, 'active'), notes from restaurants
  on conflict (household_id, restaurant_id) do nothing;

  -- discoveries: re-key by (household_id, place_id)
  alter table discoveries add column if not exists household_id uuid references households(id) on delete cascade;
  update discoveries set household_id = hid where household_id is null;
  alter table discoveries alter column household_id set not null;
  begin
    alter table discoveries drop constraint discoveries_pkey;
  exception when others then null;
  end;
  alter table discoveries add primary key (household_id, place_id);

  -- seen_places: re-key by (household_id, place_id)
  alter table seen_places add column if not exists household_id uuid references households(id) on delete cascade;
  update seen_places set household_id = hid where household_id is null;
  alter table seen_places alter column household_id set not null;
  begin
    alter table seen_places drop constraint seen_places_pkey;
  exception when others then null;
  end;
  alter table seen_places add primary key (household_id, place_id);

  -- settings: re-key by household_id
  alter table settings add column if not exists household_id uuid references households(id) on delete cascade;
  update settings set household_id = hid where household_id is null;
  begin
    alter table settings drop constraint settings_pkey;
  exception when others then null;
  end;
  begin
    alter table settings add primary key (household_id);
  exception when others then null;
  end;
end $$;

create index if not exists group_restaurants_household on group_restaurants (household_id);
create index if not exists visits_household_date on visits (household_id, date desc);
create index if not exists profiles_household on profiles (household_id);

alter table households enable row level security;
alter table group_restaurants enable row level security;

-- The old restaurants.status / restaurants.notes columns are now unused by
-- the app (group status/notes live in group_restaurants). They are left in
-- place so this migration stays non-destructive; you may drop them later.
