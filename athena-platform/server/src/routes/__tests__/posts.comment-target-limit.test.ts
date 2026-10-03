/**
 * Commenting under the same member's posts again and again.
 *
 * The per-member comment limit is thirty in five minutes across everything a
 * member does, which is nothing across a feed and a siege when every one is
 * under the same woman's posts. A comment is also counted per author of the post
 * it is under, and the author's own thread is never limited.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
    post: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    comment: { findUnique: jest.fn(), create: jest.fn() },
    user: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => ({ displayName: 'Sarah D.' })) },
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
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

// The ceiling stands down when there is no Redis (tests), so each case says what it answers.
jest.mock('../../middleware/socialLimits', () => {
  const actual: any = jest.requireActual('../../middleware/socialLimits');
  return { ...actual, withinTargetLimit: jest.fn(async () => true) };
});

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { withinTargetLimit } from '../../middleware/socialLimits';
import { assertContentAllowed } from '../../services/moderation.service';

const prisma: any = prismaTyped;
const limit = withinTargetLimit as unknown as jest.Mock<(...args: unknown[]) => Promise<boolean>>;
const as = (userId: string) => ({ 'x-test-user': userId });
const AUTHOR = 'author-1';

const post = {
  id: 'p1',
  authorId: AUTHOR,
  content: 'Hello',
  isHidden: false,
  isPublic: true,
  commentsOff: false,
  groupId: null,
};

describe('POST /api/posts/:id/comments and the same member again and again', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue(true);
    prisma.post.findUnique.mockResolvedValue(post);
    prisma.comment.create.mockResolvedValue({ id: 'c1', content: 'Nice', author: { id: 'reader' } });
  });

  it('is counted against the author of the post, and refused with a 429 past the ceiling', async () => {
    limit.mockResolvedValue(false);

    const res = await request(app).post('/api/posts/p1/comments').set(as('reader')).send({ content: 'Nice' }).expect(429);

    expect(limit).toHaveBeenCalledWith('comment', 'reader', AUTHOR);
    expect(res.body.message).toMatch(/rest/i);
    expect(prisma.comment.create).not.toHaveBeenCalled();
    // Refused before the words are looked at or anything is written.
    expect(assertContentAllowed).not.toHaveBeenCalled();
  });

  it('lets a comment through while the pair is inside the ceiling', async () => {
    await request(app).post('/api/posts/p1/comments').set(as('reader')).send({ content: 'Nice' }).expect(201);

    expect(limit).toHaveBeenCalledWith('comment', 'reader', AUTHOR);
    expect(prisma.comment.create).toHaveBeenCalled();
  });

  it('never limits the author in her own thread', async () => {
    limit.mockResolvedValue(false);

    await request(app).post('/api/posts/p1/comments').set(as(AUTHOR)).send({ content: 'Thanks all' }).expect(201);

    expect(limit).not.toHaveBeenCalled();
  });

  it('does not count a comment that a closed or hidden thread has already refused', async () => {
    prisma.post.findUnique.mockResolvedValue({ ...post, commentsOff: true });

    await request(app).post('/api/posts/p1/comments').set(as('reader')).send({ content: 'Nice' }).expect(403);

    expect(limit).not.toHaveBeenCalled();
  });
});
