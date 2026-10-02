import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Which ledger accounts a bank line may be pointed at.
 *
 * A bank feed is the member's own (it is read by her connection), but the
 * ledger account she links it to, or posts a line into, may belong to an
 * organisation's books. That check let in anyone who had a membership row, and
 * the row exists from the moment an invitation is typed, so someone who had
 * not agreed to join the organisation could point her bank lines at its
 * ledger and post into its books; the same went for the person whose id was
 * stamped on an account they had filed before they left. Only an accepted
 * member of the organisation may, as everywhere else in the books.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    bankAccount: { findFirst: jest.fn(), update: jest.fn() },
    accountingAccount: { findUnique: jest.fn() },
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

function onlyAnAcceptedMemberIsFound(accepted: boolean) {
  prisma.organizationMember.findFirst.mockImplementation(async (args: any) =>
    accepted && args.where.acceptedAt?.not === null ? { id: 'm1' } : null
  );
}

const link = (ledgerAccountId: string) => request(app).post('/api/banking/accounts/bank-1/link').send({ ledgerAccountId });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.bankAccount.findFirst.mockResolvedValue({ id: 'bank-1', connection: { userId: 'ada' } });
  prisma.bankAccount.update.mockResolvedValue({ id: 'bank-1' });
});

describe('linking a bank account to a ledger account in an organisation’s books', () => {
  it('is refused to someone who has not answered her invitation', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue({ id: 'led-1', organizationId: ORG, userId: null, type: 'ASSET' });
    onlyAnAcceptedMemberIsFound(false);

    await link('led-1').expect(403);

    expect(prisma.bankAccount.update).not.toHaveBeenCalled();
  });

  it('is refused to the person whose id is on the account once she has left the organisation', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue({ id: 'led-1', organizationId: ORG, userId: 'ada', type: 'ASSET' });
    onlyAnAcceptedMemberIsFound(false);

    const res = await link('led-1').expect(403);

    expect(res.body.message ?? res.body.error).toMatch(/not yours/);
    expect(prisma.bankAccount.update).not.toHaveBeenCalled();
  });

  it('is allowed to an accepted member', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue({ id: 'led-1', organizationId: ORG, userId: null, type: 'ASSET' });
    onlyAnAcceptedMemberIsFound(true);

    await link('led-1').expect(200);

    expect(prisma.bankAccount.update).toHaveBeenCalledTimes(1);
  });

  it('is her own to link when the ledger account is in her personal books, and no one else’s', async () => {
    prisma.accountingAccount.findUnique.mockResolvedValue({ id: 'led-2', organizationId: null, userId: 'ada', type: 'ASSET' });
    await link('led-2').expect(200);
    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();

    prisma.bankAccount.update.mockClear();
    prisma.accountingAccount.findUnique.mockResolvedValue({ id: 'led-3', organizationId: null, userId: 'bea', type: 'ASSET' });
    await link('led-3').expect(403);
    expect(prisma.bankAccount.update).not.toHaveBeenCalled();
  });
});
