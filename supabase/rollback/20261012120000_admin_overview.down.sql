-- Reversal for 20261012120000_admin_overview.sql (apply as a NEW forward migration).
-- Removes the Overview function only; no data is touched. The admin dashboard of the previous release keeps working
-- (it uses admin_stats, which this migration did not change).
drop function if exists public.admin_overview(timestamptz, timestamptz);
