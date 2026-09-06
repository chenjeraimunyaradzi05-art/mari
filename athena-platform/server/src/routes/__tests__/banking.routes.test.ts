import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    bankConnection: { findFirst: jest.fn(), findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn(async () => ({})), delete: jest.fn() },
    bankAccount: { upsert: jest.fn(), update: jest.fn(async () => ({})), findFirst: jest.fn() },
    bankTransaction: { createMany: jest.fn(), findMany: jest.fn(async () => []), findFirst: jest.fn(), update: jest.fn() },
    accountingAccount: { findUnique: jest.fn() },
    organizationMember: { findFirst: jest.fn() },
  },
}));

jest.mock('../../services/accounting.service', () => ({
  createJournalEntry: jest.fn(async () => ({ id: 'j1' })),
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
import { createJournalEntry } from '../../services/accounting.service';
import { toCents, parseStatementDate } from '../../services/open-banking.service';

const prisma: any = prismaTyped;

describe('Bank feeds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BASIQ_API_KEY;
  });

  it('reads statement amounts and dates the way Australian banks export them', () => {
    expect(toCents('1,200.00')).toBe(120000);
    expect(toCents('$4.50')).toBe(450);
    expect(toCents('(12.00)')).toBe(-1200);
    expect(toCents('12.00 DR')).toBe(-1200);
    expect(toCents(-4.5)).toBe(-450);
    expect(toCents('abc')).toBeNull();
    expect(parseStatementDate('01/07/2026')?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(parseStatementDate('2026-07-02')?.toISOString()).toBe('2026-07-02T00:00:00.000Z');
    expect(parseStatementDate('31/02/2026')).toBeNull();
  });

  it('says when the provider is not configured, and refuses to start a consent', async () => {
    const status = await request(app).get('/api/banking/status').expect(200);
    expect(status.body.data).toEqual({ configured: false, connections: [] });
    await request(app).post('/api/banking/connect').expect(503);
  });

  it('a pasted statement becomes bank lines once each, bad rows skipped, balance kept', async () => {
    prisma.bankConnection.findFirst.mockResolvedValue(null);
    prisma.bankConnection.create.mockResolvedValue({ id: 'conn-csv', provider: 'CSV' });
    prisma.bankAccount.upsert.mockResolvedValue({ id: 'acct-1' });
    prisma.bankTransaction.createMany.mockResolvedValue({ count: 2 });

    const res = await request(app)
      .post('/api/banking/import')
      .send({
        accountName: 'Everyday account',
        rows: [
          { date: '01/07/2026', description: 'Coffee', amount: '-4.50' },
          { date: '2026-07-01', description: 'coffee', amount: -4.5 },
          { date: 'yesterday', description: 'Mystery', amount: '1' },
          { date: '02/07/2026', description: 'Client payment', amount: '1,200.00', balance: '1,195.50' },
        ],
      })
      .expect(201);

    expect(res.body.data).toEqual({ accountId: 'acct-1', imported: 2, duplicates: 1, skipped: 1 });
    const rows = prisma.bankTransaction.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(3);
    expect(rows[0].fingerprint).toBe(rows[1].fingerprint);
    expect(rows[2]).toMatchObject({ description: 'Client payment', amountCents: 120000 });
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({ where: { id: 'acct-1' }, data: { balanceCents: 119550 } });
  });

  it('choosing an account marks the line categorised; posting writes one balanced journal', async () => {
    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: 't1',
      status: 'UNREVIEWED',
      ledgerAccountId: null,
      amountCents: -450,
      description: 'Coffee',
      postedAt: new Date('2026-07-01T00:00:00Z'),
      bankAccount: { id: 'acct-1', ledgerAccountId: 'ledger-bank', connection: { organizationId: null } },
    });
    prisma.accountingAccount.findUnique.mockResolvedValue({ id: 'ledger-expense', userId: 'staff', type: 'EXPENSE' });
    prisma.bankTransaction.update.mockImplementation(async ({ data }: any) => ({ id: 't1', ...data }));

    const categorised = await request(app).patch('/api/banking/transactions/t1').send({ ledgerAccountId: 'ledger-expense' }).expect(200);
    expect(categorised.body.data).toMatchObject({ status: 'CATEGORISED', ledgerAccountId: 'ledger-expense' });

    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: 't1',
      status: 'CATEGORISED',
      ledgerAccountId: 'ledger-expense',
      amountCents: -450,
      description: 'Coffee',
      postedAt: new Date('2026-07-01T00:00:00Z'),
      bankAccount: { id: 'acct-1', ledgerAccountId: 'ledger-bank', connection: { organizationId: null } },
    });
    const posted = await request(app).post('/api/banking/transactions/t1/post').expect(200);
    expect(posted.body.data).toMatchObject({ status: 'POSTED', journalEntryId: 'j1' });
    expect(createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff',
        status: 'POSTED',
        reference: 'bank:t1',
        lines: [
          { accountId: 'ledger-expense', debit: 4.5 },
          { accountId: 'ledger-bank', credit: 4.5 },
        ],
      })
    );
  });

  it('a line cannot be posted until the bank account is linked to the ledger', async () => {
    prisma.bankTransaction.findFirst.mockResolvedValue({
      id: 't2',
      status: 'CATEGORISED',
      ledgerAccountId: 'ledger-expense',
      amountCents: 1000,
      description: 'Sale',
      postedAt: new Date(),
      bankAccount: { id: 'acct-1', ledgerAccountId: null, connection: { organizationId: null } },
    });
    const res = await request(app).post('/api/banking/transactions/t2/post').expect(400);
    expect(res.body.message).toMatch(/Link this bank account/);
    expect(createJournalEntry).not.toHaveBeenCalled();
  });
});

describe('Another member’s bank data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cannot be posted, re-categorised, linked or removed: every lookup is scoped to the signed-in member', async () => {
    prisma.bankTransaction.findFirst.mockResolvedValue(null);
    prisma.bankAccount.findFirst.mockResolvedValue(null);
    prisma.bankConnection.findFirst.mockResolvedValue(null);

    await request(app).post('/api/banking/transactions/theirs/post').expect(404);
    await request(app).patch('/api/banking/transactions/theirs').send({ ledgerAccountId: 'ledger-expense' }).expect(404);
    await request(app).post('/api/banking/accounts/theirs/link').send({ ledgerAccountId: 'ledger-bank' }).expect(404);
    await request(app).delete('/api/banking/connections/theirs').expect(404);

    expect(prisma.bankTransaction.findFirst.mock.calls[0][0].where).toEqual({ id: 'theirs', bankAccount: { connection: { userId: 'staff' } } });
    expect(prisma.bankAccount.findFirst.mock.calls[0][0].where).toEqual({ id: 'theirs', connection: { userId: 'staff' } });
    expect(prisma.bankConnection.findFirst.mock.calls[0][0].where).toEqual({ id: 'theirs', userId: 'staff' });
    expect(prisma.bankTransaction.update).not.toHaveBeenCalled();
    expect(prisma.bankConnection.delete).not.toHaveBeenCalled();
  });
});
