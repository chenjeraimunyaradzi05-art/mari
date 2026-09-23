/**
 * Prepares the database the integration suite runs against, once per run.
 *
 * This is the step the repository has never had. CI already starts a Postgres
 * service and runs `prisma db push --accept-data-loss` against it, but only so
 * that `tsc` can see a generated client — no test has ever connected to it, so
 * the 63 migrations under `prisma/migrations` have never been applied by
 * anything that then checked the result. `prisma migrate deploy` here is
 * deliberate: `db push` would build the schema straight from `schema.prisma`
 * and prove nothing about whether the migrations that ship to production can
 * still construct it.
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  applyDatabaseUrlToEnvironment,
  integrationDatabaseRequired,
  resolveIntegrationDatabase,
} from './database-guards';

const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..');
const PRISMA_CLI = path.join(SERVER_ROOT, 'node_modules', 'prisma', 'build', 'index.js');

/** Written straight to stderr: a Jest reporter can swallow console output, and this must not be swallowed. */
function banner(lines: string[]): void {
  const width = Math.max(...lines.map((line) => line.length));
  const rule = '='.repeat(Math.min(width, 100));
  process.stderr.write(`\n${rule}\n${lines.join('\n')}\n${rule}\n\n`);
}

/**
 * Waits for the container to start accepting connections.
 *
 * `docker compose up -d` returns as soon as the container is created, which is
 * a second or two before Postgres is listening. Without this the first run
 * after starting the stack failed on `migrate deploy` with a connection error,
 * which reads like a broken harness rather than like "wait a moment".
 */
async function waitForDatabase(url: string, attempts = 30, delayMs = 1000): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = new PrismaClient({ datasourceUrl: url });
    try {
      await client.$queryRaw`SELECT 1`;
      await client.$disconnect();
      return;
    } catch (error) {
      lastError = error;
      await client.$disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `The test database did not accept a connection after ${attempts} attempts: ` +
      `${(lastError as Error)?.message ?? lastError}`
  );
}

function runPrisma(args: string[], url: string): void {
  execFileSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: SERVER_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_DATABASE_URL: url,
      // `prisma.config.ts` calls `import 'dotenv/config'`, and dotenv leaves an
      // existing variable alone, so the two above win over `.env`. Saying it in
      // a comment rather than trusting it silently, because the cost of being
      // wrong is this suite truncating the production database.
    },
  });
}

export default async function globalSetup(): Promise<void> {
  const database = resolveIntegrationDatabase();

  if (!database.configured) {
    if (integrationDatabaseRequired()) {
      banner([
        'INTEGRATION TESTS COULD NOT RUN, AND THIS RUN IS REQUIRED TO RUN THEM',
        '',
        database.reason,
        '',
        'Set INTEGRATION_DB_REQUIRED=0 if this pipeline deliberately runs the fast suite only.',
      ]);
      throw new Error(`Integration database required but not configured: ${database.reason}`);
    }

    banner([
      'INTEGRATION TESTS SKIPPED — NO DATABASE',
      '',
      database.reason,
      '',
      'Every suite below will report as skipped. Nothing in this run has exercised a',
      'migration, a constraint, a cascade or a concurrent transaction.',
    ]);
    return;
  }

  applyDatabaseUrlToEnvironment(database.url);

  const redacted = database.url.replace(/\/\/[^@]*@/, '//***@');
  banner([
    'INTEGRATION TESTS RUNNING AGAINST A REAL DATABASE',
    '',
    `  ${redacted}`,
    '',
    'Every table in it is truncated before each test.',
  ]);

  await waitForDatabase(database.url);
  runPrisma(['migrate', 'deploy'], database.url);
}
