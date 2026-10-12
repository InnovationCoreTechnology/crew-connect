-- Reversal for 20261012100000_otp_review_fixes.sql (apply as a NEW forward migration).
-- Restores the previous definitions of auth_is_test_phone() and auth_otp_issue() and removes the review-fix objects.
-- WARNING: dropping private.otp_ip_hits deletes the hashed IP request log (harmless). This brings back the findings of the review.

drop function if exists public.auth_revoke_sessions(uuid);
drop function if exists public.auth_find_orphan_login(text);
drop function if exists public.auth_ip_allow(text);
drop table if exists private.otp_ip_hits;
delete from public.app_settings where key in ('dev_mode', 'otp_max_requests_per_ip_per_hour', 'otp_retention_days');

create or replace function public.auth_is_test_phone(p_phone text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.test_phones t where t.phone = p_phone);
$$;

create or replace function public.auth_otp_issue(p_phone text, p_purpose text)
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
