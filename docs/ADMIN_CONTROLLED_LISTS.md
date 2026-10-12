# Admin-controlled lists – design (not built yet)

Status: **DESIGN FOR OWNER APPROVAL**, written 2026-10-12. Nothing in this file is implemented. It expands roadmap item 4.6.
Trigger: the owner wants the "Job type" dropdown to offer designations (like job apps do) and wants an admin to control those lists, plus any other data that should be admin-controlled, instead of developers editing code.

## 1. Problem today

Lists are written into the code and into database CHECK constraints:

| Data | Where it is fixed today |
|---|---|
| Job type: Security, Housekeeping | `web/src/app/config.ts` (`JOB_TYPES`) and `CHECK` on `candidates.type` and `jobs.type` |
| Areas (8 in Bangalore) | `config.ts` (`AREAS`); the database only checks length |
| Shift: Day, Night, Any | `config.ts` and `CHECK` on `candidates.shift` / `jobs.shift` |
| Availability: Immediate, 15 days, 30 days | `config.ts` and `CHECK` on `candidates.avail` |
| Price per unlock, free unlocks | `app_settings` table (server) and a display copy in `config.ts`; **no admin screen** |
| Salary limits 5,000 to 1,00,000, experience 0 to 40 | `CHECK` constraints and the validators |

Adding one designation today means a code change, a migration and a release. That does not scale and an admin cannot do it.

## 2. What becomes admin-controlled, and what stays fixed

| Data | Admin-controlled? | Reason |
|---|---|---|
| **Job categories** (main list: Security, Housekeeping, later Driver...) | **Yes** | Owner request |
| **Designations** (sub list per category: e.g. Security guard, Supervisor) | **Yes** | Owner request |
| **Cities and areas** (areas belong to a city) | **Yes** | Needed to expand beyond Bangalore (roadmap 9.6); already named in 4.6 |
| **Business numbers** (price per unlock, free unlocks for a new employer) | **Yes** (screen for the existing `app_settings`) | Today only changeable by SQL |
| **Verification rejection reasons** (roadmap 5.2) | **Yes** (small list) | Admin needs consistent reasons |
| **Report reasons** ("number not working", roadmap 3.5 / 5.6) | **Yes** (small list) | Same |
| **Languages, skills / certificates** (Phase 7 and later) | **Yes**, built on the same mechanism | Avoids a second design later |
| Shift (Day / Night / Any) | **No, fixed in code** | The search rule "Any matches every shift" is logic, not a label |
| Availability (Immediate / 15 / 30 days) | **No, fixed** (owner may change this) | Same reason: it is ordered and used for filtering |
| Roles, employer status, application status, wallet reasons | **No** | The program's rules depend on these exact values |
| Salary and experience limits | **Later**, as `app_settings` numbers | Safety limits; changing them is rare |

Rule of thumb used: a list is admin-controlled when only **names** change and no program rule depends on the exact value.

## 3. Data design

All new tables have Row Level Security. Everyone logged in may **read active rows**; only an **admin** may write, and only through server functions (SECURITY DEFINER, `set search_path = ''`), never by direct table writes.

```
job_categories ( id uuid pk, name text unique (case-insensitive), sort_order int, active bool default true, created_at )
designations   ( id uuid pk, category_id fk -> job_categories, name text, sort_order int, active bool default true,
                 unique (category_id, lower(name)) )
cities         ( id uuid pk, name text unique, active bool )
areas          ( id uuid pk, city_id fk -> cities, name text, active bool, unique (city_id, lower(name)) )
admin_audit    ( id, admin_id, action, table, row_id, old jsonb, new jsonb, at )   -- shared with roadmap 5.6
```

Changes to existing tables (expand first, remove later, so old code keeps working during a release):
- `candidates` and `jobs` get `category_id` and `designation_id` (nullable at first). The old `type` text column stays until every screen uses the new columns, then a later migration drops it.
- A trigger checks that the chosen designation belongs to the chosen category and is active when it is newly chosen.
- `areas`: `candidates.area` / `jobs.area` move to an `area_id` the same way.
- Existing values are copied over by the migration (Security, Housekeeping and the 8 areas become rows), so no profile loses data.

Rules that protect data:
- **No hard delete of a row in use.** Admin can only **deactivate**: it disappears from new choices, but people who already have it keep it and still show correctly. Deactivated rows can be reactivated (this is the "undo").
- **Rename** keeps the same id, so every profile and job updates by itself.
- Names are validated on the server: 2 to 60 characters, no duplicates inside a list.
- Every admin change is written to `admin_audit`.

Performance: lists are tiny (tens of rows). The app loads each list once after login and keeps it in memory. Search filters by id; indexes `(designation_id) where visible` on `candidates` and `jobs` keep the filters fast. No N+1: lists are fetched with one query each (or one function returning all).

## 4. Admin screen

A new **Lists** tab in the admin dashboard:
1. **Job categories and designations:** each category is a card; inside it the designations can be added, renamed, reordered and deactivated. Each row shows "used by N candidates / M jobs".
2. **Cities and areas:** same pattern.
3. **Business numbers:** price per unlock, free unlocks (with min/max and "saved" state).
4. **Reasons:** verification rejection and report reasons.

Every action has loading, error and "saved" states; deactivating something in use asks for confirmation and states the count.

## 5. How the other screens use it

- Candidate form: **Job category** dropdown, then a **Designation** dropdown filled from the chosen category.
- Employer "Post a job": the same two dropdowns. Employer search filters: category and designation.
- Candidate card and employer search row show "Security guard · Whitefield" instead of just "Security".
- Admin tables show the same labels.

## 6. Build order (each is a task branch from `develop`, one PR each)

1. **DB:** tables, RLS, admin functions, audit table, migration that copies today's values, rollback script, SQL tests (admin can write, others cannot read inactive/write, trigger rejects wrong category, deactivate keeps old data).
2. **Admin Lists tab** (categories and designations first).
3. **Candidate, job-post and search screens** use the lists (replace `JOB_TYPES`; keep `type` readable until everything is switched).
4. **Cities and areas** (same pattern).
5. Business numbers and reasons screens.
6. Cleanup migration: drop the old `type` / `area` columns after a release has run on the new ones.

Steps 1 and 3 change the database, so each is released with a backup and the tested rollback (see `docs/RELEASE_PROCESS.md`).

## 7. Risks and how they are handled

| Risk | Handling |
|---|---|
| Admin mistake (typo, wrong delete) | Deactivate instead of delete, reactivate to undo, audit log, usage counts and confirmation |
| Old app version still sends the old text value | Expand/contract migration keeps `type` working for one release |
| Too many tiny designations make search useless | Owner decides the starter list; a sensible cap per category (suggested 30) in the server function |
| Only one admin account today | Audit log records who changed what; a super-admin split is a later decision (D14) |

## 8. Cost

None. Plain Postgres tables; no new service or dependency.

## 9. Open decisions for the owner (do not build before answered)

- **D12.** The starter **designation names** for Security and for Housekeeping (the owner supplies them; Claude does not invent job titles).
- **D13.** Can a candidate choose **one** designation or **several**? (Several needs a join table and changes search; recommended: one now.)
- **D14.** Who may edit the lists: every admin, or only a "super admin"? (Today there is one admin.)
- **D15.** Launch **Bangalore only**, or build cities now? (Recommended: build the city table now, expose only Bangalore.)
- **D16.** Should an employer or candidate be able to **suggest** a missing designation (goes to the admin to approve), or is it admin-only? (Recommended: admin-only first.)
- **D17.** Keep **Shift** and **Availability** fixed in code (recommended), or make them admin lists too?
