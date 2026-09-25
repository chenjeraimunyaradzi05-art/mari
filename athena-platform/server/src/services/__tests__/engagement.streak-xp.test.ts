/**
 * The daily check-in pays once a day, and it says so.
 *
 * updateStreak returns early when the day has already been recorded, and it
 * used to return only the streak — a number greater than zero on every call.
 * The route awarded XP from `currentStreak > 0`, so holding the endpoint open
 * paid up to fifty XP a request, all day, straight onto the public
 * leaderboard. The read-then-write underneath was racy on top of that: two
 * check-ins arriving together both computed the same new streak and both
 * wrote it.
 *
 * `recordedToday` is the contract the route depends on, and it is what these
 * cover: true exactly once per member per day, on the call that actually
 * moved the streak on, and false for every other caller including the loser
 * of a race at midnight.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: unknown) => Promise<unknown>>;

const streakFindUnique = jest.fn() as Query;
const streakCreate = jest.fn() as Query;
const streakUpdateMany = jest.fn() as Query;
const userUpdate = jest.fn() as Query;
const xpCreate = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;
const achievementFindUnique = jest.fn() as Query;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    userStreak: {
      findUnique: streakFindUnique,
      create: streakCreate,
      updateMany: streakUpdateMany,
    },
    user: { update: userUpdate },
    xpTransaction: { create: xpCreate },
    notification: { create: notificationCreate },
    userAchievement: { findUnique: achievementFindUnique },
  },
}));

jest.mock('../../utils/cache', () => ({
  cacheGetOrSet: jest.fn(),
  cacheDel: jest.fn(),
  CacheKeys: { user: (key: string) => `user:${key}` },
}));

import { addXP, updateStreak } from '../engagement.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored streak row whose last activity was `daysAgo` days ago. */
const streakRow = (currentStreak: number, daysAgo: number) => ({
  id: 'streak-1',
  userId: 'member-1',
  type: 'login',
  currentStreak,
  longestStreak: currentStreak,
  lastActivityDate: new Date(Date.now() - daysAgo * DAY_MS),
});

describe('updateStreak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streakUpdateMany.mockResolvedValue({ count: 1 });
    achievementFindUnique.mockResolvedValue({ id: 'already-held' });
  });

  it('records the first ever check-in', async () => {
    streakFindUnique.mockResolvedValueOnce(null);
    streakCreate.mockResolvedValueOnce({});

    const result = await updateStreak('member-1', 'login');

    expect(result).toEqual({ currentStreak: 1, longestStreak: 1, isNewRecord: true, recordedToday: true });
  });

  it('advances the streak on a consecutive day and says the day was recorded', async () => {
    streakFindUnique.mockResolvedValueOnce(streakRow(4, 1));

    const result = await updateStreak('member-1', 'login');

    expect(result.currentStreak).toBe(5);
    expect(result.recordedToday).toBe(true);
  });

  it('refuses to record the day twice, and still reports the streak she has', async () => {
    streakFindUnique.mockResolvedValueOnce(streakRow(9, 0));

    const result = await updateStreak('member-1', 'login');

    // The streak is truthfully nine — this is exactly the number the route
    // used to read as "pay her again".
    expect(result.currentStreak).toBe(9);
    expect(result.recordedToday).toBe(false);
    expect(streakUpdateMany).not.toHaveBeenCalled();
  });

  it('tells the loser of a midnight race that the day was already recorded', async () => {
    streakFindUnique.mockResolvedValueOnce(streakRow(4, 1));
    // The other request's conditional update got there first, so this one
    // matches no row.
    streakUpdateMany.mockResolvedValueOnce({ count: 0 });
    streakFindUnique.mockResolvedValueOnce(streakRow(5, 0));

    const result = await updateStreak('member-1', 'login');

    expect(result.currentStreak).toBe(5);
    expect(result.recordedToday).toBe(false);
  });

  it('writes only while the stored day is still before today', async () => {
    streakFindUnique.mockResolvedValueOnce(streakRow(4, 1));

    await updateStreak('member-1', 'login');

    const [args] = streakUpdateMany.mock.calls[0] as [{ where: { lastActivityDate: { lt: Date } } }];
    const startOfToday = new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);
    expect(args.where.lastActivityDate.lt.getTime()).toBe(startOfToday.getTime());
  });

  it('starts again from one after a gap', async () => {
    streakFindUnique.mockResolvedValueOnce(streakRow(30, 4));

    const result = await updateStreak('member-1', 'login');

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(30);
    expect(result.isNewRecord).toBe(false);
    expect(result.recordedToday).toBe(true);
  });
});

describe('addXP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    xpCreate.mockResolvedValue({});
    notificationCreate.mockResolvedValue({});
  });

  it('lets the database do the addition, so two awards at once both land', async () => {
    userUpdate.mockResolvedValueOnce({ xp: 130 });

    const result = await addXP('member-1', 30, 'Daily check-in');

    const [args] = userUpdate.mock.calls[0] as [{ data: { xp: { increment: number } } }];
    expect(args.data.xp).toEqual({ increment: 30 });
    // The balance logged is the row the database returned, not a sum computed
    // from a value read before the other award landed.
    expect(result.newXp).toBe(130);
    const [logged] = xpCreate.mock.calls[0] as [{ data: { balance: number; amount: number } }];
    expect(logged.data).toMatchObject({ amount: 30, balance: 130 });
  });
});
