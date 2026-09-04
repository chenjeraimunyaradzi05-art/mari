import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    videoLike: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    videoSave: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
    follow: { findMany: jest.fn() },
    userFeedPreferences: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'viewer-1', role: 'USER', email: 'v@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'viewer-1', role: 'USER', email: 'v@athena.com' };
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

const VIDEO = (id: string) => ({
  id,
  authorId: 'creator-1',
  status: 'PUBLISHED',
  isHidden: false,
  hashtags: ['salary'],
  likeCount: 3,
  author: { id: 'creator-1', displayName: 'Mei', avatar: null, headline: null },
});

describe('Video feed viewer state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findMany.mockResolvedValue([VIDEO('v1'), VIDEO('v2')]);
    prisma.videoLike.findMany.mockResolvedValue([{ videoId: 'v2' }]);
    prisma.videoSave.findMany.mockResolvedValue([{ videoId: 'v1' }]);
  });

  it('marks which videos the signed-in viewer has liked and saved', async () => {
    const res = await request(app).get('/api/video/feed').set('x-test-auth', '1').expect(200);

    expect(res.body.data.map((v: any) => [v.id, v.isLiked, v.isSaved])).toEqual([
      ['v1', false, true],
      ['v2', true, false],
    ]);
    expect(prisma.videoLike.findMany.mock.calls[0][0].where).toEqual({
      userId: 'viewer-1',
      videoId: { in: ['v1', 'v2'] },
    });
  });

  it('answers false for a signed-out viewer without a lookup', async () => {
    const res = await request(app).get('/api/video/feed').expect(200);

    expect(res.body.data.every((v: any) => v.isLiked === false && v.isSaved === false)).toBe(true);
    expect(prisma.videoLike.findMany).not.toHaveBeenCalled();
    expect(prisma.videoSave.findMany).not.toHaveBeenCalled();
  });

  it('filters by hashtag, case- and hash-insensitively', async () => {
    await request(app).get('/api/video/feed?hashtag=%23Salary').expect(200);

    expect(prisma.video.findMany.mock.calls[0][0].where.hashtags).toEqual({ has: 'salary' });
  });

  it('decorates a single video the same way', async () => {
    prisma.video.findUnique.mockResolvedValue(VIDEO('v2'));

    const res = await request(app).get('/api/video/v2').set('x-test-auth', '1').expect(200);

    expect(res.body.data.isLiked).toBe(true);
    expect(res.body.data.isSaved).toBe(false);
  });
});

describe('Liking and saving a reel is idempotent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findUnique.mockResolvedValue(VIDEO('v1'));
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Priya', firstName: 'Priya', lastName: 'S' });
  });

  it('a second like is a 200 that changes nothing', async () => {
    prisma.videoLike.findUnique.mockResolvedValue({ id: 'like-1' });

    const res = await request(app).post('/api/video/v1/like').expect(200);

    expect(res.body.liked).toBe(true);
    expect(prisma.videoLike.create).not.toHaveBeenCalled();
    expect(prisma.video.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('a first like is stored, counted, and tells the creator who liked it', async () => {
    prisma.videoLike.findUnique.mockResolvedValue(null);

    await request(app).post('/api/video/v1/like').expect(200);

    expect(prisma.videoLike.create).toHaveBeenCalled();
    expect(prisma.video.update.mock.calls[0][0].data).toEqual({ likeCount: { increment: 1 } });
    const notification = prisma.notification.create.mock.calls[0][0].data;
    expect(notification).toMatchObject({
      userId: 'creator-1',
      type: 'LIKE',
      message: 'Priya liked your reel',
      link: '/explore?video=v1',
    });
  });

  it('a second save is a 200 that changes nothing', async () => {
    prisma.videoSave.findUnique.mockResolvedValue({ id: 'save-1' });

    const res = await request(app).post('/api/video/v1/save').expect(200);

    expect(res.body.saved).toBe(true);
    expect(prisma.videoSave.create).not.toHaveBeenCalled();
  });
});
