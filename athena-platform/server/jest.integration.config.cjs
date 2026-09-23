/**
 * The suite that talks to a real database.
 *
 * It is a second Jest project rather than a folder inside the first one for a
 * reason that decides whether it gets used: `npm test` has to stay fast and has
 * to keep working on a machine with no Docker. 183 mocked suites answering from
 * memory run in a couple of minutes; a Postgres round trip per assertion does
 * not. So `jest.config.cjs` ignores this directory and this file is opted into
 * explicitly, by `npm run test:integration`.
 *
 * What lives here is what a mock cannot check. The creator-payout claim and the
 * gift-point debit are conditional `updateMany` statements whose entire
 * correctness argument is "Postgres makes this atomic under READ COMMITTED",
 * and a `jest.fn()` standing in for `updateMany` will agree with whatever the
 * test asserts. The same is true of the erasure transaction across 123
 * delegates, of a unique constraint, and of a cascade.
 *
 * @type {import('jest').Config}
 */
const config = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,

  // Decides the connection string before any module is loaded, which is the
  // only moment it can be decided: `src/utils/prisma` reads the environment in
  // its module body, and `server/.env` holds the production Neon URL.
  setupFiles: ['<rootDir>/tests/integration/setup/environment.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup/after-env.ts'],

  // Starts the database and applies the 63 migrations, or says loudly that it
  // is skipping the whole project because there is nowhere to apply them.
  globalSetup: '<rootDir>/tests/integration/setup/global-setup.ts',

  // A migration deploy, a truncate of 200-odd tables and two transactions
  // deliberately contending for one row are all slower than anything in the
  // mocked suite. 30 seconds was enough there; it is not enough here, and a
  // timeout in a concurrency test reads as a deadlock rather than as a limit.
  testTimeout: 60_000,

  // One worker, always. These suites truncate every table between tests, so two
  // of them running at once do not race over a row — they delete each other's
  // fixtures wholesale, and the failures land in whichever suite happened to be
  // reading at the time. Concurrency is what this project tests, not how it
  // runs: the races inside a test are driven with Promise.allSettled on one
  // connection pool, which is genuine contention in the database regardless of
  // how many Jest workers exist.
  maxWorkers: 1,

  // Say nothing was found rather than exiting 1 on a machine where the
  // directory is empty; the harness suite is what reports a run that did not
  // happen, and it reports it as a failing test, which is louder than an exit
  // code with no name attached.
  passWithNoTests: false,
};

module.exports = config;
