# Backend & Hosting Plan

Decided 2026-10-11 by Claude on the owner's written delegation ("you can decide"). Facts below were read from the vendors' **official pages on 2026-10-11**; prices and limits change, so Claude re-checks them at the start of Phases 1, 2 and 3 (see [CLAUDE.md](../CLAUDE.md) §2, §7). Anything not verified is marked **unverified**.

Owner goals: fast · multi-platform · free to start · can move to paid without a rewrite · long-term supported · good service/support.

## 1. Decision summary

| ID | Decision | Pick | Status |
|---|---|---|---|
| D1 | Frontend hosting | **Cloudflare**, static assets served from its CDN (Workers Static Assets; Pages is the older product) | Decided |
| D2 | Backend | **Supabase** (managed PostgreSQL + Auth + Storage + Edge Functions), region **Mumbai `ap-south-1`** | Decided |
| D3 | SMS OTP provider | **MSG91**, connected through Supabase's *Send SMS hook* | Decided – official MSG91 price **unverified** |
| D4 | Login method | **Phone + OTP only** (no passwords) | Decided |

## 2. Why each pick

### D1 – Cloudflare (not Vercel, not Pages-first)
- **Vercel Hobby is rejected:** its docs say the plan "restricts users to non-commercial, personal use only" (https://vercel.com/docs/plans/hobby). Crew Connect takes payments, so it would need a paid plan from day one.
- **Cloudflare Pages vs Workers Static Assets:** Cloudflare's own docs now say "Workers supports most Pages use cases and offers a broader feature set" and advise starting new projects on Workers (https://developers.cloudflare.com/pages/framework-guides/). Static asset requests on Workers are "free and unlimited" (https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). So we deploy the Vite build as static assets on Workers.
- Pages Free limits for reference: 500 builds/month, 20,000 files/site, 25 MiB per file (https://developers.cloudflare.com/pages/platform/limits/). These are not a concern for this app.
- Not yet verified (check in Phase 2): exact rollback procedure for Workers deployments, India edge locations, and SPA fallback routing configuration for react-router.

### D2 – Supabase
Verified Free vs Pro (https://supabase.com/pricing):

| | Free ($0) | Pro (from $25/month) |
|---|---|---|
| Database | 500 MB/project | 8 GB/project, then $0.125/GB |
| File storage | 1 GB | 100 GB |
| Monthly active users | 50,000 | 100,000, then $0.00325/MAU |
| Egress | 5 GB | 250 GB, then $0.09/GB |
| Inactivity | **paused after 1 week** | not paused |
| Backups | **none** | daily, kept 7 days |
| Support | **community** | email |
| Edge Function calls | 500,000 | 2 million |

Why it fits:
- **Relational data fits the product.** Candidates, employers, jobs, applications, unlocks and a payment ledger are relational, filtered by area/type/salary/shift. PostgreSQL gives indexes, constraints, transactions and SQL functions – the right tools for an atomic "unlock" and an append-only wallet ledger.
- **Row Level Security** keeps phone numbers hidden at the database, not in the browser.
- **Mumbai region exists** (`South Asia (Mumbai), ap-south-1`, https://supabase.com/docs/guides/platform/regions) → low latency for Bangalore users.
- **Upgrade path without rewrite:** Free → Pro is a plan change on the same project; our code and SQL do not change. The schema is plain PostgreSQL in migration files, so moving to another Postgres host later stays possible (lock-in is low; portability of Auth/Storage is the part to plan for, **unverified**).
- **Multi-platform:** the same backend serves the website now and a mobile app later (Supabase publishes client libraries; confirm React Native/Expo support in its docs when that phase starts – **unverified**). The PWA in Phase 7 covers mobile before any native app.

Honest weaknesses and how we handle them:
1. **Free projects pause after 1 week of inactivity and have no backups.** Mitigation: scheduled GitHub Action pings (keep-alive) and a weekly `pg_dump` backup stored outside Supabase (Phase 2.10). This is acceptable for development and a closed pilot only.
2. **Support on Free is community only.** Email support starts at Pro. Every free tier of the services above is community-supported; no vendor gives guaranteed support for free.
3. **500 MB database / 1 GB storage.** Rough estimate (our arithmetic, not a vendor number): a candidate row is under 1 KB, so database size is not the first limit; ID photos compressed to about 200 KB would fill 1 GB at around 5,000 photos. Compress on upload and store a small thumbnail only.

**Upgrade triggers (move to Supabase Pro, ~$25/month, owner approves):**
- The first real user data or **first real payment** (no backups on Free is not acceptable for money records), or
- Database > ~400 MB, storage > ~800 MB, or egress close to 5 GB, or
- The project pause causes a user-visible outage.

### D3 – MSG91 via Send SMS hook
- Supabase phone login natively lists MessageBird, Twilio, Vonage and TextLocal (https://supabase.com/docs/guides/auth/phone-login). MSG91 and Fast2SMS are **not** native.
- Supabase's **Send SMS hook** lets you "use your own SMS service to send authentication messages" via an HTTP endpoint (Edge Function) (https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook). We write one small Edge Function that calls MSG91's API. The docs' example uses Twilio, so the MSG91 call itself must be written from MSG91's official API docs in Phase 1 (**unverified until then**).
- **India DLT registration is mandatory** for transactional SMS; Supabase's docs mention TRAI DLT as the example of country rules. Start the DLT registration (entity, sender ID, OTP template) early – it takes days and gates real SMS.
- **Price:** not verified from MSG91's official rate card. Third-party sources suggest about ₹0.15–0.25 per OTP before GST – treat as a rough guess only; get the real quote from msg91.com/in/pricing before budgeting.
- Fast2SMS stays as a fallback; the hook design makes switching a one-function change.

### D4 – Phone + OTP only
- Our users are guards and housekeepers, often on shared or low-end phones: no password to forget, no reset flow, and **no password storage at all** (the current mock stores plain text).
- Cost control: Supabase issues long-lived sessions with refresh tokens, so OTP is needed at first login or a new device, not every visit. Limit OTP resends (`resendSeconds`, `maxOtpTries` already in config) and rate-limit per phone/IP.
- Admin accounts: created manually in the database, protected by an extra check (decide in Phase 1 whether admin uses email + password or OTP + allow-list).

## 3. Target architecture

```
Browser / PWA (React, Vite)  ──►  Cloudflare CDN (static, cached, hashed files)
        │
        │  supabase-js (HTTPS)
        ▼
Supabase (Mumbai)
  ├─ Auth            phone OTP, sessions
  ├─ Postgres        tables + indexes + RLS + SQL functions (unlock, wallet)
  ├─ Storage         private bucket for ID documents
  └─ Edge Functions  send-sms hook (MSG91), Razorpay webhook (Phase 3)
```

Rules:
- Screens call only `web/src/data/api.ts`. In Phase 1 its bodies change from mock to Supabase; **function names and return types stay the same**, so screens do not change.
- The browser never receives a phone number before unlock; it never decides price or balance.
- Heavy or secret logic (SMS, payment verification) runs in Edge Functions / SQL functions, never in the client.

## 4. Speed design (so it never gets slow)

- Static front end on a CDN; hashed assets cached long-term; role dashboards lazy-loaded.
- Database: indexes on `type`, `area`, `shift`, `salary`, `verified`, plus `(employer_id, candidate_id)` unique on unlocks; **keyset pagination** for lists; list endpoints return only card fields.
- Name search: start with `ILIKE` on an indexed/limited set; if needed add the PostgreSQL `pg_trgm` extension (check Supabase docs for availability when we get there – **unverified**).
- Atomic unlock in one SQL function = one round trip, no race conditions.
- Measure: `EXPLAIN ANALYZE` on every list query, Lighthouse on every phase exit (budgets in the roadmap §5).

## 5. Cost outlook

| Stage | Hosting | Backend | SMS | Notes |
|---|---|---|---|---|
| Build / pilot | Cloudflare free | Supabase Free | test OTPs in dev | Domain only if wanted |
| First real users | Cloudflare free | **Supabase Free → Pro when triggers hit** | MSG91 per OTP + DLT | Domain recommended for SMS sender and trust |
| Payments live | same | Supabase Pro recommended (backups) | same | Razorpay fee per transaction – verify in Phase 3 |

## 6. Alternatives considered

| Option | Result |
|---|---|
| Vercel Hobby | Rejected: non-commercial only (verified). |
| Firebase | Not evaluated in depth; document-database model is a weaker fit for multi-field filtering and transactional ledgers. **Unverified claim – revisit only if the owner wants it compared.** |
| Self-hosted Postgres/VPS | Rejected for now: needs operations work (patching, backups, uptime) the project does not want at this stage. |
| Netlify | Not evaluated; no advantage over Cloudflare identified. |

## 7. Phase 1 status (2026-10-11)
- Project `crew-connect` created in **ap-south-1 (Mumbai)**, ref `qehkkituvqaishysoqta`, cost $0. The first project was in Sydney; Supabase's official guide ("Change Project Region") confirms a region cannot be changed in place, so it was recreated while still empty.
- The only project is treated as **DEV**. Create a second Free project for production before launch (Free plan allows 2 active projects, verified above).
- Database, security rules and tests: see `supabase/README.md`. Phone OTP login is coded but not usable until the Phone provider and an SMS provider are set up (item 1.8).
- Verified facts from the live project: login for an unknown number answers `otp_disabled`; registration answers `phone_provider_disabled` until Phone sign-in is enabled.
- Supabase phone OTPs are 6 digits and expire in 60 seconds by default (phone-login guide), so the template's 4-digit demo OTP was removed.

## 8. What happens next

1. Owner creates accounts: GitHub (exists), Cloudflare, Supabase (**choose region Mumbai**), and starts MSG91 + DLT registration.
2. Phase 1 starts only when the owner says so.
3. Claude re-verifies prices/limits on the vendors' pages at the start of each phase and records the date.
