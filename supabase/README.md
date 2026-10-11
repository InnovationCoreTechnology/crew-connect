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

## Dev data
`npm run seed:dev -- --dry-run` (from `web/`) shows the plan. A real run needs the **secret key** in `web/.env.seed.local`
(git-ignored) plus `SEED_CONFIRM=crew-connect-dev`. See the header of `web/scripts/seed-dev.mjs`.
