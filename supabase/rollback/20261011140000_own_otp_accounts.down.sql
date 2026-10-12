-- Reversal for 20261011140000_own_otp_accounts.sql (apply as a NEW forward migration).
-- WARNING: dropping private.otp_codes deletes pending codes (harmless). Accounts created through the new flow are NOT touched,
-- but they have email-style logins that the old register_account() / Supabase phone login cannot use.

drop function if exists public.auth_find_user(text);
drop function if exists public.auth_create_account(uuid, text, text);
drop function if exists public.auth_otp_check(text, text, text, boolean);
drop function if exists public.auth_otp_issue(text, text);
drop function if exists public.auth_is_test_phone(text);
drop table if exists private.test_phones;
drop table if exists private.otp_codes;
delete from public.app_settings where key in
  ('otp_expiry_seconds', 'otp_resend_seconds', 'otp_max_sends_per_hour', 'otp_global_sends_per_hour', 'otp_max_attempts');

-- Restore the browser-callable registration exactly as it was in 20261011130200_functions.sql
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
  if v_auth is null or v_auth !~ '^\+?91[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;
  v_phone := right(v_auth, 10);

  insert into public.profiles (id, role, phone) values (v_uid, p_role, v_phone);

  if p_role = 'candidate' then
    insert into public.candidates (id, phone_masked)
    values (v_uid, left(v_phone, 2) || 'XXXXX' || substr(v_phone, 8));
  else
    select s.value into v_free from public.app_settings s where s.key = 'free_unlocks_new_employer';
    insert into public.employers (id, free_unlocks_left) values (v_uid, coalesce(v_free, 0));
  end if;
exception
  when unique_violation then
    raise exception 'ALREADY_REGISTERED';
end;
$$;
revoke all on function public.register_account(text) from public, anon;
grant execute on function public.register_account(text) to authenticated;
