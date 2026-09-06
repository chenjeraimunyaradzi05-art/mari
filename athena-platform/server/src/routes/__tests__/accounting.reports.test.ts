import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    journalLine: { findMany: jest.fn(async () => []) },
    organizationMember: { findFirst: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'owner', role: 'USER', email: 'owner@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const account = (id: string, type: string, name: string, code?: string) => ({ id, type, name, code: code ?? null });
const line = (accountId: string, acc: any, debit: number, credit: number) => ({ accountId, account: acc, debit, credit });

const cash = account('a-cash', 'ASSET', 'Cash at bank', '1000');
const loan = account('l-loan', 'LIABILITY', 'Bank loan', '2000');
const capital = account('e-cap', 'EQUITY', 'Owner capital', '3000');
const sales = account('r-sales', 'REVENUE', 'Sales', '4000');
const rent = account('x-rent', 'EXPENSE', 'Rent', '5000');

// Owner puts in 10,000; borrows 5,000; sells 3,000 for cash; pays 1,200 rent.
const BOOKS = [
  line('a-cash', cash, 10000, 0),
  line('e-cap', capital, 0, 10000),
  line('a-cash', cash, 5000, 0),
  line('l-loan', loan, 0, 5000),
  line('a-cash', cash, 3000, 0),
  line('r-sales', sales, 0, 3000),
  line('x-rent', rent, 1200, 0),
  line('a-cash', cash, 0, 1200),
];

describe('Accounting reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.journalLine.findMany.mockResolvedValue(BOOKS);
  });

  it('profit and loss: revenue less expenses over the period', async () => {
    const res = await request(app).get('/api/accounting/reports/profit-and-loss?from=2026-07-01&to=2027-06-30').expect(200);
    expect(res.body.data).toMatchObject({ totalRevenue: 3000, totalExpenses: 1200, netProfit: 1800 });
    expect(res.body.data.revenue[0]).toMatchObject({ name: 'Sales', amount: 3000 });

    const where = prisma.journalLine.findMany.mock.calls[0][0].where.journalEntry;
    expect(where).toMatchObject({ status: 'POSTED', userId: 'owner', organizationId: null });
    expect(where.entryDate.gte).toBeInstanceOf(Date);
    expect(where.entryDate.lte).toBeInstanceOf(Date);
  });

  it('balance sheet: assets equal liabilities plus equity, with profit as retained earnings', async () => {
    const res = await request(app).get('/api/accounting/reports/balance-sheet?asOf=2027-06-30').expect(200);
    expect(res.body.data).toMatchObject({
      totalAssets: 16800,
      totalLiabilities: 5000,
      retainedEarnings: 1800,
      totalEquity: 11800,
      difference: 0,
    });
    expect(res.body.data.assets[0]).toMatchObject({ name: 'Cash at bank', amount: 16800 });
  });

  it('an organisation’s books need membership; a bad date is refused', async () => {
    await request(app).get('/api/accounting/reports/profit-and-loss?organizationId=org1').expect(403);

    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    await request(app).get('/api/accounting/reports/profit-and-loss?organizationId=org1').expect(200);
    const where = prisma.journalLine.findMany.mock.calls[0][0].where.journalEntry;
    expect(where).toEqual({ status: 'POSTED', organizationId: 'org1' });

    await request(app).get('/api/accounting/reports/balance-sheet?asOf=yesterday').expect(400);
  });
});
