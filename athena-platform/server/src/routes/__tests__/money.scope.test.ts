import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * A money record may be filed under an organisation only by someone in it.
 *
 * POST /api/money/transactions took an organizationId off the body and wrote it
 * on the row as given. Organisation ids are not secret (the public directory
 * hands them out), so anyone signed in could file records into another
 * business's books. An accepted member of the organisation is the only caller
 * that may name it; a pending invitation is not a membership. The same route is
 * called against a real database in tests/integration/tenant-isolation.test.ts.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    moneyTransaction: { create: jest.fn(), findMany: jest.fn(async () => []) },
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
const record = (organizationId?: string) => ({ ...(organizationId ? { organizationId } : {}), amount: 25, type: 'PAYMENT' });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.moneyTransaction.create.mockResolvedValue({ id: 'tx-1' });
});

describe('POST /api/money/transactions into an organisation', () => {
  it('is refused with 403 when the caller is not in it, and nothing is written', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    await request(app).post('/api/money/transactions').send(record(ORG)).expect(403);

    expect(prisma.moneyTransaction.create).not.toHaveBeenCalled();
  });

  it('asks for an accepted membership, so an unanswered invitation does not open it', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    await request(app).post('/api/money/transactions').send(record(ORG)).expect(403);

    expect(prisma.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, userId: 'ada', acceptedAt: { not: null } } })
    );
  });

  it('is written, with her id as the owner, when she is a member', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });

    await request(app).post('/api/money/transactions').send(record(ORG)).expect(201);

    expect(prisma.moneyTransaction.create.mock.calls[0][0].data).toMatchObject({ organizationId: ORG, userId: 'ada' });
  });

  it('is written without a membership lookup when it names no organisation: it is her own record', async () => {
    await request(app).post('/api/money/transactions').send(record()).expect(201);

    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.moneyTransaction.create.mock.calls[0][0].data).toMatchObject({ userId: 'ada' });
  });

  it('cannot be given another owner in the body', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });

    await request(app)
      .post('/api/money/transactions')
      .send({ ...record(ORG), userId: 'someone-else' })
      .expect(201);

    expect(prisma.moneyTransaction.create.mock.calls[0][0].data.userId).toBe('ada');
  });
});
