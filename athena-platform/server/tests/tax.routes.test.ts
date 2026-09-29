import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Row } from './support/prisma-where';

/**
 * /api/tax rates and returns. The BAS worksheet and lodgement have their own
 * suites (src/routes/__tests__/tax.bas*.test.ts); the rest of the prefix and
 * all of services/tax.service.ts had none.
 *
 * What is held here:
 *
 *   - A tax rate is platform configuration every organisation's invoices read,
 *     so any member may look one up and only an admin may write one.
 *   - A rate is a fraction. The create form once posted 10 for ten per cent,
 *     the schema let it through and the service refused it, so a GST rate could
 *     be edited but never created. 0.1 is accepted; 10 is refused, and the
 *     refusal says which unit it wants.
 *   - A return is the member's while it is a draft: she can edit, lodge or
 *     delete it, nobody else can, and once lodged it is no longer editable or
 *     deletable by anyone through this API — a lodged BAS is a record of what
 *     went to the ATO.
 *   - A return cannot be filed into an organisation she does not belong to.
 */

const store = {
  rates: [] as Row[],
  returns: [] as Row[],
  memberships: [] as Array<{ organizationId: string; userId: string }>,
};

jest.mock('../src/utils/prisma', () => {
  const where = (jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where')).matchesWhere;
  const table = (rows: () => Row[], prefix: string) => ({
    findMany: jest.fn(async (args?: { where?: unknown }) => rows().filter((row) => where(row, args?.where))),
    findUnique: jest.fn(async (args: { where: unknown }) => rows().find((row) => where(row, args.where)) ?? null),
    create: jest.fn(async ({ data }: { data: Row }) => {
      const row = { id: `${prefix}-${rows().length + 1}`, status: 'DRAFT', ...data };
      rows().push(row);
      return row;
    }),
    update: jest.fn(async ({ where: w, data }: { where: { id: string }; data: Row }) => {
      const row = rows().find((r) => r.id === w.id);
      if (!row) throw new Error('Record to update not found');
      for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
      return row;
    }),
    delete: jest.fn(async ({ where: w }: { where: { id: string } }) => {
      const index = rows().findIndex((r) => r.id === w.id);
      if (index < 0) throw new Error('Record to delete does not exist');
      return rows().splice(index, 1)[0];
    }),
  });
  return {
    prisma: {
      taxRate: table(() => store.rates, 'rate'),
      taxReturn: table(() => store.returns, 'return'),
      organizationMember: {
        findFirst: async (args: { where: { organizationId: string; userId: string } }) =>
          store.memberships.find((m) => m.organizationId === args.where.organizationId && m.userId === args.where.userId)
            ? { id: 'membership' }
            : null,
        findMany: async (args: { where: { userId: string } }) => store.memberships.filter((m) => m.userId === args.where.userId),
      },
    },
  };
});

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate: (req: { headers: Record<string, unknown>; user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (typeof id !== 'string') return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = { id, email: `${id}@example.com`, role: (req.headers['x-test-role'] as string) || 'USER' };
      next();
    },
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const as = (id: string, role = 'USER') => ({ 'x-test-user': id, 'x-test-role': role });

const quarter = {
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-09-30T23:59:59.000Z',
  totalSales: 11000,
  totalTax: 1000,
};

beforeEach(() => {
  store.rates = [];
  store.returns = [];
  store.memberships = [{ organizationId: ORG, userId: 'ada' }];
});

describe('Tax rates: anyone signed in reads them, only an admin writes them', () => {
  it('refuses a signed-out caller', async () => {
    await request(app).get('/api/tax/rates').expect(401);
  });

  it('lists the active rates to a member', async () => {
    store.rates = [
      { id: 'gst', name: 'GST', type: 'GST', rate: 0.1, region: 'ANZ', isActive: true, organizationId: null },
      { id: 'old', name: 'Retired', type: 'GST', rate: 0.125, region: 'ANZ', isActive: false, organizationId: null },
    ];

    const res = await request(app).get('/api/tax/rates').set(as('ada')).expect(200);

    expect(res.body.data.map((rate: Row) => rate.id)).toEqual(['gst']);
  });

  it('refuses a member, a moderator and a creator every write', async () => {
    store.rates = [{ id: 'gst', name: 'GST', type: 'GST', rate: 0.1, isActive: true }];
    for (const role of ['USER', 'MODERATOR', 'CREATOR']) {
      await request(app).post('/api/tax/rates').set(as('ada', role)).send({ name: 'GST', type: 'GST', rate: 0.1 }).expect(403);
      await request(app).patch('/api/tax/rates/gst').set(as('ada', role)).send({ rate: 0.2 }).expect(403);
      await request(app).delete('/api/tax/rates/gst').set(as('ada', role)).expect(403);
    }
    expect(store.rates).toEqual([{ id: 'gst', name: 'GST', type: 'GST', rate: 0.1, isActive: true }]);
  });

  it('lets an admin create ten per cent GST as 0.1', async () => {
    const res = await request(app)
      .post('/api/tax/rates')
      .set(as('root', 'ADMIN'))
      .send({ name: 'GST', type: 'GST', rate: 0.1, region: 'ANZ' })
      .expect(201);

    expect(Number(res.body.data.rate)).toBe(0.1);
    expect(store.rates).toHaveLength(1);
  });

  it('refuses 10 for ten per cent, and says the unit it wants', async () => {
    const res = await request(app)
      .post('/api/tax/rates')
      .set(as('root', 'ADMIN'))
      .send({ name: 'GST', type: 'GST', rate: 10 })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/0\.1 means 10%/);
    expect(store.rates).toHaveLength(0);
  });

  it('refuses a region the platform does not serve', async () => {
    const res = await request(app)
      .post('/api/tax/rates')
      .set(as('root', 'ADMIN'))
      .send({ name: 'GST', type: 'GST', rate: 0.1, region: 'MARS' })
      .expect(400);

    expect(res.body.message).toMatch(/invalid region/i);
  });
});

describe('Tax returns belong to the member who drafted them', () => {
  it('drafts a personal return in Australian dollars', async () => {
    const res = await request(app).post('/api/tax/returns').set(as('ada')).send(quarter).expect(201);

    expect(res.body.data).toEqual(expect.objectContaining({ userId: 'ada', status: 'DRAFT', currency: 'AUD' }));
    expect(Number(res.body.data.totalTax)).toBe(1000);
  });

  it('refuses a period that ends before it starts', async () => {
    const res = await request(app)
      .post('/api/tax/returns')
      .set(as('ada'))
      .send({ ...quarter, periodStart: quarter.periodEnd, periodEnd: quarter.periodStart })
      .expect(400);

    expect(res.body.message).toMatch(/start must be before/i);
  });

  it('files into an organisation only for a member of it', async () => {
    await request(app).post('/api/tax/returns').set(as('ada')).send({ ...quarter, organizationId: ORG }).expect(201);
    await request(app).post('/api/tax/returns').set(as('ada')).send({ ...quarter, organizationId: OTHER_ORG }).expect(403);

    expect(store.returns.map((row) => row.organizationId)).toEqual([ORG]);
  });

  it("lists a member's own personal returns, never another member's", async () => {
    store.returns = [
      { id: 'r-ada', userId: 'ada', organizationId: null, status: 'DRAFT' },
      { id: 'r-grace', userId: 'grace', organizationId: null, status: 'DRAFT' },
    ];

    const res = await request(app).get('/api/tax/returns').set(as('ada')).expect(200);

    expect(res.body.data.map((row: Row) => row.id)).toEqual(['r-ada']);
  });

  it('lets nobody else edit, lodge or delete her draft', async () => {
    store.returns = [{ id: 'r1', userId: 'ada', organizationId: null, status: 'DRAFT', totalTax: 1000 }];

    await request(app).patch('/api/tax/returns/r1').set(as('grace')).send({ totalTax: 1 }).expect(403);
    await request(app).post('/api/tax/returns/r1/submit').set(as('grace')).expect(403);
    await request(app).delete('/api/tax/returns/r1').set(as('grace')).expect(403);

    expect(store.returns).toEqual([{ id: 'r1', userId: 'ada', organizationId: null, status: 'DRAFT', totalTax: 1000 }]);
  });

  it('lodges her draft, dated, and then holds it as lodged', async () => {
    store.returns = [{ id: 'r1', userId: 'ada', organizationId: null, status: 'DRAFT', totalTax: 1000 }];

    const lodged = await request(app).post('/api/tax/returns/r1/submit').set(as('ada')).expect(200);
    expect(lodged.body.data.status).toBe('SUBMITTED');
    expect(lodged.body.data.filedAt).toEqual(expect.any(String));

    const edit = await request(app).patch('/api/tax/returns/r1').set(as('ada')).send({ totalTax: 1 }).expect(400);
    expect(edit.body.message).toMatch(/only draft returns can be edited/i);
    await request(app).post('/api/tax/returns/r1/submit').set(as('ada')).expect(400);
    await request(app).delete('/api/tax/returns/r1').set(as('ada')).expect(400);

    expect(store.returns[0]).toEqual(expect.objectContaining({ status: 'SUBMITTED', totalTax: 1000 }));
  });

  it('answers 404 for a return that does not exist', async () => {
    await request(app).post('/api/tax/returns/missing/submit').set(as('ada')).expect(404);
  });
});
