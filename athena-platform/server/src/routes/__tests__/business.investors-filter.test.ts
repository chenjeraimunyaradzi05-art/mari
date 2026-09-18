import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    investor: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'member-1', role: 'USER', email: 'member-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

/** The where clause the last listing actually queried with. */
const lastWhere = () => prisma.investor.findMany.mock.calls.at(-1)[0].where;

describe('Investor cheque-size filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps investors whose range can cover the cheque asked for', async () => {
    const res = await request(app).get('/api/business/investors?minCheck=50000');

    expect(res.status).toBe(200);
    expect(lastWhere().AND).toEqual([
      { OR: [{ maxCheckSize: null }, { maxCheckSize: { gte: 50000 } }] },
    ]);
  });

  it('keeps investors who accept cheques as small as the cap', async () => {
    await request(app).get('/api/business/investors?maxCheck=200000');

    expect(lastWhere().AND).toEqual([
      { OR: [{ minCheckSize: null }, { minCheckSize: { lte: 200000 } }] },
    ]);
  });

  it('treats the two ends together as a range overlap', async () => {
    await request(app).get('/api/business/investors?minCheck=50000&maxCheck=200000');

    expect(lastWhere().AND).toEqual([
      { OR: [{ maxCheckSize: null }, { maxCheckSize: { gte: 50000 } }] },
      { OR: [{ minCheckSize: null }, { minCheckSize: { lte: 200000 } }] },
    ]);
  });

  it('an investor with no published sizes is not silently hidden by the filter', async () => {
    await request(app).get('/api/business/investors?minCheck=50000');

    // The null branch is the claim under test: unknown cannot be disproved.
    expect(lastWhere().AND[0].OR).toContainEqual({ maxCheckSize: null });
  });

  it('ignores a cheque filter that is not a number', async () => {
    const res = await request(app).get('/api/business/investors?minCheck=lots');

    expect(res.status).toBe(200);
    expect(lastWhere().AND).toBeUndefined();
  });
});
