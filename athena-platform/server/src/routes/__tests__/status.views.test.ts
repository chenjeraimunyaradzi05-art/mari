import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    status: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    statusView: { findMany: jest.fn(async () => []), findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'viewer-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const VIEWER = 'viewer-1';
const as = (userId: string) => ({ 'x-test-user': userId });

const story = (id: string, userId: string, minutesAgo: number, extra: Record<string, unknown> = {}) => ({
  id,
  userId,
  type: 'IMAGE',
  mediaUrl: `https://cdn.example.com/${id}.jpg`,
  caption: null,
  viewCount: 0,
  createdAt: new Date(Date.now() - minutesAgo * 60000),
  expiresAt: new Date(Date.now() + 3600000),
  user: { id: userId, displayName: `User ${userId}`, firstName: null, lastName: null, avatar: null },
  ...extra,
});

describe('Stories: seen state and views', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('orders your own bucket first, then unseen, and marks what you have watched', async () => {
    prisma.status.findMany.mockResolvedValue([
      story('s1', 'u-a', 50),
      story('s2', 'u-b', 40),
      story('s3', VIEWER, 30, { viewCount: 7 }),
      story('s4', 'u-a', 20),
    ]);
    prisma.statusView.findMany.mockResolvedValue([{ statusId: 's2' }]);

    const res = await request(app).get('/api/status/feed').set(as(VIEWER)).expect(200);

    const buckets = res.body.data;
    expect(buckets.map((b: any) => b.user.id)).toEqual([VIEWER, 'u-a', 'u-b']);
    expect(buckets[0].stories[0].viewCount).toBe(7);
    expect(buckets[1].hasUnseen).toBe(true);
    expect(buckets[2].hasUnseen).toBe(false);
    expect(buckets[2].stories[0].viewed).toBe(true);
    expect(buckets[2].stories[0].viewCount).toBeUndefined();
  });

  it('a view is recorded once per viewer and never for the author', async () => {
    prisma.status.findFirst.mockResolvedValue({ id: 's1', userId: 'u-a', expiresAt: new Date(Date.now() + 1000), viewCount: 2 });
    prisma.statusView.findUnique.mockResolvedValue(null);
    prisma.statusView.create.mockResolvedValue({});
    prisma.status.update.mockResolvedValue({ viewCount: 3 });

    const first = await request(app).post('/api/status/s1/view').set(as(VIEWER)).expect(201);
    expect(first.body.viewCount).toBe(3);

    prisma.statusView.findUnique.mockResolvedValue({ id: 'v1' });
    const again = await request(app).post('/api/status/s1/view').set(as(VIEWER)).expect(200);
    expect(again.body.viewCount).toBe(2);
    expect(prisma.statusView.create).toHaveBeenCalledTimes(1);

    const own = await request(app).post('/api/status/s1/view').set(as('u-a')).expect(200);
    expect(own.body.viewCount).toBe(2);
  });

  it('only the author can see who watched', async () => {
    prisma.status.findUnique.mockResolvedValue({ id: 's1', userId: 'u-a', viewCount: 1 });
    await request(app).get('/api/status/s1/viewers').set(as(VIEWER)).expect(403);

    prisma.statusView.findMany.mockResolvedValue([
      { user: { id: VIEWER, displayName: 'Sarah D.', firstName: null, lastName: null, avatar: null }, viewedAt: new Date() },
    ]);
    const res = await request(app).get('/api/status/s1/viewers').set(as('u-a')).expect(200);
    expect(res.body.data.viewers[0].displayName).toBe('Sarah D.');
  });

  it('a story can carry a caption', async () => {
    prisma.status.create.mockImplementation(async ({ data }: any) => ({
      id: 's9',
      ...data,
      viewCount: 0,
      createdAt: new Date(),
    }));
    const res = await request(app)
      .post('/api/status')
      .set(as(VIEWER))
      .send({ type: 'image', mediaUrl: 'https://cdn.example.com/x.jpg', caption: 'First day in the new role' })
      .expect(201);
    expect(res.body.data.caption).toBe('First day in the new role');
    expect(res.body.data.viewed).toBe(true);
  });
});
