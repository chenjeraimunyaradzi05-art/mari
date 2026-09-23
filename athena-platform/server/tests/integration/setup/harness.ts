/**
 * What an integration suite uses instead of `describe`, plus the small amount
 * of database housekeeping every one of them needs.
 *
 * `describeIntegration` rather than a bare `describe` so that a run without a
 * database is *visible*. The skipped suite keeps its name and gains the reason,
 * so the summary line reads "SKIPPED — no TEST_DATABASE_URL: two payouts racing
 * for one balance" rather than a silent absence. The harness suite in
 * `harness.test.ts` then makes that absence a result in its own right.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../src/utils/prisma';
import { resolveIntegrationDatabase } from './database-guards';

const database = resolveIntegrationDatabase();

export const integrationDatabaseConfigured = database.configured;
export const integrationSkipReason = database.configured ? null : database.reason;

export function describeIntegration(name: string, body: () => void): void {
  if (database.configured) {
    describe(name, body);
    return;
  }
  describe.skip(`SKIPPED — no TEST_DATABASE_URL: ${name}`, body);
}

let tableNames: string[] | null = null;

async function publicTables(): Promise<string[]> {
  if (tableNames) return tableNames;

  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
  `;

  tableNames = rows.map((row) => `"public"."${row.tablename}"`);
  return tableNames;
}

/**
 * Empties the database between tests.
 *
 * One `TRUNCATE ... CASCADE` over every table rather than a delete per model:
 * the schema has 222 models and deleting them in dependency order is a list
 * that goes stale the moment somebody adds a relation, which is how a suite
 * ends up passing because the row it was looking for was never written.
 *
 * `_prisma_migrations` is excluded, so the migration state `globalSetup`
 * established survives and the next test does not re-run 63 migrations.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await publicTables();
  if (tables.length === 0) {
    throw new Error(
      'The test database has no tables in the public schema. `prisma migrate deploy` ' +
        'either did not run or ran against a different database.'
    );
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export interface MemberOverrides {
  email?: string;
  firstName?: string;
  lastName?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  giftBalance?: number;
  stripeConnectAccountId?: string | null;
  isSuspended?: boolean;
}

/**
 * A member row with the columns the schema insists on and nothing else, so a
 * test that cares about `giftBalance` says so and a reader can tell which
 * fields are part of the case being made.
 */
export async function createMember(overrides: MemberOverrides = {}) {
  const suffix = randomUUID();

  return prisma.user.create({
    data: {
      email: overrides.email ?? `member-${suffix}@athena.test`,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Member',
      emailVerified: overrides.emailVerified ?? true,
      passwordHash: overrides.passwordHash,
      giftBalance: overrides.giftBalance,
      stripeConnectAccountId: overrides.stripeConnectAccountId ?? undefined,
      isSuspended: overrides.isSuspended,
    },
  });
}

/**
 * Runs two calls at genuinely the same time and reports what each did.
 *
 * `Promise.allSettled` rather than `Promise.all`, because in every race worth
 * testing here exactly one side is supposed to be refused, and `Promise.all`
 * would throw that refusal instead of letting the test assert it.
 */
export async function race<T>(
  first: () => Promise<T>,
  second: () => Promise<T>
): Promise<Array<PromiseSettledResult<T>>> {
  return Promise.allSettled([first(), second()]);
}

export function fulfilled<T>(results: Array<PromiseSettledResult<T>>): T[] {
  return results.filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled').map((r) => r.value);
}

export function rejections<T>(results: Array<PromiseSettledResult<T>>): unknown[] {
  return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason);
}

/** Prisma's own error type, for suites asserting on a constraint rather than on a message. */
export const PrismaKnownRequestError = Prisma.PrismaClientKnownRequestError;

/**
 * Waits for something the server does after it has already answered.
 *
 * `/auth/forgot-password` sends its email on the response's `finish` event, on
 * purpose: awaiting the mail provider first would make the reply slower for an
 * address that has an account than for one that does not, which is the timing
 * side channel the "always return success" wording exists to close. That means
 * supertest resolves before the token has been handed to the email layer, and a
 * test that reads it straight away reads nothing.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${description}`);
}
