# Crew Connect – Development Roadmap

> **This file is the single source of truth for what to build, in what order, and what is already done.**
> It is also the working instruction for Claude (the AI assistant) on this repo. Read "Rules of engagement" first.

Last updated: 2026-10-11 · Current status: **Phase 0 – Planning (template/prototype exists, no backend)**

---

## 0. Rules of engagement (for Claude and for the owner)

1. **Do only the phase the owner names.** Never start the next phase on your own. Never assume a decision – if something is listed under "Open decisions" or is unclear, ask.
2. **Work in a new branch for every task** (see section 3). Never commit directly to `main`.
3. **Tick the checklist.** When a task is finished and verified, change `[ ]` to `[x]` in this file *in the same commit*, and add the date + commit hash. Before starting any work, read the checklist and skip what is already ticked (no repeated work).
4. **Comment the "why".** Every new file/function that is not obvious gets a short comment: *why it exists, what it does, where it is used, and a reference link* if it relies on an external service. Keep comments factual, not noisy.
5. **Tell the owner what changed.** After each task: list files changed, what changed, and how to roll it back (branch/tag name).
6. **Cost rule:** start on free tiers. Anything that costs money must be listed in the "Cost tracker" (section 6) and approved by the owner before it is added.
7. **Speed rule:** the product must feel fast on a cheap Android phone on 4G. Budgets are in section 5 and are checked at the end of every phase.
8. **Security rule:** no secrets in the repo (use `.env.local`, which is git-ignored). Never store Aadhaar numbers. Business rules that earn money (unlock, pricing, wallet) live on the **server**, never only in the browser.
9. **Verify before saying "done":** `npm run build` and `npm run lint` must pass, and the feature must be tried in the browser.

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

Goal: **any change can be undone in one step**, and `main` is always deployable.

```
main                       ← always working/deployable; protected; only receives merges
 └─ phase/N-name           ← one long-lived branch per phase (e.g. phase/1-backend-auth)
     └─ feat/<topic>       ← short branch per task (e.g. feat/supabase-client)
     └─ fix/<topic>        ← bug fixes
     └─ docs/<topic>       ← docs only
```

**Flow for every task**
1. `git checkout main && git pull` → `git checkout -b phase/N-name` (once per phase).
2. `git checkout -b feat/<topic>` from the phase branch → work → commit small, clear commits (`feat(web): …`).
3. Merge `feat/*` into `phase/N-*` using a **merge commit (`--no-ff`)** so each task is one revertable unit.
4. When the whole phase checklist is done and verified → open a PR `phase/N-*` → `main`, merge with `--no-ff`, then **tag**: `phase-N-done` (and `v0.N.0`).

**Rollback options (pick the smallest that fixes it)**
| Situation | Command |
|---|---|
| Undo one task already merged into a phase branch | `git revert -m 1 <merge-commit>` |
| Undo a whole phase already in `main` | `git revert -m 1 <phase-merge-commit>` (new commit, safe, history kept) |
| Go back to a known good state to inspect | `git checkout phase-N-done` (tag) |
| Production broken right now | Redeploy previous deployment from hosting dashboard (instant, no git needed) – see Phase 2 |
| Bad database change | Run the matching **down migration** (every migration ships with one, see Phase 1) |

**Rules**
- Never `git push --force` on `main`. Never rewrite published history.
- Never delete a phase branch or tag until the owner says so.
- Database and code changes of a task live in the **same branch**, so they are reverted together.
- Risky features go behind a **feature flag** (`web/src/app/config.ts` → `FEATURES`) so they can be switched off without a deploy rollback.
- Claude pushes/merges only when the owner says so.

---

## 4. The free-first stack (and what is NOT free)

| Need | Choice (proposed – owner confirms in Open decisions) | Free tier / cost | Why this one | Reference |
|---|---|---|---|---|
| Frontend hosting | Cloudflare Pages (or Vercel/Netlify) | Free, global CDN, unlimited bandwidth on CF | Fast static hosting, instant rollbacks, preview URL per branch | https://developers.cloudflare.com/pages/ |
| Database + Auth + Storage + API | Supabase | Free plan (small DB, file storage, monthly active users cap). **Free projects pause after about a week of inactivity** and have no automatic backups | Postgres + Row Level Security + auth in one; fits our `api.ts` seam | https://supabase.com/docs , https://supabase.com/pricing |
| SMS OTP | MSG91 or Fast2SMS | **Not free** – pay per SMS (low, paise-level) and needs **DLT registration** (mandatory in India, takes days) | Phone OTP is how this audience logs in. Cheapest realistic option | https://msg91.com , https://www.fast2sms.com |
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
| SMS OTP + DLT registration | per SMS | TBD | 1 | [ ] |
| Razorpay | % per transaction | only on revenue | 3 | [ ] |
| Supabase Pro (only if free limits hit / need backups) | monthly | TBD | when needed | [ ] |

---

## 7. Open decisions (owner must answer – Claude must NOT assume)

- [ ] D1. Hosting: Cloudflare Pages vs Vercel vs Netlify?
- [ ] D2. Backend: Supabase confirmed? (alternatives: Firebase, self-hosted)
- [ ] D3. SMS provider: MSG91 vs Fast2SMS? (DLT registration entity name needed)
- [ ] D4. Login method: phone + OTP only, or phone + password + OTP (current mock does both)?
- [ ] D5. Pricing: keep ₹30/unlock + 3 free? Wallet top-up minimum? Refund policy for wrong numbers?
- [ ] D6. Legal entity / GST for invoices; privacy policy & terms owner?
- [ ] D7. Launch city/areas order (Bangalore: which 2–3 areas first)?
- [ ] D8. Languages for Phase 7 (Kannada, Hindi, others)?
- [ ] D9. Verification depth: ID photo only, or also police verification partner?
- [ ] D10. Success-metric targets for first 90 days?
- [ ] D11. Product name/domain final? ("Crew Connect" confirmed?)

---

## 8. PHASES – Progress checklist

Legend: `[ ]` not started · `[x]` done (add date + commit) · every phase ends with its **Exit check** and tag `phase-N-done`.

### Phase 0 – Planning & foundations  *(branch: `docs/development-roadmap`)*
Why: agree the plan before spending effort.
- [x] 0.1 Review existing template and write this roadmap (2026-10-11)
- [ ] 0.2 Owner answers Open decisions D1–D11 (at least D1–D4 before Phase 1)
- [ ] 0.3 Fix README (remove false Tailwind claim, add run/build instructions and link to this file)
- [ ] 0.4 Add `.env.example` (names of variables only, no secrets) and confirm `.env*` is git-ignored
- [ ] 0.5 Set up branch protection on `main` on GitHub (owner action; Claude gives steps)
**Exit check:** owner has approved the plan and picked the next phase.

### Phase 1 – Real backend: database, auth, security  *(branch: `phase/1-backend-auth`)*
Why: today nothing is real. Money rules and personal data cannot live in the browser.
- [ ] 1.1 Create Supabase project (owner creates account; Claude gives steps), store keys in `.env.local`
- [ ] 1.2 Add `web/src/lib/supabase.ts` client (comment: why one shared client)
- [ ] 1.3 Create `supabase/migrations/` – SQL tables: `profiles`(role), `candidates`, `employers`, `jobs`, `applications`, `unlocks`, `wallet_ledger`. **Each migration has an `up` and a `down` file** (rollback)
- [ ] 1.4 Indexes on filtered columns (type, area, shift, salary, verified)
- [ ] 1.5 **Row Level Security** policies: candidates edit only own row; employers see candidates **without phone**; admins full access; phone only returned via the unlock function
- [ ] 1.6 SQL function `unlock_candidate()` – one atomic transaction: check employer approved → check not already unlocked → use free unlock or deduct balance → record unlock → return phone. Comment each rule (this is the revenue protection)
- [ ] 1.7 Replace `mockAuthService` with `supabaseAuthService` (same interface) and switch in `features/auth/services/index.ts`. Remove plain-text passwords and `demoOtp`
- [ ] 1.8 Phone OTP via SMS provider (needs D3 + DLT; until ready, use Supabase test OTP numbers in dev only)
- [ ] 1.9 Rewrite `data/api.ts` bodies to call Supabase, **keeping function names and return types**; delete `mockDb.ts`
- [ ] 1.10 Admin user created manually in DB (never via sign-up)
- [ ] 1.11 Seed script for dev data (separate from production)
- [ ] 1.12 Protect against abuse: OTP rate limit, max tries (config already has `maxOtpTries`)
**Exit check:** two different browsers/accounts cannot see each other's private data; cannot get a phone number without unlock; unlock cannot be repeated for free; build + lint pass.

### Phase 2 – Deploy + CI + monitoring (free)  *(branch: `phase/2-deploy-ci`)*
Why: deploy early and often so every later phase is tested in real conditions, and rollback exists from day one.
- [ ] 2.1 Connect repo to hosting (D1); every branch gets a preview URL; `main` = production
- [ ] 2.2 Environment variables set in hosting (staging vs production Supabase projects if owner approves; otherwise one project and a clear note of the risk)
- [ ] 2.3 GitHub Actions: install → `tsc` → `eslint` → build on every PR
- [ ] 2.4 Add Vitest + first tests for pure logic (`rules.ts`, `filters.ts`, validators, `maskPhone`)
- [ ] 2.5 Sentry error tracking (free plan)
- [ ] 2.6 Basic analytics (privacy-friendly, free)
- [ ] 2.7 Lazy-load role dashboards (`React.lazy`) to meet the bundle budget; record bundle size in this file
- [ ] 2.8 Custom domain + HTTPS (domain cost → Cost tracker)
- [ ] 2.9 Write "How to roll back production" in this file after testing it once for real
- [ ] 2.10 Supabase free-tier keep-alive + manual backup routine (free projects pause and lack backups) – export SQL weekly until paid plan
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
- [ ] 4.5 Pagination + server-side filtering for candidates and jobs
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

## 9. Change log (Claude appends one line per finished task)

| Date | Task | Branch | Commit | Rollback |
|---|---|---|---|---|
| 2026-10-11 | 0.1 Roadmap created | `docs/development-roadmap` | see git log | delete file / revert commit |
