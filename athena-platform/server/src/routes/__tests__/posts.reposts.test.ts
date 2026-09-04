import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(async () => ({ displayName: 'Sarah D.', firstName: 'Sarah', lastName: 'Demo' })) },
    notification: { create: jest.fn() },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
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

jest.mock('../../services/link-preview.service', () => ({
  enrichPostLinkPreview: jest.fn(),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { decoratePosts } from '../../services/post-decoration.service';

const prisma: any = prismaTyped;
const VIEWER = 'viewer-1';
const AUTHOR = 'author-1';
const as = (userId: string) => ({ 'x-test-user': userId });

const author = { id: AUTHOR, firstName: 'Mei', lastName: 'Chen', displayName: 'Mei C.', avatar: null, headline: null };

const original = (overrides: Record<string, unknown> = {}) => ({
  id: 'orig',
  authorId: AUTHOR,
  content: 'The original words',
  isHidden: false,
  isPublic: true,
  repostOfId: null,
  ...overrides,
});

describe('Reposts and quotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findMany.mockResolvedValue([]);
  });

  it('reposts a public post once, counts it on the original and tells the author', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.findFirst.mockResolvedValue(null);
    prisma.post.create.mockResolvedValue({
      id: 'rp',
      authorId: VIEWER,
      content: '',
      repostOfId: 'orig',
      author: { ...author, id: VIEWER },
      repostOf: { ...original(), author },
    });
    prisma.post.update.mockResolvedValue({});

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(201);

    expect(res.body.message).toBe('Reposted');
    expect(res.body.data.repostOf.content).toBe('The original words');
    expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({ authorId: VIEWER, content: '', repostOfId: 'orig' });
    expect(prisma.post.update.mock.calls[0][0]).toMatchObject({ where: { id: 'orig' }, data: { repostCount: { increment: 1 } } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: AUTHOR, type: 'REPOST' });
  });

  it('a second plain repost is the same repost, not another row', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.findFirst.mockResolvedValue({ id: 'rp', authorId: VIEWER, content: '', repostOfId: 'orig', author, repostOf: { ...original(), author } });

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(200);

    expect(res.body.message).toBe('Already reposted');
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('a quote keeps its own words and points at the original', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.create.mockResolvedValue({
      id: 'q1',
      authorId: VIEWER,
      content: 'Worth reading',
      repostOfId: 'orig',
      author,
      repostOf: { ...original(), author },
    });
    prisma.post.update.mockResolvedValue({});

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).send({ content: 'Worth reading' }).expect(201);

    expect(res.body.message).toBe('Quote posted');
    expect(prisma.post.findFirst).not.toHaveBeenCalled();
    expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({ content: 'Worth reading', repostOfId: 'orig' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toBe('Sarah D. quoted your post');
  });

  it('reposting a plain repost reposts the original underneath it', async () => {
    prisma.post.findUnique
      .mockResolvedValueOnce({ id: 'rp', authorId: 'someone', content: '', isHidden: false, isPublic: true, repostOfId: 'orig' })
      .mockResolvedValueOnce(original());
    prisma.post.findFirst.mockResolvedValue(null);
    prisma.post.create.mockResolvedValue({ id: 'rp2', authorId: VIEWER, content: '', repostOfId: 'orig', author, repostOf: null });
    prisma.post.update.mockResolvedValue({});

    await request(app).post('/api/posts/rp/repost').set(as(VIEWER)).expect(201);

    expect(prisma.post.create.mock.calls[0][0].data.repostOfId).toBe('orig');
  });

  it('a private or hidden post cannot be reposted', async () => {
    prisma.post.findUnique.mockResolvedValue(original({ isPublic: false }));
    await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(404);
  });

  it('taking a repost back removes the row and lowers the count', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: 'rp' });
    prisma.post.delete.mockResolvedValue({});
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await request(app).delete('/api/posts/orig/repost').set(as(VIEWER)).expect(200);

    expect(prisma.post.delete.mock.calls[0][0]).toEqual({ where: { id: 'rp' } });
    expect(prisma.post.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'orig' }, data: { repostCount: { decrement: 1 } } });
  });

  it('deleting a quote takes it off the original’s count', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: VIEWER, repostOfId: 'orig' });
    prisma.post.deleteMany.mockResolvedValue({ count: 0 });
    prisma.post.delete.mockResolvedValue({});
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await request(app).delete('/api/posts/q1').set(as(VIEWER)).expect(200);

    expect(prisma.post.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'orig' }, data: { repostCount: { decrement: 1 } } });
  });

  it('decoration marks what the viewer reposted and hides a withdrawn original', async () => {
    prisma.post.findMany.mockResolvedValue([{ repostOfId: 'a' }]);

    const [a, b, c] = await decoratePosts(
      [
        { id: 'a', poll: null },
        { id: 'b', poll: null, repostOfId: 'gone', repostOf: { id: 'gone', isHidden: true } },
        { id: 'c', poll: null, repostOfId: 'ok', repostOf: { id: 'ok', isHidden: false, isPublic: true, content: 'fine' } },
      ],
      VIEWER
    );

    expect(a.isReposted).toBe(true);
    expect(b.repostOf).toBeNull();
    expect(b.repostUnavailable).toBe(true);
    expect(c.repostOf).toMatchObject({ content: 'fine' });
    expect(c.repostUnavailable).toBe(false);
  });
});
