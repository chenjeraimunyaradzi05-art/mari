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
  testEnvironment: 'node',
  // Transpile, do not type-check. This used to be `preset: 'ts-jest'`, which
  // type-checks every file it compiles through a language service holding the
  // whole program — and every route suite imports src/index.ts, so every
  // worker built and kept a TypeScript program of the entire API. That, not
  // the tests, is what cost the memory: six route suites run cold in one
  // process peaked at 3,620 MB and took 333 seconds type-checked, against
  // 777 MB and 25 seconds transpiled (measured 26 September 2026 on HEAD, with
  // --no-cache, which is what CI gets). Four workers at that size were the
  // ~14 GB this suite used to need, on a runner that has 7.
  //
  // Nothing goes unchecked by this. `npm run build` is `tsc` over src/,
  // including every src/**/__tests__ suite, and `tsc -p tests/tsconfig.json`
  // covers the suites under tests/; CI runs both before the tests. Locally,
  // run `npx tsc --noEmit` — a type error no longer appears as a failing
  // suite. It also no longer fails every route suite at once: under the preset,
  // one type error anywhere in src/ stopped each of the ~130 suites that import
  // the app from compiling, every one of them reporting the same unrelated line.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
  },
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

  // Every suite that imports src/index.ts loads the whole API into its own
  // module registry, and a worker does not get all of that back when the suite
  // ends: transpiled, one still climbed steadily to about 2.3 GB over a full
  // run. This restarts a worker between suites once it has passed 1 GB, so
  // none carries more than one suite's worth. Measured on the full run (207
  // suites, 1,711 tests, two workers, cold cache, 26 September 2026), the peak
  // per worker fell from 2,291 MB to 1,374 MB, and the run took 94 s against
  // 237 s without it — on a machine other work was sharing, so read that as
  // "the restarts cost nothing", not as a promise of speed.
  workerIdleMemoryLimit: '1GB',
};

// CI used to be capped at two workers, because at 3.5-3.8 GB each the default
// of one worker per core ran a 7 GB runner out of memory with a heap error
// that named no test. The cap treated the size of the workers; the two
// settings above removed the cause. At ~1.4 GB a worker, Jest's own default
// (cores minus one, three on a standard runner) fits with room to spare, so
// CI now runs the default and finishes sooner. If this suite ever reports a
// heap allocation failure again, measure a worker before capping anything:
// the cause last time was the type-checker, not the tests.

module.exports = config;
