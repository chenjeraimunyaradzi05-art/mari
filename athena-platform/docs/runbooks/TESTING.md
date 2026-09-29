# Testing Runbook

## Server tests

There are two Jest projects, and the difference matters.

```bash
cd athena-platform/server
npm test                        # the mocked project: no database, no network
npm run test:integration        # a disposable Postgres in Docker, then the integration project
npx tsc -p tests/tsconfig.json  # type-checks tests/, which Jest does not (jest.config.cjs says why)
```

- **The mocked project** (`jest.config.cjs`) runs every `__tests__` suite under
  `src/` and every suite directly under `tests/`. Each one mocks
  `src/utils/prisma`, so nothing in it opens a database connection. Route
  suites import the whole app from `src/index` and drive it with supertest.
- **The integration project** (`jest.integration.config.cjs`) runs
  `tests/integration/` against a real Postgres built by `prisma migrate deploy`:
  constraints, cascades and concurrent writes, which a mock cannot exercise.
  Without `TEST_DATABASE_URL` it skips loudly rather than passing; CI sets it.
- **Suites that decide who is kept out** — search, feeds, anything that
  filters on blocks, "hide me from search" or privacy — should run the
  handler's real `where` clause over a handful of rows rather than assert its
  shape. `server/tests/support/prisma-where.ts` evaluates a Prisma `where` against
  plain objects for that purpose, and throws on any operator it does not
  implement, so a filter it would misread fails the test instead of passing
  it. `server/tests/search.routes.test.ts` is the one to copy.

### Common test failures

- **Missing `womanSelfAttested: true`** in registration payloads → 400 error
- **A suite that passes alone and times out beside others** → the machine is
  loaded; run it with `--maxWorkers=2` (the 30-second timeout in
  `jest.config.cjs` is set for exactly this)
- **A type error no suite reports** → Jest transpiles without type-checking;
  `npm run build` checks `src/`, and `npx tsc -p tests/tsconfig.json` checks `tests/`

---

## Client E2E Tests

```bash
cd athena-platform/client
npm run e2e
```

- **Framework:** Playwright
- **Web tier only:** these run against `next start` alone, and give the same
  answer whether or not an API is behind it.
  - `tests/smoke.spec.ts` — the homepage shell, its headings and landmarks,
    the emergency numbers in the footer, the tour at `/about`, sign-in, the
    dashboard redirect and the manifest.
  - `client/tests/failure-states.spec.ts` — every listed page is loaded with the API
    answering 502, as the web tier does when the API is down, and has to say
    it could not load rather than that the list is empty. Pages that still
    show an empty state on a failure are listed in `KNOWN_EMPTY_ON_FAILURE`
    and reported as skipped, by name and with the defect, until they are
    fixed; a fixed page moves into `HONEST_PAGES`.
  - `client/tests/search.spec.ts` — the unified search page against `GET /api/search`
    answered at the browser, in the shape `search.service.ts` returns.
  - The signed-out, cookie-banner, keyboard and timing checks at the bottom of
    `tests/critical-paths.spec.ts`.

  Where a spec answers the API at the browser (`page.route`), it blocks
  service workers, because a request the service worker makes is one the
  route never sees.
- **Full stack:** the member journey in `tests/critical-paths.spec.ts`
  (register, find a mentor, request a session, search jobs) needs the API and
  the fixtures `server/scripts/seed-e2e.js` writes. Without them it is
  skipped, and the skip names what is missing; it used to pass instead, by
  returning early from every step whose page was not there.

Two specs were deleted rather than kept failing. `super-app-features.spec.ts`
described a UI that was never built — `apprenticeship-card`, `service-card`,
`unified-search-input` and a dozen other test ids nothing renders — and signed
in as `test@example.com` with a password the server has refused since the
12-character rule, accepting a stay on `/login` as success. `user-journey.spec.ts`
registered without the date of birth the form requires and expected to land on
`/onboarding`, when registration sends a new member to `/dashboard/persona`;
the first step of the full-stack journey registers correctly and checks that
she lands there.
Both failed on every run in CI's client job, which has no API, and that job
gates the release.

### Running the full-stack journey locally

```bash
# A disposable local Postgres; the seed refuses any other host.
cd athena-platform/server
npx prisma migrate deploy
node scripts/seed-e2e.js

# The same PROXY_SHARED_SECRET and a JWT_SECRET in both terminals.
npm run dev                                  # API on :5000
cd ../client && E2E_FULL_STACK=true npx playwright test tests/critical-paths.spec.ts
```

`.github/workflows/e2e.yml` does the same on every push to `main`.

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
| CI (GitHub Actions) | Ephemeral PostgreSQL service | None in `ci.yml`; the API from the commit in `e2e.yml` | Automated on PR and push |
| Staging | Neon branch | Staging API host URL | Pre-production validation |

---

## Running Tests in CI

Tests run automatically via GitHub Actions on:
- Push to `main`
- Pull request to `main`

`ci.yml` runs:
1. Server: migrations applied to a throwaway Postgres and compared with
   `schema.prisma`, build, type check of `tests/`, the API-contract,
   doc-reference, dead-interaction, debt-ratchet and env-blueprint checks, the
   mocked Jest suite, the real-Postgres integration suite, lint

The debt ratchet (`server/scripts/check-debt-ratchet.js`) counts, per file,
the `req.user!` assertions, the `any` types and the route handlers in files
that import neither zod nor express-validator, and fails when any file has
more than `server/scripts/debt-ratchet-baseline.json` records. When a change
removes some, run `node scripts/check-debt-ratchet.js --update-baseline` and
commit the lower numbers, so they cannot creep back.
2. Client: type check, locale files, unit tests, build, then Playwright (the
   smoke, failure-state and search specs on a pull request, every spec on a
   push; the full-stack journey is skipped there because the job has no API)

`e2e.yml` runs the full-stack journey on a push to `main`, against Postgres, the
API and the fixtures. It is a separate workflow so it does not gate releases
until it has passed on `main` once.

---

## Adding New Tests

- Place a server test beside the code it covers, in a `__tests__` folder under
  `server/src`, or, for a suite about one API prefix end to end, directly in
  `server/tests/` as `<prefix>.routes.test.ts`. A suite that needs a real
  database goes in `server/tests/integration/`.
- Follow naming convention: `*.test.ts`
- Auth tests must include `womanSelfAttested: true` in registration payloads
- Use `supertest` for HTTP assertions
- Mock external services (email, Stripe, OpenAI) to keep tests fast and deterministic
