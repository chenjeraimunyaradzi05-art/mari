import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    like: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    follow: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    group: { findUnique: jest.fn() },
    groupMember: { findUnique: jest.fn() },
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

const post = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  authorId: 'author-1',
  isPublic: true,
  isHidden: false,
  groupId: null,
  ...overrides,
});

const row = (userId: string, type: string, name: string) => ({
  type,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  user: { id: userId, firstName: name, lastName: 'X', displayName: null, avatar: null, headline: 'Founder' },
});

describe('Who reacted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findUnique.mockResolvedValue(post());
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
  });

  it('lists the people with their reaction and the viewer’s follow state', async () => {
    prisma.like.findMany.mockResolvedValue([row('mei', 'CELEBRATE', 'Mei'), row('priya', 'LIKE', 'Priya')]);
    prisma.like.count.mockResolvedValue(2);
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'mei' }]);

    const res = await request(app).get('/api/posts/p1/reactions').set(as(VIEWER)).expect(200);

    expect(res.body.data).toEqual([
      expect.objectContaining({ type: 'CELEBRATE', user: expect.objectContaining({ id: 'mei', name: 'Mei X', isFollowing: true, isSelf: false }) }),
      expect.objectContaining({ type: 'LIKE', user: expect.objectContaining({ id: 'priya', isFollowing: false }) }),
    ]);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 2, pages: 1 });
    // Newest reaction first.
    expect(prisma.like.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('filters by one reaction type and refuses one that is not on the list', async () => {
    prisma.like.findMany.mockResolvedValue([]);
    await request(app).get('/api/posts/p1/reactions?type=insightful').set(as(VIEWER)).expect(200);
    expect(prisma.like.findMany.mock.calls[0][0].where).toMatchObject({ postId: 'p1', type: 'INSIGHTFUL' });

    await request(app).get('/api/posts/p1/reactions?type=angry').set(as(VIEWER)).expect(400);
  });

  it('leaves out anyone on either side of a block with the viewer', async () => {
    prisma.userSafetySettings.findMany.mockImplementation(async (args: any) =>
      // The symmetric lookup: who the viewer blocked, and who blocked the viewer.
      args.where?.blockedUsers ? [{ userId: 'stalker' }] : []
    );
    prisma.userSafetySettings.findUnique.mockImplementation(async (args: any) =>
      args.select?.blockedUsers ? { blockedUsers: ['muted-by-me'] } : null
    );
    prisma.like.findMany.mockResolvedValue([]);

    await request(app).get('/api/posts/p1/reactions').set(as(VIEWER)).expect(200);

    const where = prisma.like.findMany.mock.calls[0][0].where;
    expect(where.userId.notIn).toEqual(expect.arrayContaining(['muted-by-me', 'stalker']));
  });

  it('is not available for a post the viewer cannot see', async () => {
    prisma.post.findUnique.mockResolvedValue(post({ isPublic: false }));
    await request(app).get('/api/posts/p1/reactions').set(as(VIEWER)).expect(404);

    // A private group's post, to a non-member.
    prisma.post.findUnique.mockResolvedValue(post({ groupId: 'g1' }));
    prisma.group.findUnique.mockResolvedValue({ privacy: 'PRIVATE', isHidden: false });
    prisma.groupMember.findUnique.mockResolvedValue(null);
    await request(app).get('/api/posts/p1/reactions').set(as(VIEWER)).expect(404);
  });
});
