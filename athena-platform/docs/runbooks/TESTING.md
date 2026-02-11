# Testing Runbook

## Server Unit Tests

```bash
cd athena-platform/server
npm run build
NODE_ENV=test npm test
```

- **Framework:** Jest
- **Test suites:** 22 suites, 99+ tests
- **Coverage areas:** Auth routes (register, login, refresh, logout), validation, error handling, services
- **Database:** Tests use a test database (set `DATABASE_URL` to a test DB, or tests mock Prisma)

### Key test files

| File | Tests |
|------|-------|
| `src/__tests__/auth.happy.test.ts` | Auth happy paths (register, login, refresh, logout) |
| `src/__tests__/register_debug.test.ts` | Registration edge cases |
| `src/__tests__/validation.test.ts` | Input validation (express-validator rules) |

### Common test failures

- **Missing `womanSelfAttested: true`** in registration payloads → 400 error
- **Missing `JWT_SECRET`** env var → token generation fails
- **DB schema mismatch** → run `npx prisma migrate dev` before tests

---

## Client E2E Smoke Tests

```bash
cd athena-platform/client
npm run e2e
```

- **Framework:** Playwright
- **Scope:** Smoke tests only (intentionally DB-independent)
- **What it tests:**
  - `/login` page renders correctly
  - `/dashboard` redirects to `/login` when unauthenticated
  - Basic navigation works

### Running specific tests

```bash
# Run a specific test file
npx playwright test tests/smoke.spec.ts

# Run with browser visible
npx playwright test --headed

# View test report
npx playwright show-report
```

---

## Test Environments

| Environment | Database | API | Purpose |
|-------------|----------|-----|---------|
| Local dev | Local PostgreSQL | `localhost:5000` | Developer testing |
| CI (GitHub Actions) | Ephemeral PostgreSQL | In-memory | Automated on PR |
| Staging | Railway staging DB | Railway staging URL | Pre-production validation |

---

## Running Tests in CI

Tests run automatically via GitHub Actions on:
- Push to `main`
- Pull request to `main`

The workflow runs:
1. Server build + lint
2. Server unit tests
3. Client build
4. Client E2E smoke tests

---

## Adding New Tests

- Place server tests in `server/src/__tests__/`
- Follow naming convention: `*.test.ts`
- Auth tests must include `womanSelfAttested: true` in registration payloads
- Use `supertest` for HTTP assertions
- Mock external services (email, Stripe, OpenAI) to keep tests fast and deterministic
