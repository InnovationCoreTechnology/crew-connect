-- Create an ADMIN (roadmap 1.10). Admins can never be created from the app: register_account() refuses role 'admin'.
-- Run this by hand in the Supabase SQL editor, once per admin, AFTER that person has logged in once with their phone.
--
-- STEPS
--  1. The admin opens the app and completes the phone OTP once. (Login mode cannot create the user, so for the very first
--     admin use Register -> choose either role -> finish. This creates the login AND a normal profile.)
--  2. Replace the number below (10 digits, no +91) and run this script. It turns that profile into an admin.
--  3. The admin logs out and in again; the app now opens /admin.
--
-- ROLLBACK: run the commented block at the bottom (it turns the admin back into a normal candidate).
-- Never share this script's output or give admin to a number you cannot verify belongs to the person.

do $$
declare
  v_phone text := '9XXXXXXXXX'; -- <-- CHANGE THIS (10-digit mobile number of the admin)
  v_id    uuid;
begin
  select p.id into v_id from public.profiles p where p.phone = v_phone;
  if v_id is null then
    raise exception 'No profile for % - the person must complete the OTP login/registration once first.', v_phone;
  end if;

  -- An admin has no candidate/employer data: remove the role row that registration created.
  delete from public.candidates where id = v_id;
  delete from public.employers where id = v_id; -- fails if this number already has money history (wallet_ledger): use another number
  update public.profiles set role = 'admin' where id = v_id;
end $$;

-- ROLLBACK (turn the admin back into a candidate):
-- update public.profiles set role = 'candidate' where phone = '9XXXXXXXXX';
-- insert into public.candidates (id, phone_masked)
--   select id, left(phone, 2) || 'XXXXX' || substr(phone, 8) from public.profiles where phone = '9XXXXXXXXX';
