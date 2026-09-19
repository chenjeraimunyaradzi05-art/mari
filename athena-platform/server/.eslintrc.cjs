module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'node_modules/'],
  rules: {
    // Everything the running server says goes through utils/logger: it stamps
    // the time and the level, redacts passwords and tokens by key name, and in
    // production emits JSON that log search can read. A console call skips all
    // of that, so the one line explaining an incident is the one line nobody
    // can find. The overrides below exempt the code that is a terminal tool.
    'no-console': 'error',
    // Off, and the measurement is the reason. Turning it on as a warning put
    // 2532 lines into `npm run lint` (19 September 2026, src only), which
    // drowned the 78 no-unused-vars warnings that had until then been the
    // entire output of that command: a report nobody can read is not a report,
    // and the one rule here with something to say stopped being heard. CI is
    // unaffected either way — it lints with --quiet, so only errors reach it —
    // so this is purely about the output a person reads. It goes back to
    // 'warn' when the count has been worked down far enough to sit beside the
    // unused-vars list, or when it can be scoped to newly written code.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      // Command-line tools whose whole job is printing to a terminal, so
      // no-console would be telling them not to do the one thing they exist
      // for: the seeds, the one-off scripts, the crash-safe bootstrapper
      // (start.ts prints before the app — and therefore the logger — has been
      // loaded at all, which is the point of it), and the test suites.
      files: [
        'src/services/seed/**',
        'src/scripts/**',
        'src/start.ts',
        'src/**/__tests__/**',
        'tests/**',
        '**/*.test.ts',
      ],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
