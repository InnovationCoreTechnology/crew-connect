# CLAUDE.md – Working instructions for Claude on Crew Connect

Claude Code loads this file automatically. These rules are binding. The owner's rules come first; if a rule here conflicts with a direct instruction from the owner in chat, ask which one wins.

Project plan and progress: [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · Backend decisions: [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md) · History of what was built: [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md)

---

## 1. Scope – do only what is asked

- Work **only on the phase/task the owner names**. Do not start the next phase or "improve" unrelated code.
- Before starting, read `DEVELOPMENT_ROADMAP.md`. **Skip every item already ticked `[x]`.**
- If a decision is listed under "Open decisions" and is not answered, **stop and ask**. Never pick for the owner unless they delegated it in writing (then record that in the roadmap).

## 2. Facts – official sources only, no guessing

- Every claim about a library, service, price, limit, API or command must come from **official documentation** (vendor docs, the package's own docs/changelog, language/standards specs such as MDN, ECMAScript, PostgreSQL docs, W3C/WCAG, RFCs).
- **Fetch the official page before relying on it.** Do not answer from memory when it concerns versions, pricing, limits, or API shapes – those change.
- Blogs, forums, Stack Overflow and AI-generated pages are **not** sources. If only those exist, say so.
- Put the source URL in the code comment or doc where the fact is used. Include the date checked when it is a price/limit.
- If you cannot verify something, **write "unverified" and say what is needed to verify it**. Never fill gaps with plausible-sounding text. Never invent function names, config keys, flags or URLs.
- When unsure whether something exists in the repo, search the repo first (Grep/Glob), then say what you found.

## 3. Engineering quality – fast and proven

**Algorithms and data**
- Use well-known, proven structures and algorithms; state the complexity when it matters (e.g. "Map lookup O(1)", "keyset pagination O(log n) with index").
- No O(n²) over lists that can grow (candidates, jobs). Use `Map`/`Set` for lookups instead of nested `find`/`filter` loops.
- **Database:** index every column used in `WHERE`/`ORDER BY`/joins; use **keyset (cursor) pagination**, not `OFFSET`, for big lists; never `select *` – select needed columns; no N+1 queries (use joins/RPC); check hot queries with `EXPLAIN ANALYZE` and record the result in the task summary.
- Money-related or multi-step rules run **server-side in one transaction** (SQL function), never only in the browser.

**Frontend performance (must never feel slow or break)**
- Budgets are in `DEVELOPMENT_ROADMAP.md` §5 (e.g. first-load JS < 150 KB gzipped). Check bundle size after each task that adds a dependency or a route.
- Code-split by route/role (`React.lazy` + `Suspense`). Paginate/virtualize long lists. Debounce search input. No work in render that can be memoised or moved out.
- Every async screen has **loading, empty and error states**. Add an **error boundary** around route areas so one failure cannot blank the whole app.
- Never block the main thread with heavy synchronous work. Avoid layout thrash; prefer CSS over JS for visuals.
- Add a dependency only if it clearly beats writing 20 lines. Prefer small, maintained, tree-shakeable packages. Justify each new dependency (size, maintenance, licence) in the task summary.

**Reliability**
- Handle failure paths: network errors, timeouts, double clicks (idempotent writes), expired sessions, empty data.
- Never log secrets or personal data. Never put secrets in the repo (`.env.local` is git-ignored; commit only `.env.example`).
- Never store Aadhaar numbers. Validate input on the client **and** on the server (RLS/constraints/functions).

## 4. Coding standards (strict)

- **TypeScript strict-style:** no `any` (use `unknown` + narrowing), no `@ts-ignore`/`eslint-disable` without a written reason, no non-null `!` without a reason. Explicit types at module boundaries.
- `npm run lint` and `npm run build` (`tsc -b && vite build`) must pass with **zero errors** before anything is called done.
- **Match the surrounding code**: naming, file layout (`features/<role>/…`, `shared/…`, `data/…`), formatting, comment density. Screens call **only** `web/src/data/api.ts`; business rules live in `data/rules.ts` and `app/config.ts` – not inside components.
- Naming: `PascalCase` components/types, `camelCase` functions/variables, `UPPER_SNAKE` constants, files named after their main export.
- One responsibility per function/component. Small functions, early returns, no deep nesting. No dead code, no commented-out code.
- Accessibility: semantic HTML, labels for inputs, keyboard operable, visible focus, contrast per WCAG 2.2 AA.
- SQL: migrations are plain, numbered, reviewed files in `supabase/migrations/`, **each with a matching down/rollback script**. Constraints (`NOT NULL`, `CHECK`, FK) in the schema, not only in app code. Row Level Security on every table that holds user data.
- Tests: pure logic (rules, validators, filters, formatters) gets unit tests (Vitest, from Phase 2). Bug fix = add a test that fails first.

**Comments – the "why"**
- New non-obvious files/functions get a short comment covering: **why it exists, what it does, where it is used**, and an official reference link if it depends on an external service/standard.
- Do not narrate the obvious (`// increment i`). Comments must be accurate; update them when code changes.

## 5. Dependencies and versions – check and fix

When analysing the repo, starting a phase, or touching `package.json`:
1. Run `npm outdated` and `npm audit` (in `web/`).
2. For each outdated package, read the **official changelog/release notes/migration guide** before changing anything.
3. **Patch/minor updates:** apply on a `chore/deps-<date>` branch, run lint + build + tests, fix any breakage, commit.
4. **Major updates:** also on their own `chore/deps-<package>` branch, only after reading the official migration guide; fix all breakages and verify in the browser. If it cannot be made to work cleanly, leave the branch unmerged and report why.
5. **Security advisories (`npm audit`)** are fixed first, using the vendor-recommended fix; never use `--force` blindly.
6. Also check **script/style libraries loaded from CDNs or `index.html`** and pinned Action versions in `.github/workflows`. Always pin exact or caret-bounded versions; never `latest`.
7. Never merge dependency changes together with feature work. Record each upgrade (from → to, source link, result) in the implementation log.
8. Check that the Node.js version used matches what the tooling officially requires (`engines` in package docs).

## 6. Branching, safety and rollback

Follow `DEVELOPMENT_ROADMAP.md` §3. In short:
- **Never commit to `main`.** One branch per task (`feat/…`, `fix/…`, `docs/…`, `chore/…`) inside a `phase/N-…` branch. Merge with `--no-ff` so every task reverts with one `git revert -m 1`.
- Never force-push shared branches, never rewrite published history, never delete branches/tags unless the owner says so.
- **Push, open PRs and merge only when the owner asks.**
- Risky behaviour goes behind a feature flag; database changes ship with a rollback script in the same branch.
- Destructive actions (dropping tables, deleting data, changing production settings, anything that costs money) need the owner's explicit yes first.

## 7. Cost discipline

- Free tiers first. Anything that costs money must be added to the roadmap **Cost tracker** and approved by the owner before use.
- Re-check a service's official pricing/limits page when a phase starts, and record the date.
- Warn the owner when usage approaches a free limit (e.g. database size, egress, active users).

## 8. After every task – the summary (mandatory)

1. Tick the roadmap item(s): `[ ]` → `[x]` with date and commit hash.
2. Append an entry to `docs/IMPLEMENTATION_LOG.md` using the template in that file.
3. Reply to the owner with the same summary, short: **what changed, why, files touched, how it was verified (commands + result), performance impact, cost impact, how to roll back, what is next / needs the owner**.
4. Report honestly: failing tests, skipped steps and unverified claims are stated plainly. Do not say "done" unless lint, build and the feature check actually passed.
