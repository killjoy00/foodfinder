-- FoodFinder schema (multi-group). Paste into the Supabase SQL Editor for a
-- NEW project. Existing projects should run the migrations in
-- supabase/migrations/ instead, which preserve data.
--
-- The app talks to the database with the service-role key from the server
-- only and scopes every query by household_id in code. RLS is enabled with
-- no policies so nothing is readable through Supabase's public API.

create extension if not exists pgcrypto;

-- a "household" is one family group, with its own login
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique, -- lower(name), used for login lookup
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  emoji text not null default '🙂',
  color text not null default '#f97316',
  double_credits int not null default 0,
  created_at timestamptz not null default now()
);

-- shared catalog: objective facts about a restaurant, used by every group
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
  created_at timestamptz not null default now()
);

-- a brand is the family's single tracked entry; it groups one or more catalog
-- locations (every Chick-fil-A you've added), matched by normalized name.
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  brand_key text not null, -- normalized name; the auto-group hint
  name text not null,
  status text not null default 'active' check (status in ('active', 'wishlist')),
  notes text,
  created_at timestamptz not null default now()
);

-- each group's curated list: which catalog locations they track, filed under a brand
create table if not exists group_restaurants (
  household_id uuid not null references households(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'wishlist')), -- legacy; brand owns status now
  notes text, -- legacy; brand owns notes now
  created_at timestamptz not null default now(),
  primary key (household_id, restaurant_id)
);

-- brand-wide ratings: one score per person per brand
create table if not exists brand_ratings (
  brand_id uuid not null references brands(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  score int not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (brand_id, profile_id)
);

-- legacy per-location ratings; retained for back-compat, no longer read
create table if not exists ratings (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  score int not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, profile_id)
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade, -- legacy/nullable
  date timestamptz not null default now(),
  mode text not null default 'dine_in' check (mode in ('dine_in', 'takeout')),
  note text
);

create table if not exists vote_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
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
  household_id uuid not null references households(id) on delete cascade,
  place_id text not null,
  name text not null,
  address text,
  rating double precision,
  maps_url text,
  found_at timestamptz not null default now(),
  dismissed boolean not null default false,
  primary key (household_id, place_id)
);

create table if not exists seen_places (
  household_id uuid not null references households(id) on delete cascade,
  place_id text not null,
  primary key (household_id, place_id)
);

create table if not exists settings (
  household_id uuid primary key references households(id) on delete cascade,
  value jsonb not null
);

create index if not exists group_restaurants_household on group_restaurants (household_id);
create index if not exists group_restaurants_brand on group_restaurants (brand_id);
create index if not exists brands_household_key on brands (household_id, brand_key);
create index if not exists brand_ratings_brand on brand_ratings (brand_id);
create index if not exists visits_household_date on visits (household_id, date desc);
create index if not exists visits_brand_date on visits (brand_id, date desc);
create index if not exists profiles_household on profiles (household_id);

alter table households enable row level security;
alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table brands enable row level security;
alter table group_restaurants enable row level security;
alter table brand_ratings enable row level security;
alter table ratings enable row level security;
alter table visits enable row level security;
alter table vote_sessions enable row level security;
alter table votes enable row level security;
alter table discoveries enable row level security;
alter table seen_places enable row level security;
alter table settings enable row level security;
