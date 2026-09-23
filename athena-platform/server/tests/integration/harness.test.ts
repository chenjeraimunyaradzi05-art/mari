/**
 * The suite that reports on the harness itself.
 *
 * It is the only file in this project that does not use `describeIntegration`,
 * because it has to run in both cases. Without a database it is the run's
 * answer to "did the integration tests happen?" — a named, visible result
 * rather than an absence. With one, it proves the three things every other
 * suite quietly assumes: that Prisma is pointed at the disposable database and
 * not at production, that the migrations actually built the schema, and that
 * `resetDatabase` really empties it between tests.
 *
 * That last one matters more than it looks. A truncate that silently covered
 * only some tables would leave fixtures behind, and the failures would surface
 * as unrelated suites disagreeing with each other three files later.
 */

import { prisma } from '../../src/utils/prisma';
import { integrationDatabaseRequired, resolveIntegrationDatabase } from './setup/database-guards';
import { createMember, integrationDatabaseConfigured, integrationSkipReason, resetDatabase } from './setup/harness';

describe('the integration harness', () => {
  if (!integrationDatabaseConfigured) {
    it('DID NOT RUN — no test database, so nothing in this project touched Postgres', () => {
      // Printed as well as asserted. A skipped project is easy to read past in a
      // CI log; a named test that explains itself is not.
      process.stderr.write(
        `\nIntegration tests did not run.\n${integrationSkipReason}\n\n` +
          'Nothing in this run exercised a migration, a constraint, a cascade, or a\n' +
          'concurrent transaction. The mocked suite cannot cover those.\n\n'
      );

      // The assertion that makes an unrun suite a failure where it must be one.
      // `integrationDatabaseRequired()` is true in CI unless a pipeline has
      // explicitly opted out, so a pipeline that loses its database service
      // turns red here instead of reporting a green run of zero tests.
      expect(integrationDatabaseRequired()).toBe(false);
    });

    return;
  }

  it('is connected to the disposable test database, not to production', async () => {
    const database = resolveIntegrationDatabase();
    expect(database.configured).toBe(true);

    const [{ current_database: name }] = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;

    // The same guard `database-guards.ts` applies to the URL, asked of the
    // server that actually answered. A connection string can lie about which
    // database it reaches — a search_path, a pooler, a stale environment
    // variable — and this is the only question with an unarguable answer.
    expect(name).toMatch(/test/i);
  });

  it('has a schema the migrations built, not one Prisma pushed', async () => {
    const applied = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
    `;

    // 63 migrations ship today. Asserting "more than a few" rather than the
    // exact number keeps this from failing every time somebody adds one, while
    // still catching the case that matters: a database built by `db push`, or
    // one where deploy stopped after the first migration.
    expect(Number(applied[0].count)).toBeGreaterThan(50);

    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = new Set(tables.map((row) => row.tablename));

    // One table from each area this project has tests for, so a partially
    // applied migration history is caught here and not as a confusing failure
    // inside a test about payouts.
    for (const table of ['User', 'Session', 'CreatorPayout', 'GiftTransaction', 'DvSafeChat', 'HealthEntry', 'BankTransaction']) {
      expect(names.has(table)).toBe(true);
    }
  });

  it('empties the database between tests', async () => {
    await resetDatabase();
    await createMember();
    expect(await prisma.user.count()).toBe(1);

    await resetDatabase();
    expect(await prisma.user.count()).toBe(0);
  });

  it('enforces the unique constraint on User.email, which a mock cannot', async () => {
    await resetDatabase();
    const member = await createMember({ email: 'duplicate@athena.test' });

    // The reason this project exists, in one assertion. `jest.mock` gives
    // `user.create` back whatever the test told it to give back, so a second
    // account on one address looks fine in all 183 mocked suites.
    await expect(createMember({ email: 'duplicate@athena.test' })).rejects.toMatchObject({
      code: 'P2002',
    });

    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: member.id } }))?.email).toBe('duplicate@athena.test');
  });
});
