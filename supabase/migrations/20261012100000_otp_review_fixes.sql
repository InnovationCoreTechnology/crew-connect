-- Fixes from the review of PR #6 (own OTP system). Items refer to the numbered findings in that review.
--  2  number-probing: per-IP request limit (hashed IPs) + rate limits now run BEFORE the registered / not-registered checks
--  3  test numbers only work when app_settings.dev_mode = 1 (default 0, so a seed run on production does nothing)
--  4  data retention: old OTP rows and IP hits are deleted automatically (done inside auth_otp_issue; Supabase's cron page
--     does not show the setup SQL, so pg_cron is not used)
--  6  two simultaneous requests for one number can no longer both pass the 60 s gap (advisory lock)
--  1  helper for finishing a half-made account (login without profile)
--  8  helper that ends a user's sessions after a password reset
-- Rollback: supabase/rollback/20261012100000_otp_review_fixes.down.sql

insert into public.app_settings (key, value) values
  ('dev_mode', 0),                           -- 1 = DEV project only: honours private.test_phones (fixed OTP, no SMS). MUST stay 0 in production.
  ('otp_max_requests_per_ip_per_hour', 20),  -- OTP requests per caller IP per hour (checked by the Edge Function)
  ('otp_retention_days', 7)                  -- OTP rows older than this are deleted (personal data should not be kept longer than needed)
on conflict (key) do nothing;

-- Request log per caller. Only a HASH of the IP is stored (sha-256), and rows are deleted after a day.
create table private.otp_ip_hits (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index otp_ip_hits_ip_created_idx on private.otp_ip_hits (ip_hash, created_at desc);
alter table private.otp_ip_hits enable row level security;

-- Test numbers count only on a DEV project (item 3).
create or replace function public.auth_is_test_phone(p_phone text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'dev_mode'), 0) = 1
     and exists (select 1 from private.test_phones t where t.phone = p_phone);
$$;

-- Per-IP limit (item 2). Records the request and answers false when this caller asked too often. A missing IP cannot be limited.
create function public.auth_ip_allow(p_ip text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer := (select s.value from public.app_settings s where s.key = 'otp_max_requests_per_ip_per_hour');
  v_hash  text;
begin
  if p_ip is null or btrim(p_ip) = '' then
    return true;
  end if;
  v_hash := encode(extensions.digest(btrim(p_ip), 'sha256'), 'hex');
  if (select count(*) from private.otp_ip_hits h where h.ip_hash = v_hash and h.created_at > now() - interval '1 hour') >= v_limit then
    return false;
  end if;
  insert into private.otp_ip_hits (ip_hash) values (v_hash);
  return true;
end;
$$;

-- Issue a code. Same contract as before; changes: advisory lock (6), purge of old rows (4), rate limits first (2), dev_mode (3).
create or replace function public.auth_otp_issue(p_phone text, p_purpose text)
returns table (code text, is_test boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_expiry    integer := (select s.value from public.app_settings s where s.key = 'otp_expiry_seconds');
  v_resend    integer := (select s.value from public.app_settings s where s.key = 'otp_resend_seconds');
  v_per_hour  integer := (select s.value from public.app_settings s where s.key = 'otp_max_sends_per_hour');
  v_global    integer := (select s.value from public.app_settings s where s.key = 'otp_global_sends_per_hour');
  v_retention integer := (select s.value from public.app_settings s where s.key = 'otp_retention_days');
  v_test      boolean;
  v_code      text;
  v_bytes     bytea;
begin
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' or p_purpose not in ('register', 'reset') then
    raise exception 'INVALID_INPUT';
  end if;

  -- One request per number at a time: without this, two simultaneous requests could both pass the 60 s gap below.
  perform pg_advisory_xact_lock(hashtext(p_phone));

  -- Keep personal data only as long as needed.
  delete from private.otp_codes o where o.created_at < now() - make_interval(days => coalesce(v_retention, 7));
  delete from private.otp_ip_hits h where h.created_at < now() - interval '1 day';

  -- Rate limits FIRST, so they also apply to "is this number registered?" probing.
  if exists (select 1 from private.otp_codes o where o.phone = p_phone and o.created_at > now() - make_interval(secs => v_resend)) then
    raise exception 'RATE_LIMITED';
  end if;
  if (select count(*) from private.otp_codes o where o.phone = p_phone and o.created_at > now() - interval '1 hour') >= v_per_hour then
    raise exception 'RATE_LIMITED';
  end if;
  if (select count(*) from private.otp_codes o where o.created_at > now() - interval '1 hour') >= v_global then
    raise exception 'RATE_LIMITED';
  end if;

  if p_purpose = 'register' and exists (select 1 from public.profiles p where p.phone = p_phone) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  if p_purpose = 'reset' and not exists (select 1 from public.profiles p where p.phone = p_phone) then
    raise exception 'NOT_REGISTERED';
  end if;

  v_test := public.auth_is_test_phone(p_phone);
  if v_test then
    v_code := '123456';
  else
    v_bytes := extensions.gen_random_bytes(4);
    v_code := lpad(((get_byte(v_bytes, 0)::bigint * 16777216 + get_byte(v_bytes, 1) * 65536 + get_byte(v_bytes, 2) * 256 + get_byte(v_bytes, 3)) % 1000000)::text, 6, '0');
  end if;

  update private.otp_codes o set consumed_at = now() where o.phone = p_phone and o.purpose = p_purpose and o.consumed_at is null;
  insert into private.otp_codes (phone, purpose, code_hash, expires_at)
  values (p_phone, p_purpose, extensions.crypt(v_code, extensions.gen_salt('bf', 6)), now() + make_interval(secs => v_expiry));

  return query select v_code, v_test;
end;
$$;

-- A login that exists but has no account (a registration that failed half-way). Used to finish it instead of locking the person out (item 1).
create function public.auth_find_orphan_login(p_phone text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
   where u.email = p_phone || '@users.crewconnect.invalid'
     and not exists (select 1 from public.profiles p where p.id = u.id);
$$;

-- End every session of a user (item 8). Called after a password reset so a stolen old login stops working.
-- NOTE: an access token that was already issued stays valid until it expires (default 1 hour); refresh tokens die with the session.
create function public.auth_revoke_sessions(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions s where s.user_id = p_user_id;
$$;

revoke all on function public.auth_ip_allow(text) from public, anon, authenticated;
revoke all on function public.auth_find_orphan_login(text) from public, anon, authenticated;
revoke all on function public.auth_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.auth_ip_allow(text) to service_role;
grant execute on function public.auth_find_orphan_login(text) to service_role;
grant execute on function public.auth_revoke_sessions(uuid) to service_role;
