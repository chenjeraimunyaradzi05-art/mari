/**
 * The content and social badges, and the checks that award them.
 *
 * For a long time nothing called checkContentAchievements or
 * checkSocialAchievements at all, so "First Steps", "Video Star", "Gone
 * Viral", "First Fan", "Rising Star" and "Influencer" were drawn in the
 * achievements panel as goals nobody could reach. They are now called from
 * posting, from publishing a reel, from accepting a follow request and from
 * the panel itself, and none of that had a test. These pin what the checks
 * count, that they award from totals rather than events (so running one late
 * still lands the badge), and that running one twice never pays twice.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<unknown>>;

const postCount = jest.fn() as Query;
const postFindFirst = jest.fn() as Query;
const videoCount = jest.fn() as Query;
const videoFindFirst = jest.fn() as Query;
const followCount = jest.fn() as Query;
const streakFindUnique = jest.fn() as Query;
const streakCreate = jest.fn() as Query;
const streakUpdateMany = jest.fn() as Query;
const achievementFindFirst = jest.fn() as Query;
const achievementCreate = jest.fn() as Query;
const userUpdate = jest.fn() as Query;
const xpCreate = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { count: postCount, findFirst: postFindFirst },
    video: { count: videoCount, findFirst: videoFindFirst },
    follow: { count: followCount },
    userStreak: { findUnique: streakFindUnique, create: streakCreate, updateMany: streakUpdateMany },
    userAchievement: { findFirst: achievementFindFirst, create: achievementCreate },
    user: { update: userUpdate },
    xpTransaction: { create: xpCreate },
    notification: { create: notificationCreate },
  },
}));

jest.mock('../../utils/cache', () => ({
  cacheGetOrSet: jest.fn(),
  cacheDel: jest.fn(),
  CacheKeys: { user: (key: string) => `user:${key}` },
}));

import { checkContentAchievements, checkSocialAchievements, recordPublishedPost } from '../engagement.service';

/** Achievement ids awarded in this test, in order. */
const awarded = () => achievementCreate.mock.calls.map((call) => call[0].data.achievementId);

/** Badges she already holds. */
let held = new Set<string>();

beforeEach(() => {
  jest.clearAllMocks();
  held = new Set();
  postCount.mockResolvedValue(0);
  postFindFirst.mockResolvedValue(null);
  videoCount.mockResolvedValue(0);
  videoFindFirst.mockResolvedValue(null);
  followCount.mockResolvedValue(0);
  streakFindUnique.mockResolvedValue(null);
  achievementFindFirst.mockImplementation(async (args: any) =>
    held.has(args.where.achievementId) ? { id: 'held', achievementId: args.where.achievementId } : null
  );
  achievementCreate.mockImplementation(async (args: any) => {
    held.add(args.data.achievementId);
    return { id: 'new', ...args.data };
  });
  userUpdate.mockResolvedValue({ xp: 50 });
  xpCreate.mockResolvedValue({});
  notificationCreate.mockResolvedValue({});
});

describe('checkContentAchievements', () => {
  it('counts reels as well as posts, so a member who only publishes reels earns "First Steps" and "Video Star"', async () => {
    videoCount.mockResolvedValue(10);

    await checkContentAchievements('reel-maker');

    expect(awarded()).toEqual(['first_post', 'video_creator']);
    expect(videoCount.mock.calls[0][0].where).toEqual({ authorId: 'reel-maker', status: 'PUBLISHED' });
  });

  it('does not count a post still waiting in the schedule queue as published', async () => {
    await checkContentAchievements('planner');

    for (const call of postCount.mock.calls) {
      expect(call[0].where).toMatchObject({ authorId: 'planner', scheduledFor: null });
    }
    expect(awarded()).toEqual([]);
  });

  it('awards "Gone Viral" for a post or a reel past a thousand views', async () => {
    postCount.mockResolvedValue(3);
    videoFindFirst.mockResolvedValue({ id: 'reel-1' });

    await checkContentAchievements('creator');

    expect(awarded()).toEqual(['first_post', 'viral_post']);
    expect(videoFindFirst.mock.calls[0][0].where).toEqual({ authorId: 'creator', viewCount: { gte: 1000 } });
  });

  it('reads the posting streak from its longest run, so a badge missed on the day is still awarded', async () => {
    // Forty posts, none of them video.
    postCount.mockImplementation(async (args: any) => (args.where.type === 'VIDEO' ? 0 : 40));
    streakFindUnique.mockResolvedValue({ longestStreak: 12 });

    await checkContentAchievements('regular');

    expect(awarded()).toEqual(['first_post', 'post_streak_7']);
    expect(streakFindUnique.mock.calls[0][0].where).toEqual({ userId_type: { userId: 'regular', type: 'post' } });

    streakFindUnique.mockResolvedValue({ longestStreak: 30 });
    await checkContentAchievements('regular');
    expect(awarded()).toEqual(['first_post', 'post_streak_7', 'post_streak_30']);
  });

  it('never pays twice for a badge already held, however often it runs', async () => {
    postCount.mockResolvedValue(1);

    await checkContentAchievements('once');
    await checkContentAchievements('once');
    await checkContentAchievements('once');

    expect(awarded()).toEqual(['first_post']);
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(userUpdate.mock.calls[0][0]).toEqual({ where: { id: 'once' }, data: { xp: { increment: 50 } }, select: { xp: true } });
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({ userId: 'once', type: 'ACHIEVEMENT' });
  });
});

describe('checkSocialAchievements', () => {
  it('awards from the follower total, so a member past a threshold gets every badge below it', async () => {
    followCount.mockResolvedValue(150);

    await checkSocialAchievements('popular');

    expect(followCount.mock.calls[0][0]).toEqual({ where: { followingId: 'popular' } });
    // "First Fan" used to need exactly one follower at the moment of the
    // check; a member whose second follower came first could never earn it.
    expect(awarded()).toEqual(['first_follower', 'hundred_followers']);
  });

  it('awards nothing to a member nobody follows yet', async () => {
    await checkSocialAchievements('new');
    expect(awarded()).toEqual([]);
  });

  it('reaches "Influencer" at a thousand', async () => {
    followCount.mockResolvedValue(1000);
    await checkSocialAchievements('big');
    expect(awarded()).toEqual(['first_follower', 'hundred_followers', 'thousand_followers']);
  });
});

describe('recordPublishedPost', () => {
  it('moves the posting streak on for today and then awards what posting has earned', async () => {
    // Her first post ever: the streak row does not exist yet.
    postCount.mockResolvedValue(1);
    streakCreate.mockResolvedValue({});

    await recordPublishedPost('first-timer');

    expect(streakCreate.mock.calls[0][0].data).toMatchObject({ userId: 'first-timer', type: 'post', currentStreak: 1 });
    expect(awarded()).toEqual(['first_post']);
  });
});
