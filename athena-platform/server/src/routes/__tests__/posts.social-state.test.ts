import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    follow: { findMany: jest.fn() },
    like: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    postSave: { findMany: jest.fn() },
    comment: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'viewer-1', role: 'USER', email: 'viewer@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'viewer-1', role: 'USER', email: 'viewer@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Following tab carries follow state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'author-1' }]);
    prisma.post.findMany.mockResolvedValue([
      { id: 'p1', authorId: 'author-1', author: { id: 'author-1', displayName: 'Mei' } },
      { id: 'p2', authorId: 'viewer-1', author: { id: 'viewer-1', displayName: 'Me' } },
    ]);
    prisma.post.count.mockResolvedValue(2);
    prisma.like.findMany.mockResolvedValue([]);
    prisma.postSave.findMany.mockResolvedValue([]);
  });

  it('marks every other author as followed and the viewer as not', async () => {
    const res = await request(app)
      .get('/api/posts/feed?tab=following')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.data.map((p: any) => [p.id, p.author.isFollowing])).toEqual([
      ['p1', true],
      ['p2', false],
    ]);
  });
});

describe('Liking a post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'author-1',
      isHidden: false,
      isPublic: true,
    });
    prisma.user.findUnique.mockResolvedValue({ displayName: null, firstName: 'Priya', lastName: 'Sharma' });
  });

  it('is idempotent: a second like is a 200 that stores nothing', async () => {
    prisma.like.findUnique.mockResolvedValue({ id: 'like-1' });

    const res = await request(app).post('/api/posts/p1/like').expect(200);

    expect(res.body.liked).toBe(true);
    expect(prisma.like.create).not.toHaveBeenCalled();
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('names the liker and links to the post page the web app serves', async () => {
    prisma.like.findUnique.mockResolvedValue(null);

    await request(app).post('/api/posts/p1/like').expect(200);

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'author-1',
      type: 'LIKE',
      message: 'Priya Sharma liked your post',
      link: '/posts/p1',
    });
  });

  it('never notifies an author about their own like', async () => {
    prisma.post.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'viewer-1',
      isHidden: false,
      isPublic: true,
    });
    prisma.like.findUnique.mockResolvedValue(null);

    await request(app).post('/api/posts/p1/like').expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('Replying to a comment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.post.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'author-1',
      isHidden: false,
      isPublic: true,
    });
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Aisha', firstName: 'A', lastName: 'H' });
    prisma.comment.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data, author: {} }));
  });

  it('notifies the post author and the person replied to, once each', async () => {
    prisma.comment.findUnique
      .mockResolvedValueOnce({ postId: 'p1', isHidden: false })
      .mockResolvedValueOnce({ authorId: 'commenter-1' });

    await request(app)
      .post('/api/posts/p1/comments')
      .send({ content: 'Well said', parentId: 'c1' })
      .expect(201);

    const rows = prisma.notification.create.mock.calls.map((c: any) => [c[0].data.userId, c[0].data.message]);
    expect(rows).toEqual([
      ['author-1', 'Aisha commented on your post'],
      ['commenter-1', 'Aisha replied to your comment'],
    ]);
  });
});
