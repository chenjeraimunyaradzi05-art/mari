/**
 * The CreatorAnalytics row, which until now nothing on this server ever wrote.
 *
 * The route created it at the column defaults and handed it back, so every
 * creator was shown zero followers, zero views and zero likes as though that
 * were a measurement of her, and an income model then multiplied those zeros
 * together and called the product her forecast. These tests hold the recount to
 * the tables the numbers actually live in, and hold the row to saying nothing
 * where it has nothing to say.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/stripe', () => ({
  getStripe: () => ({}),
  isStripeConfigured: () => false,
}));

jest.mock('../socket.service', () => ({
  sendNotification: jest.fn(async () => ({})),
}));

jest.mock('../stripe-connect.service', () => ({
  resolveConnectedAccountId: jest.fn(async () => null),
  createConnectedAccount: jest.fn(),
  refreshConnectedAccount: jest.fn(),
}));

/** What the fake tables hold for the creator under test. */
const world = {
  followers: 0,
  following: 0,
  reels: { count: 0, viewCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 },
  posts: { count: 0, impressionCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 },
  existingRow: null as { updatedAt: Date; followerCount: number } | null,
};

let written: Record<string, unknown> | null = null;

const prismaMock: any = {
  follow: {
    count: jest.fn(async ({ where }: any) =>
      where.followingId ? world.followers : world.following
    ),
  },
  video: {
    aggregate: jest.fn(async () => ({
      _count: { _all: world.reels.count },
      _sum: {
        viewCount: world.reels.count ? world.reels.viewCount : null,
        likeCount: world.reels.count ? world.reels.likeCount : null,
        commentCount: world.reels.count ? world.reels.commentCount : null,
        shareCount: world.reels.count ? world.reels.shareCount : null,
      },
    })),
  },
  post: {
    aggregate: jest.fn(async () => ({
      _count: { _all: world.posts.count },
      _sum: {
        impressionCount: world.posts.count ? world.posts.impressionCount : null,
        likeCount: world.posts.count ? world.posts.likeCount : null,
        commentCount: world.posts.count ? world.posts.commentCount : null,
        shareCount: world.posts.count ? world.posts.shareCount : null,
      },
    })),
  },
  creatorAnalytics: {
    findUnique: jest.fn(async () => world.existingRow),
    upsert: jest.fn(async ({ create, update }: any) => {
      written = world.existingRow ? update : create;
      return { userId: 'creator-1', ...written };
    }),
  },
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

import { refreshCreatorAnalytics } from '../creator.service';

describe('Recounting a creator’s reach from the tables that hold it', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    written = null;
    world.followers = 0;
    world.following = 0;
    world.reels = { count: 0, viewCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 };
    world.posts = { count: 0, impressionCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 };
    world.existingRow = null;
  });

  it('counts follows, reels and posts instead of returning the column defaults', async () => {
    world.followers = 1240;
    world.following = 90;
    world.reels = { count: 12, viewCount: 40000, likeCount: 2600, commentCount: 300, shareCount: 100 };
    world.posts = { count: 8, impressionCount: 8200, likeCount: 500, commentCount: 60, shareCount: 20 };

    const row = await refreshCreatorAnalytics('creator-1');

    expect(row.followerCount).toBe(1240);
    expect(row.followingCount).toBe(90);
    expect(row.totalVideos).toBe(12);
    expect(row.totalViews).toBe(48200);
    expect(row.totalLikes).toBe(3100);
    // Twenty pieces of content between reels and posts.
    expect(row.avgViews).toBeCloseTo(48200 / 20);
    // (3100 likes + 360 comments + 120 shares) / 48200 views, as a ratio.
    expect(row.avgEngagementRate).toBeCloseTo(3580 / 48200);
  });

  it('says nothing rather than zero when she has not been seen yet', async () => {
    world.followers = 3;

    const row = await refreshCreatorAnalytics('creator-1');

    // A null engagement rate is what lets the page leave the bar out. A 0 here
    // would be printed at her as "0.0% engagement", which is a verdict on a
    // woman nobody has had the chance to see.
    expect(row.avgEngagementRate).toBeNull();
    expect(row.avgViews).toBeNull();
    expect(row.totalViews).toBe(0);
  });

  it('records the tier her gifts are actually divided by', async () => {
    world.followers = 1240;

    const row = await refreshCreatorAnalytics('creator-1');

    // CREATOR_TIERS: Rising starts at 1,000 followers and pays 75%. The old
    // code wrote the literal 'BRONZE' once, from a ladder that existed nowhere.
    expect(row.creatorTier).toBe('Rising');
  });

  it('clears the projections the old formula invented', async () => {
    world.existingRow = { updatedAt: new Date(Date.now() - 60 * 60 * 1000), followerCount: 0 };

    await refreshCreatorAnalytics('creator-1');

    expect(written).toEqual(
      expect.objectContaining({ projectedIncome: expect.anything(), topRevenueStreams: expect.anything() })
    );
    // Prisma's DbNull, not a value: the column is emptied, not overwritten with
    // a JSON null that reads back as data.
    expect(String((written as Record<string, unknown>).projectedIncome)).toMatch(/null/i);
  });

  it('does not recount a row that was counted a moment ago', async () => {
    world.existingRow = { updatedAt: new Date(), followerCount: 1240 };

    const row = await refreshCreatorAnalytics('creator-1');

    expect(prismaMock.follow.count).not.toHaveBeenCalled();
    expect(prismaMock.creatorAnalytics.upsert).not.toHaveBeenCalled();
    expect(row.followerCount).toBe(1240);
  });
});
