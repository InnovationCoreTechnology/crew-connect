# supabase/ – database as code

Everything that defines the Supabase database lives here, so any change can be reviewed, repeated and undone.
Project: **crew-connect**, region **ap-south-1 (Mumbai)**, ref `qehkkituvqaishysoqta`. This is the **DEV** project
(see [docs/BACKEND_PLAN.md](../docs/BACKEND_PLAN.md)); create a separate production project before real users arrive.

| Folder | What | When it runs |
|---|---|---|
| `migrations/` | The schema, in order. One file = one reviewable step. | Applied to the project (MCP `apply_migration`, or Supabase CLI later). |
| `rollback/` | One reversal script per migration, **same timestamp**. | Applied as a NEW forward migration if a step must be undone. Tested 2026-10-11 (see log). |
| `tests/` | `rules.test.sql`: proves the security and money rules. | Run after every migration. |
| `admin/` | `create_admin.sql`: how an admin is made (never from the app). | By hand, once per admin. |
| `seed/` | `dev_seed.sql`: fake test accounts and data (DEV only). | By hand, when you want test data. |
| `functions/` | Edge Functions (`account-auth`: register, OTP, password reset). | Deployed with the Supabase MCP `deploy_edge_function` or the CLI. The deployed copy must match the repo; its `verify_jwt` is `false` on purpose (it runs before login). |

## Rules for every change (from CLAUDE.md)
1. New migration file `YYYYMMDDHHMMSS_name.sql` + its `rollback/…down.sql`. Never edit a migration that was already applied.
2. Every table has Row Level Security **on**; grants are explicit and minimal; new functions get `revoke … from public, anon` then `grant execute … to authenticated`.
3. Run `tests/rules.test.sql`. Success is the message `ALL TESTS PASSED (rolled back)` (the script rolls itself back, so it leaves no data).
4. Run the advisors (Supabase dashboard -> Advisors, or MCP `get_advisors`) and explain anything new.
5. Regenerate `web/src/lib/database.types.ts` (MCP `generate_typescript_types`) so TypeScript matches the database.
6. A rollback never restores deleted data. Take a backup before any destructive migration (`DROP`, `DELETE`).

## Why the app can only call functions for most things
`employers`, `jobs`, `applications`, `unlocks`, `wallet_ledger` have **no grants at all** for the browser. The browser calls
SQL functions (`search_candidates`, `unlock_candidate`, `admin_*` …) which check who is calling and do the whole job in one
transaction. Advisor warnings "SECURITY DEFINER function executable by authenticated" for these 13 functions are expected:
they are the API, and each one checks the caller's role itself (proved by `tests/rules.test.sql`).

## Accepted limitations (Phase 1)
- `list_jobs` returns at most 100 jobs; admin lists at most 500 rows. Real paging: roadmap 4.5 / Phase 5.
- A paid unlock is only **recorded** in `wallet_ledger`; no money is collected until Phase 3 (Razorpay).
- `service_role` (the secret key) can still TRUNCATE the ledger. It must never leave the server / the owner's machine.
- Concurrency of two simultaneous unlocks is protected by `SELECT … FOR UPDATE` on the employer row and the primary key on
  `unlocks`, but a true parallel test is not automated yet (the SQL test runs in one session).

## Tests
- `tests/rules.test.sql` - database rules (run in the SQL editor / MCP; ends with "ALL TESTS PASSED (rolled back)").
- `tests/turnstile.test.mjs` - the CAPTCHA verification module against Cloudflare's real Siteverify with its dummy keys: `node supabase/tests/turnstile.test.mjs` (Node 22.18+, needs internet, no account).

## Edge Function secrets
Supabase injects `SUPABASE_URL` and the secret keys into every function. We add one: `TURNSTILE_SECRET_KEY` (the CAPTCHA secret from Cloudflare -> Turnstile). When the SMS gateway is connected, its credentials go in the same place (Edge Functions -> Secrets), never in the repo. With no `TURNSTILE_SECRET_KEY` set, only the dev test numbers work.

## Dev data
`seed/dev_seed.sql` creates fake logins WITH passwords (candidate, employer, admin and 23 other people, 5 jobs) and lists the 10 DEV test numbers (fixed OTP 123456, no SMS) so every screen can
be tried without SMS. Replace the three password placeholders with your own passwords first, keep them in a git-ignored file
(for example `web/.seed-credentials.local`), and run it only on the DEV project. It is safe to run again. The earlier key-based
script `web/scripts/seed-dev.mjs` was removed because it created logins without passwords.
