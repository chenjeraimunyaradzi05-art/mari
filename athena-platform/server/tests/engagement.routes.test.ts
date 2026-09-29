import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Row } from './support/prisma-where';

/**
 * /api/engagement, which had no test of any kind.
 *
 * The daily check-in is the one route here that pays out, and it paid out
 * wrongly for as long as it existed: the award was decided by
 * `currentStreak > 0`, which every call of the day passes, so holding the
 * button earned fifty XP a request straight onto the public leaderboard. The
 * service now reports whether *this* call recorded the day (`recordedToday`),
 * the write itself is conditional on the day not being recorded yet, and the
 * route pays only when it was. These tests run the real service over a small
 * in-memory store so that each of those three pieces is exercised, including
 * the race the conditional write exists for.
 *
 * Not covered here: the leaderboards. They list members by name and avatar to
 * signed-out visitors without honouring "hide me from search", profile
 * privacy or blocks, and their cache ignores the requested size. That is handed
 * to the owner of engagement.service.ts with the fix, rather than pinned here
 * as if it were the intended behaviour.
 */

const DAY = 24 * 60 * 60 * 1000;

interface Store {
  users: Array<{ id: string; xp: number }>;
  streaks: Row[];
  transactions: Row[];
  notifications: Row[];
  achievements: Row[];
  /** Runs just before the conditional streak write, to stage a concurrent one. */
  beforeStreakWrite: (() => void) | null;
}

const store: Store = { users: [], streaks: [], transactions: [], notifications: [], achievements: [], beforeStreakWrite: null };

jest.mock('../src/utils/prisma', () => {
  const where = (jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where')).matchesWhere;
  const streakKey = (args: { where: { id?: string; userId_type?: { userId: string; type: string } } }) =>
    args.where.userId_type ? { userId: args.where.userId_type.userId, type: args.where.userId_type.type } : { id: args.where.id };
  return {
    prisma: {
      user: {
        findUnique: async ({ where: w }: { where: { id: string } }) => store.users.find((u) => u.id === w.id) ?? null,
        update: async ({ where: w, data }: { where: { id: string }; data: { xp: { increment: number } } }) => {
          const user = store.users.find((u) => u.id === w.id);
          if (!user) throw new Error('No such user');
          user.xp += data.xp.increment;
          return { xp: user.xp };
        },
      },
      userStreak: {
        findUnique: async (args: { where: { id?: string; userId_type?: { userId: string; type: string } } }) =>
          store.streaks.find((row) => where(row, streakKey(args))) ?? null,
        findMany: async (args: { where?: unknown }) => store.streaks.filter((row) => where(row, args.where)),
        create: async ({ data }: { data: Row }) => {
          const row = { id: `streak-${store.streaks.length + 1}`, ...data };
          store.streaks.push(row);
          return row;
        },
        updateMany: async ({ where: w, data }: { where: unknown; data: Row }) => {
          store.beforeStreakWrite?.();
          const hits = store.streaks.filter((row) => where(row, w));
          for (const row of hits) Object.assign(row, data);
          return { count: hits.length };
        },
      },
      xpTransaction: {
        create: async ({ data }: { data: Row }) => {
          store.transactions.push({ ...data, createdAt: new Date() });
          return data;
        },
        findMany: jest.fn(async (args: { where?: unknown; take?: number }) =>
          store.transactions.filter((row) => where(row, args.where)).slice(0, args.take)
        ),
      },
      notification: {
        create: async ({ data }: { data: Row }) => {
          store.notifications.push(data);
          return data;
        },
      },
      userAchievement: {
        findMany: async (args: { where?: unknown }) => store.achievements.filter((row) => where(row, args.where)),
        findFirst: async (args: { where?: unknown }) => store.achievements.find((row) => where(row, args.where)) ?? null,
        create: async ({ data }: { data: Row }) => {
          store.achievements.push(data);
          return data;
        },
      },
      // What the achievement reconcile on GET /achievements counts.
      post: { count: async () => 0, findFirst: async () => null },
      video: { count: async () => 0, findFirst: async () => null },
      follow: { count: async () => 0 },
    },
  };
});

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate: (req: { headers: Record<string, unknown>; user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (typeof id !== 'string') return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = { id, email: `${id}@example.com`, role: 'USER' };
      next();
    },
  };
});

// A member's XP is cached for five minutes in production. Here every read goes
// to the store, so an assertion reads what was written rather than a cache.
jest.mock('../src/utils/cache', () => {
  const actual = jest.requireActual('../src/utils/cache') as Record<string, unknown>;
  return { ...actual, cacheGetOrSet: async (_key: string, fetch: () => Promise<unknown>) => fetch(), cacheDel: async () => true };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { prisma as prismaTyped } from '../src/utils/prisma';
import { ACHIEVEMENTS, calculateLevel } from '../src/services/engagement.service';

/** A mocked async function whose resolved values the tests set. */
type AsyncMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

const prisma = prismaTyped as unknown as { xpTransaction: { findMany: AsyncMock } };
const ada = { 'x-test-user': 'ada' };

function loginStreak(lastActivity: Date, currentStreak: number, longestStreak = currentStreak) {
  store.streaks.push({ id: 'streak-ada', userId: 'ada', type: 'login', currentStreak, longestStreak, lastActivityDate: lastActivity });
}

function xpOf(id: string) {
  return store.users.find((u) => u.id === id)?.xp;
}

beforeEach(() => {
  store.users = [{ id: 'ada', xp: 0 }];
  store.streaks = [];
  store.transactions = [];
  store.notifications = [];
  store.achievements = [];
  store.beforeStreakWrite = null;
  jest.clearAllMocks();
});

describe('Personal engagement routes need a signed-in member', () => {
  it('refuses a signed-out caller', async () => {
    for (const [method, path] of [
      ['get', '/api/engagement/achievements'],
      ['get', '/api/engagement/xp'],
      ['get', '/api/engagement/xp/history'],
      ['get', '/api/engagement/streaks'],
      ['get', '/api/engagement/summary'],
      ['post', '/api/engagement/streaks/check-in'],
    ] as const) {
      await request(app)[method](path).expect(401);
    }
    expect(store.transactions).toHaveLength(0);
  });
});

describe('POST /api/engagement/streaks/check-in pays once a day', () => {
  it('starts a streak on the first check-in and pays for it', async () => {
    const res = await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);

    expect(res.body).toEqual(expect.objectContaining({ currentStreak: 1, recordedToday: true, awardedXp: 12 }));
    expect(xpOf('ada')).toBe(12);
    expect(store.transactions).toEqual([expect.objectContaining({ userId: 'ada', amount: 12, reason: 'Daily check-in', balance: 12 })]);
  });

  it('pays nothing for a second check-in the same day, however many times it is sent', async () => {
    await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);
      expect(res.body).toEqual(expect.objectContaining({ currentStreak: 1, recordedToday: false, awardedXp: 0 }));
    }

    expect(xpOf('ada')).toBe(12);
    expect(store.transactions).toHaveLength(1);
  });

  it('extends a streak from yesterday, and pays two more XP per day of it', async () => {
    loginStreak(new Date(Date.now() - DAY), 4, 6);

    const res = await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);

    expect(res.body).toEqual(expect.objectContaining({ currentStreak: 5, longestStreak: 6, isNewRecord: false, awardedXp: 20 }));
    expect(xpOf('ada')).toBe(20);
  });

  it('starts again at one after a missed day, keeping the longest streak', async () => {
    loginStreak(new Date(Date.now() - 3 * DAY), 9, 9);

    const res = await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);

    expect(res.body).toEqual(expect.objectContaining({ currentStreak: 1, longestStreak: 9, awardedXp: 12 }));
  });

  it('never pays more than fifty for one day', async () => {
    loginStreak(new Date(Date.now() - DAY), 30, 30);

    const res = await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);

    expect(res.body).toEqual(expect.objectContaining({ currentStreak: 31, isNewRecord: true, awardedXp: 50 }));
  });

  // Two check-ins at once: both read yesterday's date, and the other one's
  // conditional write lands first. This one's write then matches nothing, and
  // it must be told the day was recorded — not paid a second time.
  it('pays only the request whose write recorded the day when two race', async () => {
    loginStreak(new Date(Date.now() - DAY), 4, 6);
    store.beforeStreakWrite = () => {
      store.beforeStreakWrite = null;
      Object.assign(store.streaks[0], { currentStreak: 5, lastActivityDate: new Date() });
    };

    const res = await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);

    expect(res.body).toEqual(expect.objectContaining({ currentStreak: 5, recordedToday: false, awardedXp: 0 }));
    expect(xpOf('ada')).toBe(0);
    expect(store.transactions).toHaveLength(0);
  });

  it('tells her when the check-in takes her to a new level', async () => {
    store.users = [{ id: 'ada', xp: 95 }];

    await request(app).post('/api/engagement/streaks/check-in').set(ada).expect(200);

    expect(xpOf('ada')).toBe(107);
    expect(store.notifications).toEqual([expect.objectContaining({ userId: 'ada', type: 'LEVEL_UP', data: { level: 2 } })]);
  });
});

describe('XP, streaks and achievements read back what was recorded', () => {
  it('reports her level from her stored XP', async () => {
    store.users = [{ id: 'ada', xp: 650 }];

    const res = await request(app).get('/api/engagement/xp').set(ada).expect(200);

    expect(res.body).toEqual(calculateLevel(650));
    expect(res.body.level).toBe(4);
  });

  it('lists her XP history, at most a hundred entries at a time', async () => {
    await request(app).get('/api/engagement/xp/history').query({ limit: '5000' }).set(ada).expect(200);
    expect(prisma.xpTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'ada' }, take: 100 }));
  });

  it('shows her streaks by kind', async () => {
    const last = new Date(Date.now() - DAY);
    loginStreak(last, 3, 8);

    const res = await request(app).get('/api/engagement/streaks').set(ada).expect(200);

    expect(res.body.streaks).toEqual({ login: { current: 3, longest: 8, lastActivity: last.toISOString() } });
  });

  it('marks the achievements she holds, and counts the XP they carried', async () => {
    const first = Object.values(ACHIEVEMENTS)[0];
    store.achievements = [{ userId: 'ada', achievementId: first.id, earnedAt: new Date() }];

    const res = await request(app).get('/api/engagement/achievements').set(ada).expect(200);

    const held = res.body.achievements.filter((a: { earned: boolean }) => a.earned);
    expect(held.map((a: { id: string }) => a.id)).toEqual([first.id]);
    expect(res.body.stats).toEqual(expect.objectContaining({ earned: 1, total: Object.keys(ACHIEVEMENTS).length, totalXpEarned: first.xp }));
  });

  it('publishes the list of achievements, grouped by category, without signing in', async () => {
    const res = await request(app).get('/api/engagement/achievements/list').expect(200);

    const all = Object.values(ACHIEVEMENTS);
    expect(res.body.total).toBe(all.length);
    const grouped = Object.values(res.body.byCategory as Record<string, unknown[]>).reduce((sum, list) => sum + list.length, 0);
    expect(grouped).toBe(all.length);
  });
});

