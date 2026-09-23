import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    journalLine: { findMany: jest.fn(async () => []) },
    organizationMember: { findFirst: jest.fn(async () => null) },
    taxReturn: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
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

const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const ADA_ORG = '11111111-1111-4111-8111-111111111111';
const PERIOD = 'from=2026-07-01&to=2026-09-30';

describe('The BAS worksheet needs membership of the organisation it reports on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  it('refuses a worksheet for an organisation she is not a member of', async () => {
    await request(app).get(`/api/tax/bas?${PERIOD}&organizationId=${OTHER_ORG}`).expect(403);
    expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
  });

  it('refuses to record a lodgement against those books either', async () => {
    await request(app)
      .post('/api/tax/bas/lodge')
      .send({ from: '2026-07-01', to: '2026-09-30', organizationId: OTHER_ORG })
      .expect(403);
    expect(prisma.taxReturn.create).not.toHaveBeenCalled();
  });

  it('reads the organisation’s ledger once she is a member', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });
    await request(app).get(`/api/tax/bas?${PERIOD}&organizationId=${ADA_ORG}`).expect(200);
    expect(prisma.journalLine.findMany.mock.calls[0][0].where.journalEntry).toMatchObject({
      status: 'POSTED',
      organizationId: ADA_ORG,
    });
  });

  it('answers a malformed organisation id with a 400 rather than a database error', async () => {
    await request(app).get(`/api/tax/bas?${PERIOD}&organizationId=not-a-uuid`).expect(400);
    expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
  });
});
