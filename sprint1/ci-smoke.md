# Sprint 1 — CI Smoke Test Integration

Estimate: 4h

Goal
- Add a lightweight CI job that runs smoke tests (onboarding flow + stripe simulate) on PRs.

Acceptance criteria
- CI job added to pipeline config; fails PRs on smoke-test failures.

Checklist
- [ ] Add a pipeline job that installs deps and runs smoke tests
- [ ] Include `npm run simulate-webhook` for billing flow smoke test
- [ ] Document how to run smoke tests locally

Notes
- Branch: `sprint1/ci-smoke`
