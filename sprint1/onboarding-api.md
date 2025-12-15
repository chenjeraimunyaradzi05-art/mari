# Sprint 1 — Onboarding API

Estimate: 12h

Goal
- Implement `POST /api/onboarding/complete` and supporting server-side validation and persistence.

Acceptance criteria
- API contract covered by tests; endpoint forwards to auth-service or persists to database.
- Error cases (validation, auth) return proper status codes.

Checklist
- [ ] Add route and controller/handler
- [ ] Add request validation and DTOs
- [ ] Add unit tests for handler
- [ ] Add integration test (mocked DB or mock-api)

Notes
- Branch: `sprint1/onboarding-api`
