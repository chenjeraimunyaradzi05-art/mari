/**
 * The creator dashboard was blind to reels, and its day-by-day series put each
 * post's lifetime views on the day the post was written. These pin that reels
 * are counted beside posts, that every number in the period comes from dated
 * rows on the day each happened, that the series adds up to the totals, that
 * her own activity is not counted as reach, and that a reel view is counted by
 * the same rule the view route applies to Video.viewCount.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<any>>;

const postImpressionFindMany = jest.fn() as Query;
const videoViewFindMany = jest.fn() as Query;
const likeFindMany = jest.fn() as Query;
const videoLikeFindMany = jest.fn() as Query;
const commentFindMany = jest.fn() as Query;
const videoCommentFindMany = jest.fn() as Query;
const postCount = jest.fn() as Query;
const videoCount = jest.fn() as Query;
const postFindMany = jest.fn() as Query;
const videoFindMany = jest.fn() as Query;
const postAggregate = jest.fn() as Query;
const videoAggregate = jest.fn() as Query;
const giftFindMany = jest.fn() as Query;
const followFindMany = jest.fn() as Query;
const creatorProfileFindUnique = jest.fn() as Query;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    postImpression: { findMany: postImpressionFindMany },
    videoView: { findMany: videoViewFindMany },
    like: { findMany: likeFindMany },
    videoLike: { findMany: videoLikeFindMany },
    comment: { findMany: commentFindMany },
    videoComment: { findMany: videoCommentFindMany },
    post: { count: postCount, findMany: postFindMany, aggregate: postAggregate },
    video: { count: videoCount, findMany: videoFindMany, aggregate: videoAggregate },
    giftTransaction: { findMany: giftFindMany },
    follow: { findMany: followFindMany },
    creatorProfile: { findUnique: creatorProfileFindUnique },
  },
}));

import {
  ACTIVITY_SCAN_BATCH,
  COUNTED_VIEW_WINDOW_MS,
  countedReelViews,
  creatorContentAnalytics,
  creatorDashboardAnalytics,
  periodDays,
  periodStart,
} from '../creator-content-analytics.service';

const HOUR = 60 * 60 * 1000;
// Noon UTC on 26 September 2026.
const NOW = new Date(Date.UTC(2026, 8, 26, 12, 0, 0));
const at = (iso: string) => new Date(iso);

const emptyAggregate = { _count: { _all: 0 }, _sum: { impressionCount: null, viewCount: null, likeCount: null, commentCount: null, shareCount: null } };

beforeEach(() => {
  jest.clearAllMocks();
  for (const query of [
    postImpressionFindMany,
    videoViewFindMany,
    likeFindMany,
    videoLikeFindMany,
    commentFindMany,
    videoCommentFindMany,
    giftFindMany,
    followFindMany,
  ]) {
    query.mockResolvedValue([]);
  }
  creatorProfileFindUnique.mockResolvedValue(null);
  postCount.mockResolvedValue(0);
  videoCount.mockResolvedValue(0);
  postAggregate.mockResolvedValue(emptyAggregate);
  videoAggregate.mockResolvedValue(emptyAggregate);
  // The recent-content reads come first, the detail reads for the top list after.
  postFindMany.mockResolvedValue([]);
  videoFindMany.mockResolvedValue([]);
});

describe('the period', () => {
  it('is the last N calendar days in UTC, today included', () => {
    expect(periodStart(7, NOW).toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(periodDays(7, NOW)).toEqual([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]);
  });
});

describe('countedReelViews: the view route rule, replayed', () => {
  const since = at('2026-09-20T00:00:00Z');

  it('counts a signed-in viewer once per day of rewatching, and never the author or an anonymous watch', () => {
    const counted = countedReelViews(
      [
        { videoId: 'r1', userId: 'amara', createdAt: at('2026-09-21T08:00:00Z') },
        // Twenty minutes of looping: one view.
        { videoId: 'r1', userId: 'amara', createdAt: at('2026-09-21T08:20:00Z') },
        // The next evening, more than a day after the last watch: a second view.
        { videoId: 'r1', userId: 'amara', createdAt: at('2026-09-22T09:00:00Z') },
        { videoId: 'r1', userId: 'creator', createdAt: at('2026-09-21T10:00:00Z') },
        { videoId: 'r1', userId: null, createdAt: at('2026-09-21T11:00:00Z') },
      ],
      'creator',
      since
    );

    expect(counted.map((w) => w.createdAt.toISOString())).toEqual([
      '2026-09-21T08:00:00.000Z',
      '2026-09-22T09:00:00.000Z',
    ]);
  });

  it('measures the window from her last watch, counted or not, as the route does', () => {
    const counted = countedReelViews(
      [
        { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-21T00:00:00Z') },
        { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-21T20:00:00Z') },
        // 23 hours after the uncounted rewatch, 43 after the counted one: the
        // route found a watch inside the day and did not count it.
        { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-22T19:00:00Z') },
      ],
      'creator',
      since
    );
    expect(counted).toHaveLength(1);
  });

  it('a watch just inside the period is not counted when the one that made it a rewatch was just outside', () => {
    const counted = countedReelViews(
      [
        { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-19T23:00:00Z') },
        { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-20T01:00:00Z') },
      ],
      'creator',
      since
    );
    expect(counted).toEqual([]);
  });

  it('uses a one-day window, as the view route does', () => {
    expect(COUNTED_VIEW_WINDOW_MS).toBe(24 * HOUR);
  });
});

describe('creatorContentAnalytics', () => {
  it('counts a creator whose work is all reels: views, likes and comments on the days they happened', async () => {
    videoViewFindMany.mockResolvedValue([
      { videoId: 'r1', userId: 'amara', createdAt: at('2026-09-24T09:00:00Z') },
      { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-26T07:00:00Z') },
      { videoId: 'r2', userId: 'amara', createdAt: at('2026-09-26T08:00:00Z') },
    ]);
    videoLikeFindMany.mockResolvedValue([{ videoId: 'r1', createdAt: at('2026-09-24T09:05:00Z') }]);
    videoCommentFindMany.mockResolvedValue([{ videoId: 'r1', createdAt: at('2026-09-26T07:10:00Z') }]);
    videoCount.mockResolvedValue(2);
    videoAggregate.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { viewCount: 40, likeCount: 6, commentCount: 3, shareCount: 2 },
    });
    videoFindMany.mockImplementation(async (args: any) =>
      args.select?.thumbnailUrl
        ? [
            { id: 'r1', title: 'Negotiating a raise', description: null, thumbnailUrl: 'https://cdn/r1.jpg', createdAt: at('2026-09-23T00:00:00Z'), publishedAt: at('2026-09-23T01:00:00Z'), viewCount: 30, likeCount: 5, commentCount: 3, shareCount: 2 },
            { id: 'r2', title: null, description: 'Day one', thumbnailUrl: null, createdAt: at('2026-09-25T00:00:00Z'), publishedAt: at('2026-09-25T01:00:00Z'), viewCount: 10, likeCount: 1, commentCount: 0, shareCount: 0 },
          ]
        : [
            { id: 'r2', publishedAt: at('2026-09-25T01:00:00Z') },
            { id: 'r1', publishedAt: at('2026-09-23T01:00:00Z') },
          ]
    );

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(result.period).toEqual({ posts: 0, reels: 2, views: 3, likes: 1, comments: 1 });
    expect(result.lifetime).toEqual({ posts: 0, reels: 2, views: 40, likes: 6, comments: 3, shares: 2 });
    expect(result.daily.find((d) => d.date === '2026-09-24')).toEqual({ date: '2026-09-24', views: 1, likes: 1, comments: 0 });
    expect(result.daily.find((d) => d.date === '2026-09-26')).toEqual({ date: '2026-09-26', views: 2, likes: 0, comments: 1 });
    expect(result.top.map((item) => [item.kind, item.id, item.link])).toEqual([
      ['reel', 'r1', '/explore?video=r1'],
      ['reel', 'r2', '/explore?video=r2'],
    ]);
    expect(result.top[0]).toMatchObject({ title: 'Negotiating a raise', thumbnailUrl: 'https://cdn/r1.jpg', viewCount: 30, period: { views: 2, likes: 1, comments: 1 } });
  });

  it('puts a post that took off later on the days it was seen, not the day it was written', async () => {
    // Written on the 20th; seen on the 25th and 26th.
    postImpressionFindMany.mockResolvedValue([
      { postId: 'p1', createdAt: at('2026-09-25T10:00:00Z') },
      { postId: 'p1', createdAt: at('2026-09-25T11:00:00Z') },
      { postId: 'p1', createdAt: at('2026-09-26T09:00:00Z') },
    ]);
    likeFindMany.mockResolvedValue([{ postId: 'p1', createdAt: at('2026-09-25T10:30:00Z') }]);
    postCount.mockResolvedValue(1);
    postFindMany.mockImplementation(async (args: any) =>
      args.select?.content
        ? [{ id: 'p1', content: 'What I asked for, and got', createdAt: at('2026-09-20T09:00:00Z'), impressionCount: 3, likeCount: 1, commentCount: 0, shareCount: 0 }]
        : [{ id: 'p1', createdAt: at('2026-09-20T09:00:00Z') }]
    );

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(result.daily.find((d) => d.date === '2026-09-20')).toEqual({ date: '2026-09-20', views: 0, likes: 0, comments: 0 });
    expect(result.daily.find((d) => d.date === '2026-09-25')).toEqual({ date: '2026-09-25', views: 2, likes: 1, comments: 0 });
    expect(result.daily.find((d) => d.date === '2026-09-26')?.views).toBe(1);
    expect(result.top[0]).toMatchObject({ kind: 'post', id: 'p1', link: '/posts/p1', content: 'What I asked for, and got', viewCount: 3 });
  });

  it('the day-by-day series adds up to the period totals, with a column for today', async () => {
    postImpressionFindMany.mockResolvedValue([
      { postId: 'p1', createdAt: at('2026-09-20T00:00:00Z') },
      { postId: 'p1', createdAt: at('2026-09-26T11:59:00Z') },
    ]);
    videoViewFindMany.mockResolvedValue([{ videoId: 'r1', userId: 'jo', createdAt: at('2026-09-22T12:00:00Z') }]);
    commentFindMany.mockResolvedValue([{ postId: 'p1', createdAt: at('2026-09-23T12:00:00Z') }]);

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(result.daily).toHaveLength(7);
    expect(result.daily[result.daily.length - 1].date).toBe('2026-09-26');
    const summed = result.daily.reduce(
      (acc, d) => ({ views: acc.views + d.views, likes: acc.likes + d.likes, comments: acc.comments + d.comments }),
      { views: 0, likes: 0, comments: 0 }
    );
    expect(summed).toEqual({ views: result.period.views, likes: result.period.likes, comments: result.period.comments });
    expect(result.period.views).toBe(3);
  });

  it('asks only for visible content, other people’s activity, and dated rows inside the period', async () => {
    await creatorContentAnalytics('creator', 7, NOW);

    const since = at('2026-09-20T00:00:00Z');
    expect(postImpressionFindMany.mock.calls[0][0].where).toEqual({
      createdAt: { gte: since, lte: NOW },
      post: { authorId: 'creator', isHidden: false },
    });
    expect(likeFindMany.mock.calls[0][0].where).toMatchObject({ userId: { not: 'creator' } });
    expect(commentFindMany.mock.calls[0][0].where).toMatchObject({ authorId: { not: 'creator' }, isHidden: false });
    expect(videoLikeFindMany.mock.calls[0][0].where).toMatchObject({
      userId: { not: 'creator' },
      video: { authorId: 'creator', isHidden: false, status: 'PUBLISHED' },
    });
    expect(videoCommentFindMany.mock.calls[0][0].where).toMatchObject({ authorId: { not: 'creator' }, isHidden: false });
    // Reel watches reach one window further back, so a rewatch just inside the
    // period is judged against the watch before it.
    expect(videoViewFindMany.mock.calls[0][0].where.createdAt.gte).toEqual(new Date(since.getTime() - COUNTED_VIEW_WINDOW_MS));
  });

  it('lists something published this week even before anyone has seen it', async () => {
    postFindMany.mockImplementation(async (args: any) =>
      args.select?.content
        ? [{ id: 'p-new', content: 'Just posted', createdAt: at('2026-09-26T10:00:00Z'), impressionCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 }]
        : [{ id: 'p-new', createdAt: at('2026-09-26T10:00:00Z') }]
    );

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(result.top.map((item) => item.id)).toEqual(['p-new']);
    expect(result.top[0].period).toEqual({ views: 0, likes: 0, comments: 0 });
  });

  it('leaves out an item hidden between the two reads rather than listing it blank', async () => {
    postImpressionFindMany.mockResolvedValue([{ postId: 'gone', createdAt: at('2026-09-25T10:00:00Z') }]);

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(result.top).toEqual([]);
    expect(result.period.views).toBe(1);
  });

  it('a failed read fails the whole answer rather than returning zeros', async () => {
    videoViewFindMany.mockRejectedValue(new Error('connection reset'));

    await expect(creatorContentAnalytics('creator', 7, NOW)).rejects.toThrow('connection reset');
  });
});

describe('views are read a page at a time', () => {
  const impressionPage = (count: number, createdAt: Date) =>
    Array.from({ length: count }, (_, i) => ({ id: `imp-${String(i).padStart(5, '0')}`, postId: 'p1', createdAt }));

  it('keeps reading impressions past a full page, from after the last row by date and id', async () => {
    const day = at('2026-09-25T10:00:00Z');
    postImpressionFindMany
      .mockResolvedValueOnce(impressionPage(ACTIVITY_SCAN_BATCH, day))
      .mockResolvedValueOnce([{ id: 'imp-last', postId: 'p1', createdAt: at('2026-09-26T09:00:00Z') }]);

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(postImpressionFindMany).toHaveBeenCalledTimes(2);
    const lastOfFirstPage = `imp-${String(ACTIVITY_SCAN_BATCH - 1).padStart(5, '0')}`;
    expect(postImpressionFindMany.mock.calls[1][0]).toMatchObject({
      take: ACTIVITY_SCAN_BATCH,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      where: {
        post: { authorId: 'creator', isHidden: false },
        AND: [{ OR: [{ createdAt: { gt: day } }, { createdAt: day, id: { gt: lastOfFirstPage } }] }],
      },
    });
    expect(result.period.views).toBe(ACTIVITY_SCAN_BATCH + 1);
    expect(result.daily.find((d) => d.date === '2026-09-25')?.views).toBe(ACTIVITY_SCAN_BATCH);
    expect(result.daily.find((d) => d.date === '2026-09-26')?.views).toBe(1);
  });

  it('applies the one-view-a-day rule across a page boundary', async () => {
    // Her first watch closes the first page; her rewatch twenty minutes later
    // opens the second. It must not count as a second view.
    const filler = Array.from({ length: ACTIVITY_SCAN_BATCH - 1 }, (_, i) => ({
      id: `w-${String(i).padStart(5, '0')}`,
      videoId: 'r1',
      userId: `viewer-${i}`,
      createdAt: at('2026-09-24T08:00:00Z'),
    }));
    videoViewFindMany
      .mockResolvedValueOnce([...filler, { id: 'w-amara-1', videoId: 'r1', userId: 'amara', createdAt: at('2026-09-24T09:00:00Z') }])
      .mockResolvedValueOnce([{ id: 'w-amara-2', videoId: 'r1', userId: 'amara', createdAt: at('2026-09-24T09:20:00Z') }]);

    const result = await creatorContentAnalytics('creator', 7, NOW);

    expect(videoViewFindMany).toHaveBeenCalledTimes(2);
    expect(result.period.views).toBe(ACTIVITY_SCAN_BATCH);
  });
});

describe('creatorDashboardAnalytics: what GET /api/creator/analytics answers', () => {
  it('puts a reel-only creator on the dashboard: her reels are counted and listed', async () => {
    videoViewFindMany.mockResolvedValue([
      { videoId: 'r1', userId: 'amara', createdAt: at('2026-09-25T09:00:00Z') },
      { videoId: 'r1', userId: 'jo', createdAt: at('2026-09-26T09:00:00Z') },
    ]);
    videoLikeFindMany.mockResolvedValue([{ videoId: 'r1', createdAt: at('2026-09-25T09:01:00Z') }]);
    videoCount.mockResolvedValue(1);
    videoAggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { viewCount: 12, likeCount: 4, commentCount: 1, shareCount: 3 },
    });
    videoFindMany.mockImplementation(async (args: any) =>
      args.select?.thumbnailUrl
        ? [{ id: 'r1', title: 'Asking for the raise', description: null, thumbnailUrl: 'https://cdn/r1.jpg', createdAt: at('2026-09-24T00:00:00Z'), publishedAt: at('2026-09-24T01:00:00Z'), viewCount: 12, likeCount: 4, commentCount: 1, shareCount: 3 }]
        : [{ id: 'r1', publishedAt: at('2026-09-24T01:00:00Z') }]
    );

    const result = await creatorDashboardAnalytics('creator', 7, NOW);

    // Before, every one of these was zero and the list was empty.
    expect(result.summary).toMatchObject({ totalPosts: 0, totalReels: 1, totalViews: 2, totalLikes: 1, totalComments: 0 });
    expect(result.lifetime).toEqual({ posts: 0, reels: 1, views: 12, likes: 4, comments: 1, shares: 3 });
    expect(result.topPosts).toHaveLength(1);
    expect(result.topPosts[0]).toMatchObject({ kind: 'reel', id: 'r1', title: 'Asking for the raise', link: '/explore?video=r1' });
    expect(result.summary).not.toHaveProperty('totalShares');
  });

  it('counts gifts and new followers on the same calendar days as the content', async () => {
    giftFindMany.mockResolvedValue([
      { giftValue: 500, creatorShare: 350, createdAt: at('2026-09-20T00:30:00Z') },
      { giftValue: 100, creatorShare: 70, createdAt: at('2026-09-26T11:00:00Z') },
      { giftValue: 100, creatorShare: 70, createdAt: at('2026-09-26T11:30:00Z') },
    ]);
    followFindMany.mockResolvedValue([
      { createdAt: at('2026-09-22T08:00:00Z') },
      { createdAt: at('2026-09-22T09:00:00Z') },
    ]);
    creatorProfileFindUnique.mockResolvedValue({ totalEarnings: 9000, pendingPayout: 1200 });

    const result = await creatorDashboardAnalytics('creator', 7, NOW);

    const since = at('2026-09-20T00:00:00Z');
    expect(giftFindMany.mock.calls[0][0].where).toEqual({ receiverId: 'creator', createdAt: { gte: since, lte: NOW } });
    expect(followFindMany.mock.calls[0][0].where).toEqual({ followingId: 'creator', createdAt: { gte: since, lte: NOW } });

    expect(result.summary).toMatchObject({ totalGiftValue: 700, totalEarningsFromGifts: 490, newFollowers: 2 });
    expect(result.profile).toEqual({ totalEarnings: 9000, pendingPayout: 1200 });
    expect(result.dailyStats).toHaveLength(7);
    expect(result.dailyStats[0]).toEqual({ date: '2026-09-20', views: 0, likes: 0, comments: 0, gifts: 500, followers: 0 });
    expect(result.dailyStats.find((d) => d.date === '2026-09-22')).toMatchObject({ followers: 2, gifts: 0 });
    expect(result.dailyStats[6]).toMatchObject({ date: '2026-09-26', gifts: 200 });
    // Each column adds up to its total.
    expect(result.dailyStats.reduce((sum, d) => sum + d.gifts, 0)).toBe(result.summary.totalGiftValue);
    expect(result.dailyStats.reduce((sum, d) => sum + d.followers, 0)).toBe(result.summary.newFollowers);
  });

  it('gives no engagement rate over no views, and a real one when there are', async () => {
    const quiet = await creatorDashboardAnalytics('creator', 7, NOW);
    expect(quiet.summary.engagementRate).toBeNull();
    expect(quiet.profile).toEqual({ totalEarnings: 0, pendingPayout: 0 });

    postImpressionFindMany.mockResolvedValue([
      { postId: 'p1', createdAt: at('2026-09-25T10:00:00Z') },
      { postId: 'p2', createdAt: at('2026-09-25T10:00:00Z') },
      { postId: 'p3', createdAt: at('2026-09-25T10:00:00Z') },
      { postId: 'p4', createdAt: at('2026-09-25T10:00:00Z') },
    ]);
    likeFindMany.mockResolvedValue([{ postId: 'p1', createdAt: at('2026-09-25T10:01:00Z') }]);

    const busy = await creatorDashboardAnalytics('creator', 7, NOW);
    expect(busy.summary.engagementRate).toBe(25);
  });

  it('a gift ledger that cannot be read fails the answer instead of reporting no earnings', async () => {
    giftFindMany.mockRejectedValue(new Error('connection reset'));

    await expect(creatorDashboardAnalytics('creator', 7, NOW)).rejects.toThrow('connection reset');
  });
});
