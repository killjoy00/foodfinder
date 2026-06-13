-- FoodFinder schema. Paste this whole file into the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → Run) when setting up the project.
--
-- The app talks to the database with the service-role key from the server
-- only, which bypasses RLS. RLS is enabled with no policies so nothing is
-- readable through Supabase's public API.

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🙂',
  color text not null default '#f97316',
  double_credits int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cuisines text[] not null default '{}',
  price int not null default 2 check (price between 1 and 4),
  address text,
  lat double precision,
  lng double precision,
  google_place_id text unique,
  maps_url text,
  reserve_url text,
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'wishlist')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists ratings (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  score int not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, profile_id)
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  date timestamptz not null default now(),
  mode text not null default 'dine_in' check (mode in ('dine_in', 'takeout')),
  note text
);

create table if not exists vote_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'closed')),
  candidate_ids uuid[] not null default '{}',
  winner_id uuid
);

create table if not exists votes (
  session_id uuid not null references vote_sessions(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  pick_id uuid,
  veto_id uuid,
  deferred boolean not null default false,
  primary key (session_id, profile_id)
);

create table if not exists discoveries (
  place_id text primary key,
  name text not null,
  address text,
  rating double precision,
  maps_url text,
  found_at timestamptz not null default now(),
  dismissed boolean not null default false
);

create table if not exists seen_places (
  place_id text primary key
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create index if not exists visits_restaurant_date on visits (restaurant_id, date desc);
create index if not exists visits_date on visits (date desc);

alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table ratings enable row level security;
alter table visits enable row level security;
alter table vote_sessions enable row level security;
alter table votes enable row level security;
alter table discoveries enable row level security;
alter table seen_places enable row level security;
alter table settings enable row level security;
