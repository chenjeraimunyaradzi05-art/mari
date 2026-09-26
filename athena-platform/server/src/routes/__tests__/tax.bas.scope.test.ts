import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    journalLine: { findMany: jest.fn(async () => []) },
    organizationMember: { findFirst: jest.fn(async () => null) },
    taxReturn: { create: jest.fn(async () => ({ id: 'ret-1' })), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
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

// A BAS lodged against a business is the business's record, not the private
// property of whichever colleague pressed Lodge. The list used to AND the
// organisation with the caller's own id, so nobody else in the business could
// see it.
describe('Tax returns belong to the books they were filed in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  it('lists every return in an organisation for any member of it', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });

    await request(app).get(`/api/tax/returns?organizationId=${ADA_ORG}`).expect(200);

    expect(prisma.taxReturn.findMany.mock.calls[0][0].where).toEqual({ organizationId: ADA_ORG });
  });

  it('refuses the list for an organisation she is not a member of', async () => {
    await request(app).get(`/api/tax/returns?organizationId=${OTHER_ORG}`).expect(403);
    expect(prisma.taxReturn.findMany).not.toHaveBeenCalled();
  });

  it('lists only her own personal returns when she names no organisation', async () => {
    await request(app).get('/api/tax/returns').expect(200);

    expect(prisma.taxReturn.findMany.mock.calls[0][0].where).toEqual({ userId: 'ada', organizationId: null });
  });

  it('will not file a return into an organisation she is not a member of', async () => {
    await request(app)
      .post('/api/tax/returns')
      .send({
        organizationId: OTHER_ORG,
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-09-30T00:00:00.000Z',
        totalSales: 1000,
        totalTax: 100,
      })
      .expect(403);
    expect(prisma.taxReturn.create).not.toHaveBeenCalled();
  });

  it('files one into her own organisation', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm1' });

    await request(app)
      .post('/api/tax/returns')
      .send({
        organizationId: ADA_ORG,
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-09-30T00:00:00.000Z',
        totalSales: 1000,
        totalTax: 100,
      })
      .expect(201);
    expect(prisma.taxReturn.create.mock.calls[0][0].data).toMatchObject({ organizationId: ADA_ORG, userId: 'ada' });
  });
});
