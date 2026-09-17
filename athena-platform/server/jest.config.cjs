/** @type {import('jest').Config} */
module.exports = {
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
