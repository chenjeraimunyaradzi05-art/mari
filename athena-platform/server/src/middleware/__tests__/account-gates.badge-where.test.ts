/**
 * The filter that tells a women-only gate badge from every other badge, checked
 * against the SQL Prisma really writes for it.
 *
 * The mocked-client tests elsewhere can only say what `where` was handed to
 * Prisma, and that is exactly the part that was wrong. `NOT` over a comparison
 * with a missing value is unknown, not true, and an ordinary badge has no
 * `purpose` at all, so the first version of this filter matched no ordinary
 * badge: the reviewer's queue came back empty. What decides it is the SQL, so
 * the query is compiled here by Prisma's own engine through a driver adapter
 * that records the statement and answers with no rows. Nothing connects to
 * anything, and the URLs below are dummies.
 */

import { afterAll, describe, expect, it, jest } from '@jest/globals';
import { PrismaClient, type Prisma } from '@prisma/client';
import { WOMAN_GATE_BADGE_WHERE } from '../account-gates';

// Dummies, set before the client is made so that nothing from a .env file is read.
process.env.DATABASE_URL = 'postgresql://nobody:nothing@127.0.0.1:1/none';
process.env.DIRECT_DATABASE_URL = 'postgresql://nobody:nothing@127.0.0.1:1/none';

jest.mock('../../utils/prisma', () => ({ prisma: {} }));

const statements: string[] = [];
const adapter = {
  provider: 'postgres' as const,
  adapterName: 'recording-adapter',
  async queryRaw(query: { sql: string }) {
    statements.push(query.sql);
    return { columnNames: [], columnTypes: [], rows: [] };
  },
  async executeRaw(query: { sql: string }) {
    statements.push(query.sql);
    return 0;
  },
  async executeScript() {},
  async startTransaction(): Promise<never> {
    throw new Error('The recording adapter does not run transactions');
  },
  async dispose() {},
  getConnectionInfo() {
    return { supportsRelationJoins: true };
  },
};
const adapterFactory = { provider: 'postgres' as const, adapterName: 'recording-adapter', connect: async () => adapter };

const client = new PrismaClient({ adapter: adapterFactory as never });

afterAll(async () => {
  await client.$disconnect();
});

async function sqlFor(where: Prisma.VerificationBadgeWhereInput): Promise<string> {
  statements.length = 0;
  await client.verificationBadge.findMany({ where });
  expect(statements).toHaveLength(1);
  return statements[0];
}

describe('WOMAN_GATE_BADGE_WHERE', () => {
  it('under NOT, tests that the badge has a purpose before comparing it, so a badge with none is not left out', async () => {
    const sql = await sqlFor({ status: 'PENDING', NOT: WOMAN_GATE_BADGE_WHERE });

    // NOT ( has-a-purpose AND purpose-is-the-gate ): false, not unknown, when
    // there is no purpose, and NOT of false is true.
    expect(sql).toMatch(/NOT \(\(.*#>ARRAY\[\$\d+\]::text\[\]\)::jsonb IS NOT NULL AND .*= \$\d+\)\)/);
  });

  it('selects a women-gate badge when used the other way round', async () => {
    const sql = await sqlFor({ type: 'IDENTITY', ...WOMAN_GATE_BADGE_WHERE });

    expect(sql).toMatch(/IS NOT NULL AND .*= \$\d+/);
    expect(sql).not.toContain('NOT (');
  });
});
