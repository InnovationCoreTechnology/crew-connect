# Release process – how code reaches production

Decided by the owner on 2026-10-12. Short version: **`main` is production. Only tested, stable, owner-approved code is ever merged into it. All day-to-day work happens on `develop`.**

## 1. Branches

| Branch | Purpose | Who may change it | How |
|---|---|---|---|
| `main` | Production. Always working, always deployable. Every commit on it is a release. | Nobody directly | Only a **release PR** from `develop` (or a `hotfix/*` PR), merged by the owner |
| `develop` | Integration / staging. The next release candidate. | Nobody directly | Only PRs from `feature/*`, `fix/*`, `docs/*`, `chore/*` branches |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | One task each | The developer | Cut from `develop`, merged back into `develop` with a PR (`--no-ff` merge) |
| `hotfix/*` | Urgent production bug | The developer | Cut from `main`, PR into `main`, then merged back into `develop` |

```
main      ──●────────────────●─────────────●──      v0.1.0 ... v0.2.0 ... (tags = releases)
             \              / \           /
develop   ────●──●──●──●───●───●──●──●───●──────
               \ /  \  /         \ /
feat/*          ●    ●            ●
```

## 2. Normal flow (feature, fix, improvement)

1. `git checkout develop && git pull` → `git checkout -b feat/<topic>`.
2. Work in small commits. Run `npm run lint` and `npm run build` in `web/`; run the database tests if you touched `supabase/`.
3. Open a PR **into `develop`** (the default template appears). CI must be green. The owner (or a reviewer the owner names) reviews.
4. Merge with a merge commit (`--no-ff`). One task = one revertable unit (`git revert -m 1 <merge>`).

`develop` is allowed to be "in progress" but must always build. If `develop` turns red, fixing it comes before new work.

## 3. Release flow (develop → main) – the production gate

Done when the owner decides a set of work is ready (normally at the end of a roadmap phase, or when a bug fix is needed live).

1. Freeze: no new merges into `develop` while the release is being checked.
2. Open a PR **`develop` → `main`** and choose the **release template** (add `?template=release.md` to the PR URL).
3. Fill in every section of the template. Nothing is ticked on trust; each tick needs the evidence written beside it (command + result, or "clicked X as role Y").
4. The release candidate is tested **as the build that will go live**: run `supabase/tests/rules.test.sql`, test each role in a browser, and check the phase's roadmap **exit check**.
5. **Stakeholder approval:** the owner signs the approval line in the PR and approves the PR. If another stakeholder (for example a business partner or client) has to accept the release, they test the candidate and say so in the PR before the owner approves.
6. Apply database migrations to the production database **before** merging (a backup first; each migration has a tested rollback script). Migrations must stay backward-compatible with the previous release so a code rollback still works.
7. Merge with `--no-ff`. Tag the merge commit `v0.<phase>.<n>` and push the tag. Cloudflare deploys `main` as production.
8. Open the live site and check it. Append the release to the roadmap change log. If `main` has commits `develop` lacks (hotfixes), merge `main` into `develop`.

## 4. Hotfix flow

1. `git checkout main && git pull` → `git checkout -b hotfix/<topic>`.
2. Smallest possible fix + a test that fails without it. CI must be green.
3. PR into `main` using the release template (sections that do not apply are marked "n/a, hotfix" with the reason). Owner approves and merges, tags `v0.x.y+1`.
4. Merge `main` back into `develop` the same day so the fix is not lost.

## 5. Rolling back a release

Smallest fix first:
1. **Instant:** in the Cloudflare dashboard redeploy the previous production deployment (no git needed).
2. **Git:** `git revert -m 1 <release-merge-commit>` on a `hotfix/*` branch, PR into `main`.
3. **Database:** run the migration's rollback script as a new forward migration. It cannot restore deleted data, so take a backup first (roadmap 2.10).

## 6. What is enforced today, and what is not (honest limits)

| Rule | Enforced by | Status |
|---|---|---|
| Lint, types, build, dependency audit and CAPTCHA tests on every PR | `.github/workflows/ci.yml` (shows a red/green check) | Automatic |
| Reviewer requested on sensitive paths | `.github/CODEOWNERS` | Request only |
| Checklist and sign-off before production | PR templates | Process |
| **Nobody can push to `main` / `develop`, merge needs a green check and an approval** | GitHub branch protection or rulesets | **NOT available**: this private repository is on GitHub Free, where GitHub answers "Upgrade to GitHub Pro or make this repository public" (checked 2026-10-12). Until then these rules are followed by discipline, and Claude is instructed never to push to or merge into `main` or `develop`. |
| Database tests (`supabase/tests/rules.test.sql`) | Run by hand, result written in the release PR | Manual (they need the Supabase project) |

**Before a second developer joins:** upgrade to GitHub Pro (or use a GitHub organization plan) and turn on, for `main` and `develop`: require a pull request, require the `CI / lint, types, build, tests` check, require 1 approval (Code Owners), block force pushes and deletions. Roadmap item 2.11 tracks this. Re-check GitHub's pricing and docs when doing it.

**Before real users:** a separate production Supabase project and a staging address for `develop` (roadmap item 2.12). Today there is one Supabase project, treated as development, so a release to `main` does not yet have its own production database.
