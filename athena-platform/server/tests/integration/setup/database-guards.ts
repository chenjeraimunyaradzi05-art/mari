/**
 * Deciding whether the integration suite may run, and against what.
 *
 * Two separate dangers are answered here, and they pull in opposite directions.
 *
 * The first is that these tests truncate every table in the database they are
 * pointed at before each test. `server/.env` holds the production Neon
 * connection string, `src/index.ts` and `prisma.config.ts` both call
 * `dotenv.config()`, and dotenv does not overwrite a variable that is already
 * set — so a run that forgets to set `DATABASE_URL` does not fail, it inherits
 * production. That is the single worst thing this harness could do, so the URL
 * is checked against several independent guards and a failure is a hard error
 * rather than a skip.
 *
 * The second is that a developer without Docker, and the ordinary mocked suite,
 * must be unaffected. Absent configuration therefore skips — but it says so at
 * the top of the run, in the suite titles, and in a test of its own, and in CI
 * it is an outright failure. A suite that quietly reports success without
 * having connected to anything is worth less than no suite at all, because it
 * reads on the dashboard exactly like one that ran.
 */

import { isNeonConnectionString, isPostgresConnectionString } from '../../../src/utils/database-url';

/**
 * Hosts a disposable test database is allowed to live on without anyone having
 * to say so. `docker-compose.test.yml` publishes on localhost, and a GitHub
 * Actions service container is reachable there too; `postgres` and
 * `athena-test-db` cover the suite running inside the compose network itself.
 */
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'host.docker.internal',
  'postgres',
  'athena-test-db',
]);

/**
 * Every environment variable `applyDatabaseUrlDefaults` will read a connection
 * string out of. The harness overwrites the lot rather than only `DATABASE_URL`,
 * because the resolver falls through this list in order and a leftover
 * `DIRECT_DATABASE_URL` from `.env` is enough to send `prisma migrate deploy` at
 * production while `DATABASE_URL` points somewhere harmless.
 */
export const DATABASE_URL_ENV_KEYS = [
  'DATABASE_URL',
  'NETLIFY_DB_URL',
  'NETLIFY_DATABASE_URL',
  'NEON_DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'DIRECT_URL',
  'NEON_DIRECT_DATABASE_URL',
] as const;

/**
 * Where the client is pointed when there is no test database. It is not a real
 * address: port 1 on the loopback interface refuses immediately. Leaving
 * `DATABASE_URL` alone instead would leave production in it, and a single
 * `describe` that forgot to use `describeIntegration` would then run against it.
 */
export const UNREACHABLE_DATABASE_URL =
  'postgresql://athena-integration-harness:not-configured@127.0.0.1:1/athena_test_not_configured';

export type IntegrationDatabase =
  | { configured: true; url: string }
  | { configured: false; reason: string };

export class IntegrationDatabaseMisconfigured extends Error {}

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function refuse(reason: string): never {
  throw new IntegrationDatabaseMisconfigured(
    `TEST_DATABASE_URL is set but cannot be used: ${reason}\n` +
      'The integration suite truncates every table in the database it is given, so it ' +
      'refuses anything it cannot prove is disposable. See server/docker-compose.test.yml.'
  );
}

/**
 * Whether a missing test database is a failure rather than a skip.
 *
 * `CI` is the default answer because a continuous-integration run that skips
 * every integration test and reports green is the failure mode this whole file
 * exists to prevent. `INTEGRATION_DB_REQUIRED` overrides it either way: `1` for
 * a developer who wants the same insistence locally, `0` for a pipeline that
 * has deliberately chosen to run the fast suite only.
 */
export function integrationDatabaseRequired(): boolean {
  const explicit = process.env.INTEGRATION_DB_REQUIRED?.trim().toLowerCase();
  if (explicit === '1' || explicit === 'true' || explicit === 'yes') return true;
  if (explicit === '0' || explicit === 'false' || explicit === 'no') return false;
  return Boolean(process.env.CI);
}

/**
 * The test database, or the reason there is not one.
 *
 * Throws — rather than reporting "not configured" — when `TEST_DATABASE_URL` is
 * present but fails a guard. Someone who set the variable meant these tests to
 * run, and answering that with a silent skip is how a typo in a CI secret turns
 * into months of a suite that never executed.
 */
export function resolveIntegrationDatabase(env: NodeJS.ProcessEnv = process.env): IntegrationDatabase {
  const raw = env.TEST_DATABASE_URL?.trim();

  if (!raw) {
    return {
      configured: false,
      reason:
        'TEST_DATABASE_URL is not set. Start the disposable database with ' +
        '`docker compose -f docker-compose.test.yml up -d` and export the URL it prints, ' +
        'or run `node scripts/integration-db.js up` which does both.',
    };
  }

  if (!isPostgresConnectionString(raw)) {
    refuse('it is not a postgres:// or postgresql:// connection string.');
  }

  const url = parse(raw);
  if (!url) {
    refuse('it is not a parseable URL.');
  }

  if (isNeonConnectionString(raw)) {
    refuse(
      'it points at a Neon host. Neon is where ATHENA keeps member data, including ' +
        'domestic-violence safety records, and this suite would truncate it.'
    );
  }

  // The most reliable guard of the set, because it does not depend on knowing
  // which hosts are production: the developer has to have deliberately named a
  // database `something_test` for the suite to touch it at all.
  const database = url.pathname.replace(/^\//, '');
  if (!/test/i.test(database)) {
    refuse(
      `the database name "${database || '(none)'}" does not contain "test". ` +
        'Name the database so that nobody reading the connection string can mistake it ' +
        'for one holding real data.'
    );
  }

  if (!LOCAL_HOSTS.has(url.hostname) && env.ATHENA_TEST_DATABASE_IS_DISPOSABLE !== '1') {
    refuse(
      `the host "${url.hostname}" is not local. If this really is a throwaway database, ` +
        'set ATHENA_TEST_DATABASE_IS_DISPOSABLE=1 alongside it to say so on the record.'
    );
  }

  // Catches the case the other guards cannot: a `TEST_DATABASE_URL` copied from
  // `DATABASE_URL` and then edited only in the parts nobody checks.
  for (const key of DATABASE_URL_ENV_KEYS) {
    if (env[key] && env[key] === raw) {
      refuse(`it is identical to ${key}, so it is not a separate database at all.`);
    }
  }

  return { configured: true, url: raw };
}

/**
 * Makes sure the pool is big enough for the races these tests stage.
 *
 * Prisma sizes its pool at `cores * 2 + 1` by default, and an interactive
 * `$transaction` holds its connection for the whole transaction. The gift test
 * fires five simultaneous sends at one balance on purpose, so on a two-core CI
 * runner — pool of five — the last of them would wait for a connection instead
 * of waiting for the row lock, and the failure would arrive as a P2024 pool
 * timeout: a confusing answer to a test about concurrency, and one that would
 * read as the guard being broken.
 *
 * Only added when the caller has not asked for something specific.
 */
function withPoolSettings(url: string): string {
  const parsed = parse(url);
  if (!parsed) return url;

  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', '20');
  }
  if (!parsed.searchParams.has('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', '20');
  }

  return parsed.toString();
}

/**
 * Points every connection-string variable the server reads at one URL.
 *
 * Both halves matter. Setting the test URL is what makes `src/utils/prisma`
 * connect somewhere disposable; clearing the rest is what stops `.env` putting
 * production back in through a variable the caller never thought about.
 */
export function applyDatabaseUrlToEnvironment(url: string, env: NodeJS.ProcessEnv = process.env): void {
  const pooled = withPoolSettings(url);

  for (const key of DATABASE_URL_ENV_KEYS) {
    delete env[key];
  }
  env.DATABASE_URL = pooled;
  env.DIRECT_DATABASE_URL = pooled;
}
