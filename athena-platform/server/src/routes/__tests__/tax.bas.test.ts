import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    journalLine: { findMany: jest.fn(async () => []) },
    taxReturn: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'staff', role: 'USER', email: 'staff@athena.com' };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { periodLabel } from '../../services/bas.service';

const prisma: any = prismaTyped;

const line = (account: { id: string; name: string; type: string; taxTreatment: string }, debit: number, credit: number) => ({
  accountId: account.id,
  debit,
  credit,
  account: { ...account, code: null },
});

const SALES = { id: 'sales', name: 'Sales', type: 'REVENUE', taxTreatment: 'GST' };
const GST_FREE_SALES = { id: 'sales-free', name: 'GST-free sales', type: 'REVENUE', taxTreatment: 'GST_FREE' };
const GST_COLLECTED = { id: 'gst-out', name: 'GST collected', type: 'LIABILITY', taxTreatment: 'GST_COLLECTED' };
const RENT = { id: 'rent', name: 'Rent', type: 'EXPENSE', taxTreatment: 'GST' };
const GST_PAID = { id: 'gst-in', name: 'GST paid', type: 'ASSET', taxTreatment: 'GST_PAID' };
const BANK = { id: 'bank', name: 'Bank', type: 'ASSET', taxTreatment: 'GST' };
const LAPTOP = { id: 'laptop', name: 'Equipment', type: 'ASSET', taxTreatment: 'CAPITAL' };

describe('BAS worksheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('labels the quarter on the Australian financial year', () => {
    expect(periodLabel(new Date('2026-07-01T00:00:00Z'), new Date('2026-09-30T23:59:59Z'))).toBe('Q1 FY2027');
    expect(periodLabel(new Date('2026-01-01T00:00:00Z'), new Date('2026-03-31T23:59:59Z'))).toBe('Q3 FY2026');
  });

  it('sums posted lines onto the statement by each account’s tax treatment', async () => {
    prisma.journalLine.findMany.mockResolvedValue([
      line(SALES, 0, 1000),
      line(GST_COLLECTED, 0, 100),
      line(GST_FREE_SALES, 0, 50),
      line(RENT, 200, 0),
      line(GST_PAID, 20, 0),
      line(LAPTOP, 500, 0),
      line(BANK, 880, 0),
    ]);

    const res = await request(app).get('/api/tax/bas?from=2026-07-01&to=2026-09-30').expect(200);
    const sheet = res.body.data;
    expect(sheet.period.label).toBe('Q1 FY2027');
    expect(sheet.sales.taxable).toBe(1000);
    expect(sheet.g3).toBe(50);
    expect(sheet.oneA).toBe(100);
    expect(sheet.oneAEstimated).toBe(false);
    expect(sheet.oneB).toBe(20);
    expect(sheet.g1).toBe(1150);
    expect(sheet.g10).toBe(550);
    expect(sheet.g11).toBe(220);
    expect(sheet.net).toBe(80);
    expect(sheet.lines.find((l: any) => l.accountId === 'bank')).toBeUndefined();

    const where = prisma.journalLine.findMany.mock.calls[0][0].where.journalEntry;
    expect(where).toMatchObject({ status: 'POSTED', userId: 'staff', organizationId: null });
  });

  it('estimates the GST accounts at a tenth when none is tagged, and says so', async () => {
    prisma.journalLine.findMany.mockResolvedValue([line(SALES, 0, 1000), line(RENT, 200, 0)]);
    const res = await request(app).get('/api/tax/bas?from=2026-07-01&to=2026-09-30').expect(200);
    expect(res.body.data).toMatchObject({ oneA: 100, oneAEstimated: true, oneB: 20, oneBEstimated: true, net: 80, g1: 1100 });
  });

  it('refuses a period that runs backwards', async () => {
    await request(app).get('/api/tax/bas?from=2026-09-30&to=2026-07-01').expect(400);
  });

  it('recording a lodgement files a submitted tax return with the worksheet attached', async () => {
    prisma.journalLine.findMany.mockResolvedValue([line(SALES, 0, 1000), line(GST_COLLECTED, 0, 100), line(RENT, 200, 0), line(GST_PAID, 20, 0)]);
    prisma.taxReturn.create.mockImplementation(async ({ data }: any) => ({ id: 't1', status: 'DRAFT', ...data }));
    prisma.taxReturn.findUnique.mockResolvedValue({ id: 't1', userId: 'staff', status: 'DRAFT' });
    prisma.taxReturn.update.mockImplementation(async ({ data }: any) => ({ id: 't1', userId: 'staff', ...data }));

    const res = await request(app).post('/api/tax/bas/lodge').send({ from: '2026-07-01', to: '2026-09-30', w2: 30 }).expect(201);
    expect(res.body.data.status).toBe('SUBMITTED');

    const created = prisma.taxReturn.create.mock.calls[0][0].data;
    expect(Number(created.totalTax)).toBe(110);
    expect(Number(created.totalSales)).toBe(1100);
    expect(created.reference).toBe('BAS Q1 FY2027');
    expect(created.metadata).toMatchObject({ kind: 'BAS', w2: 30, payable: 110, refund: 0 });
    expect(created.metadata.worksheet.net).toBe(80);
  });
});
