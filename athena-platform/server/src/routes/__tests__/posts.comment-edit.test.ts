import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn() },
    comment: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
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
import { assertContentAllowed } from '../../services/moderation.service';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });
const AUTHOR = 'author-1';
const COMMENTER = 'commenter-1';
const MEI = '11111111-1111-4111-8111-111111111111';

const comment = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  postId: 'p1',
  authorId: COMMENTER,
  content: 'First thoughts',
  isHidden: false,
  post: { authorId: AUTHOR, commentsOff: false },
  ...overrides,
});

describe('Editing a comment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('only the commenter may edit; the post author and strangers are refused', async () => {
    prisma.comment.findUnique.mockResolvedValue(comment());
    await request(app).patch('/api/posts/p1/comments/c1').set(as(AUTHOR)).send({ content: 'Changed' }).expect(403);
    await request(app).patch('/api/posts/p1/comments/c1').set(as('stranger')).send({ content: 'Changed' }).expect(403);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('a comment id under the wrong post is not found', async () => {
    prisma.comment.findUnique.mockResolvedValue(comment({ postId: 'p-other' }));
    await request(app).patch('/api/posts/p1/comments/c1').set(as(COMMENTER)).send({ content: 'Changed' }).expect(404);
  });

  it('stores the new words with editedAt, moderated like a fresh comment', async () => {
    prisma.comment.findUnique.mockResolvedValue(comment());
    prisma.comment.update.mockImplementation(async (args: any) => ({ ...comment(), ...args.data, author: { id: COMMENTER } }));

    const res = await request(app).patch('/api/posts/p1/comments/c1').set(as(COMMENTER)).send({ content: '  Second thoughts  ' }).expect(200);

    const data = prisma.comment.update.mock.calls[0][0].data;
    expect(data.content).toBe('Second thoughts');
    expect(data.editedAt).toBeInstanceOf(Date);
    expect(assertContentAllowed).toHaveBeenCalledWith('Second thoughts', { kind: 'comment', userId: COMMENTER });
    expect(res.body.data.content).toBe('Second thoughts');
  });

  it('an edit that changes nothing writes nothing', async () => {
    prisma.comment.findUnique.mockResolvedValue(comment());
    await request(app).patch('/api/posts/p1/comments/c1').set(as(COMMENTER)).send({ content: 'First thoughts' }).expect(200);
    expect(prisma.comment.update).not.toHaveBeenCalled();
    expect(assertContentAllowed).not.toHaveBeenCalled();
  });

  it('tells someone newly named in the edit, and nobody named before', async () => {
    prisma.comment.findUnique.mockResolvedValue(comment({ content: `Thanks @[Mei Chen](${MEI})` }));
    prisma.comment.update.mockImplementation(async (args: any) => ({ ...comment(), ...args.data, author: { id: COMMENTER } }));
    prisma.user.findMany.mockImplementation(async (args: any) => args.where.id.in.map((id: string) => ({ id })));

    // Mei was already named; nothing new.
    await request(app)
      .patch('/api/posts/p1/comments/c1')
      .set(as(COMMENTER))
      .send({ content: `Thanks again @[Mei Chen](${MEI})` })
      .expect(200);
    expect(prisma.notification.create).not.toHaveBeenCalled();

    // Priya is new; she hears about it.
    const PRIYA = '22222222-2222-4222-8222-222222222222';
    await request(app)
      .patch('/api/posts/p1/comments/c1')
      .set(as(COMMENTER))
      .send({ content: `Thanks @[Mei Chen](${MEI}) and @[Priya](${PRIYA})` })
      .expect(200);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: PRIYA, type: 'MENTION', link: '/posts/p1' });
  });

  it('refuses an empty edit', async () => {
    prisma.comment.findUnique.mockResolvedValue(comment());
    await request(app).patch('/api/posts/p1/comments/c1').set(as(COMMENTER)).send({ content: '   ' }).expect(400);
  });
});

describe('Deleting a comment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a comment id paired with the wrong post, so the wrong count is never decremented', async () => {
    prisma.comment.findUnique.mockResolvedValue({ authorId: COMMENTER, postId: 'p-other', post: { authorId: AUTHOR } });
    await request(app).delete('/api/posts/p1/comments/c1').set(as(COMMENTER)).expect(404);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
    expect(prisma.post.update).not.toHaveBeenCalled();
  });
});
