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
