-- Database rule tests (Phase 1 + own OTP system). Run in the Supabase SQL editor or via the MCP execute_sql tool.
-- HOW IT WORKS: everything runs inside ONE transaction that is deliberately aborted at the end, so no fixture data
-- is kept. It pretends to be different logged-in users by setting the JWT claims and switching to the real
-- `authenticated` / `anon` Postgres roles, so grants and RLS are exercised exactly as the browser would hit them.
-- RESULT: success = the statement fails with the message "ALL TESTS PASSED (rolled back)".
--         Any other message starting with "FAIL:" names the broken rule.
-- WHEN: after every database migration. (JS unit tests arrive in Phase 2 with Vitest; these cover the server rules.)

do $test$
declare
  v_admin uuid := '00000000-0000-0000-0000-0000000000a0';
  v_e1    uuid := '00000000-0000-0000-0000-0000000000e1'; -- employer, will be approved
  v_e2    uuid := '00000000-0000-0000-0000-0000000000e2'; -- employer, stays Pending
  v_c1    uuid := '00000000-0000-0000-0000-0000000000c1'; -- named candidate
  v_c2    uuid := '00000000-0000-0000-0000-0000000000c2'; -- named candidate
  v_c3    uuid := '00000000-0000-0000-0000-0000000000c3'; -- profile NOT completed (no name)
  v_c4    uuid := '00000000-0000-0000-0000-0000000000c4'; -- named but blocked
  v_x     uuid := '00000000-0000-0000-0000-0000000000f1'; -- non-Indian phone
  v_j1    uuid := '00000000-0000-0000-0000-0000000000b1';
  v_j2    uuid := '00000000-0000-0000-0000-0000000000b2';
  n integer; r record; ov record; t text; v_wrong text; k integer;
  v_raised boolean; v_msg text; v_state text; v_rows integer;
  v_all uuid[] := '{}'; v_cur_at timestamptz; v_cur_id uuid; v_cnt integer; v_iter integer := 0;
begin
  ------------------------------------------------------------------ clean slate (inside this rolled-back transaction)
  delete from auth.users; -- removes any dev seed data so the counts below are exact; undone by the final rollback
  delete from private.otp_codes;
  delete from private.test_phones;

  ------------------------------------------------------------------ fixtures (as the owner)
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (v_admin, 'authenticated', 'authenticated', 't-a0@test.invalid', now(), now(), now()),
    (v_e1,    'authenticated', 'authenticated', 't-e1@test.invalid', now(), now(), now()),
    (v_e2,    'authenticated', 'authenticated', 't-e2@test.invalid', now(), now(), now()),
    (v_c1,    'authenticated', 'authenticated', 't-c1@test.invalid', now(), now(), now()),
    (v_c2,    'authenticated', 'authenticated', 't-c2@test.invalid', now(), now(), now()),
    (v_c3,    'authenticated', 'authenticated', 't-c3@test.invalid', now(), now(), now()),
    (v_c4,    'authenticated', 'authenticated', 't-c4@test.invalid', now(), now(), now()),
    (v_x,     'authenticated', 'authenticated', 't-x@test.invalid',  now(), now(), now());

  ------------------------------------------------------------------ account creation (server-only functions, run here as the owner)
  perform public.auth_create_account(v_c1, '9111000001', 'candidate');
  select c.phone_masked into t from public.candidates c where c.id = v_c1;
  if t is distinct from '91XXXXX001' then raise exception 'FAIL: phone mask is % (want 91XXXXX001)', t; end if;
  select pr.phone into t from public.profiles pr where pr.id = v_c1;
  if t is distinct from '9111000001' then raise exception 'FAIL: stored phone is %', t; end if;

  v_raised := false;
  begin perform public.auth_create_account(v_c1, '9111000001', 'candidate');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'ALREADY_REGISTERED' then raise exception 'FAIL: double registration (got %)', coalesce(v_msg, 'no error'); end if;

  v_raised := false;
  begin perform public.auth_create_account(v_x, '9111000099', 'admin');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'INVALID_ROLE' then raise exception 'FAIL: creating an admin through the account function was not refused (got %)', coalesce(v_msg, 'no error'); end if;
  v_raised := false;
  begin perform public.auth_create_account(v_x, '4155550123', 'candidate');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'INVALID_PHONE' then raise exception 'FAIL: non-Indian phone accepted (got %)', coalesce(v_msg, 'no error'); end if;

  -- browsers (logged in or not) must not be able to call ANY server-only function
  foreach t in array array[
    $$public.auth_is_test_phone('9111000001')$$,
    $$public.auth_otp_issue('9222000050', 'register')$$,
    $$public.auth_otp_check('9222000050', 'register', '123456', false)$$,
    $$public.auth_create_account('00000000-0000-0000-0000-0000000000f1', '9111000098', 'candidate')$$,
    $$public.auth_find_user('9111000001')$$
  ] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_raised := false;
    begin execute 'select ' || t; exception when others then v_raised := true; v_state := sqlstate; end;
    reset role;
    if not v_raised or v_state <> '42501' then raise exception 'FAIL: logged-in browser can call %', t; end if;
    set local role anon;
    v_raised := false;
    begin execute 'select ' || t; exception when others then v_raised := true; v_state := sqlstate; end;
    reset role;
    if not v_raised or v_state <> '42501' then raise exception 'FAIL: anonymous browser can call %', t; end if;
  end loop;

  perform public.auth_create_account(v_c2, '9111000002', 'candidate');
  perform public.auth_create_account(v_c3, '9111000003', 'candidate');
  perform public.auth_create_account(v_c4, '9111000004', 'candidate');
  perform public.auth_create_account(v_e1, '9111000011', 'employer');
  perform public.auth_create_account(v_e2, '9111000012', 'employer');

  select e.free_unlocks_left into n from public.employers e where e.id = v_e1;
  if n <> 3 then raise exception 'FAIL: new employer free unlocks is % (want 3 from app_settings)', n; end if;
  select e.status into t from public.employers e where e.id = v_e1;
  if t <> 'Pending' then raise exception 'FAIL: new employer status is % (want Pending)', t; end if;

  ------------------------------------------------------------------ candidate rights (RLS + column grants)
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.candidates set name = 'Ravi Kumar', type = 'Security', exp = 5, area = 'Whitefield', salary = 18000, shift = 'Night'
   where id = v_c1;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then reset role; raise exception 'FAIL: candidate cannot edit own profile'; end if;

  v_raised := false;
  begin update public.candidates set verified = true where id = v_c1;
  exception when others then v_raised := true; v_state := sqlstate; end;
  if not v_raised or v_state <> '42501' then reset role; raise exception 'FAIL: candidate could self-verify (state %)', coalesce(v_state, 'none'); end if;

  v_raised := false;
  begin update public.candidates set blocked = false, phone_masked = 'X' where id = v_c1;
  exception when others then v_raised := true; v_state := sqlstate; end;
  if not v_raised or v_state <> '42501' then reset role; raise exception 'FAIL: candidate could edit admin-only columns'; end if;

  v_raised := false;
  begin update public.candidates set salary = 200 where id = v_c1;
  exception when others then v_raised := true; v_state := sqlstate; end;
  if not v_raised or v_state <> '23514' then reset role; raise exception 'FAIL: out-of-range salary accepted (state %)', coalesce(v_state, 'none'); end if;

  update public.candidates set name = 'Hacked' where id = v_c2;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then reset role; raise exception 'FAIL: candidate edited ANOTHER candidate'; end if;

  select count(*) into n from public.candidates; -- RLS: own row only
  if n <> 1 then reset role; raise exception 'FAIL: candidate sees % candidate rows (want 1)', n; end if;
  select count(*) into n from public.profiles;
  if n <> 1 then reset role; raise exception 'FAIL: candidate sees % profiles (want 1)', n; end if;

  foreach t in array array['employers', 'wallet_ledger', 'unlocks', 'jobs', 'applications'] loop
    v_raised := false;
    begin execute format('select count(*) from public.%I', t);
    exception when others then v_raised := true; v_state := sqlstate; end;
    if not v_raised or v_state <> '42501' then reset role; raise exception 'FAIL: candidate can read table % directly', t; end if;
  end loop;

  v_raised := false;
  begin insert into public.profiles (id, role, phone) values (v_c1, 'admin', '9111000098');
  exception when others then v_raised := true; v_state := sqlstate; end;
  if not v_raised or v_state <> '42501' then reset role; raise exception 'FAIL: client could insert a profile/role'; end if;

  foreach t in array array['search_candidates()', 'admin_stats()', 'admin_overview()', 'get_my_employer()', 'list_unlocked()'] loop
    v_raised := false;
    begin execute format('select * from public.%s', t);
    exception when others then v_raised := true; v_msg := sqlerrm; end;
    if not v_raised or v_msg <> 'FORBIDDEN' then reset role; raise exception 'FAIL: candidate allowed to call % (got %)', t, coalesce(v_msg, 'no error'); end if;
  end loop;

  v_raised := false;
  begin perform public.admin_set_candidate_flag(v_c1, 'verified', true);
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'FORBIDDEN' then reset role; raise exception 'FAIL: candidate could call admin_set_candidate_flag (got %)', coalesce(v_msg, 'no error'); end if;
  reset role;

  -- anonymous (not logged in) can do nothing
  set local role anon;
  v_raised := false;
  begin perform count(*) from public.profiles;
  exception when others then v_raised := true; v_state := sqlstate; end;
  if not v_raised or v_state <> '42501' then reset role; raise exception 'FAIL: anon can read profiles'; end if;
  v_raised := false;
  begin perform * from public.search_candidates();
  exception when others then v_raised := true; v_state := sqlstate; end;
  reset role;
  if not v_raised or v_state <> '42501' then raise exception 'FAIL: anon can call search_candidates'; end if;
  set local role anon;
  v_raised := false;
  begin perform * from public.admin_overview();
  exception when others then v_raised := true; v_state := sqlstate; end;
  reset role;
  if not v_raised or v_state <> '42501' then raise exception 'FAIL: anon can call admin_overview'; end if;

  ------------------------------------------------------------------ owner sets up the rest of the data
  update public.candidates set name = 'Suresh Gowda', type = 'Housekeeping', exp = 1, area = 'HSR Layout', salary = 15000, shift = 'Any' where id = v_c2;
  update public.candidates set blocked = true, name = 'Blocked Person' where id = v_c4; -- named but blocked
  update public.candidates set verified = true where id = v_c1;
  update public.employers set status = 'Approved' where id = v_e1;

  -- 6 more named candidates created in the SAME transaction => identical created_at: tests the id tie-breaker
  insert into auth.users (id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
    select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
           '9198460' || lpad(i::text, 5, '0'), now(), now(), now()
      from generate_series(1, 6) i;
  insert into public.profiles (id, role, phone)
    select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, 'candidate', '9846' || '0' || lpad(i::text, 5, '0')
      from generate_series(1, 6) i;
  insert into public.candidates (id, phone_masked, name)
    select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, '98XXXXX' || lpad(i::text, 3, '0'), 'Bulk Person ' || i
      from generate_series(1, 6) i;

  insert into public.jobs (id, employer_id, title, type, area, salary, shift, openings) values
    (v_j1, v_e1, 'Security Guard - Gate', 'Security', 'Whitefield', 18000, 'Night', 4),
    (v_j2, v_e2, 'Housekeeping - Office', 'Housekeeping', 'HSR Layout', 15000, 'Day', 2);

  ------------------------------------------------------------------ employer: search (privacy + filters + paging)
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.candidates; -- employers cannot read candidate rows directly
  if n <> 0 then reset role; raise exception 'FAIL: employer can read candidates table directly (% rows)', n; end if;

  select count(*) into n from public.search_candidates(p_limit => 50);
  if n <> 8 then reset role; raise exception 'FAIL: search shows % candidates (want 8: unnamed + blocked hidden)', n; end if;
  select count(*) into n from public.search_candidates(p_limit => 50) s where s.phone is not null;
  if n <> 0 then reset role; raise exception 'FAIL: phone leaked before unlock'; end if;

  select count(*) into n from public.search_candidates(p_type => 'Housekeeping');
  if n <> 1 then reset role; raise exception 'FAIL: type filter (got %)', n; end if;
  select count(*) into n from public.search_candidates(p_min_exp => 3);
  if n <> 1 then reset role; raise exception 'FAIL: min experience filter (got %)', n; end if;
  select count(*) into n from public.search_candidates(p_shift => 'Day'); -- 'Any'-shift candidates match too
  if n <> 7 then reset role; raise exception 'FAIL: shift filter (got %, want 7)', n; end if;
  select count(*) into n from public.search_candidates(p_max_salary => 16000);
  if n <> 7 then reset role; raise exception 'FAIL: max salary filter (got %, want 7)', n; end if;
  select count(*) into n from public.search_candidates(p_verified_only => true);
  if n <> 1 then reset role; raise exception 'FAIL: verified filter (got %)', n; end if;
  select count(*) into n from public.search_candidates(p_query => 'ravi');
  if n <> 1 then reset role; raise exception 'FAIL: name search (got %)', n; end if;
  select count(*) into n from public.search_candidates(p_query => 'bulk');
  if n <> 6 then reset role; raise exception 'FAIL: name search "bulk" (got %)', n; end if;
  select count(*) into n from public.search_candidates(p_query => '%'); -- must be treated as text, not a wildcard
  if n <> 0 then reset role; raise exception 'FAIL: LIKE wildcard not escaped (got %)', n; end if;
  select count(*) into n from public.search_candidates(p_query => '_');
  if n <> 0 then reset role; raise exception 'FAIL: LIKE underscore not escaped (got %)', n; end if;

  -- keyset pagination: pages of 3, every candidate exactly once even though created_at is identical
  loop
    v_iter := v_iter + 1;
    exit when v_iter > 10;
    v_cnt := 0;
    for r in select * from public.search_candidates(p_limit => 3, p_after_created_at => v_cur_at, p_after_id => v_cur_id) loop
      v_cnt := v_cnt + 1;
      if v_cnt <= 3 then v_all := v_all || r.id; v_cur_at := r.created_at; v_cur_id := r.id; end if;
    end loop;
    exit when v_cnt <= 3; -- no lookahead row => last page
  end loop;
  if coalesce(array_length(v_all, 1), 0) <> 8 or (select count(distinct x) from unnest(v_all) x) <> 8 then
    reset role; raise exception 'FAIL: paging returned % ids (% distinct), want 8 distinct', array_length(v_all, 1), (select count(distinct x) from unnest(v_all) x);
  end if;
  reset role;

  ------------------------------------------------------------------ employer: unlock (the revenue rule)
  perform set_config('request.jwt.claims', json_build_object('sub', v_e2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_raised := false;
  begin perform * from public.unlock_candidate(v_c1);
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  reset role;
  if not v_raised or v_msg <> 'NOT_APPROVED' then raise exception 'FAIL: Pending employer could unlock (got %)', coalesce(v_msg, 'no error'); end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into r from public.unlock_candidate(v_c1);
  if r.phone <> '9111000001' or r.free_unlocks_left <> 2 or r.charged or r.unlocked_count <> 1 then
    reset role; raise exception 'FAIL: first free unlock result % / % / % / %', r.phone, r.free_unlocks_left, r.charged, r.unlocked_count;
  end if;
  select * into r from public.unlock_candidate(v_c1); -- again: idempotent, no second charge
  if r.free_unlocks_left <> 2 or r.unlocked_count <> 1 or r.charged then
    reset role; raise exception 'FAIL: repeated unlock changed counters (% / %)', r.free_unlocks_left, r.unlocked_count;
  end if;
  foreach t in array array[v_c3::text, v_c4::text, '00000000-0000-0000-0000-00000000dead'] loop
    v_raised := false;
    begin perform * from public.unlock_candidate(t::uuid);
    exception when others then v_raised := true; v_msg := sqlerrm; end;
    if not v_raised or v_msg <> 'NOT_FOUND' then reset role; raise exception 'FAIL: unlock of hidden/unknown candidate % (got %)', t, coalesce(v_msg, 'no error'); end if;
  end loop;

  select s.phone, s.unlocked into r from public.search_candidates(p_query => 'ravi') s;
  if r.phone is distinct from '9111000001' or r.unlocked is not true then reset role; raise exception 'FAIL: unlocked number not shown in search'; end if;
  select count(*) into n from public.search_candidates(p_limit => 50) s where s.phone is not null;
  if n <> 1 then reset role; raise exception 'FAIL: only the unlocked candidate may show a phone (got %)', n; end if;
  reset role;

  update public.employers set free_unlocks_left = 0 where id = v_e1; -- free ones used up: next unlock is charged
  set local role authenticated;
  select * into r from public.unlock_candidate(v_c2);
  if not r.charged or r.spent_inr <> 30 or r.unlocked_count <> 2 or r.free_unlocks_left <> 0 then
    reset role; raise exception 'FAIL: paid unlock result charged=% spent=% count=%', r.charged, r.spent_inr, r.unlocked_count;
  end if;
  select count(*) into n from public.list_unlocked(p_limit => 50) u where u.phone is not null;
  if n <> 2 then reset role; raise exception 'FAIL: list_unlocked returned % numbers (want 2)', n; end if;
  reset role;

  select count(*) into n from public.wallet_ledger where employer_id = v_e1 and amount_inr = -30;
  if n <> 1 then raise exception 'FAIL: ledger rows for paid unlock = % (want 1)', n; end if;
  v_raised := false;
  begin update public.wallet_ledger set amount_inr = 0;
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'wallet_ledger is append-only' then raise exception 'FAIL: ledger UPDATE allowed'; end if;
  v_raised := false;
  begin delete from public.wallet_ledger;
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'wallet_ledger is append-only' then raise exception 'FAIL: ledger DELETE allowed'; end if;

  ------------------------------------------------------------------ candidate: jobs and applying
  perform set_config('request.jwt.claims', json_build_object('sub', v_c3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_raised := false;
  begin perform public.apply_to_job(v_j1);
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  reset role;
  if not v_raised or v_msg <> 'PROFILE_INCOMPLETE' then raise exception 'FAIL: unnamed candidate could apply (got %)', coalesce(v_msg, 'no error'); end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_c4, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_raised := false;
  begin perform public.apply_to_job(v_j1);
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  reset role;
  if not v_raised or v_msg <> 'BLOCKED' then raise exception 'FAIL: blocked candidate could apply (got %)', coalesce(v_msg, 'no error'); end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.list_jobs();
  if n <> 1 then reset role; raise exception 'FAIL: list_jobs shows % jobs (want 1: Pending employer hidden)', n; end if;
  v_raised := false;
  begin perform public.apply_to_job(v_j2);
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'NOT_FOUND' then reset role; raise exception 'FAIL: applied to a Pending employer''s job (got %)', coalesce(v_msg, 'no error'); end if;
  perform public.apply_to_job(v_j1);
  perform public.apply_to_job(v_j1); -- applying twice is harmless
  select count(*) into n from public.list_my_applications();
  reset role;
  if n <> 1 then raise exception 'FAIL: applications = % (want 1)', n; end if;

  ------------------------------------------------------------------ admin
  insert into public.profiles (id, role, phone) values (v_admin, 'admin', '9111000000'); -- owner creates admins
  perform set_config('request.jwt.claims', json_build_object('sub', v_e1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_raised := false;
  begin perform * from public.admin_stats();
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  reset role;
  if not v_raised or v_msg <> 'FORBIDDEN' then raise exception 'FAIL: employer could read admin stats'; end if;
  set local role authenticated;
  v_raised := false;
  begin perform * from public.admin_overview();
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  reset role;
  if not v_raised or v_msg <> 'FORBIDDEN' then raise exception 'FAIL: employer could read the admin overview (got %)', coalesce(v_msg, 'no error'); end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into r from public.admin_stats();
  if r.candidates_count <> 8 or r.employers_count <> 2 or r.pending_employers_count <> 1
     or r.jobs_count <> 2 or r.unlocks_count <> 2 or r.revenue_inr <> 30 then
    reset role; raise exception 'FAIL: admin_stats % % % % % %', r.candidates_count, r.employers_count, r.pending_employers_count, r.jobs_count, r.unlocks_count, r.revenue_inr;
  end if;
  -- admin_overview: employer is refused (the candidate case is in the loop above); totals match the tables; the range works
  select * into ov from public.admin_overview();
  reset role;
  if ov.candidates_total <> (select count(*) from public.candidates)
     or ov.candidates_visible <> 8
     or ov.employers_total <> 2 or ov.employers_pending <> 1 or ov.employers_approved <> 1 or ov.employers_blocked <> 0
     or ov.jobs_total <> 2 or ov.applications_total <> (select count(*) from public.applications)
     or ov.unlocks_total <> 2 or ov.revenue_total_inr <> 30
     or ov.candidates_new <> ov.candidates_total or ov.unlocks_new <> 2 or ov.revenue_range_inr <> 30 then
    raise exception 'FAIL: admin_overview totals % % % % % %', ov.candidates_total, ov.employers_total, ov.jobs_total, ov.applications_total, ov.unlocks_total, ov.revenue_total_inr;
  end if;
  set local role authenticated;
  select * into ov from public.admin_overview(now() + interval '1 day', null); -- a period in the future: nothing is "new", totals stay
  if ov.candidates_new <> 0 or ov.employers_new <> 0 or ov.jobs_new <> 0 or ov.applications_new <> 0 or ov.unlocks_new <> 0
     or ov.revenue_range_inr <> 0 or ov.unlocks_total <> 2 or ov.revenue_total_inr <> 30 then
    reset role; raise exception 'FAIL: admin_overview future range';
  end if;
  select * into ov from public.admin_overview(now() - interval '1 day', now() + interval '1 day'); -- everything in the test was created now
  if ov.unlocks_new <> 2 or ov.revenue_range_inr <> 30 or ov.employers_new <> 2 or ov.jobs_new <> 2 then
    reset role; raise exception 'FAIL: admin_overview current range';
  end if;
  select * into ov from public.admin_overview(null, now() - interval '1 day'); -- before yesterday: nothing was created yet
  if ov.unlocks_new <> 0 or ov.candidates_new <> 0 then reset role; raise exception 'FAIL: admin_overview past range'; end if;
  v_raised := false;
  begin perform * from public.admin_overview(now(), now() - interval '1 day');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'INVALID_RANGE' then reset role; raise exception 'FAIL: reversed range accepted (got %)', coalesce(v_msg, 'no error'); end if;

  perform public.admin_set_employer_status(v_e2, 'Approved');
  perform public.admin_set_candidate_flag(v_c2, 'verified', true);
  v_raised := false;
  begin perform public.admin_set_employer_status(v_e2, 'Hacked');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'INVALID_STATUS' then reset role; raise exception 'FAIL: bad employer status accepted'; end if;
  v_raised := false;
  begin perform public.admin_set_candidate_flag(v_c2, 'phone_masked', true);
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'INVALID_FLAG' then reset role; raise exception 'FAIL: bad flag accepted'; end if;
  select count(*) into n from public.admin_list_candidates() a where a.phone is not null;
  if n <> 10 then reset role; raise exception 'FAIL: admin candidate list has % rows with phone (want 10)', n; end if;
  select count(*) into n from public.admin_list_employers() a where a.status = 'Approved';
  reset role;
  if n <> 2 then raise exception 'FAIL: admin approval did not stick (% approved)', n; end if;

  ------------------------------------------------------------------ OTP: codes, limits, lock-out (own SMS-code system)
  select * into r from public.auth_otp_issue('9222000001', 'register');
  if r.code !~ '^[0-9]{6}$' or r.is_test then raise exception 'FAIL: issued code % / test=%', r.code, r.is_test; end if;
  select o.code_hash into t from private.otp_codes o where o.phone = '9222000001';
  if t = r.code or t is null then raise exception 'FAIL: the code is stored in plain form'; end if;

  v_raised := false;
  begin perform * from public.auth_otp_issue('9222000001', 'register'); -- again straight away
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'RATE_LIMITED' then raise exception 'FAIL: no resend cooldown (got %)', coalesce(v_msg, 'no error'); end if;

  v_wrong := case when r.code = '000000' then '111111' else '000000' end;
  for k in 1..5 loop
    if public.auth_otp_check('9222000001', 'register', v_wrong) <> 'INVALID_OTP' then raise exception 'FAIL: wrong code %-th time not refused', k; end if;
  end loop;
  if public.auth_otp_check('9222000001', 'register', r.code) <> 'LOCKED' then raise exception 'FAIL: code not locked after 5 wrong guesses (a right guess must NOT work any more)'; end if;

  update private.otp_codes set created_at = created_at - interval '120 seconds' where phone = '9222000001'; -- cooldown over
  select * into r from public.auth_otp_issue('9222000001', 'register'); -- a new code retires the old one
  v_wrong := case when r.code = '000000' then '111111' else '000000' end;
  if public.auth_otp_check('9222000001', 'register', v_wrong) <> 'INVALID_OTP' then raise exception 'FAIL: wrong code accepted for the new code'; end if;
  if public.auth_otp_check('9222000001', 'register', r.code) <> 'OK' then raise exception 'FAIL: right code refused (attempts must be per code)'; end if;
  if public.auth_otp_check('9222000001', 'register', r.code) <> 'OK' then raise exception 'FAIL: a non-consuming check must be repeatable'; end if;
  if public.auth_otp_check('9222000001', 'reset', r.code) <> 'OTP_EXPIRED' then raise exception 'FAIL: a register code worked for password reset'; end if;
  if public.auth_otp_check('9222000001', 'register', r.code, true) <> 'OK' then raise exception 'FAIL: consuming check failed'; end if;
  if public.auth_otp_check('9222000001', 'register', r.code) <> 'OTP_EXPIRED' then raise exception 'FAIL: a used code worked again'; end if;

  select * into r from public.auth_otp_issue('9222000004', 'register');
  update private.otp_codes set expires_at = now() - interval '1 second' where phone = '9222000004';
  if public.auth_otp_check('9222000004', 'register', r.code) <> 'OTP_EXPIRED' then raise exception 'FAIL: an expired code worked'; end if;

  v_raised := false;
  begin perform * from public.auth_otp_issue('9111000001', 'register'); -- already registered
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'ALREADY_REGISTERED' then raise exception 'FAIL: OTP issued to a registered number for registration (got %)', coalesce(v_msg, 'no error'); end if;
  v_raised := false;
  begin perform * from public.auth_otp_issue('9222000009', 'reset'); -- never registered
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'NOT_REGISTERED' then raise exception 'FAIL: reset OTP issued to an unknown number (got %)', coalesce(v_msg, 'no error'); end if;
  v_raised := false;
  begin perform * from public.auth_otp_issue('12345', 'register');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'INVALID_INPUT' then raise exception 'FAIL: bad phone accepted by OTP issue (got %)', coalesce(v_msg, 'no error'); end if;

  update public.app_settings set value = 1 where key = 'dev_mode'; -- test numbers only count on a DEV project
  insert into private.test_phones (phone) values ('9222000002'); -- dev test number: fixed code, no SMS
  select * into r from public.auth_otp_issue('9222000002', 'register');
  if r.code <> '123456' or r.is_test is not true then raise exception 'FAIL: test number did not get the fixed code'; end if;
  if public.auth_otp_check('9222000002', 'register', '123456', true) <> 'OK' then raise exception 'FAIL: test code refused'; end if;

  update public.app_settings set value = 2 where key = 'otp_max_sends_per_hour';
  select * into r from public.auth_otp_issue('9222000003', 'register');
  update private.otp_codes set created_at = created_at - interval '120 seconds' where phone = '9222000003';
  select * into r from public.auth_otp_issue('9222000003', 'register');
  update private.otp_codes set created_at = created_at - interval '120 seconds' where phone = '9222000003';
  v_raised := false;
  begin perform * from public.auth_otp_issue('9222000003', 'register'); -- third code within the hour
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'RATE_LIMITED' then raise exception 'FAIL: no per-number hourly cap (got %)', coalesce(v_msg, 'no error'); end if;

  update public.app_settings set value = 0 where key = 'otp_global_sends_per_hour';
  v_raised := false;
  begin perform * from public.auth_otp_issue('9222000005', 'register');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'RATE_LIMITED' then raise exception 'FAIL: no project-wide hourly cap (got %)', coalesce(v_msg, 'no error'); end if;

  if public.auth_find_user('9111000001') is distinct from v_c1 or public.auth_find_user('9999999999') is not null then raise exception 'FAIL: auth_find_user'; end if;

  ------------------------------------------------------------------ review fixes (PR #6 findings 1-8)
  update public.app_settings set value = 300 where key = 'otp_global_sends_per_hour';
  update public.app_settings set value = 5 where key = 'otp_max_sends_per_hour';

  -- (3) test numbers are ignored unless dev_mode = 1
  insert into private.test_phones (phone) values ('9222000010');
  update public.app_settings set value = 0 where key = 'dev_mode';
  if public.auth_is_test_phone('9222000010') then raise exception 'FAIL: test number honoured with dev_mode = 0'; end if;
  select * into r from public.auth_otp_issue('9222000010', 'register');
  if r.is_test then raise exception 'FAIL: test number got the fixed-code treatment with dev_mode = 0'; end if;
  update public.app_settings set value = 1 where key = 'dev_mode';
  if not public.auth_is_test_phone('9222000010') then raise exception 'FAIL: test number ignored with dev_mode = 1'; end if;

  -- (2) rate limits run BEFORE the registered / not-registered checks: no free probing right after a code was sent
  select * into r from public.auth_otp_issue('9111000001', 'reset');
  v_raised := false;
  begin perform * from public.auth_otp_issue('9111000001', 'register');
  exception when others then v_raised := true; v_msg := sqlerrm; end;
  if not v_raised or v_msg <> 'RATE_LIMITED' then raise exception 'FAIL: probe answered % instead of RATE_LIMITED (limits must run first)', coalesce(v_msg, 'no error'); end if;

  -- (2) per-IP limit, hashed storage, missing IP cannot be limited
  update public.app_settings set value = 2 where key = 'otp_max_requests_per_ip_per_hour';
  if not public.auth_ip_allow('203.0.113.9') or not public.auth_ip_allow('203.0.113.9') then raise exception 'FAIL: first two requests from an IP must pass'; end if;
  if public.auth_ip_allow('203.0.113.9') then raise exception 'FAIL: third request from the same IP was not limited'; end if;
  if not public.auth_ip_allow('203.0.113.10') then raise exception 'FAIL: a different IP was limited'; end if;
  if not public.auth_ip_allow(null) or not public.auth_ip_allow('  ') then raise exception 'FAIL: a missing IP must not be limited'; end if;
  select h.ip_hash into t from private.otp_ip_hits h order by h.id limit 1;
  if t is null or t like '%203.0.113%' or length(t) <> 64 then raise exception 'FAIL: IP is not stored as a sha-256 hash (got %)', t; end if;

  -- (4) retention: old codes and old IP hits are deleted automatically
  insert into private.otp_codes (phone, purpose, code_hash, expires_at, created_at)
  values ('9222000020', 'register', 'x', now() - interval '9 days', now() - interval '10 days');
  insert into private.otp_ip_hits (ip_hash, created_at) values ('old-hash', now() - interval '2 days');
  select * into r from public.auth_otp_issue('9222000021', 'register');
  if exists (select 1 from private.otp_codes o where o.phone = '9222000020') then raise exception 'FAIL: a 10-day-old OTP row was not deleted'; end if;
  if exists (select 1 from private.otp_ip_hits h where h.ip_hash = 'old-hash') then raise exception 'FAIL: a 2-day-old IP hit was not deleted'; end if;
  if not exists (select 1 from private.otp_codes o where o.phone = '9222000021') then raise exception 'FAIL: the new code was deleted by the purge'; end if;

  -- (1) a login without an account (failed registration) can be found and finished; real accounts are not reported as orphans
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', '9333000001@users.crewconnect.invalid', now(), now(), now());
  if public.auth_find_orphan_login('9333000001') is distinct from '00000000-0000-0000-0000-0000000000d1'::uuid then raise exception 'FAIL: orphan login not found'; end if;
  perform public.auth_create_account('00000000-0000-0000-0000-0000000000d1', '9333000001', 'candidate');
  if public.auth_find_orphan_login('9333000001') is not null then raise exception 'FAIL: a finished account is still reported as an orphan'; end if;
  if public.auth_find_orphan_login('9444000001') is not null then raise exception 'FAIL: unknown number reported as an orphan'; end if;

  -- (8) sessions end after a reset, and only for that user
  insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), v_c1, now(), now()), (gen_random_uuid(), v_c1, now(), now()), (gen_random_uuid(), v_c2, now(), now());
  perform public.auth_revoke_sessions(v_c1);
  select count(*) into n from auth.sessions where user_id = v_c1;
  if n <> 0 then raise exception 'FAIL: % session(s) of the user survived the revoke', n; end if;
  select count(*) into n from auth.sessions where user_id = v_c2;
  if n <> 1 then raise exception 'FAIL: another user''s session was removed (left %)', n; end if;

  -- the new server-only functions are closed to browsers (logged in or not)
  foreach t in array array[
    $$public.auth_ip_allow('203.0.113.77')$$,
    $$public.auth_find_orphan_login('9333000001')$$,
    $$public.auth_revoke_sessions('00000000-0000-0000-0000-0000000000c1')$$
  ] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_raised := false;
    begin execute 'select ' || t; exception when others then v_raised := true; v_state := sqlstate; end;
    reset role;
    if not v_raised or v_state <> '42501' then raise exception 'FAIL: logged-in browser can call %', t; end if;
    set local role anon;
    v_raised := false;
    begin execute 'select ' || t; exception when others then v_raised := true; v_state := sqlstate; end;
    reset role;
    if not v_raised or v_state <> '42501' then raise exception 'FAIL: anonymous browser can call %', t; end if;
  end loop;

  raise exception 'ALL TESTS PASSED (rolled back)';
end;
$test$;
