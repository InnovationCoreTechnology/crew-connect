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
