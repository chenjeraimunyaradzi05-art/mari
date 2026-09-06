import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    feedback: {
      create: jest.fn(async ({ data }: any) => ({ id: 'f1', ...data })),
      findMany: jest.fn(async () => []),
      groupBy: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async ({ data }: any) => ({ id: 'f1', ...data })),
    },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  const userFrom = (req: any) => (req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: `${req.headers['x-test-user']}@athena.com` } : null);
  return {
    ...actual,
    authenticate: (req: any, res: any, next: any) => {
      const user = userFrom(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = userFrom(req);
      if (user) req.user = user;
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

describe('Feedback from the help centre', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a visitor can send it with an email; a member is attached by account', async () => {
    await request(app).post('/api/feedback').send({ message: 'The BAS worksheet rounds the wrong way on G10.', category: 'BUG', email: 'Mei@Example.com', page: '/dashboard/finance/tax' }).expect(201);
    expect(prisma.feedback.create.mock.calls[0][0].data).toMatchObject({ userId: null, email: 'mei@example.com', category: 'BUG', page: '/dashboard/finance/tax' });

    await request(app).post('/api/feedback').set('x-test-user', 'u1').send({ message: 'Loving the ledger, thank you.', category: 'PRAISE' }).expect(201);
    expect(prisma.feedback.create.mock.calls[1][0].data).toMatchObject({ userId: 'u1', email: 'u1@athena.com', category: 'PRAISE' });
  });

  it('needs a real message and a known category', async () => {
    await request(app).post('/api/feedback').send({ message: 'short' }).expect(400);
    await request(app).post('/api/feedback').send({ message: 'Long enough to count as feedback.', category: 'RANT' }).expect(400);
    await request(app).post('/api/feedback').send({ message: 'Long enough to count as feedback.', email: 'nope' }).expect(400);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('staff see the list with counts and move items through seen and done; others do not', async () => {
    await request(app).get('/api/admin/feedback').set('x-test-user', 'u1').expect(403);

    prisma.feedback.findMany.mockResolvedValue([{ id: 'f1', message: 'x', status: 'NEW', category: 'BUG', createdAt: new Date(), user: null }]);
    prisma.feedback.groupBy.mockResolvedValue([{ status: 'NEW', _count: { _all: 3 } }, { status: 'DONE', _count: { _all: 9 } }]);
    const list = await request(app).get('/api/admin/feedback?status=NEW').set('x-test-user', 'staff').set('x-test-role', 'ADMIN').expect(200);
    expect(list.body.counts).toEqual({ NEW: 3, DONE: 9 });
    expect(prisma.feedback.findMany.mock.calls[0][0].where).toEqual({ status: 'NEW' });

    prisma.feedback.findUnique.mockResolvedValue({ id: 'f1' });
    const done = await request(app).patch('/api/admin/feedback/f1').set('x-test-user', 'staff').set('x-test-role', 'ADMIN').send({ status: 'DONE' }).expect(200);
    expect(done.body.data.status).toBe('DONE');
    await request(app).patch('/api/admin/feedback/f1').set('x-test-user', 'staff').set('x-test-role', 'ADMIN').send({ status: 'LATER' }).expect(400);
  });
});
