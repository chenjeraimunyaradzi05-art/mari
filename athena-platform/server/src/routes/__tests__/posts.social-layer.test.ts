import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    like: { findUnique: jest.fn(), findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []), create: jest.fn(), update: jest.fn() },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { upsert: jest.fn(), groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    comment: { findUnique: jest.fn(), update: jest.fn() },
    commentLike: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
    notification: { create: jest.fn() },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    userFeedPreferences: { findUnique: jest.fn(async () => null) },
    follow: { findMany: jest.fn(async () => []) },
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
const VIEWER = 'viewer-1';
const AUTHOR = 'author-1';
// A mention carries a uuid, so the member named in the tests has one.
const MEI = '11111111-1111-4111-8111-111111111111';
const as = (userId: string) => ({ 'x-test-user': userId });

const post = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  authorId: AUTHOR,
  content: 'Hello',
  type: 'TEXT',
  isPublic: true,
  isHidden: false,
  isPinned: false,
  poll: null,
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date(),
  ...overrides,
});

describe('Reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a reaction that is not on the list', async () => {
    prisma.post.findUnique.mockResolvedValue(post());
    await request(app).post('/api/posts/p1/react').set(as(VIEWER)).send({ type: 'ANGRY' }).expect(400);
  });

  it('a first reaction is stored, counted and notifies with its verb', async () => {
    prisma.post.findUnique.mockResolvedValue(post());
    prisma.like.findUnique.mockResolvedValue(null);
    prisma.like.create.mockResolvedValue({});
    prisma.post.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Sarah D.' });

    const res = await request(app).post('/api/posts/p1/react').set(as(VIEWER)).send({ type: 'celebrate' }).expect(201);

    expect(res.body).toMatchObject({ reaction: 'CELEBRATE', changed: true });
    expect(prisma.like.create.mock.calls[0][0].data).toEqual({ userId: VIEWER, postId: 'p1', type: 'CELEBRATE' });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { likeCount: { increment: 1 } } });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toBe('Sarah D. celebrated your post');
  });

  it('changing your mind swaps the type without counting twice', async () => {
    prisma.post.findUnique.mockResolvedValue(post());
    prisma.like.findUnique.mockResolvedValue({ id: 'l1', type: 'LIKE' });
    prisma.like.update.mockResolvedValue({});

    const res = await request(app).post('/api/posts/p1/react').set(as(VIEWER)).send({ type: 'INSIGHTFUL' }).expect(200);

    expect(res.body).toMatchObject({ reaction: 'INSIGHTFUL', changed: true });
    expect(prisma.like.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { type: 'INSIGHTFUL' } });
    expect(prisma.like.create).not.toHaveBeenCalled();
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('the feed carries counts per reaction and the viewer\'s own', async () => {
    prisma.follow.findMany.mockResolvedValue([{ followingId: AUTHOR }]);
    prisma.post.findMany.mockResolvedValue([post({ author: { id: AUTHOR, displayName: 'Mei' } })]);
    prisma.post.count.mockResolvedValue(1);
    prisma.like.groupBy.mockResolvedValue([
      { postId: 'p1', type: 'CELEBRATE', _count: { _all: 4 } },
      { postId: 'p1', type: 'LIKE', _count: { _all: 2 } },
    ]);
    prisma.like.findMany.mockResolvedValue([{ postId: 'p1', type: 'CELEBRATE' }]);

    const res = await request(app).get('/api/posts/feed?tab=following').set(as(VIEWER)).expect(200);

    expect(res.body.data[0].reactionCounts).toEqual({ CELEBRATE: 4, LIKE: 2 });
    expect(res.body.data[0].myReaction).toBe('CELEBRATE');
    expect(res.body.data[0].isLiked).toBe(true);
    expect(res.body.data[0].reasons).toEqual(['Someone you follow']);
  });
});

describe('Polls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a poll post needs two to four distinct options', async () => {
    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'Remote or office?', type: 'POLL', poll: { options: ['Remote'] } })
      .expect(400);
    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'Remote or office?', type: 'POLL', poll: { options: ['Remote', 'remote'] } })
      .expect(400);
  });

  it('creates the poll with ids and a close time', async () => {
    prisma.post.create.mockImplementation(async ({ data }: any) => ({ id: 'p2', ...data, author: { id: AUTHOR } }));

    const res = await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'Remote or office?', type: 'POLL', poll: { options: ['Remote', 'Office', 'Hybrid'], durationHours: 48 } })
      .expect(201);

    const poll = prisma.post.create.mock.calls[0][0].data.poll;
    expect(poll.options.map((o: any) => o.id)).toEqual(['o1', 'o2', 'o3']);
    const hoursAhead = (new Date(poll.endsAt).getTime() - Date.now()) / 3600000;
    expect(Math.round(hoursAhead)).toBe(48);
    expect(res.body.data.type).toBe('POLL');
  });

  it('votes, changes the vote, and refuses after close', async () => {
    const open = post({
      type: 'POLL',
      poll: { options: [{ id: 'o1', text: 'Remote' }, { id: 'o2', text: 'Office' }], endsAt: new Date(Date.now() + 3600000).toISOString() },
    });
    prisma.post.findUnique.mockResolvedValue(open);
    prisma.pollVote.upsert.mockResolvedValue({});
    prisma.pollVote.groupBy.mockResolvedValue([{ postId: 'p1', optionId: 'o1', _count: { _all: 3 } }]);
    prisma.pollVote.findMany.mockResolvedValue([{ postId: 'p1', optionId: 'o1' }]);

    await request(app).post('/api/posts/p1/vote').set(as(VIEWER)).send({ optionId: 'o9' }).expect(400);

    const res = await request(app).post('/api/posts/p1/vote').set(as(VIEWER)).send({ optionId: 'o1' }).expect(200);
    expect(prisma.pollVote.upsert.mock.calls[0][0]).toMatchObject({
      where: { postId_userId: { postId: 'p1', userId: VIEWER } },
      update: { optionId: 'o1' },
    });
    expect(res.body.data).toMatchObject({ totalVotes: 3, myVote: 'o1', isClosed: false });
    expect(res.body.data.options[0]).toMatchObject({ id: 'o1', votes: 3, percent: 100 });

    prisma.post.findUnique.mockResolvedValue(
      post({ type: 'POLL', poll: { ...(open.poll as unknown as object), endsAt: new Date(Date.now() - 1000).toISOString() } })
    );
    await request(app).post('/api/posts/p1/vote').set(as(VIEWER)).send({ optionId: 'o1' }).expect(409);
  });
});

describe('Scheduling, mentions, pins and comment likes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a scheduled post is stored hidden with its time, and nobody is notified yet', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: MEI }]);
    prisma.post.create.mockImplementation(async ({ data }: any) => ({ id: 'p3', ...data, author: { id: AUTHOR } }));
    const when = new Date(Date.now() + 2 * 3600000).toISOString();

    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'Welcome @[Mei Chen](11111111-1111-4111-8111-111111111111)!', scheduledFor: when })
      .expect(201);

    const data = prisma.post.create.mock.calls[0][0].data;
    expect(data.isHidden).toBe(true);
    expect(data.scheduledFor.toISOString()).toBe(when);
    expect(data.mentionedUserIds).toEqual([MEI]);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('refuses a schedule in the past or too far ahead', async () => {
    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'x', scheduledFor: new Date(Date.now() - 60000).toISOString() })
      .expect(400);
    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'x', scheduledFor: new Date(Date.now() + 40 * 24 * 3600000).toISOString() })
      .expect(400);
  });

  it('a mention in a published post notifies the person named', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: MEI }]);
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Sarah D.' });
    prisma.post.create.mockImplementation(async ({ data }: any) => ({ id: 'p4', ...data, author: { id: AUTHOR } }));

    await request(app)
      .post('/api/posts')
      .set(as(AUTHOR))
      .send({ content: 'Thanks @[Mei Chen](11111111-1111-4111-8111-111111111111)' })
      .expect(201);

    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: MEI, type: 'MENTION', link: '/posts/p4' });
    expect(notice.message).toBe('Sarah D. mentioned you in a post');
  });

  it('pinning a post unpins the previous one and only the author may', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: AUTHOR });
    await request(app).patch('/api/posts/p1/pin').set(as(VIEWER)).send({ pinned: true }).expect(403);

    prisma.post.updateMany.mockResolvedValue({ count: 1 });
    prisma.post.update.mockResolvedValue({});
    await request(app).patch('/api/posts/p1/pin').set(as(AUTHOR)).send({ pinned: true }).expect(200);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({ where: { authorId: AUTHOR, isPinned: true }, data: { isPinned: false } });
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isPinned: true } });
  });

  it('liking a comment is idempotent and counted', async () => {
    prisma.comment.findUnique.mockResolvedValue({ id: 'c1', postId: 'p1', authorId: AUTHOR, isHidden: false });
    prisma.commentLike.findUnique.mockResolvedValue(null);
    prisma.commentLike.create.mockResolvedValue({});
    prisma.comment.update.mockResolvedValue({ likeCount: 1 });
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Sarah D.' });

    const res = await request(app).post('/api/posts/p1/comments/c1/like').set(as(VIEWER)).expect(201);
    expect(res.body).toMatchObject({ liked: true, likeCount: 1 });

    prisma.commentLike.findUnique.mockResolvedValue({ id: 'cl1' });
    await request(app).post('/api/posts/p1/comments/c1/like').set(as(VIEWER)).expect(200);
    expect(prisma.commentLike.create).toHaveBeenCalledTimes(1);

    prisma.commentLike.deleteMany.mockResolvedValue({ count: 1 });
    prisma.comment.update.mockResolvedValue({ likeCount: 0 });
    const removed = await request(app).delete('/api/posts/p1/comments/c1/like').set(as(VIEWER)).expect(200);
    expect(removed.body).toMatchObject({ liked: false, likeCount: 0 });
  });
});
