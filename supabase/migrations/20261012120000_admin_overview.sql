-- Admin dashboard v2, step 1: the Overview numbers (roadmap 4.8, design: docs/ADMIN_DASHBOARD.md).
-- WHY: the admin wants to see how many companies, candidates, jobs, applications and unlocks exist and how many are new in a
--      period. The browser must not add rows up itself, so ONE server function returns all totals in one call.
-- WHAT: public.admin_overview(p_from, p_to). Totals are always all-time; the "new_*" numbers count rows created in
--       [p_from, p_to) (p_from inclusive, p_to exclusive, null = no bound). Admin only (same check as admin_stats).
--       "revenue" is the sum of unlock charges in wallet_ledger = internal DEMO CREDITS until real payments exist (Phase 3).
-- COST: five aggregate scans, each reading one table once (FILTER clauses, no joins). Fine at today's size; if a table grows
--       to millions of rows, add the daily summary table described in docs/ADMIN_DASHBOARD.md section 4.
-- Rollback: supabase/rollback/20261012120000_admin_overview.down.sql

create function public.admin_overview(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  candidates_total integer, candidates_visible integer, candidates_new integer,
  employers_total integer, employers_approved integer, employers_pending integer, employers_blocked integer, employers_new integer,
  jobs_total integer, jobs_new integer,
  applications_total integer, applications_new integer,
  unlocks_total integer, unlocks_new integer,
  revenue_total_inr integer, revenue_range_inr integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'INVALID_RANGE';
  end if;
  return query
    select
      (select count(*) from public.candidates)::integer,
      (select count(*) from public.candidates c where c.visible)::integer,
      (select count(*) from public.candidates c where (p_from is null or c.created_at >= p_from) and (p_to is null or c.created_at < p_to))::integer,
      (select count(*) from public.employers)::integer,
      (select count(*) from public.employers e where e.status = 'Approved')::integer,
      (select count(*) from public.employers e where e.status = 'Pending')::integer,
      (select count(*) from public.employers e where e.status = 'Blocked')::integer,
      (select count(*) from public.employers e where (p_from is null or e.created_at >= p_from) and (p_to is null or e.created_at < p_to))::integer,
      (select count(*) from public.jobs)::integer,
      (select count(*) from public.jobs j where (p_from is null or j.created_at >= p_from) and (p_to is null or j.created_at < p_to))::integer,
      (select count(*) from public.applications)::integer,
      (select count(*) from public.applications a where (p_from is null or a.created_at >= p_from) and (p_to is null or a.created_at < p_to))::integer,
      (select count(*) from public.unlocks)::integer,
      (select count(*) from public.unlocks u where (p_from is null or u.created_at >= p_from) and (p_to is null or u.created_at < p_to))::integer,
      coalesce((select -sum(l.amount_inr) from public.wallet_ledger l where l.reason = 'unlock'), 0)::integer,
      coalesce((select -sum(l.amount_inr) from public.wallet_ledger l
                 where l.reason = 'unlock' and (p_from is null or l.created_at >= p_from) and (p_to is null or l.created_at < p_to)), 0)::integer;
end;
$$;

revoke all on function public.admin_overview(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_overview(timestamptz, timestamptz) to authenticated;
