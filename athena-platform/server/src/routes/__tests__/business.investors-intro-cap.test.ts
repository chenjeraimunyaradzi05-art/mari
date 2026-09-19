import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type Intro = { id: string; userId: string; status: string; requestedAt: Date };

// The introductions on record, which the count mock filters the way Postgres
// would: by user, by status and by requestedAt against the bound the route asks for.
const intros: Intro[] = [];

jest.mock('../../utils/prisma', () => ({
  prisma: {
    investor: { findUnique: jest.fn(async () => ({ id: 'inv-1', name: 'Blackbird', isActive: true })) },
    investorIntroduction: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      count: jest.fn(async ({ where }: any) =>
        intros.filter(
          (i) =>
            i.userId === where.userId &&
            (!where.status || where.status.in.includes(i.status)) &&
            (!where.requestedAt || i.requestedAt.getTime() >= where.requestedAt.gte.getTime())
        ).length
      ),
      create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data, investor: { id: 'inv-1', name: 'Blackbird' } })),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'founder-1', role: 'USER', email: 'founder@example.com' };
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
import { INTRO_MONTHLY_LIMIT, startOfBrisbaneMonth, startOfNextBrisbaneMonth } from '../business.routes';

const prisma: any = prismaTyped;

// Only Date is faked: supertest still needs real timers to move bytes.
const travelTo = (iso: string) =>
  jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'hrtime', 'performance'],
  });

const requested = (id: string, iso: string, status = 'REQUESTED'): Intro => ({ id, userId: 'founder-1', status, requestedAt: new Date(iso) });

describe('Warm introductions: three a calendar month', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    intros.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('the limit is three', () => {
    expect(INTRO_MONTHLY_LIMIT).toBe(3);
  });

  it('the month turns at midnight in Brisbane, not at a UTC boundary', () => {
    // 30 Sep 2026 23:30 in Brisbane is still 13:30 UTC on the 30th.
    const lateSeptember = new Date('2026-09-30T13:30:00.000Z');
    expect(startOfBrisbaneMonth(lateSeptember).toISOString()).toBe('2026-08-31T14:00:00.000Z');
    expect(startOfNextBrisbaneMonth(lateSeptember).toISOString()).toBe('2026-09-30T14:00:00.000Z');
    // Half an hour later it is 1 October in Brisbane while UTC is still on the 30th.
    const firstOctober = new Date('2026-09-30T14:30:00.000Z');
    expect(startOfBrisbaneMonth(firstOctober).toISOString()).toBe('2026-09-30T14:00:00.000Z');
  });

  it('refuses the fourth request in a month with a message that says when the next one opens', async () => {
    travelTo('2026-09-30T13:00:00.000Z');
    intros.push(requested('a', '2026-09-05T02:00:00.000Z'), requested('b', '2026-09-12T02:00:00.000Z', 'APPROVED'), requested('c', '2026-09-20T02:00:00.000Z'));

    const res = await request(app).post('/api/business/investors/inv-1/request-intro').send({ message: 'Hello' });

    expect(res.status).toBe(429);
    expect(res.body.message).toContain('3 warm introductions');
    expect(res.body.message).toContain('1 October');
    expect(prisma.investorIntroduction.create).not.toHaveBeenCalled();
  });

  it('allows the first request of the next month, even while UTC is still on the last day of the old one', async () => {
    travelTo('2026-09-30T14:30:00.000Z');
    intros.push(requested('a', '2026-09-05T02:00:00.000Z'), requested('b', '2026-09-12T02:00:00.000Z'), requested('c', '2026-09-20T02:00:00.000Z'));

    const res = await request(app).post('/api/business/investors/inv-1/request-intro').send({});

    expect(res.status).toBe(201);
    expect(prisma.investorIntroduction.create).toHaveBeenCalledTimes(1);
    const where = prisma.investorIntroduction.count.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['REQUESTED', 'APPROVED'] });
    expect(where.requestedAt.gte.toISOString()).toBe('2026-09-30T14:00:00.000Z');
  });

  it('a declined or expired request hands its slot back', async () => {
    travelTo('2026-09-30T13:00:00.000Z');
    intros.push(requested('a', '2026-09-05T02:00:00.000Z', 'DECLINED'), requested('b', '2026-09-12T02:00:00.000Z', 'EXPIRED'), requested('c', '2026-09-20T02:00:00.000Z'));

    await request(app).post('/api/business/investors/inv-1/request-intro').send({}).expect(201);
  });

  it('a duplicate request for the same investor is still a conflict, before the cap is checked', async () => {
    travelTo('2026-09-30T13:00:00.000Z');
    prisma.investorIntroduction.findUnique.mockResolvedValueOnce({ id: 'dup' });

    await request(app).post('/api/business/investors/inv-1/request-intro').send({}).expect(409);
    expect(prisma.investorIntroduction.count).not.toHaveBeenCalled();
  });

  it('tells the founder how many of this month’s three she has left', async () => {
    travelTo('2026-09-15T00:00:00.000Z');
    intros.push(requested('a', '2026-09-05T02:00:00.000Z'), requested('old', '2026-08-05T02:00:00.000Z'));

    const res = await request(app).get('/api/business/investors/my/introductions').expect(200);

    expect(res.body.allowance).toEqual({ limit: 3, used: 1, remaining: 2, resetsAt: '2026-09-30T14:00:00.000Z' });
  });
});
