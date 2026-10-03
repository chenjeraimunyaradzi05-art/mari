import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Who may open one row of an organisation's books by its id.
 *
 * The list routes were closed to everyone but accepted members (see
 * accounting.scope.test.ts). The routes that take an id (read, post, void and
 * edit a journal entry; edit and delete an account) asked a looser question:
 * the caller owns the row, or any membership row at all exists. A membership
 * row is written when somebody types an address into the invite box, so an
 * invitation nobody had answered opened the books; and a journal entry carries
 * the id of whoever filed it, so a bookkeeper removed from the organisation kept
 * the right to rewrite what she had filed. Both are what these tests refuse.
 * The same rows are read from a real database in
 * tests/integration/tenant-isolation.test.ts.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    accountingAccount: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    journalEntry: { findUnique: jest.fn(), update: jest.fn() },
    organizationMember: { findFirst: jest.fn() },
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

const ORG = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '33333333-3333-4333-8333-333333333333';
const JOURNAL = '44444444-4444-4444-8444-444444444444';

/** The membership lookup is the accepted-member filter, so its answer is the whole question. */
function onlyAnAcceptedMemberIsFound(accepted: boolean) {
  prisma.organizationMember.findFirst.mockImplementation(async (args: any) =>
    accepted && args.where.acceptedAt?.not === null ? { id: 'm1' } : null
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.accountingAccount.update.mockResolvedValue({ id: ACCOUNT });
  prisma.accountingAccount.delete.mockResolvedValue({ id: ACCOUNT });
  prisma.journalEntry.update.mockResolvedValue({ id: JOURNAL, lines: [] });
});

describe('an account in an organisation’s chart', () => {
  // The row as the service now writes it: the organisation's, with no personal owner.
  const orgAccount = { organizationId: ORG, userId: null };
  // The row as a bookkeeper who has since left would find it, with her id still on it.
  const filedByAda = { organizationId: ORG, userId: 'ada' };

  it('is refused to a member who has not answered her invitation, for edit and for delete', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue(orgAccount);
    onlyAnAcceptedMemberIsFound(false);

    await request(app).patch(`/api/accounting/accounts/${ACCOUNT}`).send({ name: 'Renamed' }).expect(403);
    await request(app).delete(`/api/accounting/accounts/${ACCOUNT}`).expect(403);

    expect(prisma.accountingAccount.update).not.toHaveBeenCalled();
    expect(prisma.accountingAccount.delete).not.toHaveBeenCalled();
  });

  it('is refused to the person whose id is on the row once she has left the organisation', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue(filedByAda);
    onlyAnAcceptedMemberIsFound(false);

    await request(app).patch(`/api/accounting/accounts/${ACCOUNT}`).send({ name: 'Renamed' }).expect(403);
    await request(app).delete(`/api/accounting/accounts/${ACCOUNT}`).expect(403);

    expect(prisma.accountingAccount.update).not.toHaveBeenCalled();
    expect(prisma.accountingAccount.delete).not.toHaveBeenCalled();
  });

  it('is open to an accepted member, whoever filed it', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue(orgAccount);
    onlyAnAcceptedMemberIsFound(true);

    await request(app).patch(`/api/accounting/accounts/${ACCOUNT}`).send({ name: 'Renamed' }).expect(200);
    await request(app).delete(`/api/accounting/accounts/${ACCOUNT}`).expect(204);

    expect(prisma.accountingAccount.update).toHaveBeenCalledTimes(1);
    expect(prisma.accountingAccount.delete).toHaveBeenCalledTimes(1);
  });

  it('is her own to change when it is in her personal books, and no one else’s', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue({ organizationId: null, userId: 'ada' });
    await request(app).patch(`/api/accounting/accounts/${ACCOUNT}`).send({ name: 'Mine' }).expect(200);
    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();

    prisma.accountingAccount.update.mockClear();
    prisma.accountingAccount.findUnique.mockResolvedValue({ organizationId: null, userId: 'bea' });
    await request(app).patch(`/api/accounting/accounts/${ACCOUNT}`).send({ name: 'Hers' }).expect(403);
    expect(prisma.accountingAccount.update).not.toHaveBeenCalled();
  });
});

describe('a journal entry in an organisation’s books', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    id: JOURNAL,
    organizationId: ORG,
    userId: 'ada',
    status: 'DRAFT',
    description: 'Sale',
    lines: [
      { accountId: 'a', debit: 100, credit: 0 },
      { accountId: 'b', debit: 0, credit: 100 },
    ],
    ...overrides,
  });

  it('cannot be read, edited, posted or voided by the person who filed it once she has left', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue(entry());
    onlyAnAcceptedMemberIsFound(false);

    await request(app).get(`/api/accounting/journals/${JOURNAL}`).expect(403);
    await request(app).patch(`/api/accounting/journals/${JOURNAL}`).send({ description: 'Rewritten' }).expect(403);
    await request(app).post(`/api/accounting/journals/${JOURNAL}/post`).expect(403);
    await request(app).post(`/api/accounting/journals/${JOURNAL}/void`).expect(403);

    expect(prisma.journalEntry.update).not.toHaveBeenCalled();
  });

  it('cannot be reached by a member who has not answered her invitation', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue(entry({ userId: 'bea' }));
    onlyAnAcceptedMemberIsFound(false);

    await request(app).get(`/api/accounting/journals/${JOURNAL}`).expect(403);
    await request(app).post(`/api/accounting/journals/${JOURNAL}/void`).expect(403);

    expect(prisma.journalEntry.update).not.toHaveBeenCalled();
  });

  it('is open to an accepted member, including one who did not file it', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue(entry({ userId: 'bea' }));
    onlyAnAcceptedMemberIsFound(true);

    await request(app).get(`/api/accounting/journals/${JOURNAL}`).expect(200);
    await request(app).post(`/api/accounting/journals/${JOURNAL}/void`).expect(200);

    expect(prisma.journalEntry.update).toHaveBeenCalledTimes(1);
  });

  it('is refused to a stranger for a personal entry, and her own to open', async () => {
    prisma.journalEntry.findUnique.mockResolvedValue(entry({ organizationId: null, userId: 'bea' }));
    await request(app).get(`/api/accounting/journals/${JOURNAL}`).expect(403);

    prisma.journalEntry.findUnique.mockResolvedValue(entry({ organizationId: null, userId: 'ada' }));
    await request(app).get(`/api/accounting/journals/${JOURNAL}`).expect(200);
  });
});
