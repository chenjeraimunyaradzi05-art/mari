import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), update: jest.fn() },
    videoComment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // findFirst is whether the author is in Safe Mode (audience.service isDiscreet).
    user: { findUnique: jest.fn(), findFirst: jest.fn(async () => null) },
    // A reel is opened, and a notification sent, only across no block, in either store.
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    dvSafetyProfile: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    follow: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
    notification: { create: jest.fn() },
  },
}));

// x-test-user picks who is calling: the reel's creator, the comment's author,
// or a stranger.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'stranger-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
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

const CREATOR = 'creator-1';
const COMMENTER = 'commenter-1';
const STRANGER = 'stranger-1';

const as = (user: string) => ({ 'x-test-user': user });

describe('Reel comment threads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findUnique.mockResolvedValue({
      id: 'v1',
      authorId: CREATOR,
      status: 'PUBLISHED',
      isHidden: false,
    });
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Aisha', firstName: 'Aisha', lastName: 'H' });
    prisma.videoComment.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));
    prisma.videoComment.count.mockResolvedValue(0);
    // Nobody is blocked, in Safe Mode or closed to the viewer unless a test says so.
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.follow.findFirst.mockResolvedValue(null);
  });

  it('lists pinned comments first', async () => {
    prisma.videoComment.findMany.mockResolvedValue([]);

    await request(app).get('/api/video/v1/comments').expect(200);

    expect(prisma.videoComment.findMany.mock.calls[0][0].orderBy).toEqual([
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ]);
  });

  it('a reply is threaded under the top-level comment and notifies both the creator and the person replied to', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({
      videoId: 'v1',
      isHidden: false,
      authorId: COMMENTER,
      parentId: null,
    });

    await request(app)
      .post('/api/video/v1/comments')
      .set(as(STRANGER))
      .send({ content: 'Agreed', parentId: 'c1' })
      .expect(201);

    expect(prisma.videoComment.create.mock.calls[0][0].data.parentId).toBe('c1');

    const recipients = prisma.notification.create.mock.calls.map((c: any) => [c[0].data.userId, c[0].data.title]);
    expect(recipients).toEqual([
      [CREATOR, 'New comment'],
      [COMMENTER, 'New reply'],
    ]);
  });

  it('a reply to a reply hangs off the same top-level comment', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({
      videoId: 'v1',
      isHidden: false,
      authorId: COMMENTER,
      parentId: 'c-root',
    });

    await request(app)
      .post('/api/video/v1/comments')
      .set(as(STRANGER))
      .send({ content: 'Same', parentId: 'c-child' })
      .expect(201);

    expect(prisma.videoComment.create.mock.calls[0][0].data.parentId).toBe('c-root');
  });

  it('the creator can pin a top-level comment, and pinning unpins the previous one', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      isPinned: false,
      parentId: null,
      isHidden: false,
    });
    prisma.videoComment.update.mockResolvedValue({ id: 'c1', isPinned: true });

    const res = await request(app).patch('/api/video/v1/comments/c1/pin').set(as(CREATOR)).expect(200);

    expect(res.body.data.isPinned).toBe(true);
    expect(prisma.videoComment.updateMany.mock.calls[0][0]).toEqual({
      where: { videoId: 'v1', isPinned: true },
      data: { isPinned: false },
    });
    expect(prisma.videoComment.update.mock.calls[0][0].data).toEqual({ isPinned: true });
  });

  it('nobody but the creator can pin', async () => {
    await request(app).patch('/api/video/v1/comments/c1/pin').set(as(COMMENTER)).expect(403);
    expect(prisma.videoComment.update).not.toHaveBeenCalled();
  });

  it('a reply cannot be pinned', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({
      id: 'c2',
      videoId: 'v1',
      isPinned: false,
      parentId: 'c1',
      isHidden: false,
    });

    await request(app).patch('/api/video/v1/comments/c2/pin').set(as(CREATOR)).expect(400);
  });

  it('the author can delete their comment and the count drops by the thread size', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({ id: 'c1', videoId: 'v1', authorId: COMMENTER });
    prisma.videoComment.count.mockResolvedValue(2);

    const res = await request(app).delete('/api/video/v1/comments/c1').set(as(COMMENTER)).expect(200);

    expect(res.body.removed).toBe(3);
    expect(prisma.videoComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(prisma.video.update.mock.calls[0][0].data).toEqual({ commentCount: { decrement: 3 } });
  });

  it('the creator can delete anyone\'s comment on their reel', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({ id: 'c1', videoId: 'v1', authorId: COMMENTER });

    await request(app).delete('/api/video/v1/comments/c1').set(as(CREATOR)).expect(200);
    expect(prisma.videoComment.delete).toHaveBeenCalled();
  });

  it('a stranger cannot delete it', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({ id: 'c1', videoId: 'v1', authorId: COMMENTER });

    await request(app).delete('/api/video/v1/comments/c1').set(as(STRANGER)).expect(403);
    expect(prisma.videoComment.delete).not.toHaveBeenCalled();
  });

  it('a comment from another reel is not found here', async () => {
    prisma.videoComment.findUnique.mockResolvedValue({ id: 'c1', videoId: 'v-other', authorId: COMMENTER });

    await request(app).delete('/api/video/v1/comments/c1').set(as(COMMENTER)).expect(404);
  });
});

/**
 * A reel's thread was open to anyone who held its id: the list answered for a
 * reel that was hidden, still processing, by a member who had blocked the
 * reader or by one whose profile is closed to her, and a like, a save or a
 * comment asked only whether the reel existed. The reel itself (GET /:id) was
 * held to the author's audience and to blocks; the rest of its routes were the
 * way round.
 */
describe('Reel comment threads and who may open the reel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findUnique.mockResolvedValue({ id: 'v1', authorId: CREATOR, status: 'PUBLISHED', isHidden: false });
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Aisha', firstName: 'Aisha', lastName: 'H' });
    prisma.videoComment.findMany.mockResolvedValue([]);
    prisma.videoComment.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.follow.findFirst.mockResolvedValue(null);
  });

  it('is not listed for a reel that is hidden or not yet published, whoever asks', async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 'v1', authorId: CREATOR, status: 'PROCESSING', isHidden: false });
    await request(app).get('/api/video/v1/comments').expect(404);

    prisma.video.findUnique.mockResolvedValue({ id: 'v1', authorId: CREATOR, status: 'PUBLISHED', isHidden: true });
    await request(app).get('/api/video/v1/comments').set(as(STRANGER)).expect(404);

    expect(prisma.videoComment.findMany).not.toHaveBeenCalled();
  });

  it('is not listed for a reader on either side of a block with the creator: the answer is the one for a reel that is not there', async () => {
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: CREATOR }]);

    await request(app).get('/api/video/v1/comments').set(as(STRANGER)).expect(404);

    expect(prisma.videoComment.findMany).not.toHaveBeenCalled();
  });

  it('is not listed to anyone outside the audience of a creator whose profile is private or in Safe Mode', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'private' });
    await request(app).get('/api/video/v1/comments').expect(404);

    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: CREATOR });
    await request(app).get('/api/video/v1/comments').set(as(STRANGER)).expect(404);

    expect(prisma.videoComment.findMany).not.toHaveBeenCalled();
  });

  it('leaves a blocked member’s comments and replies out in the query, in either store and either direction', async () => {
    // The reader blocked 'him'; 'blocked-her' blocked her; she blocked 'dv-only' from the DV page.
    // The creator is not on either side of a block with her, so the one-member check finds nothing.
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    prisma.userSafetySettings.findMany.mockImplementation(async ({ where }: any) =>
      where.OR ? [] : [{ userId: 'blocked-her' }]
    );
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });
    prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: 'dv-blocked-her' }]);

    await request(app).get('/api/video/v1/comments').set(as(STRANGER)).expect(200);

    const { where, include } = prisma.videoComment.findMany.mock.calls[0][0];
    expect([...where.authorId.notIn].sort()).toEqual(['blocked-her', 'dv-blocked-her', 'dv-only', 'him']);
    expect([...include.replies.where.authorId.notIn].sort()).toEqual(['blocked-her', 'dv-blocked-her', 'dv-only', 'him']);
    expect(where).toMatchObject({ videoId: 'v1', parentId: null, isHidden: false });
  });

  it('asks for no author clause for a signed-out reader, who has blocked nobody', async () => {
    await request(app).get('/api/video/v1/comments').expect(200);

    const { where, include } = prisma.videoComment.findMany.mock.calls[0][0];
    expect(where.authorId).toBeUndefined();
    expect(include.replies.where).toEqual({ isHidden: false });
  });

  it('does not answer with the whole thread when the block lists cannot be read', async () => {
    prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).get('/api/video/v1/comments').set(as(STRANGER));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(prisma.videoComment.findMany).not.toHaveBeenCalled();
  });

  it('refuses a comment, a like and a save from someone the creator has blocked, and stores nothing', async () => {
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: CREATOR }]);

    await request(app).post('/api/video/v1/comments').set(as(STRANGER)).send({ content: 'Hello' }).expect(404);
    await request(app).post('/api/video/v1/like').set(as(STRANGER)).expect(404);
    await request(app).post('/api/video/v1/save').set(as(STRANGER)).expect(404);

    expect(prisma.videoComment.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('lets the creator herself, and a reader the creator has not closed her profile to, through', async () => {
    await request(app).post('/api/video/v1/comments').set(as(CREATOR)).send({ content: 'Thanks all' }).expect(201);
    await request(app).post('/api/video/v1/comments').set(as(STRANGER)).send({ content: 'Lovely' }).expect(201);

    expect(prisma.videoComment.create).toHaveBeenCalledTimes(2);
  });
});
