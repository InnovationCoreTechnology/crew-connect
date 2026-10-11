-- DEV-ONLY test data (roadmap 1.11). Creates fake logins WITH passwords so every role can be tried without SMS.
-- Safe to run again: it creates only what is missing (existing phone numbers are skipped, existing rows are kept).
--
-- BEFORE RUNNING: replace the three placeholders below with strong passwords of your own (one per role), and keep
-- them in a git-ignored file (for example web/.seed-credentials.local). NEVER commit a real password into this file.
--   __CANDIDATE_PASSWORD__   __EMPLOYER_PASSWORD__   __ADMIN_PASSWORD__
-- The other fake people get random passwords nobody knows. Only run this on the DEV project.
--
-- HOW the logins are made: rows are inserted into auth.users / auth.identities by hand with a bcrypt hash
-- (extensions.crypt). This is NOT an officially documented way; the supported alternative is the Auth Admin API
-- (https://supabase.com/docs/reference/javascript/auth-admin-createuser). UNVERIFIED that Supabase Auth accepts these rows
-- until a login has been tried with the Phone provider enabled.
--
-- Accounts (mobile -> role): 9845000001 candidate (full profile, 1 application) · 9845000003 candidate (EMPTY profile)
--   9845000002 employer (Approved, 3 free unlocks) · 9900000002 employer (Pending) · 9845000000 admin
-- ROLLBACK: delete from auth.users where phone in ('91' || <each seeded mobile>);  (profiles, candidates, employers,
--   jobs and applications are removed by cascade; an employer that already has wallet_ledger rows cannot be deleted).

do $seed$
declare
  p_cand text := '__CANDIDATE_PASSWORD__';
  p_emp  text := '__EMPLOYER_PASSWORD__';
  p_adm  text := '__ADMIN_PASSWORD__';
  names  text[] := array['Ravi Kumar','Suresh Gowda','Manjunath R','Lakshmi Devi','Anita Kumari','Mohammed Irfan','Prakash S','Savitha M','Ramesh Naik','Geetha B','Venkatesh P','Shanthi K','Arun Raj','Nagaraj H','Meena Kumari','Basavaraj L','Pooja S','Imran Khan','Kavitha R','Dinesh Kumar'];
  areas  text[] := array['Whitefield','Koramangala','HSR Layout','Indiranagar','Marathahalli','Electronic City','Jayanagar','Yelahanka'];
  jtypes text[] := array['Security','Housekeeping'];
  shifts text[] := array['Day','Night','Any'];
begin
  if p_cand like '\_\_%' or p_emp like '\_\_%' or p_adm like '\_\_%' then
    raise exception 'Replace the three __PASSWORD__ placeholders first.';
  end if;

  create temp table seed_accounts (phone text primary key, role text not null, pw text not null, id uuid not null default gen_random_uuid()) on commit drop;
  create temp table seed_cand (phone text, name text, type text, exp int, area text, salary int, shift text, avail text, verified boolean) on commit drop;

  insert into seed_cand
  select case when i = 0 then '9845000001' else '98' || (45000000 + i * 137911)::text end,
         names[i + 1], jtypes[(i % 2) + 1], (i * 3) % 11, areas[((i * 5) % 8) + 1], (12 + ((i * 7) % 9)) * 1000,
         shifts[(i % 3) + 1], case when i % 4 <> 0 then 'Immediate' else '15 days' end, (i % 3 <> 1)
    from generate_series(0, 19) i;
  insert into seed_cand values ('9845000003', '', 'Security', 0, 'Whitefield', 15000, 'Any', 'Immediate', false);

  insert into seed_accounts (phone, role, pw)
    select phone, 'candidate', case when phone in ('9845000001', '9845000003') then p_cand else gen_random_uuid()::text end from seed_cand;
  insert into seed_accounts (phone, role, pw) values
    ('9845000002', 'employer', p_emp), ('9900000002', 'employer', p_emp),
    ('9900000003', 'employer', gen_random_uuid()::text), ('9900000004', 'employer', gen_random_uuid()::text),
    ('9845000000', 'admin', p_adm);

  insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, phone_change,
                          phone_change_token, reauthentication_token, email_change_token_current)
    select '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated', '91' || s.phone, now(),
           extensions.crypt(s.pw, extensions.gen_salt('bf')), '{"provider":"phone","providers":["phone"]}', '{}',
           now(), now(), '', '', '', '', '', '', '', ''  -- empty strings, not NULL: Auth fails to read NULL token columns
      from seed_accounts s
     where not exists (select 1 from auth.users u where u.phone = '91' || s.phone);

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.phone, 'phone',
           json_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true)::jsonb, now(), now(), now()
      from seed_accounts s join auth.users u on u.phone = '91' || s.phone
     where not exists (select 1 from auth.identities i where i.user_id = u.id);

  insert into public.profiles (id, role, phone)
    select u.id, s.role, s.phone from seed_accounts s join auth.users u on u.phone = '91' || s.phone
    on conflict (id) do nothing;

  insert into public.candidates (id, phone_masked, name, type, exp, area, salary, shift, avail, verified)
    select u.id, left(c.phone, 2) || 'XXXXX' || substr(c.phone, 8), c.name, c.type, c.exp, c.area, c.salary, c.shift, c.avail, c.verified
      from seed_cand c join auth.users u on u.phone = '91' || c.phone
    on conflict (id) do nothing;

  insert into public.employers (id, company_name, status, free_unlocks_left)
    select u.id, v.company, v.status, 3
      from (values ('9845000002', 'Prestige Facility Services', 'Approved'), ('9900000002', 'Sunrise Apartments Association', 'Pending'),
                   ('9900000003', 'Metro Housekeeping Co.', 'Pending'), ('9900000004', 'SafeGuard Security Agency', 'Approved')) v(phone, company, status)
      join auth.users u on u.phone = '91' || v.phone
    on conflict (id) do nothing;

  insert into public.jobs (employer_id, title, type, area, salary, shift, openings)
    select u.id, j.title, j.type, j.area, j.salary, j.shift, j.openings
      from (values ('9845000002', 'Security Guard – Apartment Gate', 'Security', 'Whitefield', 18000, 'Night', 4),
                   ('9900000004', 'Security Supervisor', 'Security', 'Koramangala', 24000, 'Day', 1),
                   ('9845000002', 'Housekeeping Staff – Office', 'Housekeeping', 'Marathahalli', 15000, 'Day', 6),
                   ('9900000004', 'Housekeeping Supervisor', 'Housekeeping', 'HSR Layout', 21000, 'Day', 2),
                   ('9900000002', 'Security Guard – Society', 'Security', 'Yelahanka', 16000, 'Any', 3)) j(phone, title, type, area, salary, shift, openings)
      join auth.users u on u.phone = '91' || j.phone
     where not exists (select 1 from public.jobs x where x.employer_id = u.id and x.title = j.title);

  insert into public.applications (job_id, candidate_id, status)
    select j.id, c.id, 'Shortlisted'
      from public.jobs j, auth.users c
     where j.title = 'Security Supervisor' and c.phone = '919845000001'
    on conflict do nothing;
end $seed$;
