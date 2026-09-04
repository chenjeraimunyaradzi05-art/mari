import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), delete: jest.fn() },
    videoSave: { findMany: jest.fn(), count: jest.fn() },
    // Every signed-in listing is decorated with the viewer's like state.
    videoLike: { findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] || 'viewer-1',
      role: req.headers['x-test-role'] || 'USER',
      email: 'u@athena.com',
    };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
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

const VIEWER = 'viewer-1';
const AUTHOR = 'author-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

describe('Video browse routes are not swallowed by /:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.video.findMany as any).mockResolvedValue([]);
    (prisma.video.count as any).mockResolvedValue(0);
  });

  it('GET /trending filters to a period window and ranks by engagement', async () => {
    await request(app).get('/api/video/trending?period=week').expect(200);

    // Never routed into the lookup-by-id handler.
    expect(prisma.video.findUnique).not.toHaveBeenCalled();

    const args = (prisma.video.findMany as any).mock.calls[0][0];
    expect(args.where.status).toBe('PUBLISHED');
    expect(args.where.publishedAt.gte).toBeInstanceOf(Date);
    expect(args.orderBy[0]).toEqual({ engagementScore: 'desc' });
  });

  it('GET /trending rejects an unknown period rather than silently defaulting', async () => {
    await request(app).get('/api/video/trending?period=decade').expect(400);
  });

  it('GET /trending defaults to a week when no period is given', async () => {
    await request(app).get('/api/video/trending').expect(200);

    const since = (prisma.video.findMany as any).mock.calls[0][0].where.publishedAt.gte;
    const daysAgo = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(daysAgo)).toBe(7);
  });

  it('GET /bookmarked returns the videos, not the join rows', async () => {
    (prisma.videoSave.findMany as any).mockResolvedValue([
      { video: { id: 'v1', title: 'Saved one', author: { id: AUTHOR } } },
    ]);
    (prisma.videoSave.count as any).mockResolvedValue(1);

    const res = await request(app).get('/api/video/bookmarked').set(as(VIEWER)).expect(200);

    expect(res.body.data).toEqual([
      { id: 'v1', title: 'Saved one', author: { id: AUTHOR }, isLiked: false, isSaved: true, sound: null },
    ]);
    expect(prisma.video.findUnique).not.toHaveBeenCalled();
  });

  it('GET /category/:category filters by VideoType when the name is one', async () => {
    await request(app).get('/api/video/category/career-story').expect(200);

    const where = (prisma.video.findMany as any).mock.calls[0][0].where;
    expect(where.type).toBe('CAREER_STORY');
    expect(where.hashtags).toBeUndefined();
  });

  it('GET /category/:category falls back to a hashtag for anything else', async () => {
    await request(app).get('/api/video/category/Welding').expect(200);

    const where = (prisma.video.findMany as any).mock.calls[0][0].where;
    expect(where.hashtags).toEqual({ has: 'welding' });
    expect(where.type).toBeUndefined();
  });

  it('GET /user/:userId shows only published videos to other people', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(VIEWER)).expect(200);

    const where = (prisma.video.findMany as any).mock.calls[0][0].where;
    expect(where).toEqual({ status: 'PUBLISHED', isHidden: false, authorId: AUTHOR });
  });

  it('GET /user/:userId shows authors their own unpublished uploads', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(AUTHOR)).expect(200);

    const where = (prisma.video.findMany as any).mock.calls[0][0].where;
    expect(where).toEqual({ authorId: AUTHOR, isHidden: false });
  });

  it('GET /user/:userId shows admins everything too', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(VIEWER, 'ADMIN')).expect(200);

    expect((prisma.video.findMany as any).mock.calls[0][0].where.status).toBeUndefined();
  });
});

describe('Video deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.video.delete as any).mockResolvedValue({});
  });

  it('lets the author delete their own video', async () => {
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'v1', authorId: AUTHOR });

    await request(app).delete('/api/video/v1').set(as(AUTHOR)).expect(200);

    expect(prisma.video.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  it("refuses to delete someone else's video", async () => {
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'v1', authorId: AUTHOR });

    await request(app).delete('/api/video/v1').set(as(VIEWER)).expect(403);

    expect(prisma.video.delete).not.toHaveBeenCalled();
  });

  it('lets an admin delete any video', async () => {
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'v1', authorId: AUTHOR });

    await request(app).delete('/api/video/v1').set(as(VIEWER, 'ADMIN')).expect(200);
  });

  it('404s for a video that does not exist', async () => {
    (prisma.video.findUnique as any).mockResolvedValue(null);

    await request(app).delete('/api/video/nope').set(as(AUTHOR)).expect(404);
  });
});
