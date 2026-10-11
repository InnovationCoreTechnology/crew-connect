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
