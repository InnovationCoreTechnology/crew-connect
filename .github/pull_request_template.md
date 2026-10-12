<!--
Default template: for feature / fix / docs / chore PRs into `develop`.
Releasing to production? Open the PR from `develop` into `main` and use the release template:
add  ?template=release.md  to the PR URL (see docs/RELEASE_PROCESS.md).
Base branch must be `develop` (NOT `main`) unless this is a hotfix.
-->

## What
<!-- 1-3 lines: what changed -->

## Why
<!-- the requirement, roadmap item (e.g. 1.12) or bug -->

## How it was verified
<!-- Exact commands and results, or what you clicked in the browser. "Not verified" items must be listed as such. -->
- [ ] `npm run lint` and `npm run build` pass (run from `web/`)
- [ ] Browser check of the changed screens (which roles?)
- [ ] Database changed? Tests in `supabase/tests/` run and passing

## Database changes
- [ ] No database change
- [ ] New migration in `supabase/migrations/` **with a tested rollback** in `supabase/rollback/`

## Risk and impact
- Security / privacy (personal data, new permissions, secrets):
- Performance (bundle size, query cost):
- Cost (anything that is not free):

## Checklist
- [ ] No secrets, keys or real personal data in the diff
- [ ] Docs updated (`docs/IMPLEMENTATION_LOG.md`, roadmap checkbox if a roadmap item is done)
- [ ] Based on `develop`, one purpose per PR, small enough to review
