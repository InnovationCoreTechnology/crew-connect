-- Reversal for 20261011130000_core_schema.sql.
-- Apply as a NEW forward migration (Supabase does not run "down" files automatically).
-- WARNING: DROP TABLE deletes the data in it and cannot be undone. Take a backup first
-- (pg_dump, see DEVELOPMENT_ROADMAP.md Phase 2.10) and rehearse on a throwaway database.

drop table if exists public.unlocks;
drop table if exists public.applications;
drop table if exists public.jobs;
drop table if exists public.wallet_ledger;
drop function if exists private.block_ledger_changes();
drop table if exists public.app_settings;
drop table if exists public.employers;
drop table if exists public.candidates;
drop table if exists public.profiles;

-- Not dropped on purpose: schema `private` and extension pg_trgm may be used by later migrations.
-- Restore Supabase's historic default grants for future objects (undo of the hardening block):
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, public;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated;
