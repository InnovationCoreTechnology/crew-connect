-- Reversal for 20261011130100_rls_policies.sql (apply as a new forward migration).
-- This REMOVES access rules: only run it together with dropping the tables, never alone on a live database.
drop policy if exists app_settings_select on public.app_settings;
drop policy if exists candidates_update_own on public.candidates;
drop policy if exists candidates_select_own on public.candidates;
drop policy if exists profiles_select_own on public.profiles;
revoke all on public.profiles, public.candidates, public.app_settings from authenticated;
