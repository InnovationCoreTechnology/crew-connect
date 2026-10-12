-- Own OTP + account creation (replaces Supabase's phone provider / Twilio).
-- WHY: Supabase's Phone provider cannot be enabled without credentials from one of its listed SMS providers, and MSG91
--      is not one of them. So login no longer uses Supabase phone auth at all:
--        * a person's login is a hidden email-style identity "<10 digits>@users.crewconnect.invalid" + password
--          (verified 2026-10-11: password login for such a user works with no phone provider),
--        * the OTP that proves a mobile number (register / forgot password) is generated, stored hashed, rate-limited and
--          checked HERE, and sent by the Edge Function `account-auth` through an SMS gateway (MSG91 later).
-- All functions below are callable ONLY by the server (role service_role = the Edge Function), never by the browser.
-- Sources (official, checked 2026-10-11): Securing your API (grants for functions), Edge Functions secrets/auth pages.
-- Rollback: supabase/rollback/20261011140000_own_otp_accounts.down.sql

-- Tunable numbers (the server trusts these; clients cannot write them). Change with SQL.
insert into public.app_settings (key, value) values
  ('otp_expiry_seconds', 300),         -- a code is valid for 5 minutes (SMS can arrive late)
  ('otp_resend_seconds', 60),          -- minimum gap between two codes for the same number
  ('otp_max_sends_per_hour', 5),       -- per number: stops SMS bombing a victim and cost abuse
  ('otp_global_sends_per_hour', 300),  -- whole project: hard cap on SMS spend per hour
  ('otp_max_attempts', 5)              -- wrong guesses allowed per code before it is locked
on conflict (key) do nothing;

-- One row per issued code. The code itself is stored only as a bcrypt hash.
create table private.otp_codes (
  id          bigint generated always as identity primary key,
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  purpose     text not null check (purpose in ('register', 'reset')),
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index otp_codes_phone_created_idx on private.otp_codes (phone, created_at desc);
create index otp_codes_created_idx on private.otp_codes (created_at desc);
alter table private.otp_codes enable row level security;

-- DEV ONLY mechanism: numbers listed here get the fixed code 123456 and NO SMS is sent, so the OTP screens can be
-- tried before an SMS gateway exists. In production this table must stay EMPTY (it is filled only by supabase/seed/dev_seed.sql).
create table private.test_phones (
  phone text primary key check (phone ~ '^[6-9][0-9]{9}$')
);
alter table private.test_phones enable row level security;

-- ---------------------------------------------------------------------------
-- Is this a dev test number? (used by the Edge Function to decide whether an SMS must be sent)
-- ---------------------------------------------------------------------------
create function public.auth_is_test_phone(p_phone text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.test_phones t where t.phone = p_phone);
$$;

-- ---------------------------------------------------------------------------
-- Issue a code. Raises: ALREADY_REGISTERED / NOT_REGISTERED / RATE_LIMITED / INVALID_INPUT.
-- Returns the plain code ONCE, to the Edge Function, which texts it; it is never stored in plain form.
-- ---------------------------------------------------------------------------
create function public.auth_otp_issue(p_phone text, p_purpose text)
returns table (code text, is_test boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_expiry   integer := (select s.value from public.app_settings s where s.key = 'otp_expiry_seconds');
  v_resend   integer := (select s.value from public.app_settings s where s.key = 'otp_resend_seconds');
  v_per_hour integer := (select s.value from public.app_settings s where s.key = 'otp_max_sends_per_hour');
  v_global   integer := (select s.value from public.app_settings s where s.key = 'otp_global_sends_per_hour');
  v_test     boolean;
  v_code     text;
  v_bytes    bytea;
begin
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' or p_purpose not in ('register', 'reset') then
    raise exception 'INVALID_INPUT';
  end if;

  if p_purpose = 'register' and exists (select 1 from public.profiles p where p.phone = p_phone) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  if p_purpose = 'reset' and not exists (select 1 from public.profiles p where p.phone = p_phone) then
    raise exception 'NOT_REGISTERED';
  end if;

  -- Rate limits, in order: gap between codes, codes per hour for this number, codes per hour for the whole project.
  if exists (select 1 from private.otp_codes o where o.phone = p_phone and o.created_at > now() - make_interval(secs => v_resend)) then
    raise exception 'RATE_LIMITED';
  end if;
  if (select count(*) from private.otp_codes o where o.phone = p_phone and o.created_at > now() - interval '1 hour') >= v_per_hour then
    raise exception 'RATE_LIMITED';
  end if;
  if (select count(*) from private.otp_codes o where o.created_at > now() - interval '1 hour') >= v_global then
    raise exception 'RATE_LIMITED';
  end if;

  v_test := exists (select 1 from private.test_phones t where t.phone = p_phone);
  if v_test then
    v_code := '123456';
  else
    -- 4 random bytes -> number -> 6 digits (cryptographic randomness from pgcrypto)
    v_bytes := extensions.gen_random_bytes(4);
    v_code := lpad(((get_byte(v_bytes, 0)::bigint * 16777216 + get_byte(v_bytes, 1) * 65536 + get_byte(v_bytes, 2) * 256 + get_byte(v_bytes, 3)) % 1000000)::text, 6, '0');
  end if;

  -- Only the newest code works: retire older unused ones for this number + purpose.
  update private.otp_codes o set consumed_at = now() where o.phone = p_phone and o.purpose = p_purpose and o.consumed_at is null;
  insert into private.otp_codes (phone, purpose, code_hash, expires_at)
  values (p_phone, p_purpose, extensions.crypt(v_code, extensions.gen_salt('bf', 6)), now() + make_interval(secs => v_expiry));

  return query select v_code, v_test;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check a code. Returns 'OK' | 'INVALID_OTP' | 'OTP_EXPIRED' | 'LOCKED'. It RETURNS a status instead of raising, because a
-- raised error would roll back the attempt counter and allow unlimited guessing.
-- p_consume = true marks the code as used (it then never works again).
-- ---------------------------------------------------------------------------
create function public.auth_otp_check(p_phone text, p_purpose text, p_code text, p_consume boolean default false)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := (select s.value from public.app_settings s where s.key = 'otp_max_attempts');
  r     private.otp_codes%rowtype;
begin
  select * into r from private.otp_codes o
   where o.phone = p_phone and o.purpose = p_purpose and o.consumed_at is null
   order by o.created_at desc limit 1
   for update;
  if not found or r.expires_at <= now() then
    return 'OTP_EXPIRED';
  end if;
  if r.attempts >= v_max then
    return 'LOCKED';
  end if;

  if p_code is null or p_code !~ '^[0-9]{6}$' or extensions.crypt(p_code, r.code_hash) <> r.code_hash then
    update private.otp_codes o set attempts = o.attempts + 1 where o.id = r.id;
    return 'INVALID_OTP';
  end if;

  if p_consume then
    update private.otp_codes o set consumed_at = now() where o.id = r.id;
  end if;
  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- Account creation (server only). Replaces the browser-callable register_account(): the profile + role row are
-- now created by the Edge Function AFTER the OTP was verified, with the phone number the OTP proved.
-- ---------------------------------------------------------------------------
create function public.auth_create_account(p_user_id uuid, p_phone text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_free integer;
begin
  if p_role not in ('candidate', 'employer') then
    raise exception 'INVALID_ROLE'; -- 'admin' can never be created this way
  end if;
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  insert into public.profiles (id, role, phone) values (p_user_id, p_role, p_phone);

  if p_role = 'candidate' then
    insert into public.candidates (id, phone_masked)
    values (p_user_id, left(p_phone, 2) || 'XXXXX' || substr(p_phone, 8));
  else
    select s.value into v_free from public.app_settings s where s.key = 'free_unlocks_new_employer';
    insert into public.employers (id, free_unlocks_left) values (p_user_id, coalesce(v_free, 0));
  end if;
exception
  when unique_violation then
    raise exception 'ALREADY_REGISTERED';
end;
$$;

-- The login id of a registered number (used by password reset).
create function public.auth_find_user(p_phone text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p where p.phone = p_phone;
$$;

-- The old browser-callable registration is replaced by the server-side flow above.
drop function public.register_account(text);

-- ---------------------------------------------------------------------------
-- Who may call: ONLY the server (service_role). Browsers (anon / authenticated) get nothing.
-- ---------------------------------------------------------------------------
revoke all on function public.auth_is_test_phone(text) from public, anon, authenticated;
revoke all on function public.auth_otp_issue(text, text) from public, anon, authenticated;
revoke all on function public.auth_otp_check(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.auth_create_account(uuid, text, text) from public, anon, authenticated;
revoke all on function public.auth_find_user(text) from public, anon, authenticated;
grant execute on function public.auth_is_test_phone(text) to service_role;
grant execute on function public.auth_otp_issue(text, text) to service_role;
grant execute on function public.auth_otp_check(text, text, text, boolean) to service_role;
grant execute on function public.auth_create_account(uuid, text, text) to service_role;
grant execute on function public.auth_find_user(text) to service_role;
