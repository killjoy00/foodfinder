-- Migration for the "defer your vote" feature.
-- Run this once in the Supabase SQL Editor on an existing database
-- (new databases created from schema.sql already include these columns).
--
-- Until this runs, deferring a vote and starting a vote will error; the
-- rest of the app is unaffected.

alter table profiles add column if not exists double_credits int not null default 0;
alter table votes add column if not exists deferred boolean not null default false;
