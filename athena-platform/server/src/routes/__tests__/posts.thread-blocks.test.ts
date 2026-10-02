/**
 * The comments under a post, and a block.
 *
 * The thread was read as the first fifty comments and then thinned in memory, so
 * a member who had blocked a busy commenter was handed a thread of fifty minus
 * everything that commenter wrote, and the replies she could have read past the
 * fiftieth were never fetched. A block made from the DV safety page alone was
 * not in the list the thinning used at all. The block now goes into the query,
 * from both stores and both directions, before the first fifty are taken.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), update: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    commentLike: { findMany: jest.fn(async () => []) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    // "Is the post's author in Safe Mode?" and "does the viewer follow her?".
    user: { findFirst: jest.fn(async () => null) },
    follow: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'viewer-1', role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    }
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
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

const thread = (authorId = 'author-1') => ({
  id: 'p1',
  authorId,
  groupId: null,
  isHidden: false,
  isPublic: true,
  poll: null,
  likeCount: 0,
  commentCount: 2,
  author: { id: authorId },
  comments: [
    { id: 'c1', authorId: 'priya', content: 'Hello', replies: [{ id: 'r1', authorId: 'him', content: 'A reply from the blocked one' }] },
    { id: 'c2', authorId: 'him', content: 'A comment from the blocked one', replies: [] },
  ],
  _count: { comments: 2, likes: 0 },
});

/** She blocked 'him'; 'blocked-her' blocked her; she blocked 'dv-only' from the DV page; 'dv-blocked-her' blocked her from it. */
const blockEveryWay = () => {
  prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
  // The mock does not read the query: only the "who blocked her" ask (a blockedUsers filter on
  // its own) gets the row, not the pairwise "is the post's author blocked" one (an OR).
  prisma.userSafetySettings.findMany.mockImplementation(async (args: any) => (args.where.OR ? [] : [{ userId: 'blocked-her' }]));
  prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });
  prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: 'dv-blocked-her' }]);
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.post.findUnique.mockResolvedValue(thread());
  prisma.userSafetySettings.findUnique.mockResolvedValue(null);
  prisma.userSafetySettings.findMany.mockResolvedValue([]);
  prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
  prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
  prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
  prisma.user.findFirst.mockResolvedValue(null);
  prisma.follow.findUnique.mockResolvedValue(null);
});

describe('GET /api/posts/:id and the comments of someone she has blocked', () => {
  const included = () => prisma.post.findUnique.mock.calls[0][0].include;

  it('leaves them out of the query that takes the first fifty, comments and replies alike, in both stores and both directions', async () => {
    blockEveryWay();

    await request(app).get('/api/posts/p1').set(as('viewer-1')).expect(200);

    const { comments } = included();
    expect(comments.take).toBe(50);
    expect([...comments.where.authorId.notIn].sort()).toEqual(['blocked-her', 'dv-blocked-her', 'dv-only', 'him']);
    expect([...comments.include.replies.where.authorId.notIn].sort()).toEqual(['blocked-her', 'dv-blocked-her', 'dv-only', 'him']);
    // The reply filter keeps the hidden-comment rule beside it.
    expect(comments.include.replies.where.isHidden).toBe(false);
    expect(comments.where).toMatchObject({ parentId: null, isHidden: false });
  });

  it('still wipes them from what comes back, so a thread the database over-returned is not shown', async () => {
    blockEveryWay();

    const res = await request(app).get('/api/posts/p1').set(as('viewer-1')).expect(200);

    expect(res.body.data.comments.map((comment: any) => comment.id)).toEqual(['c1']);
    expect(res.body.data.comments[0].replies).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('blocked one');
  });

  it('asks for no block clause when nobody is blocked, and for a signed-out reader', async () => {
    await request(app).get('/api/posts/p1').set(as('viewer-1')).expect(200);
    await request(app).get('/api/posts/p1').expect(200);

    for (const [args] of prisma.post.findUnique.mock.calls) {
      expect(args.include.comments.where.authorId).toBeUndefined();
      expect(args.include.comments.include.replies.where.authorId).toBeUndefined();
    }
  });

  it('does not answer with the whole thread when the block lists cannot be read', async () => {
    prisma.dvSafetyProfile.findMany.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).get('/api/posts/p1').set(as('viewer-1'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
    expect(prisma.post.findUnique).not.toHaveBeenCalled();
  });

  it('is not found for the post of someone she blocked', async () => {
    prisma.post.findUnique.mockResolvedValue(thread('him'));
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'viewer-1' }]); // the pairwise ask finds the block

    await request(app).get('/api/posts/p1').set(as('viewer-1')).expect(404);
  });

  it('shows staff the whole thread: moderating it is why they open it', async () => {
    blockEveryWay();

    const res = await request(app).get('/api/posts/p1').set(as('staff-1', 'ADMIN')).expect(200);

    expect(included().comments.where.authorId).toBeUndefined();
    expect(res.body.data.comments).toHaveLength(2);
  });
});
