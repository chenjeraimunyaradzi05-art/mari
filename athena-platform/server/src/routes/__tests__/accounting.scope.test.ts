import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    accountingAccount: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn() },
    journalEntry: { findMany: jest.fn(async () => []), create: jest.fn() },
    organizationMember: { findFirst: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ada', role: 'USER', email: 'ada@athena.com' };
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

const prisma: any = prismaTyped;

const ADA_ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const CASH = '33333333-3333-4333-8333-333333333333';
const SALES = '44444444-4444-4444-8444-444444444444';

const balanced = (organizationId?: string) => ({
  ...(organizationId ? { organizationId } : {}),
  description: 'Sale',
  status: 'POSTED',
  lines: [
    { accountId: CASH, debit: 100 },
    { accountId: SALES, credit: 100 },
  ],
});

describe('The ledger only opens books the caller has', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findFirst.mockResolvedValue(null);
    prisma.journalEntry.create.mockResolvedValue({ id: 'j1', lines: [] });
    prisma.accountingAccount.create.mockResolvedValue({ id: CASH });
  });

  it('refuses a journal entry filed into an organisation she is not in', async () => {
    await request(app).post('/api/accounting/journals').send(balanced(OTHER_ORG)).expect(403);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('refuses lines that cite accounts from other books, even in her own', async () => {
    prisma.accountingAccount.findMany.mockResolvedValue([
      { id: CASH, organizationId: null, userId: 'ada' },
      { id: SALES, organizationId: null, userId: 'bea' },
    ]);

    await request(app).post('/api/accounting/journals').send(balanced()).expect(403);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('accepts an entry whose every line is in the books it is filed into', async () => {
    prisma.accountingAccount.findMany.mockResolvedValue([
      { id: CASH, organizationId: null, userId: 'ada' },
      { id: SALES, organizationId: null, userId: 'ada' },
    ]);

    await request(app).post('/api/accounting/journals').send(balanced()).expect(201);
    expect(prisma.journalEntry.create).toHaveBeenCalled();
  });

  it('will not mint an account inside someone else’s organisation', async () => {
    await request(app)
      .post('/api/accounting/accounts')
      .send({ organizationId: OTHER_ORG, name: 'Cash at bank', type: 'ASSET' })
      .expect(403);
    expect(prisma.accountingAccount.create).not.toHaveBeenCalled();
  });

  it('refuses to list a stranger’s chart of accounts or journal', async () => {
    await request(app).get(`/api/accounting/accounts?organizationId=${OTHER_ORG}`).expect(403);
    expect(prisma.accountingAccount.findMany).not.toHaveBeenCalled();

    await request(app).get(`/api/accounting/journals?organizationId=${OTHER_ORG}`).expect(403);
    expect(prisma.journalEntry.findMany).not.toHaveBeenCalled();
  });

  it('shows a member the whole organisation’s journal, not only her own entries', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    await request(app).get(`/api/accounting/journals?organizationId=${ADA_ORG}`).expect(200);
    expect(prisma.journalEntry.findMany.mock.calls[0][0].where).toEqual({ organizationId: ADA_ORG, status: undefined });
  });
});
