-- Phase 1.3 / 1.4 – core tables, constraints and indexes.
-- WHY: replaces web/src/data/mockDb.ts with real PostgreSQL tables. Rules that must never be bypassed
--      (value ranges, allowed statuses, one unlock per employer+candidate) live here as constraints,
--      not only in the browser.
-- Rollback: supabase/rollback/20261011130000_core_schema.down.sql
-- Sources (official, checked 2026-10-11):
--   RLS + grants      https://supabase.com/docs/guides/database/postgres/row-level-security
--   Securing the API  https://supabase.com/docs/guides/api/securing-your-api
--   pg_trgm           https://www.postgresql.org/docs/current/pgtrgm.html

-- ---------------------------------------------------------------------------
-- Hardening: new objects in `public` must be opt-in for the Data API (Supabase's documented opt-in).
-- Without this, every new table/function would be reachable by anon/authenticated by default.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- `private` holds helper functions. It is NOT an exposed API schema and API roles get no access to it.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Trigram index support for fast "name contains …" search (see candidates_name_trgm_idx).
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles: one row per login. Holds the ROLE and the 10-digit phone number.
-- Role is set only by public.register_account() (or by the owner for admins) – never by the client.
-- Phone is private: RLS lets a user read only their own row (see the policies migration).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('candidate', 'employer', 'admin')),
  phone      text not null check (phone ~ '^[6-9][0-9]{9}$'), -- Indian mobile, same rule as the app
  created_at timestamptz not null default now()
);
create unique index profiles_phone_key on public.profiles (phone);

-- ---------------------------------------------------------------------------
-- candidates: the searchable profile. NO phone column on purpose: employers must never be able to
-- read a number from this table. The masked form is stored for display; the real one is in `profiles`
-- and is only released by public.unlock_candidate().
-- ---------------------------------------------------------------------------
create table public.candidates (
  id           uuid primary key references public.profiles (id) on delete cascade,
  phone_masked text not null,
  name         text not null default '' check (name = '' or char_length(btrim(name)) between 2 and 80),
  type         text not null default 'Security' check (type in ('Security', 'Housekeeping')),
  exp          smallint not null default 0 check (exp between 0 and 40),
  area         text not null default 'Whitefield' check (char_length(area) between 1 and 60),
  salary       integer not null default 15000 check (salary between 5000 and 100000),
  shift        text not null default 'Any' check (shift in ('Day', 'Night', 'Any')),
  avail        text not null default 'Immediate' check (avail in ('Immediate', '15 days', '30 days')),
  verified     boolean not null default false, -- set by admin only (column is not client-updatable)
  blocked      boolean not null default false, -- set by admin only
  -- Mirrors isProfileComplete() in web/src/data/rules.ts: visible to employers only when named and not blocked.
  visible      boolean generated always as (not blocked and char_length(btrim(name)) >= 2) stored,
  created_at   timestamptz not null default now()
);

-- Search path used by public.search_candidates(): keyset order + each filter, all limited to visible rows
-- (partial indexes stay small and are only used for rows employers can actually see).
create index candidates_visible_order_idx on public.candidates (created_at desc, id desc) where visible;
create index candidates_verified_order_idx on public.candidates (created_at desc, id desc) where visible and verified;
create index candidates_type_area_idx on public.candidates (type, area) where visible;
create index candidates_salary_idx on public.candidates (salary) where visible;
create index candidates_shift_idx on public.candidates (shift) where visible;
create index candidates_name_trgm_idx on public.candidates using gin (name extensions.gin_trgm_ops) where visible;

-- ---------------------------------------------------------------------------
-- employers
-- ---------------------------------------------------------------------------
create table public.employers (
  id                uuid primary key references public.profiles (id) on delete cascade,
  company_name      text not null default '' check (char_length(company_name) <= 120),
  status            text not null default 'Pending' check (status in ('Pending', 'Approved', 'Blocked')),
  free_unlocks_left integer not null default 0 check (free_unlocks_left >= 0),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_settings: business numbers the SERVER trusts (price, free unlocks). The numbers in
-- web/src/app/config.ts PRICING are for display only. Change a value here with SQL; clients cannot write it.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key   text primary key,
  value integer not null check (value >= 0)
);
insert into public.app_settings (key, value) values
  ('free_unlocks_new_employer', 3),
  ('price_per_unlock_inr', 30);

-- ---------------------------------------------------------------------------
-- wallet_ledger: append-only money history. Rows are never updated or deleted (trigger below), so the
-- numbers can always be audited. Phase 3 adds top-ups/refunds as new `reason` values.
-- ---------------------------------------------------------------------------
create table public.wallet_ledger (
  id           bigint generated always as identity primary key,
  employer_id  uuid not null references public.employers (id) on delete restrict, -- money records must not vanish
  amount_inr   integer not null,                                                  -- negative = charge
  reason       text not null check (reason in ('unlock')),
  candidate_id uuid references public.candidates (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index wallet_ledger_employer_idx on public.wallet_ledger (employer_id, created_at desc);
create index wallet_ledger_candidate_idx on public.wallet_ledger (candidate_id) where candidate_id is not null;

create function private.block_ledger_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'wallet_ledger is append-only';
end;
$$;
create trigger wallet_ledger_append_only
  before update or delete on public.wallet_ledger
  for each row execute function private.block_ledger_changes();

-- ---------------------------------------------------------------------------
-- jobs, applications, unlocks
-- ---------------------------------------------------------------------------
create table public.jobs (
  id          uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 3 and 120),
  type        text not null check (type in ('Security', 'Housekeeping')),
  area        text not null check (char_length(area) between 1 and 60),
  salary      integer not null check (salary between 5000 and 100000),
  shift       text not null check (shift in ('Day', 'Night', 'Any')),
  openings    smallint not null check (openings between 1 and 500),
  created_at  timestamptz not null default now()
);
create index jobs_employer_idx on public.jobs (employer_id);
create index jobs_type_created_idx on public.jobs (type, created_at desc, id desc);

create table public.applications (
  job_id       uuid not null references public.jobs (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  status       text not null default 'Applied' check (status in ('Applied', 'Shortlisted', 'Rejected')),
  created_at   timestamptz not null default now(),
  primary key (job_id, candidate_id) -- one application per job per candidate
);
create index applications_candidate_idx on public.applications (candidate_id, created_at desc);

create table public.unlocks (
  employer_id  uuid not null references public.employers (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (employer_id, candidate_id) -- the database itself prevents a second (paid) unlock
);
-- list_unlocked() pages "newest unlock first" for one employer (keyset order).
create index unlocks_employer_order_idx on public.unlocks (employer_id, created_at desc, candidate_id desc);
create index unlocks_candidate_idx on public.unlocks (candidate_id); -- speeds up cascade deletes

-- ---------------------------------------------------------------------------
-- Row Level Security ON for every table. Tables with no policy and no grant are unreachable from the API.
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.candidates     enable row level security;
alter table public.employers      enable row level security;
alter table public.app_settings   enable row level security;
alter table public.wallet_ledger  enable row level security;
alter table public.jobs           enable row level security;
alter table public.applications   enable row level security;
alter table public.unlocks        enable row level security;
