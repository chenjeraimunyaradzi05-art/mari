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
    user: { findUnique: jest.fn() },
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
  optionalAuth: (req: any, _res: any, next: any) => next(),
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
