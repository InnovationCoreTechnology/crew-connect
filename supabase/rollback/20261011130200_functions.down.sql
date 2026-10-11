-- Reversal for 20261011130200_functions.sql (apply as a new forward migration).
-- Dropping these functions disables registration, search, unlock and admin actions; no table data is touched.
drop function if exists public.admin_set_candidate_flag(uuid, text, boolean);
drop function if exists public.admin_set_employer_status(uuid, text);
drop function if exists public.admin_list_candidates();
drop function if exists public.admin_list_employers();
drop function if exists public.admin_stats();
drop function if exists public.apply_to_job(uuid);
drop function if exists public.list_my_applications();
drop function if exists public.list_jobs(text);
drop function if exists public.unlock_candidate(uuid);
drop function if exists public.list_unlocked(timestamptz, uuid, integer);
drop function if exists public.search_candidates(text, integer, text, integer, text, boolean, text, timestamptz, uuid, integer);
drop function if exists public.get_my_employer();
drop function if exists public.register_account(text);
drop function if exists private.employer_stats(uuid);
drop function if exists private.is_admin();
drop function if exists private.require_uid();
