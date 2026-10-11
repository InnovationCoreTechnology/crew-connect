-- Phase 1.6 – server-side rules as database functions.
-- WHY: anything that costs money or reveals private data (unlock, phone numbers, admin actions) runs here as ONE
--      transaction under the database's control. The browser can only ask; it cannot decide.
-- HOW: these are SECURITY DEFINER functions (run with the owner's rights, so they can read tables the caller cannot)
--      with `set search_path = ''` (every object is schema-qualified, so a caller cannot hijack names).
--      Each function checks who is calling itself, then EXECUTE is granted only to `authenticated`.
-- Errors are raised as short codes (NOT_APPROVED, NOT_FOUND, …); web/src/data/api.ts maps them to messages.
-- Sources (official, checked 2026-10-11):
--   Securing the API / functions   https://supabase.com/docs/guides/api/securing-your-api
--   Security definer functions     https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions
-- Rollback: supabase/rollback/20261011130200_functions.down.sql

-- ---------------------------------------------------------------------------
-- Helpers (schema `private`: not reachable from the API)
-- ---------------------------------------------------------------------------
create function private.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'FORBIDDEN';
  end if;
  return v_uid;
end;
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

-- Counters shown in the employer's header cards. `spent_inr` is derived from the append-only ledger,
-- so it cannot drift from the real charges.
create function private.employer_stats(p_employer_id uuid)
returns table (free_unlocks_left integer, spent_inr integer, unlocked_count integer)
language sql stable security definer set search_path = '' as $$
  select e.free_unlocks_left,
         coalesce((select -sum(l.amount_inr) from public.wallet_ledger l
                    where l.employer_id = e.id and l.reason = 'unlock'), 0)::integer,
         (select count(*) from public.unlocks u where u.employer_id = e.id)::integer
    from public.employers e
   where e.id = p_employer_id;
$$;

-- ---------------------------------------------------------------------------
-- Registration: creates the profile + the role row. The ONLY way a role is assigned from the app.
-- 'admin' can never be requested here; admins are created by the owner (supabase/admin/create_admin.sql).
-- Phone comes from the verified login (auth.users), never from the client.
-- ---------------------------------------------------------------------------
create function public.register_account(p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := private.require_uid();
  v_auth  text;
  v_phone text;
  v_free  integer;
begin
  if p_role not in ('candidate', 'employer') then
    raise exception 'INVALID_ROLE';
  end if;

  select u.phone into v_auth from auth.users u where u.id = v_uid;
  -- Only Indian numbers: country code 91 followed by a 10-digit mobile number.
  -- (the optional "+" covers either way Auth may store the number)
  if v_auth is null or v_auth !~ '^\+?91[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;
  v_phone := right(v_auth, 10);

  insert into public.profiles (id, role, phone) values (v_uid, p_role, v_phone);

  if p_role = 'candidate' then
    -- "98XXXXX123": first 2 digits + XXXXX + last 3 (same shape as maskPhone() used before).
    insert into public.candidates (id, phone_masked)
    values (v_uid, left(v_phone, 2) || 'XXXXX' || substr(v_phone, 8));
  else
    select s.value into v_free from public.app_settings s where s.key = 'free_unlocks_new_employer';
    insert into public.employers (id, free_unlocks_left) values (v_uid, coalesce(v_free, 0));
  end if;
exception
  when unique_violation then
    raise exception 'ALREADY_REGISTERED'; -- two taps at once, or the number is already registered
end;
$$;

-- ---------------------------------------------------------------------------
-- Employer: own account (with counters)
-- ---------------------------------------------------------------------------
create function public.get_my_employer()
returns table (id uuid, company_name text, status text, free_unlocks_left integer, spent_inr integer, unlocked_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  return query
    select e.id, e.company_name, e.status, s.free_unlocks_left, s.spent_inr, s.unlocked_count
      from public.employers e
     cross join lateral private.employer_stats(e.id) s
     where e.id = v_uid;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Employer: search candidates.
-- * Only rows employers may see (visible = named and not blocked).
-- * Phone is returned ONLY for candidates this employer already unlocked.
-- * Keyset pagination: pass the last row's (created_at, id) as the cursor. Cost stays flat on page 1000
--   (OFFSET would re-scan every skipped row). Returns up to p_limit + 1 rows: the extra row means "more pages".
-- ---------------------------------------------------------------------------
create function public.search_candidates(
  p_type text default null,
  p_min_exp integer default 0,
  p_area text default null,
  p_max_salary integer default 0,           -- 0 = any
  p_shift text default null,                -- a Day/Night search also matches candidates who work 'Any' shift
  p_verified_only boolean default false,
  p_query text default '',
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid, name text, type text, exp integer, area text, salary integer, shift text, avail text,
  verified boolean, phone_masked text, phone text, unlocked boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := private.require_uid();
  v_query text := btrim(coalesce(p_query, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
begin
  if not exists (select 1 from public.employers e where e.id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;

  return query
    select c.id, c.name, c.type, c.exp::integer, c.area, c.salary, c.shift, c.avail,
           c.verified, c.phone_masked,
           case when u.candidate_id is not null then pr.phone end,
           (u.candidate_id is not null),
           c.created_at
      from public.candidates c
      left join public.unlocks u on u.employer_id = v_uid and u.candidate_id = c.id
      left join public.profiles pr on pr.id = c.id and u.candidate_id is not null
     where c.visible
       and (p_type is null or c.type = p_type)
       and c.exp >= coalesce(p_min_exp, 0)
       and (p_area is null or c.area = p_area)
       and (coalesce(p_max_salary, 0) = 0 or c.salary <= p_max_salary)
       and (p_shift is null or c.shift = p_shift or c.shift = 'Any')
       and (not coalesce(p_verified_only, false) or c.verified)
       and (v_query = '' or c.name ilike '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%')
       and (p_after_created_at is null or (c.created_at, c.id) < (p_after_created_at, p_after_id))
     order by c.created_at desc, c.id desc
     limit v_limit + 1;
end;
$$;

-- Employer: the candidates this employer unlocked (newest first), with phone numbers. Same paging contract.
create function public.list_unlocked(
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid, name text, type text, exp integer, area text, salary integer, shift text, avail text,
  verified boolean, phone_masked text, phone text, unlocked boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := private.require_uid();
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
begin
  if not exists (select 1 from public.employers e where e.id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;

  return query
    select c.id, c.name, c.type, c.exp::integer, c.area, c.salary, c.shift, c.avail,
           c.verified, c.phone_masked, pr.phone, true, u.created_at
      from public.unlocks u
      join public.candidates c on c.id = u.candidate_id
      join public.profiles pr on pr.id = c.id
     where u.employer_id = v_uid
       and (p_after_created_at is null or (u.created_at, u.candidate_id) < (p_after_created_at, p_after_id))
     order by u.created_at desc, u.candidate_id desc
     limit v_limit + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- THE REVENUE RULE: unlock a candidate's phone number.
-- One transaction. The employer's row is locked (FOR UPDATE) so two simultaneous taps cannot both use the
-- last free unlock; the (employer_id, candidate_id) primary key stops a second charge for the same candidate.
-- Unlocking again is free and returns the same number (idempotent).
-- NOTE: until Phase 3 (Razorpay wallet) a paid unlock is only RECORDED in the ledger; no money is collected yet.
-- ---------------------------------------------------------------------------
create function public.unlock_candidate(p_candidate_id uuid)
returns table (phone text, free_unlocks_left integer, spent_inr integer, unlocked_count integer, charged boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := private.require_uid();
  v_status  text;
  v_free    integer;
  v_phone   text;
  v_price   integer;
  v_charged boolean := false;
begin
  select e.status, e.free_unlocks_left into v_status, v_free
    from public.employers e where e.id = v_uid for update;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'Approved' then
    raise exception 'NOT_APPROVED';
  end if;

  select pr.phone into v_phone
    from public.candidates c join public.profiles pr on pr.id = c.id
   where c.id = p_candidate_id and c.visible;
  if v_phone is null then
    raise exception 'NOT_FOUND';
  end if;

  if not exists (select 1 from public.unlocks u where u.employer_id = v_uid and u.candidate_id = p_candidate_id) then
    if v_free > 0 then
      update public.employers e set free_unlocks_left = e.free_unlocks_left - 1 where e.id = v_uid;
    else
      select s.value into v_price from public.app_settings s where s.key = 'price_per_unlock_inr';
      insert into public.wallet_ledger (employer_id, amount_inr, reason, candidate_id)
      values (v_uid, -coalesce(v_price, 0), 'unlock', p_candidate_id);
      v_charged := true;
    end if;
    insert into public.unlocks (employer_id, candidate_id) values (v_uid, p_candidate_id);
  end if;

  return query
    select v_phone, s.free_unlocks_left, s.spent_inr, s.unlocked_count, v_charged
      from private.employer_stats(v_uid) s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Candidate: jobs and applications
-- ---------------------------------------------------------------------------
-- Only jobs of APPROVED employers are listed. Capped at 100 until job paging is built (roadmap 4.5).
create function public.list_jobs(p_type text default null)
returns table (
  id uuid, title text, type text, area text, salary integer, shift text, openings integer,
  company_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  return query
    select j.id, j.title, j.type, j.area, j.salary, j.shift, j.openings::integer, e.company_name, j.created_at
      from public.jobs j
      join public.employers e on e.id = j.employer_id
     where e.status = 'Approved'
       and (p_type is null or j.type = p_type)
     order by j.created_at desc, j.id desc
     limit 100;
end;
$$;

create function public.list_my_applications()
returns table (
  id uuid, title text, type text, area text, salary integer, shift text, openings integer,
  company_name text, status text, applied_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_uid();
begin
  return query
    select j.id, j.title, j.type, j.area, j.salary, j.shift, j.openings::integer,
           e.company_name, a.status, a.created_at
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.employers e on e.id = j.employer_id
     where a.candidate_id = v_uid
     order by a.created_at desc, a.job_id desc
     limit 200;
end;
$$;

create function public.apply_to_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := private.require_uid();
  v_blocked boolean;
  v_name    text;
begin
  select c.blocked, c.name into v_blocked, v_name from public.candidates c where c.id = v_uid;
  if not found then
    raise exception 'FORBIDDEN';
  end if;
  if v_blocked then
    raise exception 'BLOCKED';
  end if;
  if char_length(btrim(v_name)) < 2 then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  if not exists (select 1 from public.jobs j join public.employers e on e.id = j.employer_id
                  where j.id = p_job_id and e.status = 'Approved') then
    raise exception 'NOT_FOUND';
  end if;
  insert into public.applications (job_id, candidate_id) values (p_job_id, v_uid)
  on conflict do nothing; -- applying twice is a no-op
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin (every function checks private.is_admin() first). Lists are capped at 500 newest rows; the extra
-- 501st row tells the screen the list was cut. Real paging/search for admins comes with the verification queue (Phase 5).
-- ---------------------------------------------------------------------------
create function public.admin_stats()
returns table (
  candidates_count integer, employers_count integer, pending_employers_count integer,
  jobs_count integer, unlocks_count integer, revenue_inr integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select (select count(*) from public.candidates c where c.visible)::integer,
           (select count(*) from public.employers)::integer,
           (select count(*) from public.employers e where e.status = 'Pending')::integer,
           (select count(*) from public.jobs)::integer,
           (select count(*) from public.unlocks)::integer,
           coalesce((select -sum(l.amount_inr) from public.wallet_ledger l where l.reason = 'unlock'), 0)::integer;
end;
$$;

create function public.admin_list_employers()
returns table (
  id uuid, phone text, company_name text, status text, free_unlocks_left integer, spent_inr integer, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select e.id, pr.phone, e.company_name, e.status, e.free_unlocks_left,
           coalesce((select -sum(l.amount_inr) from public.wallet_ledger l
                      where l.employer_id = e.id and l.reason = 'unlock'), 0)::integer,
           e.created_at
      from public.employers e
      join public.profiles pr on pr.id = e.id
     order by e.created_at desc, e.id desc
     limit 501;
end;
$$;

create function public.admin_list_candidates()
returns table (
  id uuid, phone text, name text, type text, exp integer, area text, salary integer, shift text, avail text,
  verified boolean, blocked boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select c.id, pr.phone, c.name, c.type, c.exp::integer, c.area, c.salary, c.shift, c.avail,
           c.verified, c.blocked, c.created_at
      from public.candidates c
      join public.profiles pr on pr.id = c.id
     order by c.created_at desc, c.id desc
     limit 501;
end;
$$;

create function public.admin_set_employer_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_status not in ('Pending', 'Approved', 'Blocked') then
    raise exception 'INVALID_STATUS';
  end if;
  update public.employers e set status = p_status where e.id = p_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create function public.admin_set_candidate_flag(p_id uuid, p_flag text, p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_flag not in ('verified', 'blocked') or p_value is null then
    raise exception 'INVALID_FLAG';
  end if;
  update public.candidates c
     set verified = case when p_flag = 'verified' then p_value else c.verified end,
         blocked  = case when p_flag = 'blocked'  then p_value else c.blocked  end
   where c.id = p_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: logged-in users only (never anon). The functions then check the caller's role themselves.
-- ---------------------------------------------------------------------------
revoke all on function public.register_account(text) from public, anon;
revoke all on function public.get_my_employer() from public, anon;
revoke all on function public.search_candidates(text, integer, text, integer, text, boolean, text, timestamptz, uuid, integer) from public, anon;
revoke all on function public.list_unlocked(timestamptz, uuid, integer) from public, anon;
revoke all on function public.unlock_candidate(uuid) from public, anon;
revoke all on function public.list_jobs(text) from public, anon;
revoke all on function public.list_my_applications() from public, anon;
revoke all on function public.apply_to_job(uuid) from public, anon;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.admin_list_employers() from public, anon;
revoke all on function public.admin_list_candidates() from public, anon;
revoke all on function public.admin_set_employer_status(uuid, text) from public, anon;
revoke all on function public.admin_set_candidate_flag(uuid, text, boolean) from public, anon;

grant execute on function public.register_account(text) to authenticated;
grant execute on function public.get_my_employer() to authenticated;
grant execute on function public.search_candidates(text, integer, text, integer, text, boolean, text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_unlocked(timestamptz, uuid, integer) to authenticated;
grant execute on function public.unlock_candidate(uuid) to authenticated;
grant execute on function public.list_jobs(text) to authenticated;
grant execute on function public.list_my_applications() to authenticated;
grant execute on function public.apply_to_job(uuid) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_list_employers() to authenticated;
grant execute on function public.admin_list_candidates() to authenticated;
grant execute on function public.admin_set_employer_status(uuid, text) to authenticated;
grant execute on function public.admin_set_candidate_flag(uuid, text, boolean) to authenticated;
