<!--
RELEASE PR: `develop` -> `main`. This is the gate to production. Nothing is merged until every box is ticked
and the approver has signed the last section. Process: docs/RELEASE_PROCESS.md
-->

## Release
- Version tag: `v0.__.0`
- Roadmap phase / items included:
- Pull requests included (list or link the merged PRs since the last release):

## 1. Automated checks (must be green on THIS PR)
- [ ] CI check is green (lint, types, build, dependency audit, CAPTCHA tests)

## 2. Manual checks on the release candidate (the `develop` build)
- [ ] `supabase/tests/rules.test.sql` run on the database: "ALL TESTS PASSED (rolled back)"
- [ ] Browser test of every role touched by this release: candidate / employer / pending employer / admin / register / forgot password
- [ ] Roadmap **exit check** of the phase(s) included is satisfied (quote it):
- [ ] Known problems are listed below and accepted by the approver

Known problems / not verified:

## 3. Database
- [ ] No database change in this release
- [ ] Migrations to apply to production, in order:
- [ ] A backup / restore point exists before applying them
- [ ] Rollback script exists for each migration and was tested

## 4. Deployment and rollback
- [ ] Settings / secrets needed in production are set (names only, never values):
- [ ] How to roll back this release (previous tag + Cloudflare redeploy + database steps):

## 5. Cost and security review
- [ ] Anything that costs money is approved in the roadmap Cost tracker
- [ ] Advisors / audits reviewed (Supabase advisors, `npm audit`), new warnings explained

## 6. Approval (stakeholder sign-off)
Approved for production by: ______________________  Role: ______________  Date: ____________

(Until GitHub branch protection is enabled, this signed line plus the PR approval is the record.)

## After merging
- [ ] Tag the merge commit `v0.__.0` and push the tag
- [ ] Cloudflare production deployment finished; live site checked in a browser
- [ ] Append the release to the roadmap change log; merge `main` back into `develop` if it moved
