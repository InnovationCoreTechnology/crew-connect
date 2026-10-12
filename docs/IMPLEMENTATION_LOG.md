# Implementation Log

Append-only history of what was built, why, and how to undo it. Newest entry at the **bottom**. Required by [CLAUDE.md](../CLAUDE.md) §8. Roadmap items are ticked in [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md).

## Entry template

```
### YYYY-MM-DD · <roadmap item id> · <short title>
- Branch / commit: <branch> @ <hash>
- What changed: <1–3 lines>
- Why: <reason / requirement>
- Files: <list>
- Sources used (official): <urls, date checked for prices/limits>
- Verification: <commands run + result; manual browser check>
- Performance impact: <bundle size before → after, query EXPLAIN notes, or "none">
- Cost impact: <none | what, how much, approved by owner Y/N>
- Dependencies changed: <name from → to, or none>
- Rollback: <exact command or step>
- Follow-ups / needs owner: <list or none>
```

## Entries

### 2026-10-11 · 0.1 · Roadmap created
- Branch / commit: `docs/development-roadmap` @ f68dc6e (PR #1)
- What changed: added `DEVELOPMENT_ROADMAP.md` (phases 0–9, branching/rollback, free-first stack, open decisions).
- Why: product moves from template to a planned, phased build.
- Verification: docs only, no code run.
- Cost impact: none.
- Rollback: `git revert -m 1 <merge commit>` or delete the file.

### 2026-10-11 · 0.6 · Instruction file, backend plan, decisions D1–D4
- Branch: `docs/instructions-backend-plan`
- What changed: added `CLAUDE.md`, `docs/BACKEND_PLAN.md`, this log; recorded D1–D4 in the roadmap.
- Why: owner asked for standing rules (official sources only, proven/fast design, summaries, dependency checks) and for the backend to be chosen.
- Sources used (official): Supabase pricing, regions, phone-login and Send SMS hook docs; Cloudflare Pages limits and Workers static-assets billing; Vercel Hobby plan docs – all checked 2026-10-11 (links in `docs/BACKEND_PLAN.md`).
- Verification: docs only; `npm outdated` and `npm audit` run in `web/` (0 vulnerabilities; TypeScript 6.0.3 → 7.0.2 and @types/node 24 → 26 are available major versions, not applied).
- Cost impact: none.
- Rollback: delete the three files / revert the commit.

### 2026-10-11 · Phase 1 (1.1–1.7, 1.9; 2.7 pulled forward) · Real backend: database, security, OTP login
- Branch / commit: `phase/1-backend-auth`; task branches `feat/db-schema` (233a539), `feat/frontend-supabase` (912722b), `feat/dev-seed` (175ecbb), merged with `--no-ff`.
- What changed:
  - **Database** (project `crew-connect`, Mumbai, applied via MCP `apply_migration`): 8 tables with CHECK constraints, 13 server functions, RLS on every table, column-level grants, append-only wallet ledger, partial/trigram indexes.
  - **App**: typed Supabase client; OTP-only login/register (`PhoneOtpForm`); `data/api.ts` rewritten on the database functions; paged candidate and unlocked lists with Load more; role dashboards lazy-loaded; error boundary; mock auth, mock database and password field deleted.
- Why: replace the in-memory template with a real, secure backend; money and phone-number rules enforced by the database, not the browser (decisions D1–D4).
- Files: `supabase/**` (migrations, rollback, tests, admin script, README), `web/src/lib/*`, `web/src/data/*`, `web/src/features/auth/**`, employer/candidate/admin screens, `web/src/shared/hooks/useLoadMore.ts`, `web/src/app/ErrorBoundary.tsx`, `web/src/App.tsx`, `web/scripts/seed-dev.mjs`, `web/.env.example`.
- Sources used (official, checked 2026-10-11): Supabase phone login, RLS (+ performance recommendations), Securing your API, auth error codes, rate limits, change-region, regions pages; supabase-js 2.117.3 type definitions in `node_modules`; PostgreSQL pg_trgm docs.
- Verification:
  - `supabase/tests/rules.test.sql` -> "ALL TESTS PASSED (rolled back)" (registration, RLS, column grants, anon, no phone leak, filters, keyset paging with identical timestamps, free/paid/idempotent unlock, append-only ledger, apply rules, admin rules, admin cannot be self-registered). A deliberate weakening of one rule was detected (control test), and fixtures were confirmed rolled back.
  - Reversal scripts run in a rolled-back transaction: 0 tables / functions / policies left. `create_admin.sql` tested the same way.
  - Supabase advisors: only expected notes (deny-all tables, the 13 intended SECURITY DEFINER functions, indexes not used yet).
  - `npm run lint` and `npm run build` (from `web/`): zero errors. `npm audit`: 0 vulnerabilities.
  - Browser (Vite dev server vs the live Mumbai project): login page renders, no console errors; the OTP request path got the real server answers `otp_disabled` (login, unknown number -> mapped to "not registered", now verified) and `phone_provider_disabled` (register -> friendly message).
  - NOT verified: the OTP happy path, employer/candidate/admin screens against live data in a browser, and a parallel-session unlock race. All need item 1.8 (SMS provider or test numbers) and seed data.
- Performance impact: EXPLAIN ANALYZE at 100,000 candidates (temp table, same indexes): first page 0.05 ms, page 50,000 deep 0.05 ms, 5-filter search 0.25 ms, verified 0.06 ms, name search via trigram 10 ms. First-load JS 92.9 -> 141.4 KB gzip (budget 150 KB): the Supabase client adds about 49 KB; dashboards split into 3 lazy chunks of 1.6-2.6 KB gzip each.
- Cost impact: none (Free plan; project cost confirmed $0). Not added yet: SMS provider + DLT (Phase 1.8) and domain. Free-plan caveats unchanged: no backups, pauses after 1 week idle.
- Dependencies changed: added `@supabase/supabase-js` ^2.117.3 (official client; Node >= 22 required, local Node is 22.20 - Cloudflare's build Node version must be set in Phase 2). Outdated majors still pending, unchanged: TypeScript 6.0.3 -> 7.0.2, @types/node 24 -> 26 (roadmap 0.7).
- Rollback: code `git revert -m 1 <merge hash>` per task (see roadmap change log). Database: apply `supabase/rollback/*.down.sql` newest-first as a NEW migration (it deletes the tables' data; take a backup first once there is real data).
- Decisions made without the owner (recorded, easy to change): (1) the only Supabase project is treated as **DEV** and a separate production project is needed before real users (free plan allows 2 projects); (2) OTP is 6 digits (Supabase default) instead of the template's 4; (3) `list_jobs` capped at 100 and admin lists at 500 until later phases; (4) `register_account()` accepts Indian numbers only (+91).
- Follow-ups / needs owner:
  1. **1.8**: enable Phone sign-in in the dashboard and connect an SMS provider (MSG91 + DLT, D3), or find out whether the dashboard offers test OTP numbers. Then I can finish the browser tests, the admin creation (1.10) and the seed run (1.11).
  2. **1.11**: put the secret key in `web/.env.seed.local` yourself (never in chat) with `SEED_CONFIRM=crew-connect-dev`, then run `npm run seed:dev` from `web/`.
  3. **1.12**: read the real rate limits in Authentication -> Rate Limits and decide on CAPTCHA (Cloudflare Turnstile).
  4. Merge PRs #1 and #2 first, then open the Phase 1 PR (`phase/1-backend-auth` is stacked on them).

### 2026-10-11 · D4 revised + 1.7 rework + 1.10/1.11 · Mobile + password login, OTP to register/reset, test data for all roles
- Branch / commit: `phase/1b-password-login` (3118b4f auth, 4cebd61 seed). Stacked on main after PR #3.
- What changed: (1) Owner decision D4 revised: log in with mobile + password; SMS OTP only to register and to reset a forgotten password. Rewrote the auth flow (`AuthService`, `supabaseAuthService`, `AuthProvider`, Login/Register/ForgotPassword/NewPassword forms, restored `PasswordField`, password rules min 8). (2) `supabase/seed/dev_seed.sql` applied to the DEV project: 26 logins with passwords, data for every role. The earlier key-based seed script was removed.
- Why: the owner wants the familiar password flow, a forgot-password path and test accounts for every role to check the forms.
- Sources (official, checked 2026-10-11): Supabase password-based auth (phone sections), password security, phone login; supabase-js `updateUser` / `signInWithPassword` documentation in the installed package.
- Verification: `npm run lint`, `npm run build` zero errors (first-load JS 143.0 KB gzip, budget 150 KB). Browser against the live Mumbai project: login, forgot and register screens render; a reset OTP request for a seeded number shows the friendly "Phone login is not available right now" message. Live API check with a throwaway user (deleted afterwards): password login answers `phone_provider_disabled` while the Phone provider is off. Seed counts checked by SQL (26 logins, 21 candidates, 4 employers, 5 jobs, 1 application, 1 admin).
- NOT verified: any successful login, registration, reset, or the three dashboards with data. All blocked on enabling the Phone provider (login) and an SMS provider (register/reset). The hand-inserted seed users are also unproven against Supabase Auth until a login works.
- Performance impact: +1.6 KB gzip first-load JS (141.4 -> 143.0 KB).
- Cost impact: none now. SMS is used only for register and reset; MSG91 price still unverified.
- Dependencies changed: none.
- Rollback: `git revert -m 1 754e523` (auth) and `git revert 4cebd61` (seed files); remove seeded users as described in `supabase/seed/dev_seed.sql`.
- Secrets: the three generated test passwords live only in the git-ignored `web/.seed-credentials.local` and in this session's tool calls; none is in the repo (checked with a repo-wide search).
- Follow-ups / needs owner: enable the Phone provider in the Supabase dashboard (then I verify logins for every role and test each screen in the browser); SMS provider (MSG91 + DLT) for register/reset; decide on MFA for recycled numbers; match the server's minimum password length (8) in Authentication settings.
### 2026-10-11 · 2.1 (part) · First hosted version on Cloudflare
- Branch / commit: `phase/2-deploy-ci` (task `feat/cloudflare-hosting` 61a97e8, PR #4).
- What changed: `web/wrangler.jsonc` (assets-only, SPA fallback), `.node-version` 22, `wrangler` dev dependency. Deployed manually with `npx wrangler deploy` from the owner's terminal. Account workers.dev subdomain: `innovationcore`.
- Live URL: https://crew-connect.innovationcore.workers.dev
- Sources (official, checked 2026-10-11): Cloudflare Workers static assets, Workers Builds configuration + build image, workers.dev subdomain docs.
- Verification: local `wrangler dev` and the live site: `/`, `/login`, `/employer`, `/candidate`, `/admin` and an unknown path all return 200 with the app; the login page renders in a browser; the deployed bundle contains the dev Supabase URL and publishable (public) key. The new subdomain's HTTPS took about 30-60 s to start working.
- Cost impact: none (Workers free plan; static asset requests are free per Cloudflare docs).
- Rollback: Cloudflare dashboard -> Workers & Pages -> crew-connect -> Deployments (rollback procedure NOT yet tested; roadmap 2.9), or redeploy an older commit.
- Caveats: this is a DEV site pointing at the DEV database. The site is public. Phone login still cannot work until item 1.8 (SMS provider). Wrangler login for the deploy gave Wrangler broad Cloudflare scopes; revoke in the Cloudflare dashboard (My Profile -> API Tokens / authorized apps, UNVERIFIED path) if the machine is shared.
- Follow-ups: connect GitHub for auto-deploy and preview URLs; production vs dev Supabase projects; custom domain (2.8).

### 2026-10-11 · D4 revised again + 1.7 / 1.12 / 1.13 · Own OTP system, `account-auth` Edge Function, every role tested in a browser
- Branch / commit: `phase/1b-password-login` (tasks `feat/own-otp-database`, `feat/own-otp-app`). Supersedes the Supabase-phone-provider version in the first commits of PR #5.
- What changed: (1) The Supabase Phone provider cannot be saved without Twilio-style credentials, so login no longer uses it. New migration `20261011140000_own_otp_accounts.sql` (OTP tables, five server-only functions, limits in `app_settings`; the browser-callable `register_account` is dropped). (2) Edge Function `account-auth` (send-otp, check-otp, register, reset-password), deployed with `verify_jwt=false`; its SMS adapter is a stub until MSG91's official API is read. (3) Web app: new `AuthService` contract and `supabaseAuthService` (email-style identity + password), OTP checked at its own step then again on the server, forms carry the OTP forward. (4) `dev_seed.sql` now creates email-style logins and 10 dev test numbers. (5) SQL rule tests extended with OTP, rate-limit, lock-out and "browsers cannot call server-only functions" cases.
- Why: the owner wants mobile + password login with OTP for register / forgot password, no Twilio, and MSG91 later.
- Sources (official, checked 2026-10-11): Supabase Edge Functions secrets, auth (verify_jwt) and CORS guides; Auth Admin API; password-based auth; password security; the supabase-js package docs. Edge Function SMS part: NOT implemented (MSG91 docs not read yet).
- Verification:
  - `supabase/tests/rules.test.sql` -> ALL TESTS PASSED (rolled back), including the new OTP cases. The suite wipes users inside its own rolled-back transaction; after it, the seeded data was confirmed intact.
  - Reversal script tested in a rolled-back transaction (0 new functions / private tables left, old function restored; the restored function body in that test was a stub, the real body is in the down file).
  - Live API test of the deployed function, 17 steps with a test number (cooldown, wrong / right OTP, weak password, register, login ok / wrong password, already registered, real number refused, bad input, admin role refused, reset, old password fails, new works, consumed code refused): all as expected.
  - Browser (Vite dev server vs the live Mumbai project): logged in as candidate (profile, jobs filtered to approved employers, apply, profile validation + save, database confirmed), approved employer (20 candidates, masked numbers, unlock 3 -> 2 free, real number appears, filter, Unlocked tab), pending employer (banner, unlock disabled), admin (live stats, approved an employer, verified a candidate; database confirmed). New user registered with the OTP screen (wrong OTP message, weak / mismatched password messages, lands on the dashboard), logged in again, wrong password message, forgot password (cooldown message, reset, old password rejected, new works). Edge messages: already registered, no SMS gateway for real numbers.
  - `npm run lint`, `npm run build` zero errors; first-load JS 143.0 KB gzip (budget 150 KB). Supabase security advisor: only the expected notes plus "leaked password protection disabled" (Pro plan feature).
  - NOT verified: real SMS delivery; "Load more" with more than 24 candidates in the browser (the database paging is tested); a parallel-session unlock race; session cancelling after a password reset.
- Performance impact: none measurable in the bundle (+0.0 KB); OTP checks run bcrypt (cost 6) in the database, a few ms.
- Cost impact: none (Edge Function invocations: 500,000 per month on Free per Supabase pricing page). SMS cost starts only when MSG91 is connected and only for register / reset.
- Dependencies changed: none in the web app. The Edge Function pins `@supabase/supabase-js@2.117.3` (same as the app).
- Rollback: database `supabase/rollback/20261011140000_own_otp_accounts.down.sql` (restores `register_account`; accounts already made through the new flow would then have logins the old flow cannot use); app `git revert -m 1 <merge>`; Edge Function: delete `account-auth` in the dashboard or redeploy an earlier version.
- Secrets: the three seeded test passwords are only in the owner's git-ignored `web/.seed-credentials.local` and in this session's tool calls; none is in the repo (repo-wide search). Two throwaway test users made during testing were deleted.
- Follow-ups / needs owner: (1) the Supabase Phone form can be CANCELLED, leave Phone provider OFF; (2) MSG91 account + DLT-approved OTP template so real numbers can get OTPs (item 1.8); (3) CAPTCHA decision (item 1.12); (4) redeploy the Cloudflare site so the URL shows the new login (needs the owner's go-ahead); (5) consider MFA and cancelling sessions after a reset.

### 2026-10-12 · 1.12 · CAPTCHA (Cloudflare Turnstile) on OTP requests
- Branch / commit: `phase/1b-password-login` (task `feat/captcha`).
- What changed: Turnstile on "Send OTP" and "Resend OTP". Server: new `turnstile.ts` (Siteverify, fails closed) used by `account-auth` before any database work; no secret configured => only dev test numbers, never a real SMS. Browser: `TurnstileWidget` (explicit rendering), `PhoneOtpForm` collects one token per request and asks for a fresh challenge after each attempt; `VITE_TURNSTILE_SITE_KEY` (optional). Error `CAPTCHA_FAILED`.
- Why: the owner asked for CAPTCHA (roadmap 1.12): protects the SMS bill and stops people locking others out through the project-wide OTP cap.
- Sources (official, checked 2026-10-12): Cloudflare Turnstile client-side rendering, server-side validation and testing (dummy keys) pages.
- Verification: `node supabase/tests/turnstile.test.mjs` -> ALL TURNSTILE TESTS PASSED (7 cases against Cloudflare's real Siteverify with its dummy keys: valid, rejected, replayed token, missing / junk / over-long token, Cloudflare unreachable, non-JSON answer). Live API test of a TEMPORARY build of `account-auth` with the dummy always-passes secret built in (replaced right afterwards): no token / empty token / junk token -> `CAPTCHA_FAILED`; the dummy widget token -> ok; real number -> `SMS_FAILED`; a refused request did not consume the OTP rate limit. Browser: the widget loads from `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, Send OTP is disabled until a token exists, a fresh token is ready for Resend after a send, OTP verify reaches the password step. Final build redeployed (version 3) and checked: reads `TURNSTILE_SECRET_KEY` from the environment, no secret in the code; real numbers refused, dev test numbers work. `npm run lint` and `npm run build` pass (first-load JS 143.6 KB gzip).
- NOT verified: a real Turnstile widget with real keys (needs the owner's Cloudflare Turnstile widget); the real-secret enforcement path on the deployed function (only tested with the dummy secret in the temporary build); behaviour on blocked / slow networks beyond the "could not load" message.
- Performance impact: +0.5 KB gzip in our bundle; Cloudflare's widget script loads from Cloudflare only on the Register / Forgot password screens.
- Cost impact: none (Turnstile is free; Edge Function calls: one extra HTTPS request to Cloudflare per OTP request).
- Dependencies changed: none.
- Rollback: `git revert -m 1 <merge>`; redeploy the previous Edge Function version (the temporary and final builds differ from before only by the CAPTCHA lines).
- Notes: two registrations with test numbers 9000000009 (candidate) and 9000000010 (employer) appeared in the database on 2026-10-12 02:30-02:32 UTC (not made by this session); left untouched. The test numbers 9000000001-8 had throwaway OTP rows from testing; deleted.
- Follow-ups / needs owner: create the Turnstile widget in Cloudflare (free), set the site key (`VITE_TURNSTILE_SITE_KEY`, also as a Cloudflare build variable if building there) and the secret (`TURNSTILE_SECRET_KEY` in Supabase Edge Function secrets); restrict the widget to your hostnames; then I re-test the real-key path.

### 2026-10-12 · PR #6 review fixes (8 findings) · own OTP system hardening
- Branch / commit: `fix/pr6-review` (merged into `phase/1b-password-login`, PR #6).
- What changed (finding numbers from the review):
  1. **Stuck after a failed registration:** `register` now finishes a login that has no account (new `auth_find_orphan_login`, then set password + create the account) instead of answering ALREADY_REGISTERED; the result of the cleanup `deleteUser` is now checked and logged.
  2. **Number probing:** the OTP rate limits now run BEFORE the registered / not-registered answers, and a new per-IP limit (`auth_ip_allow`, 20 per hour, IP stored only as a sha-256 hash, deleted after a day) is applied by the Edge Function. Not covered: a determined attacker with many IPs; the CAPTCHA and the project-wide cap remain the other layers.
  3. **Test numbers in production:** they only work when `app_settings.dev_mode = 1` (default 0). The dev seed sets it; this dev project has it on.
  4. **Retention:** OTP rows older than `otp_retention_days` (7) and IP hits older than a day are deleted whenever an OTP is requested (pg_cron not used: its setup SQL is not on Supabase's cron page, so I could not verify it).
  5. **Consume result:** the Edge Function now checks and logs a failed "mark code as used" in register and reset.
  6. **Simultaneous requests:** `pg_advisory_xact_lock(hashtext(phone))` at the start of `auth_otp_issue`.
  7. **72 bytes:** both the Edge Function and the web validator count BYTES (`TextEncoder`), with a clearer message.
  8. **Sessions after reset:** new server-only `auth_revoke_sessions`, called after `updateUserById`.
- Files: `supabase/migrations/20261012100000_otp_review_fixes.sql` (+ rollback), `supabase/functions/account-auth/index.ts`, `supabase/tests/rules.test.sql`, `supabase/seed/dev_seed.sql`, `web/src/features/auth/validators.ts`, docs.
- Sources: the PR #6 review; Supabase cron page (no setup SQL, so not used); Auth behaviour verified by tests below.
- Verification: `supabase/tests/rules.test.sql` -> ALL TESTS PASSED (rolled back) with new cases for findings 2, 3, 4, 1 (helper), 8 and "browsers cannot call the new functions"; seeded data confirmed intact afterwards. Reversal script run in a rolled-back transaction (0 new objects left, restored function works). Deployed Edge Function version 4 (exact repo source). Live tests: per-IP limit (3rd request from one caller refused; stored IPs are all 64-hex sha-256); orphan login finished and then usable (old password rejected); a 37-character Hindi password (109 bytes) refused; old device's refresh token refused after a reset (`refresh_token_not_found`) and the new password works. `npm run lint`, tsc clean.
- NOT verified: the advisory lock under real simultaneous requests (smoke-tested only); which header Supabase's edge guarantees for the caller IP (the code uses `cf-connecting-ip`, then the first `x-forwarded-for` value; the live test shows an IP was available, not which header); access tokens issued before a reset stay valid until they expire (default 1 hour).
- Performance impact: each OTP request does one extra small insert (IP log) and one range delete; negligible at this scale.
- Cost impact: none.
- Dependencies changed: none.
- Rollback: `git revert -m 1 <merge>`; database `supabase/rollback/20261012100000_otp_review_fixes.down.sql` (brings back the findings); Edge Function: redeploy version 3 (CAPTCHA build without these fixes).
- Test data touched: temporary test accounts 9000000012 / 9000000013 created for the live tests and deleted; two accounts 9000000009 / 9000000010 that someone else registered earlier were left untouched.
- Follow-ups: the review's suggestion to track items 2, 4 and 8 separately is no longer needed (done here); still open: real Turnstile keys, MSG91 gateway, MFA for recycled numbers.

### 2026-10-12 · 1.12 follow-up · CAPTCHA runs on demand
- Branch / commit: `fix/captcha-on-demand` (from `main` after PR #6).
- Why: the owner saw the widget tick itself before any number was typed and again after switching tabs. Cause: the widget started its check as soon as the form appeared and was rebuilt when the role tab changed. Cloudflare's Managed mode also decides by itself whether a checkbox is shown (a normal browser usually just gets "Success!"); a real-key widget cannot be forced to always show a checkbox.
- What changed: `TurnstileWidget` now renders with `execution: 'execute'` and `appearance: 'execute'` (Cloudflare's documented options) and exposes `getToken()` through a ref; it resets the widget before reuse. `PhoneOtpForm` asks for a token only when Send OTP / Resend OTP is pressed (busy label "Please wait…"), and shows "The security check did not finish. Please try again." when it fails, without calling the server.
- Sources (official, checked 2026-10-12): Turnstile widget configurations page (`execution`, `appearance`, `turnstile.execute()`), client-side rendering page (`reset`, `remove`, token life).
- Verification (local dev server with Cloudflare's published dummy keys, in a browser): no widget, token or challenge on page load or after switching "I want a job" / "I want to hire"; Send OTP sends exactly one request carrying a fresh token; a second send with another number works (widget reuse); with the always-fails dummy key the user sees the failure message, nothing is sent to the server and the button is usable again. `npm run lint` and `tsc` clean.
- NOT verified: the real-key widget end to end (a real Turnstile checkbox is for a human to click, I may not solve it); `turnstile.reset()` before `execute()` is not described in the docs I read (it worked with the dummy key); the server still accepts requests with no token until `TURNSTILE_SECRET_KEY` is set in Supabase (owner action, confirmed by a live test on 2026-10-12).
- Rollback: `git revert -m 1 <merge>`.
- UPDATE (same day, owner feedback): with a real key Cloudflare's Managed mode still ticked "Success!" by itself right after Send OTP, and a real-key widget cannot be forced to show a checkbox. So the form now shows OUR unticked "I'm not a robot" box (`shared/components/HumanCheck.tsx`): ticking it runs Turnstile behind it ("Verifying..." -> "Verified"), Send OTP / Resend OTP need the tick (message otherwise, no request sent), and the box resets to unticked after every request because a token works once. Cloudflare's own widget (appearance `interaction-only`) appears inside the box only if it really needs the visitor. The box is only the user interface: the protection is the one-time token the SERVER verifies. Verified in a browser with Cloudflare's dummy keys: starts unticked and stays so after tab switches; Send without the tick shows a message and sends nothing; tick -> Verifying -> Verified; send carries a token and the box resets; always-fails key -> "We could not verify you. Tick the box to try again." with nothing sent. NOT verified: a real-key challenge that needs a human click.
- UPDATE 2 (owner feedback): the "I'm not a robot" box reappeared unticked on the OTP screen while the user was typing the OTP (it was there for Resend, which needs a fresh token, and Verify OTP does not need it). Now it is shown only where a code can be requested: the first screen, and the OTP screen once the 60 s resend wait is over (next to the Resend link). Verified in a browser (dummy key): box hidden during the wait; after the wait the box and Resend appear; Resend without the tick shows the message and sends nothing; with the tick the code is resent, the countdown restarts and the box hides again.

### 2026-10-12 · 2.13 · Branching model main / develop, CI gate, release process
- Branch / commit: `docs/branching-strategy` (from `develop`, which was created from `main` at 38b6e7b).
- Why: the owner wants `main` to be a clean production build that only receives tested, stable, stakeholder-approved code, with all new work on `develop`, and a process that works when more developers join.
- What changed: `.github/workflows/ci.yml` (lint, tsc + build, `npm audit --omit=dev --audit-level=high`, Turnstile tests; read-only permissions; Node from `web/.node-version`); `.github/pull_request_template.md` (tasks into `develop`); `.github/PULL_REQUEST_TEMPLATE/release.md` (develop -> main gate with evidence and owner sign-off); `.github/CODEOWNERS`; `docs/RELEASE_PROCESS.md`; roadmap §3 rewritten, items 2.11-2.13 added; `CLAUDE.md` §6 updated (never push to `main`/`develop`, tasks from `develop`, release PR only when the owner asks).
- Sources (official, checked 2026-10-12): GitHub Actions `actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0 release pages (exact pins); GitHub's API answer for this repo: branch protection and rulesets unavailable on a private repo on GitHub Free ("Upgrade to GitHub Pro or make this repository public").
- Verification: see the PR. Local `npm run lint` and `npm run build` results are in the reply to the owner; the workflow's first real run happens on the PR of this branch and is reported there.
- NOT verified: CI behaviour until it has run on GitHub; that `npm audit --audit-level=high` is clean today (checked in the run); template picker with `?template=release.md` (GitHub documents query-parameter templates, not re-tested).
- Limits (accepted by the owner: "Process + CI for now"): GitHub cannot block pushes or merges on a red check; the rules are followed by discipline until GitHub Pro (2.11). Staging environment and separate production database deferred to 2.12 ("later, before real users").
- Cost impact: none (GitHub Actions free minutes for private repos; the job takes about 1-2 minutes). Dependencies changed: none.
- Rollback: `git revert -m 1 <merge>`; the `develop` branch can stay (it equals `main` until the first change).
- Needs owner: choose whether GitHub's default branch becomes `develop` (so new PRs target it by default); in Cloudflare Workers Builds set production branch `main` when connecting GitHub.

### 2026-10-12 · Saved candidate profile view
- Branch / commit: `feat/candidate-profile-view` (from `develop`).
- Why: after pressing Save the candidate saw the same form again; the owner asked for a finished-profile view like job sites show (mockup option A approved).
- What changed: new `ProfileTab` (first-time candidate with no name sees the form; otherwise the view), `ProfileView` (avatar initial, name, job type + area, ID badge, "Visible to employers", fact tiles, profile-strength meter with checklist, Edit profile), `ProfileForm` gets Cancel when editing an existing profile, `profileStrength()` in `data/rules.ts` (basic details 60 + verified ID 40), styles in `dashboard.css`. No database, API or dependency change.
- Verification: `npm run lint` clean; `npm run build` clean (first-load 144.17 KB gzip, unchanged; candidate chunk 3.19 KB gzip).
- NOT verified: the screen in a browser (login goes to the remote Supabase project; I do not enter credentials there). Owner to check: new candidate sees the form and, after Save, the card; Edit profile and Cancel work; the strength shows 60% (unverified) or 100% (verified). No unit test: Vitest arrives with roadmap 2.4.
- Not built (needs new fields, separate task): photo, languages, skills, about-me. The ID step says "earns the trust badge"; there is no candidate-side ID submission yet (roadmap Phase 5).
- Rollback: `git revert -m 1 <merge>`.

### 2026-10-12 · Release v0.1.0 (first production merge)
- What: PR #9 merged `develop` into `main` (merge `4464f5f`); `main` and `develop` have identical content. Annotated tag `v0.1.0` created on that merge by the owner.
- Not done: the release PR template was not used and the sign-off line was not filled for this first release; the live site was not redeployed (still the manual 2026-10-11 deploy); SQL rule tests were last passed on 2026-10-12 (PR #6 fixes), no database change since.
- Rollback: Cloudflare dashboard: redeploy previous deployment; git: `git revert -m 1 4464f5f` on a `hotfix/*` branch.

### 2026-10-12 · Design: admin-controlled lists (roadmap 4.6)
- Branch: `docs/admin-controlled-lists` (from `develop`). Documentation only, nothing built.
- Why: the owner wants designations under each job type (like job apps) and wants an admin, not a developer, to control the main list, the sub list and any other data that changes by name only.
- What: `docs/ADMIN_CONTROLLED_LISTS.md` (what is admin-controlled vs fixed, table design with RLS and an audit log, expand/contract migration, admin "Lists" tab, build order, risks), roadmap 4.6 rewritten and blocked on new open decisions D12-D17.
- Sources: none external; based on the repo's own schema and code (checked 2026-10-12). No library or service claims made.
- NOT verified: nothing is implemented or tested; design needs the owner's answers to D12-D17.
- Cost impact: none planned. Rollback: `git revert -m 1 <merge>`.

### 2026-10-12 · 2.1 follow-up · Cloudflare branch (preview) builds fixed
- Branch: `fix/wrangler-previews-block` (from `develop`).
- Why: after connecting GitHub to Cloudflare Workers Builds, every branch build failed at the deploy step. Build log (pasted by the owner): the build itself succeeded, then `npx wrangler preview` stopped with "Your Wrangler configuration is missing a `previews` block".
- What changed: `web/wrangler.jsonc` gets `"previews": {}` (valid when empty). Production settings stay at the top level.
- Source (official, checked 2026-10-12): https://developers.cloudflare.com/workers/previews/configuration/ ("The `previews` block is required, but it can be empty if your Preview does not need separate settings").
- Verification: `npm run build` clean; `npx wrangler deploy --dry-run` accepts the config and reads the same 13 asset files. NOT verified: that the next Cloudflare branch build succeeds (it runs on the PR); the docs do not state directly that the empty block leaves `wrangler deploy` unchanged, the dry run shows no change.
- Cost impact: none. Rollback: `git revert -m 1 <merge>`.

### 2026-10-12 · My applications screen (roadmap 4.4, part)
- Branch: `feat/applications-view` (from `develop`).
- Why: the owner found the plain table too thin and asked for a job-site style screen (mockup approved).
- What changed: `ApplicationsTab` is now summary tiles + filter chips (All / In review / Shortlisted / Not selected) + one card per application (title, company, area, salary, shift, openings, "applied N days ago") + a progress tracker (Applied, Shortlisted, Interview, Hired) + friendly empty and "no applications in this group" states; "Find jobs" / "Find similar jobs" buttons switch to the Find jobs tab. `ApplicationView` gets `appliedAt` (the RPC `list_my_applications` already returned `applied_at`; the screen simply had dropped it). Wording and tracker rules in `data/rules.ts` (Applied is shown as "In review", Rejected as "Not selected"); `timeAgo()` in `shared/format.ts`.
- No database, RPC or dependency change.
- Verification: `npm run lint` clean; `npm run build` clean (first load 144.18 KB gzip; candidate chunk 3.69 KB gzip); `timeAgo` checked with a small script (today, yesterday, 5 days, 2 weeks, 8 weeks, dated, invalid input gives an empty string).
- NOT verified: the screen in a browser (login goes to the remote Supabase project; the Cloudflare preview of this PR can be used). Interview and Hired steps are always "not reached": no employer pipeline exists yet (roadmap 4.3), so the screen cannot show them honestly any other way. The shortlisted line says "may contact you", which is true only if the employer unlocks the number. No unit tests: Vitest arrives with roadmap 2.4.
- Cost impact: none. Rollback: `git revert -m 1 <merge>`.

### 2026-10-12 · Design: admin dashboard v2 (roadmap 4.8, 4.9)
- Branch: `docs/admin-dashboard-plan` (from `develop`). Documentation only, nothing built.
- Why: the owner asked for an admin dashboard with visitors, companies, candidates, revenue, SMS / token cost, master forms for categories, approvals and add / modify users.
- What: `docs/ADMIN_DASHBOARD.md` (what exists, which data does not exist yet and what unlocks it, five screens, data and performance design, the careful design for add / modify users, build order, risks, cost), roadmap items 4.8 and 4.9, open decisions D18-D25.
- Sources: repo only, plus Cloudflare Web Analytics overview page (https://developers.cloudflare.com/web-analytics/, checked 2026-10-12: describes itself as privacy-first; the page did not state price, cookie use, setup or an API, so those are marked UNVERIFIED). MSG91's public login page showed no price or API information, so SMS cost is planned as an owner-supplied rate, marked UNVERIFIED.
- NOT verified: all of it is a plan; no tile, function or table exists yet.
- Cost impact: none now. Rollback: `git revert -m 1 <merge>`.

### 2026-10-12 · Admin dashboard design revised (owner decision D21)
- Branch: `docs/admin-dashboard-plan` (same PR).
- Owner decision: the admin does not create candidates or employers; the admin can add another admin and can hard delete users and employers.
- Changed in `docs/ADMIN_DASHBOARD.md` section 5, decisions and risks; roadmap D21 ticked with the answer, D26 (hard delete rules) and D27 (who may add / delete admins) opened.
- Finding from the schema (checked in `supabase/migrations/20261011130000_core_schema.sql`): deleting a candidate works (applications and unlocks cascade, ledger rows keep the amount and lose the candidate link); deleting an employer is BLOCKED while it has wallet ledger rows (`on delete restrict`, deliberate so money records cannot vanish). The design needs the owner's choice in D26.
- NOT verified: Supabase Auth admin delete behaviour in our Edge Function is a plan, not tested. Docs only, nothing built.
