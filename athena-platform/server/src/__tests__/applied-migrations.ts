/**
 * What _prisma_migrations holds for a database that has every migration this
 * build ships with, for the launch-readiness suites to answer the migrations
 * check with.
 *
 * /health/launch-readiness asks the database whether the migrations ran
 * (health.routes.ts, migrationsCheck), and a suite whose prisma mock answers
 * nothing would report not-ready for a reason that has nothing to do with what
 * it is about. These rows are read from the real prisma/migrations directory,
 * so a new migration does not need this file touched.
 *
 * It lives under src/ and not under tests/ because both kinds of suite use it:
 * `npm run build` is `tsc` over src/ (rootDir src), including every
 * src/**\/__tests__ suite, and a suite there that imported a file from tests/
 * stopped the build with TS6059. tests/support/applied-migrations.ts re-exports
 * this for the suites under tests/. Jest only runs *.test.ts files, so this is
 * not collected as a suite.
 */

import fs from 'fs';
import path from 'path';

/** Two levels below the server root from src/__tests__ and from dist/__tests__ alike. */
export const MIGRATIONS_DIRECTORY = path.resolve(__dirname, '../../prisma/migrations');

export function shippedMigrationNames(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export function appliedMigrationRows(): MigrationRow[] {
  const finished = new Date('2026-01-01T00:00:00.000Z');
  return shippedMigrationNames().map((name) => ({ migration_name: name, finished_at: finished, rolled_back_at: null }));
}
