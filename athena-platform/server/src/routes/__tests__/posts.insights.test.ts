import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(async () => []), updateMany: jest.fn() },
    postImpression: {
      createMany: jest.fn(async () => ({ count: 0 })),
      count: jest.fn(async () => 0),
      groupBy: jest.fn(async () => []),
      findMany: jest.fn(async () => []),
    },
    like: { groupBy: jest.fn(async () => []) },
    comment: { count: jest.fn(async () => 0) },
    postSave: { count: jest.fn(async () => 0) },
    follow: { count: jest.fn(async () => 0) },
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
const as = (userId: string) => ({ 'x-test-user': userId });

describe('Post impressions and insights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records one impression row per viewer and counts every showing', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    await request(app).post('/api/posts/impressions').set(as('viewer-1')).send({ ids: ['p1', 'p2', 'p1'], source: 'feed' }).expect(204);

    const rows = prisma.postImpression.createMany.mock.calls[0][0];
    expect(rows.skipDuplicates).toBe(true);
    expect(rows.data).toEqual([
      { postId: 'p1', viewerKey: 'viewer-1', userId: 'viewer-1', source: 'feed' },
      { postId: 'p2', viewerKey: 'viewer-1', userId: 'viewer-1', source: 'feed' },
    ]);
    expect(prisma.post.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ['p1', 'p2'] } }, data: { impressionCount: { increment: 1 } } });
    // A signed-in viewer's own posts are left out of what is counted.
    expect(prisma.post.findMany.mock.calls[0][0].where.authorId).toEqual({ not: 'viewer-1' });
  });

  it('an anonymous browser counts once, under a hashed key', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 'p1' }]);

    await request(app).post('/api/posts/impressions').send({ ids: ['p1'], anonId: 'browser-key-1234' }).expect(204);

    const row = prisma.postImpression.createMany.mock.calls[0][0].data[0];
    expect(row.viewerKey).toMatch(/^anon:[0-9a-f]{24}$/);
    expect(row.viewerKey).not.toContain('browser-key');
    expect(row.userId).toBeNull();
  });

  it('nothing is written without a viewer key', async () => {
    await request(app).post('/api/posts/impressions').send({ ids: ['p1'] }).expect(204);
    expect(prisma.postImpression.createMany).not.toHaveBeenCalled();
  });

  it('only the author reads a post’s insights', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'author-1', createdAt: new Date(), impressionCount: 10, likeCount: 2, commentCount: 1, shareCount: 0, repostCount: 1 });
    await request(app).get('/api/posts/p1/insights').set(as('viewer-1')).expect(403);
  });

  it('insights add up reach, engagement rate, sources and reach by day', async () => {
    const today = new Date();
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'author-1', createdAt: today, impressionCount: 200, likeCount: 8, commentCount: 2, shareCount: 1, repostCount: 3 });
    prisma.postImpression.count.mockResolvedValue(120);
    prisma.like.groupBy.mockResolvedValue([
      { type: 'LIKE', _count: { _all: 5 } },
      { type: 'CELEBRATE', _count: { _all: 3 } },
    ]);
    prisma.comment.count.mockResolvedValue(2);
    prisma.postSave.count.mockResolvedValue(7);
    prisma.postImpression.groupBy.mockResolvedValue([
      { source: 'feed', _count: { _all: 100 } },
      { source: null, _count: { _all: 20 } },
    ]);
    prisma.postImpression.findMany.mockResolvedValue([{ createdAt: today }, { createdAt: today }]);

    const res = await request(app).get('/api/posts/p1/insights').set(as('author-1')).expect(200);

    expect(res.body.data).toMatchObject({
      impressions: 200,
      reach: 120,
      reactions: { total: 8, byType: { LIKE: 5, CELEBRATE: 3 } },
      comments: 2,
      saves: 7,
      reposts: 3,
      engagements: 20,
      engagementRate: 10,
      sources: [
        { source: 'feed', count: 100 },
        { source: 'other', count: 20 },
      ],
    });
    expect(res.body.data.daily).toHaveLength(7);
    expect(res.body.data.daily[6]).toEqual({ date: today.toISOString().slice(0, 10), reach: 2 });
  });

  it('the overview sums your recent posts and lists the ones that carried furthest', async () => {
    prisma.post.findMany.mockResolvedValue([
      { id: 'a', content: 'Top post', type: 'TEXT', mediaUrls: [], createdAt: new Date(), impressionCount: 500, likeCount: 20, commentCount: 5, repostCount: 0 },
      { id: 'b', content: 'Second', type: 'IMAGE', mediaUrls: ['x.jpg'], createdAt: new Date(), impressionCount: 100, likeCount: 1, commentCount: 0, repostCount: 1 },
    ]);
    prisma.postImpression.groupBy.mockResolvedValue([{ viewerKey: 'v1' }, { viewerKey: 'v2' }, { viewerKey: 'v3' }]);
    prisma.postSave.count.mockResolvedValue(4);
    prisma.follow.count.mockResolvedValue(6);

    const res = await request(app).get('/api/posts/me/insights?days=30').set(as('author-1')).expect(200);

    expect(res.body.data).toMatchObject({
      days: 30,
      posts: 2,
      impressions: 600,
      reach: 3,
      reactions: 21,
      comments: 5,
      reposts: 1,
      saves: 4,
      engagements: 31,
      newFollowers: 6,
    });
    expect(res.body.data.top[0]).toMatchObject({ id: 'a', excerpt: 'Top post', impressions: 500, engagements: 25, engagementRate: 5 });
    expect(res.body.data.top[1].hasMedia).toBe(true);
  });
});
