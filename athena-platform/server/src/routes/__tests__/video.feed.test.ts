import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    // The block checks read the DV safety profile's list as well as the
    // platform one, in both directions; nobody is blocked here.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    video: { findMany: jest.fn() },
    follow: { findMany: jest.fn() },
    userFeedPreferences: { findUnique: jest.fn() },
  },
}));

let authenticatedUserId: string | null = null;

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (authenticatedUserId) {
      req.user = { id: authenticatedUserId, role: 'USER', email: 'user@athena.com' };
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

function video(id: string) {
  return {
    id,
    videoUrl: `https://cdn/${id}.mp4`,
    thumbnailUrl: null,
    title: id,
    description: id,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    duration: 10,
    hashtags: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    author: { id: 'a1', displayName: 'Ada', avatar: null, headline: null },
  };
}

describe('GET /api/video/feed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedUserId = null;
  });

  it('returns a flat data array plus a nextCursor, which is what the client reads', async () => {
    (prisma.video.findMany as any).mockResolvedValue([video('v1'), video('v2')]);

    const res = await request(app).get('/api/video/feed?limit=5').expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body).toHaveProperty('nextCursor');
    // Guards the regression where the client read data.videos instead of data.
    expect(res.body.data.videos).toBeUndefined();
  });

  it('defaults to newest first', async () => {
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed').expect(200);

    expect((prisma.video.findMany as any).mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('feed=trending orders by engagement rather than recency', async () => {
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed?feed=trending').expect(200);

    expect((prisma.video.findMany as any).mock.calls[0][0].orderBy).toEqual([
      { engagementScore: 'desc' },
      { viewCount: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('feed=following restricts to the authors the viewer follows', async () => {
    authenticatedUserId = 'user-123';
    (prisma.follow.findMany as any).mockResolvedValue([
      { followingId: 'a1' },
      { followingId: 'a2' },
    ]);
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed?feed=following').expect(200);

    expect((prisma.video.findMany as any).mock.calls[0][0].where.authorId).toEqual({
      in: ['a1', 'a2'],
    });
  });

  it('feed=following is empty for a signed-out viewer rather than silently showing everything', async () => {
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed?feed=following').expect(200);

    expect(prisma.follow.findMany).not.toHaveBeenCalled();
    expect((prisma.video.findMany as any).mock.calls[0][0].where.authorId).toEqual({ in: [] });
  });

  it('sets nextCursor only when another page exists', async () => {
    // The handler takes limit + 1 to detect more; two rows for a limit of one.
    (prisma.video.findMany as any).mockResolvedValue([video('v1'), video('v2')]);

    const res = await request(app).get('/api/video/feed?limit=1').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.nextCursor).toBe('v1');
  });

  it('still filters by VideoType when type is supplied', async () => {
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed?type=REEL&feed=trending').expect(200);

    expect((prisma.video.findMany as any).mock.calls[0][0].where.type).toBe('REEL');
  });
  it('leaves out reels from anyone on either side of a block with a signed-in viewer', async () => {
    authenticatedUserId = 'user-123';
    // She blocked a1; b2 blocked her.
    (prisma.userSafetySettings.findUnique as any).mockResolvedValueOnce({ blockedUsers: ['a1'] });
    (prisma.userSafetySettings.findMany as any).mockResolvedValueOnce([{ userId: 'b2' }]);
    (prisma.userFeedPreferences.findUnique as any).mockResolvedValue({ blockedCreators: ['muted-1'] });
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed').expect(200);

    const where = (prisma.video.findMany as any).mock.calls[0][0].where;
    expect(where.authorId.notIn.sort()).toEqual(['a1', 'b2', 'muted-1']);
    // A block she made from her DV safety page, before it reached the
    // platform-wide list, is honoured through the author's own profile.
    expect(where.author).toEqual({ NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: 'user-123' } } } } });
  });

  it('fails rather than serving the feed unfiltered when the block list cannot be read', async () => {
    authenticatedUserId = 'user-123';
    (prisma.userSafetySettings.findUnique as any).mockRejectedValueOnce(new Error('database unavailable'));
    (prisma.video.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/video/feed').expect(500);

    expect(prisma.video.findMany).not.toHaveBeenCalled();
  });
});
