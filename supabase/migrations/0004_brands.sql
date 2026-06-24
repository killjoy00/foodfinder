-- 0004: brand-level tracking.
--
-- The family now tracks BRANDS, each of which groups one or more catalog
-- locations (every Chick-fil-A you've added). Ratings and visits move to the
-- brand level. The shared `restaurants` catalog is unchanged and still keeps
-- one row per physical location.
--
-- Safe to run more than once. Legacy columns/tables (ratings,
-- group_restaurants.status/notes, visits.restaurant_id) are intentionally
-- LEFT IN PLACE so this is reversible — the app just stops reading them.
-- Take a backup before running.

-- 1. a brand: the family's single tracked entry, grouping locations by name.
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  brand_key text not null,                 -- normalized name; the auto-group hint
  name text not null,                      -- display name
  status text not null default 'active' check (status in ('active', 'wishlist')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists brands_household_key on brands (household_id, brand_key);

-- 2. which brand each tracked location belongs to.
alter table group_restaurants add column if not exists brand_id uuid references brands(id) on delete cascade;
create index if not exists group_restaurants_brand on group_restaurants (brand_id);

-- 3. brand-wide ratings (one score per person per brand).
create table if not exists brand_ratings (
  brand_id uuid not null references brands(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  score int not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (brand_id, profile_id)
);

-- 4. visits attach to a brand; a visit no longer needs a specific location.
alter table visits add column if not exists brand_id uuid references brands(id) on delete cascade;
alter table visits alter column restaurant_id drop not null;
create index if not exists visits_brand_date on visits (brand_id, date desc);

-- ---- data migration -------------------------------------------------------

-- 5. create one brand per (household, normalized name) for tracked locations
--    that don't have a brand yet.
insert into brands (household_id, brand_key, name, status, notes, created_at)
select gr.household_id,
       regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g') as brand_key,
       min(r.name) as name,
       case when bool_or(gr.status = 'active') then 'active' else 'wishlist' end as status,
       (array_remove(array_agg(gr.notes order by gr.created_at), null))[1] as notes,
       min(gr.created_at) as created_at
from group_restaurants gr
join restaurants r on r.id = gr.restaurant_id
where gr.brand_id is null
  and not exists (
    select 1 from brands b
    where b.household_id = gr.household_id
      and b.brand_key = regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g')
  )
group by gr.household_id, regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g');

-- 6. point each tracked location at its brand.
update group_restaurants gr
set brand_id = b.id
from brands b, restaurants r
where gr.restaurant_id = r.id
  and gr.brand_id is null
  and b.household_id = gr.household_id
  and b.brand_key = regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g');

-- 7. fold existing per-location ratings up to the brand, keeping the HIGHEST
--    score when a member rated several locations of the same brand.
insert into brand_ratings (brand_id, profile_id, score, updated_at)
select gr.brand_id, ra.profile_id, max(ra.score) as score, max(ra.updated_at) as updated_at
from ratings ra
join profiles p on p.id = ra.profile_id
join group_restaurants gr on gr.household_id = p.household_id and gr.restaurant_id = ra.restaurant_id
where gr.brand_id is not null
group by gr.brand_id, ra.profile_id
on conflict (brand_id, profile_id) do update set score = greatest(brand_ratings.score, excluded.score);

-- 8. attach existing visits to the brand of the location they were logged at.
update visits v
set brand_id = gr.brand_id
from group_restaurants gr
where v.brand_id is null
  and v.restaurant_id is not null
  and gr.household_id = v.household_id
  and gr.restaurant_id = v.restaurant_id
  and gr.brand_id is not null;

-- 9. lock down the new tables like the rest.
alter table brands enable row level security;
alter table brand_ratings enable row level security;
