/**
 * Runs in every integration worker before any test module is loaded, and
 * decides which database the code under test will talk to.
 *
 * The ordering is the whole point. `src/utils/prisma` builds its client from
 * `process.env` the moment it is imported, and `src/index.ts` calls
 * `dotenv.config()` at the top of its own module body. Jest runs `setupFiles`
 * before it requires any test file, so the connection string is already decided
 * by the time either of those runs — and because dotenv does not overwrite a
 * variable that already exists, `server/.env`'s production Neon URL cannot get
 * back in.
 *
 * Nothing here mocks Prisma. That is the point of the project: these tests are
 * the only ones in the repository that let a real Postgres answer.
 */

import {
  applyDatabaseUrlToEnvironment,
  resolveIntegrationDatabase,
  UNREACHABLE_DATABASE_URL,
} from './database-guards';

const database = resolveIntegrationDatabase();

applyDatabaseUrlToEnvironment(database.configured ? database.url : UNREACHABLE_DATABASE_URL);

// A developer with Redis running would otherwise carry login-lockout counters
// from one run into the next, so the account-lockout test would pass alone and
// fail on the second run. The in-process fallback in `utils/loginAttempts` is
// per-worker and starts empty, which is what a test wants.
delete process.env.REDIS_URL;

// Nothing in this project may reach Stripe. The suites that exercise money
// paths mock `utils/stripe` themselves; clearing the key means a path that
// forgot to fails loudly at the boundary instead of authenticating.
delete process.env.STRIPE_SECRET_KEY;

// The HTTP rate limiters count requests per process, and an integration suite
// makes far more of them than a person does: five password-reset requests an
// hour is the production limit, and the reset suite alone needs more than that.
// Switched off here rather than raised, using the flag the app already reads,
// because what these tests are about is the account lockout in
// `utils/loginAttempts` — a different mechanism, still fully in force, and one
// of the things finding 36 says has never been exercised through the route.
process.env.RATE_LIMIT_ENABLED = 'false';
