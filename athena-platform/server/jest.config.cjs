/**
 * The fast project: every suite here answers from a mock.
 *
 * Worth saying plainly, because the directory layout suggests otherwise. Two
 * conventions are in use — suites beside the code they cover, in `__tests__`
 * folders under `src`, and route-level suites under `tests/` — and the second
 * set used to be described here as "integration suites". They are not, and
 * never were: `tests/course-enrollment.test.ts` and `tests/mentor-booking.test.ts`
 * both open with `jest.mock('../src/utils/prisma')`, as do 138 of the files in
 * the first set. Nothing this project runs has ever opened a database
 * connection. The suites that do are the separate project in
 * `jest.integration.config.cjs`.
 *
 * Both patterns are listed because one that covered only the first would skip
 * the second in silence rather than report it missing.
 *
 * @type {import('jest').Config}
 */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/tests/**/*.test.ts'],
  // `tests/integration` belongs to the other project. The pattern above would
  // otherwise collect it, and those suites need a Postgres container and a
  // `prisma migrate deploy` that this project's setup never runs — so `npm test`
  // would start failing on every machine without Docker, which is the opposite
  // of what a separate project is for.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integration/'],
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
