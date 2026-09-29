import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * /api/analytics, which had no test of any kind.
 *
 * Two things matter here. The platform-wide figures and any one member's
 * figures are staff-only: a member's post views, follower counts and daily
 * activity are hers, and the only route that answers them for someone else is
 * the admin one. And a member's own dashboard has to add up — the engagement
 * rate, the per-day series and the top posts are computed in the service from
 * her rows, not stored, so a mistake there is a wrong number on her screen
 * rather than a failed request.
 *
 * The staff-only routes are exercised for who gets in; what they compute is
 * read from other tables and is stubbed here, so only the member dashboard's
 * arithmetic is asserted.
 */

const DAY = 24 * 60 * 60 * 1000;

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(async () => []) },
    follow: { count: jest.fn(async () => 0) },
    like: { count: jest.fn(async () => 0) },
    user: { findUnique: jest.fn(async () => ({ createdAt: new Date('2026-01-01T00:00:00.000Z'), role: 'USER' })) },
  },
}));

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate: (req: { headers: Record<string, unknown>; user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (typeof id !== 'string') return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = { id, email: `${id}@example.com`, role: (req.headers['x-test-role'] as string) || 'USER' };
      next();
    },
  };
});

jest.mock('../src/services/analytics.service', () => {
  const actual = jest.requireActual('../src/services/analytics.service') as Record<string, unknown>;
  return {
    __esModule: true,
    ...actual,
    getPlatformStats: jest.fn(async () => ({ users: { total: 3 } })),
    getEngagementTimeSeries: jest.fn(async () => ({ series: [] })),
    getTopContent: jest.fn(async () => ({ posts: [] })),
    getGrowthMetrics: jest.fn(async () => ({ period: '7 days' })),
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { prisma as prismaTyped } from '../src/utils/prisma';
import * as analyticsTyped from '../src/services/analytics.service';

/** A mocked async function whose resolved values the tests set. */
type AsyncMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

const prisma = prismaTyped as unknown as {
  post: { findMany: AsyncMock };
  follow: { count: AsyncMock };
  like: { count: AsyncMock };
  user: { findUnique: AsyncMock };
};
const analytics = analyticsTyped as unknown as { getPlatformStats: AsyncMock; getGrowthMetrics: AsyncMock; getTopContent: AsyncMock };

const as = (id: string, role = 'USER') => ({ 'x-test-user': id, 'x-test-role': role });

const STAFF_ONLY = [
  '/api/analytics/platform',
  '/api/analytics/engagement',
  '/api/analytics/top-content',
  '/api/analytics/growth',
  '/api/analytics/dashboard',
  '/api/analytics/user/someone-else',
];

describe('Platform and other members\' analytics are for admins only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a signed-out caller everywhere', async () => {
    for (const path of [...STAFF_ONLY, '/api/analytics/me', '/api/analytics/creator-dashboard']) {
      await request(app).get(path).expect(401);
    }
  });

  it('refuses members, creators, mentors and moderators the admin routes', async () => {
    for (const role of ['USER', 'CREATOR', 'MENTOR', 'MODERATOR']) {
      for (const path of STAFF_ONLY) {
        const res = await request(app).get(path).set(as('ada', role));
        expect({ path, role, status: res.status }).toEqual({ path, role, status: 403 });
      }
    }
    // Nothing was computed for any of the refused calls.
    expect(analytics.getPlatformStats).not.toHaveBeenCalled();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('answers an admin', async () => {
    const res = await request(app).get('/api/analytics/dashboard').set(as('root', 'ADMIN')).expect(200);

    expect(res.body.stats).toEqual({ users: { total: 3 } });
    expect(analytics.getGrowthMetrics).toHaveBeenCalledWith(7);
    expect(analytics.getTopContent).toHaveBeenCalledWith('week', 5);
  });

  it('caps the admin top-content list at fifty', async () => {
    await request(app).get('/api/analytics/top-content').query({ limit: '5000' }).set(as('root', 'ADMIN')).expect(200);
    expect(analytics.getTopContent).toHaveBeenCalledWith('week', 50);
  });

  it('lets an admin read one member\'s figures, and only through the admin route', async () => {
    await request(app).get('/api/analytics/user/grace').set(as('root', 'ADMIN')).expect(200);

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'grace' }) })
    );
  });

  it('keeps the creator dashboard to creators and admins', async () => {
    await request(app).get('/api/analytics/creator-dashboard').set(as('ada', 'USER')).expect(403);
    await request(app).get('/api/analytics/creator-dashboard').set(as('ada', 'CREATOR')).expect(200);
  });
});

describe('GET /api/analytics/me is her own dashboard, and adds up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads only her own rows, whatever id is in the query', async () => {
    await request(app).get('/api/analytics/me').query({ userId: 'grace' }).set(as('ada')).expect(200);

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'ada' }) })
    );
    expect(prisma.follow.count).toHaveBeenCalledWith({ where: { followingId: 'ada' } });
    expect(prisma.follow.count).toHaveBeenCalledWith({ where: { followerId: 'ada' } });
  });

  it('computes totals, the engagement rate, a day-by-day series and her top posts', async () => {
    const now = Date.now();
    const yesterday = new Date(now - DAY);
    const threeDaysAgo = new Date(now - 3 * DAY);
    prisma.post.findMany.mockResolvedValueOnce([
      { id: 'p1', type: 'TEXT', viewCount: 100, likeCount: 10, commentCount: 5, shareCount: 1, createdAt: yesterday },
      { id: 'p2', type: 'IMAGE', viewCount: 300, likeCount: 2, commentCount: 3, shareCount: 0, createdAt: yesterday },
      { id: 'p3', type: 'VIDEO', viewCount: 100, likeCount: 30, commentCount: 0, shareCount: 4, createdAt: threeDaysAgo },
    ]);
    prisma.follow.count.mockResolvedValueOnce(12).mockResolvedValueOnce(7);

    const res = await request(app).get('/api/analytics/me').query({ days: '7' }).set(as('ada')).expect(200);

    expect(res.body.summary).toEqual({
      totalPosts: 3,
      totalViews: 500,
      totalLikes: 42,
      totalComments: 8,
      totalShares: 5,
      followers: 12,
      following: 7,
      // (42 likes + 8 comments) / 500 views
      engagementRate: 10,
    });

    // One entry per day of the window, each post counted on its own day.
    expect(res.body.dailyStats).toHaveLength(7);
    const day = (instant: Date) => res.body.dailyStats.find((entry: { date: string }) => entry.date === instant.toISOString().split('T')[0]);
    expect(day(yesterday)).toEqual(expect.objectContaining({ posts: 2, views: 400, likes: 12 }));
    expect(day(threeDaysAgo)).toEqual(expect.objectContaining({ posts: 1, views: 100, likes: 30 }));

    // Ranked by views plus five per like: p2 = 310, p3 = 250, p1 = 150.
    expect(res.body.topPosts.map((p: { id: string }) => p.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('reports an engagement rate of zero rather than dividing by no views', async () => {
    prisma.post.findMany.mockResolvedValueOnce([
      { id: 'p1', type: 'TEXT', viewCount: 0, likeCount: 0, commentCount: 0, shareCount: 0, createdAt: new Date() },
    ]);

    const res = await request(app).get('/api/analytics/me').set(as('ada')).expect(200);

    expect(res.body.summary.engagementRate).toBe(0);
    // Thirty days when none is asked for.
    expect(res.body.dailyStats).toHaveLength(30);
  });
});
