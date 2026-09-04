import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn(), create: jest.fn() },
    comment: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(async () => ({ displayName: 'Sarah D.' })), findMany: jest.fn(async () => []) },
    notification: { create: jest.fn() },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    follow: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
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

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });
const AUTHOR = 'author-1';

const post = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  authorId: AUTHOR,
  content: 'Hello',
  isHidden: false,
  isPublic: true,
  commentsOff: false,
  ...overrides,
});

describe('Comment controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses new comments when the author turned them off, except from the author', async () => {
    prisma.post.findUnique.mockResolvedValue(post({ commentsOff: true }));

    const refused = await request(app).post('/api/posts/p1/comments').set(as('reader')).send({ content: 'Nice' }).expect(403);
    expect(refused.body.message).toMatch(/comments are off/i);

    prisma.comment.create.mockResolvedValue({ id: 'c1', content: 'Thanks all', author: { id: AUTHOR } });
    prisma.post.update.mockResolvedValue({});
    await request(app).post('/api/posts/p1/comments').set(as(AUTHOR)).send({ content: 'Thanks all' }).expect(201);
  });

  it('the author turns comments off through the post update', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: AUTHOR });
    prisma.post.update.mockResolvedValue(post({ commentsOff: true, author: { id: AUTHOR } }));

    await request(app).patch('/api/posts/p1').set(as(AUTHOR)).send({ commentsOff: true }).expect(200);

    expect(prisma.post.update.mock.calls[0][0].data).toEqual({ commentsOff: true });
  });

  it('the post’s author can delete anyone’s comment on it; a stranger cannot', async () => {
    prisma.comment.findUnique.mockResolvedValue({ authorId: 'commenter', post: { authorId: AUTHOR } });
    prisma.comment.delete.mockResolvedValue({});
    prisma.post.update.mockResolvedValue({});

    await request(app).delete('/api/posts/p1/comments/c1').set(as(AUTHOR)).expect(200);
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });

    await request(app).delete('/api/posts/p1/comments/c1').set(as('stranger')).expect(403);
  });

  it('pinning a comment unpins the previous one, and only the author may pin', async () => {
    prisma.comment.findUnique.mockResolvedValue({ id: 'c2', postId: 'p1', isHidden: false, post: { authorId: AUTHOR } });
    prisma.comment.updateMany.mockResolvedValue({ count: 1 });
    prisma.comment.update.mockResolvedValue({});

    const res = await request(app).patch('/api/posts/p1/comments/c2/pin').set(as(AUTHOR)).send({ pinned: true }).expect(200);

    expect(res.body.data).toEqual({ commentId: 'c2', isPinned: true });
    expect(prisma.comment.updateMany.mock.calls[0][0]).toEqual({ where: { postId: 'p1', isPinned: true }, data: { isPinned: false } });
    expect(prisma.comment.update.mock.calls[0][0]).toEqual({ where: { id: 'c2' }, data: { isPinned: true } });

    await request(app).patch('/api/posts/p1/comments/c2/pin').set(as('someone')).send({ pinned: true }).expect(403);

    // Unpinning clears without pinning anything.
    jest.clearAllMocks();
    prisma.comment.findUnique.mockResolvedValue({ id: 'c2', postId: 'p1', isHidden: false, post: { authorId: AUTHOR } });
    prisma.comment.updateMany.mockResolvedValue({ count: 1 });
    await request(app).patch('/api/posts/p1/comments/c2/pin').set(as(AUTHOR)).send({ pinned: false }).expect(200);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('a post with images accepts alt text, capped to the media list', async () => {
    prisma.post.create.mockResolvedValue({ id: 'p9', isPublic: true, isHidden: false, author: { id: AUTHOR, displayName: 'Sarah D.' } });

    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'Two photos', mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'], mediaAlt: ['  A sunrise  ', 'Our team', 'extra'] })
      .expect(201);

    expect(prisma.post.create.mock.calls[0][0].data.mediaAlt).toEqual(['A sunrise', 'Our team']);
  });
});
