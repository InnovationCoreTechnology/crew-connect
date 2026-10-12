# Crew Connect – Development Roadmap

> **This file is the single source of truth for what to build, in what order, and what is already done.**
> It is also the working instruction for Claude (the AI assistant) on this repo. Read "Rules of engagement" first.

Last updated: 2026-10-11 · Current status: **Phase 0 – Planning (template/prototype exists, no backend)**

---

## 0. Rules of engagement (for Claude and for the owner)

1. **Do only the phase the owner names.** Never start the next phase on your own. Never assume a decision – if something is listed under "Open decisions" or is unclear, ask.
2. **Work in a new branch for every task** (see section 3). Never commit directly to `main`.
3. **Tick the checklist.** When a task is finished and verified, change `[ ]` to `[x]` in this file *in the same commit* and add the date. A commit cannot contain its own hash, so the **merge commit hash** is added afterwards in a small follow-up docs commit (in the change log, section 9). Before starting any work, read the checklist and skip what is already ticked (no repeated work).
4. **Comment the "why".** Every new file/function that is not obvious gets a short comment: *why it exists, what it does, where it is used, and a reference link* if it relies on an external service. Keep comments factual, not noisy.
5. **Tell the owner what changed.** After each task: list files changed, what changed, and how to roll it back (branch/tag name).
6. **Cost rule:** start on free tiers. Anything that costs money must be listed in the "Cost tracker" (section 6) and approved by the owner before it is added.
7. **Speed rule:** the product must feel fast on a cheap Android phone on 4G. Budgets are in section 5 and are checked at the end of every phase.
8. **Security rule:** no secrets in the repo (use `.env.local`, which is git-ignored). Never store Aadhaar numbers. Business rules that earn money (unlock, pricing, wallet) live on the **server**, never only in the browser.
9. **Verify before saying "done":** run `npm run build` and `npm run lint` **from the `web/` directory** (the scripts exist only in `web/package.json`); both must pass, and the feature must be tried in the browser.

---

## 1. Where we are today (baseline, verified 2026-10-11)

- React 19 + Vite + TypeScript + react-router, in `web/`. Commit `1f2c589`.
- Three roles with dashboards: candidate, employer, admin. Job types: Security, Housekeeping. City: Bangalore (8 areas).
- **All data is fake**: `web/src/data/mockDb.ts` (in memory) and `mockAuthService.ts` (localStorage, plain-text passwords, OTP `1234`).
- `web/src/data/api.ts` is the **only** data entry point for screens → this is the seam we replace with Supabase without rewriting screens.
- Missing: real backend, payments, job posting by employers, notifications, tests/CI, deployment, vernacular languages, verification uploads. README wrongly says Tailwind.

---

## 2. How we compete (strategy)

### 2.1 Who we are up against
General job apps (Apna, WorkIndia, Naukri, Indeed, Quikr/OLX Jobs), hiring-tech for blue-collar (Vahan and similar), and local agencies/contractors who supply guards and housekeepers by phone and WhatsApp.
*(Competitor details are from general knowledge – re-check their current pricing/features before final pricing decisions. See Phase 9.)*

### 2.2 Why we will not out-spend them
They have millions of profiles and large marketing budgets. We win by being **narrow, trusted and fast**, not bigger.

### 2.3 Our positioning
**"The fastest way to hire a verified security guard or housekeeper in your neighbourhood – same day."**

| Pillar | What competitors do | What we do | Phase |
|---|---|---|---|
| **Niche depth** | Generic categories | Only security + housekeeping (later facility staff). Guard grade, armed/unarmed, uniform, shift pattern, supervisor roles | 4, 8 |
| **Trust** | Self-declared profiles | Admin-verified ID, police-verification status, employer approval, visible trust badge | 5 |
| **Pay-for-result** | Pay to unlock, no guarantee | Wrong/unreachable number → automatic credit back. Low per-contact price | 3, 6 |
| **Local speed** | City-wide search | Area/pincode-based, "available today", distance sorting | 4, 8 |
| **Bulk & agencies** | One job at a time | Apartment associations / facility agencies post multi-opening jobs, get replacements | 4, 9 |
| **Reach for the user** | English forms | Kannada + Hindi + English, big buttons, voice-friendly, works as installed PWA, WhatsApp share and alerts | 7 |
| **Speed** | Heavy apps | Small bundle, PWA, works on slow 4G | all |

### 2.4 Go-to-market (cold start – the real challenge)
A marketplace is useless until **both** sides exist. Order:
1. **Supply first (candidates):** onboard 200–500 verified guards/housekeepers in 2–3 Bangalore areas (security agencies' bench, apartment gate guards, referral from existing staff). Free for them.
2. **Demand next (employers):** apartment associations, small offices, PGs, facility companies in those same areas. First 3 unlocks free (already in config).
3. **One area at a time.** Do not launch city-wide thin. Expand to the next area only when the current one has repeat employers.
4. **Growth loops:** referral link/WhatsApp share per candidate and per employer, shareable job cards.

### 2.5 Success metrics (decide targets with owner – see Open decisions)
Candidates registered/verified · employers approved · unlocks per employer · repeat employers (30-day) · unreachable-number rate · time-to-first-hire.

---

## 3. Branching & rollback strategy

Goal: **`main` is production and always works; any change can be undone in one step.** Full process, gate checklist and limits: [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md). Decided by the owner 2026-10-12 (replaces the earlier `phase/N-*` branch model; phase names below are now only labels for groups of tasks).

```
main                  <- production; only tested, owner-approved releases; every release is tagged v0.x.y
 └─ develop           <- integration / staging; the next release candidate
     └─ feat|fix|docs|chore/<topic>   <- one short branch per task, cut from develop
 └─ hotfix/<topic>    <- urgent production fix, cut from main, merged back into develop
```

**Flow for every task**
1. `git checkout develop && git pull` -> `git checkout -b feat/<topic>` -> small, clear commits (`feat(web): ...`).
2. PR into `develop` (default template). CI must be green. Merge with a merge commit (`--no-ff`) so each task is one revertable unit.
3. **Release:** when the owner decides `develop` is ready, a PR `develop` -> `main` using the release template. Every box needs evidence; the owner signs the approval line; migrations are applied with a backup first; merge with `--no-ff`; tag `v0.<phase>.<n>`.

**Rollback options (pick the smallest that fixes it)**
| Situation | Command |
|---|---|
| Undo one task already merged into `develop` | `git revert -m 1 <merge-commit>` |
| Undo a whole release already in `main` | `git revert -m 1 <release-merge-commit>` on a `hotfix/*` branch (new commit, safe, history kept) |
| Go back to a known good state to inspect | `git checkout v0.x.y` (release tag) |
| Production broken right now | Redeploy the previous deployment from the Cloudflare dashboard (instant, no git needed) - see Phase 2 |
| Bad database change | Ship a **new forward "compensating" migration** that reverses the change (Supabase applies migrations forward; it does not run paired `down` files automatically). Reversing a destructive change (drop column/table, delete rows) **cannot restore data**, so before applying one: take a backup (`pg_dump`, Phase 2.10), apply on a test/branch database first, and rehearse the restore. See Phase 1.3 |

**Rules**
- Never commit or push directly to `main` or `develop`; never `git push --force` on them; never rewrite published history.
- Never delete a branch or tag until the owner says so.
- Only `develop` goes to `main`, and only through the release PR (or a hotfix PR). Nothing reaches `main` that is not tested and approved by the owner.
- Database and code changes of a task live in the **same branch**, but reverting the code does **not** undo an already-applied database migration. Roll back the database separately with a compensating migration or a backup restore (see the rollback table). Prefer additive, backward-compatible migrations (add columns/tables first, remove old ones in a later release) so old code keeps working.
- Risky features go behind a **feature flag**. A flag in `web/src/app/config.ts` is compiled into the bundle, so changing it needs a new build and deploy (still quick, but not instant). For an **instant kill switch without redeploying**, store the flag server-side (a Supabase `feature_flags` table read at app start) - decided per feature in the phase that needs it.
- Claude pushes, opens PRs and merges only when the owner says so.
- **Enforcement today is process + CI only:** GitHub Free cannot lock branches on a private repo (checked 2026-10-12). Upgrade tracked in 2.11.

---

## 4. The free-first stack (and what is NOT free)

| Need | Choice (proposed – owner confirms in Open decisions) | Free tier / cost | Why this one | Reference |
|---|---|---|---|---|
| Frontend hosting | Cloudflare (Workers Static Assets; Pages is the older product) – **decided D1** | Static asset requests free and unlimited per Cloudflare docs (checked 2026-10-11) | Fast static hosting, instant rollbacks, preview URL per branch | https://developers.cloudflare.com/pages/ |
| Database + Auth + Storage + API | Supabase – **decided D2** | Free plan (small DB, file storage, monthly active users cap). **Free projects pause after about a week of inactivity** and have no automatic backups | Postgres + Row Level Security + auth in one; fits our `api.ts` seam | https://supabase.com/docs , https://supabase.com/pricing |
| SMS OTP | MSG91 – **decided D3** (Fast2SMS fallback) | **Not free** – pay per SMS (low, paise-level) and needs **DLT registration** (mandatory in India, takes days) | Phone OTP is how this audience logs in. Cheapest realistic option | https://msg91.com , https://www.fast2sms.com |
| Payments | Razorpay | No monthly fee; per-transaction fee (~2%) taken only when money moves | Standard in India, supports UPI | https://razorpay.com/docs |
| Error tracking | Sentry | Free developer plan | See production errors, not guess | https://docs.sentry.io |
| Analytics | Plausible (paid) or PostHog / Cloudflare Web Analytics | CF Web Analytics free; PostHog has a free tier | Know what users do, privacy friendly | https://posthog.com/pricing |
| CI | GitHub Actions | Free minutes for repos | Build + lint + tests on every PR | https://docs.github.com/actions |
| WhatsApp | Start with free `wa.me` share links; WhatsApp Business API is **paid per conversation** | Free (links) → paid later | No cost until proven useful | https://developers.facebook.com/docs/whatsapp |
| Domain | Any registrar | ~₹700–1,000/year | Needed for trust and SMS sender approval | – |

> **Honest cost note:** "zero cost" is not fully possible. The unavoidable early costs are the **domain** and **SMS OTP** (+ DLT registration). Everything else can start free. Free-tier limits change – re-check each pricing page before depending on it.

---

## 5. Performance & quality budgets (checked at the end of every phase)

- First load JS (gzipped): **< 150 KB** for the landing/login route; dashboards lazy-loaded per role (`React.lazy`).
- Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 90.
- Lists (candidates/jobs) paginated – no "load everything".
- Debounced search (already in `useDebouncedValue`), indexes on every filtered DB column.
- Images compressed; no large images on first screen.
- Works usably on a slow 4G / low-end Android (test with Chrome DevTools throttling).

---

## 6. Cost tracker (update whenever something paid is added)

| Item | Type | Monthly / one-time | Added in phase | Approved by owner |
|---|---|---|---|---|
| Domain | one-time/yearly | TBD | 2 | [ ] |
| SMS OTP + DLT registration | per SMS (third-party estimates ₹0.15–0.25 per OTP before GST; MSG91's own rate card still UNVERIFIED) | TBD | 1 | [ ] |
| Razorpay | % per transaction | only on revenue | 3 | [ ] |
| Supabase Pro (only if free limits hit / need backups) | monthly | TBD | when needed | [ ] |

---

## 7. Open decisions (owner must answer – Claude must NOT assume)

- [x] D1. Hosting: **Cloudflare** (static assets on its CDN). Decided by Claude on owner's delegation, 2026-10-11. Vercel Hobby rejected (non-commercial only). Reasons + sources: `docs/BACKEND_PLAN.md`
- [x] D2. Backend: **Supabase** (Postgres + Auth + Storage + Edge Functions), Mumbai region. Same delegation/date. Free to start, Pro (~$25/mo) when triggers in `docs/BACKEND_PLAN.md` §2 are hit
- [x] D3. SMS provider: **MSG91** (Fast2SMS = fallback), now called from OUR Edge Function `account-auth` (not through Supabase's phone provider, which cannot be enabled without Twilio-style credentials). The SMS adapter `supabase/functions/account-auth/sms.ts` is a stub until MSG91's official API is read (item 1.8). Official MSG91 price still **unverified**; DLT registration entity name still needed from owner
- [x] D4. Login method: **REVISED 2026-10-11 by the owner (twice)**: mobile number + password to log in; an SMS OTP only to register (verify the number, then create a password) and to reset a forgotten password. Second revision, same day: Supabase's phone provider is NOT used (it needs Twilio-style credentials and does not support MSG91). A login is a hidden email-style identity `<10 digits>@users.crewconnect.invalid` + password; the OTP is generated, hashed, rate-limited and checked in our own database tables and sent by the Edge Function. Details: `docs/BACKEND_PLAN.md`
- [ ] D5. Pricing: keep ₹30/unlock + 3 free? Wallet top-up minimum? Refund policy for wrong numbers?
- [ ] D6. Legal entity / GST for invoices; privacy policy & terms owner?
- [ ] D7. Launch city/areas order (Bangalore: which 2–3 areas first)?
- [ ] D8. Languages for Phase 7 (Kannada, Hindi, others)?
- [ ] D9. Verification depth: ID photo only, or also police verification partner?
- [ ] D10. Success-metric targets for first 90 days?
- [ ] D11. Product name/domain final? ("Crew Connect" confirmed?)

---

## 8. PHASES – Progress checklist

Legend: `[ ]` not started · `[x]` done (add date; merge hash goes in the change log afterwards) · every phase ends with its **Exit check** and tag `phase-N-done`.

### Phase 0 – Planning & foundations  *(branch: `docs/development-roadmap`)*
Why: agree the plan before spending effort.
- [x] 0.1 Review existing template and write this roadmap (2026-10-11)
- [ ] 0.2 Owner answers remaining Open decisions D5–D11 (D1–D4 done)
- [ ] 0.3 Fix README (remove false Tailwind claim, add run/build instructions and link to this file)
- [ ] 0.4 Add `.env.example` (names of variables only, no secrets) and confirm `.env*` is git-ignored
- [ ] 0.5 Set up branch protection on `main` on GitHub (owner action; Claude gives steps)
- [x] 0.6 Add `CLAUDE.md` (standing rules), `docs/BACKEND_PLAN.md`, `docs/IMPLEMENTATION_LOG.md`; decide D1–D4 (2026-10-11, branch `docs/instructions-backend-plan`)
- [ ] 0.7 Dependency check: `npm outdated` shows TypeScript 6.0.3 → 7.0.2 and @types/node 24 → 26 (majors). Upgrade on `chore/deps-*` branches only after reading the official migration guides (owner decides when)
**Exit check:** owner has approved the plan and picked the next phase.

### Phase 1 – Real backend: database, auth, security  *(branch: `phase/1-backend-auth`)*
Why: today nothing is real. Money rules and personal data cannot live in the browser.
- [x] 1.1 Create Supabase project (owner creates account; Claude gives steps), store keys in `.env.local` — done 2026-10-11 (project `crew-connect`, Mumbai; the first Sydney project was deleted)
- [x] 1.2 Add `web/src/lib/supabase.ts` client (comment: why one shared client) — 2026-10-11, typed with generated `database.types.ts`
- [x] 1.3 Create `supabase/migrations/` – SQL tables: `profiles`(role), `candidates`, `employers`, `jobs`, `applications`, `unlocks`, `wallet_ledger`. **Rollback = forward compensating migration** (a new file that reverses the change; Supabase does not auto-run `down` files). Keep a reversal script next to each migration, test it on a throwaway database, and require a verified backup before any destructive migration (drop/delete) — done 2026-10-11; reversal scripts in `supabase/rollback/` tested in a rolled-back transaction
- [x] 1.4 Indexes on filtered columns (type, area, shift, salary, verified) — 2026-10-11; EXPLAIN ANALYZE at 100k rows: first page 0.05 ms, page 50,000 deep 0.05 ms, multi-filter 0.25 ms, name search (trigram) 10 ms
- [x] 1.5 **Row Level Security** policies: candidates edit only own row; employers see candidates **without phone**; admins full access; phone only returned via the unlock function — done 2026-10-11 (employers use `search_candidates()`; proved by `supabase/tests/rules.test.sql`)
- [x] 1.6 SQL function `unlock_candidate()` – one atomic transaction: check employer approved → check not already unlocked → use free unlock or deduct balance → record unlock → return phone. Comment each rule (this is the revenue protection) — done 2026-10-11. NOTE: a paid unlock is only recorded in the ledger until Phase 3 collects money
- [x] 1.7 Replace `mockAuthService` with `supabaseAuthService` (same interface) and switch in `features/auth/services/index.ts`. Remove plain-text passwords and `demoOtp` — done 2026-10-11 and reworked twice the same day (final design: D4 above; branch `phase/1b-password-login`). TESTED in a browser against the live Mumbai project with every role (see log)
- [x] 1.13 Own OTP + account system (added 2026-10-11, replaces the Supabase phone provider): migration `20261011140000_own_otp_accounts.sql` (OTP tables, rate limits, server-only functions), Edge Function `account-auth` (send-otp, check-otp, register, reset-password), SQL rule tests extended, dev test numbers. Verified: SQL tests, 17-step live API test, browser tests for candidate / employer / pending employer / admin / register / forgot password
- [ ] 1.8 SMS gateway for real numbers: connect MSG91 in `supabase/functions/account-auth/sms.ts` (read MSG91's official API docs first; needs the owner's MSG91 account, DLT-approved OTP template, and secrets set in Supabase -> Edge Functions -> Secrets). **The Supabase Phone provider is NOT needed and should stay OFF (the Twilio form can be cancelled).** Until then Register / Forgot password work only for the 10 DEV test numbers `9000000001`-`9000000010` (fixed OTP 123456, no SMS); real numbers get "We could not send the SMS"
- [x] 1.9 Rewrite `data/api.ts` bodies to call Supabase, **keeping function names and return types**; delete `mockDb.ts` — done 2026-10-11. Names kept; params that became server-side (user id/phone) were dropped; lists now return pages (`Page<T>`) and admin lists `AdminList<T>` (see log)
- [x] 1.10 Admin user created manually in DB (never via sign-up) — DEV admin `9845000000` created by `supabase/seed/dev_seed.sql` on 2026-10-11 (password only in the owner's git-ignored `web/.seed-credentials.local`); `create_admin.sql` remains the way to make real admins. Login NOT yet tried (needs the Phone provider, see 1.8)
- [x] 1.11 Seed script for dev data (separate from production) — `supabase/seed/dev_seed.sql` APPLIED 2026-10-11 to the DEV project: 26 logins with passwords (21 candidates incl. one with an empty profile, 4 employers incl. one Pending, 1 admin), 5 jobs, 1 application. Replaced the earlier key-based script (it made logins without passwords). Rows were inserted by hand into `auth.users`: UNVERIFIED that Supabase Auth accepts them until a login succeeds (needs 1.8 step 1)
- [x] 1.12 Protect against abuse — database limits (tested): 60 s gap between OTPs, 5 per number per hour, 300 per hour for the whole project (SMS cost cap), 5 wrong guesses per code, 5-minute expiry, codes stored hashed (numbers in `app_settings`). CAPTCHA (Cloudflare Turnstile, free) added 2026-10-12 on Send OTP / Resend OTP: the browser widget collects a one-time token and the Edge Function verifies it with Cloudflare BEFORE any database work (fails closed). Safety rule: with no `TURNSTILE_SECRET_KEY` configured, a real SMS is never sent. OWNER TO DO before real SMS: create the Turnstile widget (Cloudflare dashboard -> Turnstile, hostnames: the workers.dev address, later your domain), put the SITE key in `VITE_TURNSTILE_SITE_KEY` (build variable / `web/.env.local`) and the SECRET key in Supabase -> Edge Functions -> Secrets -> `TURNSTILE_SECRET_KEY`. Not covered by CAPTCHA: password login (limited only by Supabase's own Auth rate limits, default numbers UNVERIFIED) and the OTP check (limited by the 5-guess rule)
**Exit check:** two different browsers/accounts cannot see each other's private data; cannot get a phone number without unlock; unlock cannot be repeated for free; build + lint pass.

### Phase 2 – Deploy + CI + monitoring (free)  *(branch: `phase/2-deploy-ci`)*
Why: deploy early and often so every later phase is tested in real conditions, and rollback exists from day one.
- [ ] 2.1 (PARTLY DONE 2026-10-11: site is live at https://crew-connect.innovationcore.workers.dev via a manual `npx wrangler deploy`; SPA fallback verified. STILL TO DO: connect GitHub for auto-deploys + branch preview URLs, and document/test the rollback) Connect repo to Cloudflare (D1) and verify SPA fallback routing + rollback procedure in its official docs; every branch gets a preview URL; `main` = production
- [ ] 2.2 Environment variables set in hosting (staging vs production Supabase projects if owner approves; otherwise one project and a clear note of the risk)
- [ ] 2.3 GitHub Actions: install → `tsc` → `eslint` → build on every PR
- [ ] 2.4 Add Vitest + first tests for pure logic (`rules.ts`, `filters.ts`, validators, `maskPhone`)
- [ ] 2.5 Sentry error tracking (free plan)
- [ ] 2.6 Basic analytics (privacy-friendly, free)
- [x] 2.7 Lazy-load role dashboards (`React.lazy`) to meet the bundle budget; record bundle size in this file — done early (2026-10-11) because Phase 1's `@supabase/supabase-js` pushed the bundle to 147 KB gzip. Now **141.4 KB gzip** first load (budget 150 KB; the Supabase client is about 49 KB of it). Perf pass (Phase 7) can try the smaller `auth-js` + `postgrest-js` packages (UNVERIFIED that Supabase supports that)
- [ ] 2.8 Custom domain + HTTPS (domain cost → Cost tracker)
- [ ] 2.9 Write "How to roll back production" in this file after testing it once for real
- [ ] 2.10 Supabase free-tier keep-alive + manual backup routine (free projects pause and lack backups) – export SQL weekly until paid plan
- [ ] 2.11 Before a second developer joins: GitHub Pro (or org plan) and branch protection / rulesets on `main` and `develop` (require PR, require the CI check, 1 Code Owner approval, no force-push/delete). Price -> Cost tracker, owner approves first
- [ ] 2.12 Before real users: separate production Supabase project + a staging address for `develop` (Cloudflare Workers Builds: production branch `main`, `develop` builds get preview URLs); `main` deploys to production only
- [x] 2.13 Branching model main/develop, CI workflow, PR + release templates, CODEOWNERS, `docs/RELEASE_PROCESS.md` (2026-10-12; the CI check's first real run is on the PR of this task)
- [x] 4.x Saved candidate profile view with strength meter (owner-approved mockup option A; 2026-10-12). Photo, languages, skills and about-me are NOT built: they need new fields (migration + rollback + privacy review) and stay open
**Exit check:** merging to `main` auto-deploys; a deliberate bad deploy was rolled back successfully in under 2 minutes.

### Phase 3 – Payments & wallet  *(branch: `phase/3-payments`)*
Why: this is the revenue. Must be correct before real users pay.
- [ ] 3.1 Wallet model: balance computed from `wallet_ledger` (append-only, never edit rows)
- [ ] 3.2 Razorpay account + test mode; top-up via UPI/cards (D5 pricing)
- [ ] 3.3 Server-side payment verification (webhook / Edge Function with signature check) – never trust the browser
- [ ] 3.4 Unlock deducts from wallet atomically (extends 1.6)
- [ ] 3.5 "Number not working" report → admin review or auto-check → credit back
- [ ] 3.6 Employer billing page: balance, top-up, transaction history, GST invoice (D6)
- [ ] 3.7 Admin revenue dashboard (replace the simple counter)
**Exit check:** test-mode payments reconcile exactly with ledger; double-click / retry cannot double-charge or double-credit.

### Phase 4 – Complete the marketplace loop  *(branch: `phase/4-jobs-hiring`)*
Why: today employers cannot post jobs, so the candidate side has nothing to apply to.
- [ ] 4.1 Employer job posting: create / edit / close job, multiple openings
- [ ] 4.2 Employer company profile: company name, address, GST (collected at first login – currently blank)
- [ ] 4.3 Applicant pipeline per job: Applied → Shortlisted → Interview → Hired / Rejected
- [ ] 4.4 Candidate sees status changes in "My applications"
- [ ] 4.5 Pagination + server-side filtering for candidates and jobs — candidates and unlocked lists are DONE in Phase 1 (keyset paging + Load more); jobs (capped at 100) and admin lists (capped at 500) remain
- [ ] 4.6 Make job types/areas data-driven (tables) instead of hard-coded lists in `config.ts`
- [ ] 4.7 Job expiry and "filled" state
**Exit check:** full loop works with real accounts: post job → candidate applies → employer shortlists → candidate sees it.

### Phase 5 – Trust & verification  *(branch: `phase/5-trust-verification`)*
Why: trust is our main differentiator vs generic job apps.
- [ ] 5.1 Candidate ID photo / document upload to private storage bucket (never store Aadhaar numbers; D9)
- [ ] 5.2 Admin verification queue: approve / reject with reason
- [ ] 5.3 Employer approval flow with company details review (replace manual toggle)
- [ ] 5.4 Verification levels shown as badges (ID verified, police verified if D9)
- [ ] 5.5 Ratings/feedback from employers after hire (simple, abuse-protected)
- [ ] 5.6 Report/block flow + audit log of admin actions
- [ ] 5.7 Privacy policy, terms, data deletion request (legal requirement; D6)
**Exit check:** uploaded documents are not publicly reachable; every admin action is logged.

### Phase 6 – Notifications  *(branch: `phase/6-notifications`)*
Why: this audience lives on WhatsApp/SMS, not email.
- [ ] 6.1 Notification events table (one place that decides who is told what)
- [ ] 6.2 SMS for critical events only (cost control)
- [ ] 6.3 Free WhatsApp share links (`wa.me`) for job sharing and referral
- [ ] 6.4 Decide if WhatsApp Business API is worth the per-message cost (owner decision, then implement)
- [ ] 6.5 In-app notification centre
**Exit check:** shortlist event reaches the candidate within a minute; monthly notification cost is visible in Cost tracker.

### Phase 7 – Language, accessibility, PWA (reach & speed)  *(branch: `phase/7-languages-pwa`)*
Why: low-literacy, mobile-first users are lost by an English-only form UI.
- [ ] 7.1 i18n setup; Kannada + Hindi + English (D8). All text moved out of components (extend the `copy.ts` pattern)
- [ ] 7.2 Language picker on first screen, remembered
- [ ] 7.3 Big tap targets, icons with text, simple short forms, clear error messages
- [ ] 7.4 PWA: installable, offline fallback page, caching of static assets
- [ ] 7.5 Accessibility pass (keyboard, contrast, screen-reader labels)
- [ ] 7.6 Performance pass against section 5 budgets (Lighthouse report saved in `docs/`)
**Exit check:** a first-time user can register a profile in Kannada on a low-end phone in under 2 minutes.

### Phase 8 – Differentiators  *(branch: `phase/8-differentiators`)*
Why: this is what makes a niche product beat generic apps.
- [ ] 8.1 Security/housekeeping specific fields: guard grade, armed/unarmed, uniform, supervisor, languages known, ex-serviceman
- [ ] 8.2 Area/pincode distance sorting; "available today" filter
- [ ] 8.3 Saved searches + alerts for employers; job alerts for candidates
- [ ] 8.4 Bulk hiring: multi-opening jobs, shortlists shared with a team
- [ ] 8.5 Agency accounts (many sites, many hires) and replacement requests
- [ ] 8.6 Simple matching score (job ↔ candidate) shown on cards
**Exit check:** measured faster time-to-shortlist vs generic search (owner-defined metric, D10).

### Phase 9 – Launch, learn, expand  *(branch: `phase/9-launch`)*
Why: product is only proven by real usage.
- [ ] 9.1 Re-check competitor pricing/features; adjust pricing (D5)
- [ ] 9.2 Soft launch in 1–2 areas with real users; support channel (WhatsApp number)
- [ ] 9.3 Weekly review of metrics (section 2.5); fix top friction points
- [ ] 9.4 Referral program
- [ ] 9.5 Upgrade to paid tiers only when free limits are actually hit (backups, no pausing) – update Cost tracker
- [ ] 9.6 Expand to next area/city using the data-driven areas from 4.6
**Exit check:** repeat employers exist in the launch areas; unreachable-number rate under owner target.

---

## 9. Change log (one line per finished task; full detail in `docs/IMPLEMENTATION_LOG.md`)

| Date | Task | Branch | Commit | Rollback |
|---|---|---|---|---|
| 2026-10-11 | 0.1 Roadmap created | `docs/development-roadmap` | f68dc6e | delete file / revert commit |
| 2026-10-11 | 0.6 Instructions, backend plan, D1–D4 | `docs/instructions-backend-plan` | 429ce3f | revert commit |
| 2026-10-11 | 1.3–1.6 Database schema, RLS, functions, tests | `feat/db-schema` | 233a539 (merge 9f57887) | `git revert -m 1 9f57887` + apply `supabase/rollback/*` in reverse order |
| 2026-10-11 | 1.2, 1.7, 1.9, 2.7 Supabase client, OTP login, data layer | `feat/frontend-supabase` | 912722b (merge f268f03) | `git revert -m 1 f268f03` |
| 2026-10-11 | 1.11 Dev seed script (not run) | `feat/dev-seed` | 175ecbb (merge 4442a37) | `git revert -m 1 4442a37` |
| 2026-10-11 | D4 revised: mobile + password login, OTP to register/reset; SQL dev seed | `phase/1b-password-login` | 3118b4f, 4cebd61 | `git revert -m 1 754e523` and `git revert 4cebd61`; seeded users: see rollback note in `supabase/seed/dev_seed.sql` |
| 2026-10-11 | D4 revised again: own OTP system + `account-auth` Edge Function, no Supabase phone provider; seed moved to email-style logins | `phase/1b-password-login` (tasks `feat/own-otp-database`, `feat/own-otp-app`) | see git log | `git revert -m 1 <merge>`; database: `supabase/rollback/20261011140000_own_otp_accounts.down.sql`; function: redeploy the previous version or delete `account-auth` in the dashboard |
| 2026-10-12 | 1.12 CAPTCHA (Turnstile) on OTP requests | `phase/1b-password-login` (task `feat/captcha`) | see git log | `git revert -m 1 <merge>`; Edge Function: redeploy the previous version (v2/v3 differ only by the CAPTCHA lines) |
| 2026-10-12 | PR #6 review: 8 findings fixed (orphan login recovery, number-probing limits + per-IP limit, dev_mode switch, OTP retention, consume check, advisory lock, 72 BYTES, sessions ended after reset) | `fix/pr6-review` into `phase/1b-password-login` | see git log | `git revert -m 1 <merge>`; database `supabase/rollback/20261012100000_otp_review_fixes.down.sql`; Edge Function: redeploy version 3 |
| 2026-10-12 | CAPTCHA now runs ON DEMAND (only when Send / Resend OTP is pressed) | `fix/captcha-on-demand` | see git log | `git revert -m 1 <merge>` |
| 2026-10-12 | 2.13 Branching model main/develop, CI, PR/release templates, CODEOWNERS, release process | `docs/branching-strategy` into `develop` | see git log | `git revert -m 1 <merge>` |
| 2026-10-12 | Saved candidate profile view (card + profile strength + Edit) | `feat/candidate-profile-view` into `develop` | see git log | `git revert -m 1 <merge>` |
| 2026-10-12 | Release v0.1.0 (first release: develop -> main via PR #9; tag on `4464f5f`; the release template was NOT used for this first one) | `develop` into `main` | 4464f5f | Cloudflare: redeploy previous deployment; git: `git revert -m 1 4464f5f` on a `hotfix/*` branch |
