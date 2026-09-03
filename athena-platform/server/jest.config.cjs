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
};
