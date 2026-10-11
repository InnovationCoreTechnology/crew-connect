-- Phase 1.5 – who may read/write what directly through the Data API.
-- WHY: the browser talks to the database with the user's login token. GRANT decides whether a role can touch a
--      table at all; RLS policies decide which ROWS. Everything not granted here is only reachable through the
--      SECURITY DEFINER functions in the next migration (unlock, search, admin actions).
-- Pattern from the official docs: `to authenticated` + `(select auth.uid())` so Postgres evaluates the user id once
-- per statement, not per row. https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations
-- Rollback: supabase/rollback/20261011130100_rls_policies.down.sql

-- Start from nothing for the API roles, then add the minimum back.
revoke all on public.profiles, public.candidates, public.employers, public.app_settings,
              public.wallet_ledger, public.jobs, public.applications, public.unlocks
  from anon, authenticated;

-- profiles: a user can read ONLY their own row (this is how the app learns the role). No client writes.
grant select on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- candidates: a candidate reads and edits ONLY their own row, and only the profile fields.
-- `verified`, `blocked`, `phone_masked` are not in the UPDATE column list, so a candidate cannot self-verify.
-- Employers never read this table directly: they use public.search_candidates() (no phone, filtered, paged).
grant select on public.candidates to authenticated;
grant update (name, type, exp, area, salary, shift, avail) on public.candidates to authenticated;
create policy candidates_select_own on public.candidates
  for select to authenticated
  using ((select auth.uid()) = id);
create policy candidates_update_own on public.candidates
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- app_settings: readable by logged-in users (to show the price); writable only by the owner via SQL.
grant select on public.app_settings to authenticated;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using (true);

-- employers, wallet_ledger, jobs, applications, unlocks: RLS is on and there is NO grant and NO policy,
-- so the API cannot touch them directly. Access is only through the functions below.
