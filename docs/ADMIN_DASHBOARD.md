# Admin dashboard – design (not built yet)

Status: **DESIGN FOR OWNER APPROVAL**, written 2026-10-12. Nothing in this file is implemented.
Owner request: an admin dashboard where the admin can see how many people visited the app, how many companies and candidates there are, total revenue and what part of it goes to SMS and other tokens, plus master forms for job category and sub category, approvals, and adding and modifying users.
Related: [ADMIN_CONTROLLED_LISTS.md](ADMIN_CONTROLLED_LISTS.md) (the master data part), `docs/RELEASE_PROCESS.md`.

## 1. What exists today (checked in the repo 2026-10-12)

- Admin dashboard with two tabs (Employers, Candidates) and six number tiles: candidates, employers, pending approvals, open jobs, numbers unlocked, "Revenue (demo)" (`web/src/features/admin/`).
- Server functions: `admin_stats`, `admin_list_employers`, `admin_list_candidates`, `admin_set_employer_status`, `admin_set_candidate_flag` (`supabase/migrations/20261011130200_functions.sql`).
- Employer approval (Pending / Approved / Blocked) and candidate verified / blocked flags.
- A wallet ledger (`wallet_ledger`, append-only) that records each unlock charge. These are **internal credits**: no real payment exists yet (Phase 3).
- One admin account (dev admin `9845000000`).

## 2. What the owner asked for, and whether the data exists

| Block | Data available? | Needs |
|---|---|---|
| Companies, candidates, jobs, applications, unlocks (counts) | **Yes, live** | Extend `admin_stats` |
| Approvals queue (new companies) | **Yes** | One combined list |
| Approvals queue (ID checks, wrong-number reports) | **No** | Phase 5.2 (ID verification) and 3.5 (wrong-number reports) |
| Users: add admin, edit, block / unblock, hard delete | Block / unblock **yes**; the rest **no** | New audited admin functions (section 5) |
| Master data (job category, designation, areas) | **No** | [ADMIN_CONTROLLED_LISTS.md](ADMIN_CONTROLLED_LISTS.md) |
| **Visitors** (how many people visited) | **No** | Web analytics (roadmap 2.6). Candidate tool: Cloudflare Web Analytics, described by Cloudflare as "privacy-first analytics ... without changing DNS or using Cloudflare proxy" (https://developers.cloudflare.com/web-analytics/, checked 2026-10-12). **UNVERIFIED:** price, cookie use, setup for a Workers site, and whether the numbers can be read by our own dashboard (API). To verify from Cloudflare's official docs when 2.6 starts. If it has no read API, the admin sees a link to Cloudflare's own dashboard instead of a tile. |
| **Revenue** (total money earned) | Only internal credits | Real payments: Razorpay (Phase 3.2 to 3.4). Until then the tile stays labelled "Revenue (demo credits)". |
| **SMS and token cost** | **No** | The SMS gateway (MSG91, roadmap 1.8) must be connected first. Counting messages sent is easy (we log each OTP request). The **price per SMS** and any delivery reports must come from MSG91's official documentation or the owner's invoice: **UNVERIFIED**, MSG91's public pages I could open did not show prices or an API. Plan: store a "cost per SMS" setting that the owner enters from the MSG91 rate card, and show cost = messages sent x that rate, labelled "estimate". |
| Net (revenue minus costs) | After the two above | Payments and SMS cost both live |

Honesty rule for every tile: if the number is an estimate, demo or incomplete, the tile says so in its label. A wrong-looking-right number is worse than an empty tile.

## 3. Screens

One admin area with five tabs:

1. **Overview**: tiles (companies, candidates, jobs, applications, unlocks, visitors, revenue, SMS and service cost, net) with a date range (today, 7 days, 30 days, custom) and a small trend for each. Tiles whose data does not exist yet show "Not connected yet" with the roadmap item that unlocks them.
2. **Approvals**: one queue of everything waiting for the admin (new companies now; ID checks and wrong-number reports later), each with Approve / Reject (with a reason from an admin list) and who decided when.
3. **Users**: search and filter candidates, companies and admins; open a user to see details and history; Add user, Edit, Block / Unblock (section 5).
4. **Master data**: categories, designations, areas, reason lists, business numbers (price per unlock, free unlocks, cost per SMS) as in ADMIN_CONTROLLED_LISTS.md.
5. **Money**: ledger view (who was charged what and when), revenue, costs, net, export to CSV. Only after Phase 3.

Every screen has loading, empty and error states, keyboard access, and works on a phone-width screen.

## 4. Data and performance design

- **Counts and totals** come from one server function (`admin_overview(from, to)`) that runs a few aggregate queries inside one call, never from the browser summing rows. Indexes on `created_at` (and on `wallet_ledger (created_at)`, to be added) keep date-range counts fast. Check with `EXPLAIN ANALYZE` when building.
- **Large lists** (users, ledger) use keyset paging like the candidate search; today's 500-row cap on admin lists is replaced.
- If counting gets slow with many rows, add a small daily summary table (`daily_stats`) filled by a scheduled job. Not needed at today's size; decided when measured.
- **SMS log:** record each OTP request (time, purpose, success or failure, no message text and no OTP) so the message count does not depend on MSG91's reports. Today `otp_codes` rows are purged after 7 days, so a separate tiny counter table is needed for long-range totals.
- **Visitors:** read from the analytics tool if it offers an API, or link out. No personal data is stored by us for this.

## 5. Users: admins, edit and hard delete (the sensitive part)

Owner decision 2026-10-12 (replaces my earlier "admin creates candidates and employers"): **the admin does not create candidates or employers; they register themselves** with their own OTP. The admin **can add another admin** (to help monitor) and can **hard delete** a candidate or an employer from the database.

An admin who can create admins, change accounts or erase them is the most powerful role in the system, so this is built conservatively:

- All writes go through **server functions** that check the caller is an admin, validate input, and write an **audit row** (see "Audit and privacy" below). Direct table writes stay impossible.
- **Add admin:** the admin enters the new admin's name and verified mobile number; the account is created with the admin role and **no password**, and the person sets a password through the OTP flow. The creating admin never sees or sets a password. Rules: the number must not already belong to a candidate or employer (one login = one role); a limit on the number of admins (setting, suggested 5); every addition is audited; recommended: it needs a recent re-login and, once available, MFA (D20). This replaces the earlier rule that admins can only be made by hand in the database (`supabase/admin/create_admin.sql` stays as the emergency route).
- **Edit:** profile details only (name, job category, designation, area, salary, shift, company name). **Phone number and role are not editable** in version 1 (account takeover risk, D22).
- **Block / unblock, approve / reject:** with a reason and an audit row.
- **Hard delete** (candidate or employer): permanently removes the account and its data. Safeguards:
  - The admin types the person's phone (or the company name) to confirm, and sees what will go: profile, applications, unlocks, login. **It cannot be undone**; the only way back is a database backup restore (so backups must exist before real users, roadmap 2.10).
  - **Candidate:** the login, profile, applications and unlock records are removed. Wallet ledger rows that mention the candidate keep their money amount but lose the link to the person (the database already sets that link to empty on delete).
  - **Employer:** **the database refuses the delete today for any employer that has wallet ledger rows**, because the ledger is append-only and its employer link is "restrict" (money records must not vanish). Options are in D26. An employer without ledger rows can be deleted.
  - An admin **cannot delete themselves** and **cannot delete the last admin**. Deleting **another admin** needs the same typed confirmation and is audited. Who may delete admins is D27.
  - Implementation note: the login lives in Supabase Auth, so deleting uses Auth's admin API from our Edge Function (service key only on the server), then the database cascades remove the profile rows. The order and failure handling (what if the login is deleted but the rows fail) must be designed and tested in the build task, with the same orphan-recovery care as the registration flow. This is a plan, not tested.
  - Optional safety net (D26): a "scheduled for deletion" state for 7 days before the real delete, which the admin can cancel. Recommended for candidates and employers unless the owner wants instant deletion.
- **Audit and privacy:** the audit table records admin id, action, target id and time. It must **not** keep the deleted person's phone number or name after a hard delete (privacy), only the target id and a type. Retention of audit rows is part of D26.
- **Phone numbers** of candidates are visible to admins only, and viewing them is logged.
- Each of these has SQL tests (admin can, others cannot; audit row written; invalid input refused; cannot delete self or the last admin; the employer-with-ledger rule) before it ships.

## 6. Build order (each a task branch from `develop`, one PR each; DB tasks follow `docs/RELEASE_PROCESS.md`)

1. **Overview v1** with live counts and a date range; honest "not connected yet" tiles. No new data, small DB function.
2. **Audit table** (shared with the lists design and roadmap 5.6).
3. **Approvals queue** (companies), with reasons.
4. **Master data** (ADMIN_CONTROLLED_LISTS.md steps 1 to 4).
5. **Users tab**: search, details, add admin, edit, block, hard delete (needs decisions D22, D26, D27; plus D20 for admin MFA).
6. **Visitors tile** after analytics (2.6).
7. **SMS cost tile** after the gateway (1.8) and the SMS counter.
8. **Money tab and revenue / net** after payments (Phase 3).

## 7. Risks

| Risk | Handling |
|---|---|
| Admin account stolen = whole system exposed (it could add admins and delete users) | Phone + password only today; recommend admin MFA before real users (D20); admin limit; audit log; typed confirmations; delete delay (D26) |
| Hard delete is permanent | Typed confirmation, optional 7-day delay, backups before launch, cannot delete self or the last admin |
| Admin changes data by mistake | Reasons required, audit log, soft deactivate, confirmations with counts |
| Cost or revenue numbers mislead | Labels say demo / estimate; costs come from a stored rate the owner confirms |
| Slow dashboard with growth | Aggregate in the database, indexes, date ranges, daily summary table if measured slow |
| Privacy of candidates | Admin-only phone view with logging; no personal data stored for visitor counts |

## 8. Cost

Free for the screens (Postgres only). Analytics: planned as a free tool (to verify). SMS has a running cost per message (shown in this dashboard once connected). Payment gateway charges a fee per payment (to verify in Razorpay's official docs in Phase 3, then add to the Cost tracker).

## 9. Decisions the owner must answer

- **D12 to D17** (in the roadmap, from ADMIN_CONTROLLED_LISTS.md): designation names, one or many designations per candidate, who edits lists, cities, user-suggested designations, shift and availability.
- **D18. Visitors:** which count do you want: unique visitors, page views, or both? Is a link to Cloudflare's own analytics dashboard acceptable if our dashboard cannot read the numbers? (Recommended: link first.)
- **D19. Revenue before real payments:** show "Revenue (demo credits)" until Phase 3, or hide revenue and net until then? (Recommended: show, clearly labelled.)
- **D20. Admin sign-in security:** require a second step (MFA) for admins before real users? How many admins will there be, and who? (Recommended: yes, MFA before launch.)
- **D21. ANSWERED 2026-10-12 by the owner:** the admin does **not** create candidates or employers (they self-register). The admin **can add another admin**, and can **hard delete** a user or employer. Details and safeguards in section 5.
- **D22. Edit rules:** may the admin change a user's **phone number or role**? (Recommended: no in version 1; do it as a separate, extra-careful task.)
- **D23. Approvals:** what must an employer submit before approval (company name only today; GST, address, ID?), and does a rejection need a reason shown to the employer? (Ties to roadmap 4.2.)
- **D24. SMS cost:** will you give the cost per SMS (from your MSG91 rate card) so the dashboard can estimate cost? Do we also count other paid services (Supabase plan, domain) in "cost", or SMS and payment fees only? (Recommended: SMS and payment fees automatic; other fixed costs entered by hand monthly.)
- **D25. Date and money format:** India time (IST) and ₹ with Indian digit grouping for all dashboard numbers. (Recommended: yes.)
- **D26. Hard delete rules:** (a) instant, or "scheduled for deletion" for 7 days that the admin can cancel (recommended: 7 days)? (b) **Employers with money records:** erase them to an anonymous stub (name and phone erased, id and ledger kept) and call it deleted (recommended), or refuse to delete them? (c) How long are audit rows kept (suggested: 2 years)? (d) Must a backup exist before the first real delete (recommended: yes, roadmap 2.10)?
- **D27. Admins and admins:** may every admin add and delete other admins, or only a "main admin" (the owner) deletes admins while any admin may add up to the limit? (Recommended: the second. Ties to D14 and D20.)
