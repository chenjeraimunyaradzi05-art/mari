/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Two conventions are in use: suites that live beside the code they cover in
  // `src/**/__tests__`, and the older integration suites under `tests/`. Both
  // are listed because a pattern that covers only the first silently skips the
  // second rather than reporting it as missing.
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  // Jest's 5 second default is not enough for these suites on a loaded machine:
  // ts-jest compiles as it goes, and a run that is sharing the machine reports
  // timeouts in suites that pass on their own. That produces failures which look
  // real, are not reproducible, and cost more to chase than the wait costs.
  testTimeout: 30_000,
};

// On a GitHub-hosted runner, Jest's default of one worker per core — four —
// exhausts the memory rather than reporting a failure. Each worker carries its
// own ts-jest program and its own generated Prisma client, and the larger route
// suites push that to several gigabytes per worker against the runner's 7GB.
// What comes out is a heap allocation error that names no test, so it reads as
// a broken suite instead of as a resource limit, and the next person spends the
// afternoon looking for a test that does not exist.
//
// Only CI is capped. Halving the run on a developer's machine is a cost paid
// every time anyone runs the tests, and that machine usually has the headroom.
// `CI` is set by GitHub Actions and by every other runner worth naming.
if (process.env.CI) {
  config.maxWorkers = 2;
}

module.exports = config;
