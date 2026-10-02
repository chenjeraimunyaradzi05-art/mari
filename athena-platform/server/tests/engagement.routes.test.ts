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
 * The leaderboards are public and signed-out visitors read them, so the last
 * block asks who they name: a member who asked to be hidden from search, a
 * member in Safe Mode and a member whose profile is private are not on them
 * however high they score, and either side of a block is taken off the page of
 * the member who blocked. They did list all of them, with an id that is the key
 * to everything else about her, and their cache ignored the requested size.
 */

const DAY = 24 * 60 * 60 * 1000;

interface Store {
  /** Members, with the relations a visibility filter reads (profile, dvSafetyProfile, safetySettings, followers) inline. */
  users: Array<{ id: string; xp: number } & Row>;
  posts: Row[];
  safetySettings: Row[];
  dvProfiles: Row[];
  /** The key every cached read was asked for, in order. */
  cacheKeys: string[];
  /** Makes the block list unreadable, for the test that says a search must then fail. */
  blockLookupFails: boolean;
  streaks: Row[];
  transactions: Row[];
  notifications: Row[];
  achievements: Row[];
  /** Runs just before the conditional streak write, to stage a concurrent one. */
  beforeStreakWrite: (() => void) | null;
}

const store: Store = {
  users: [],
  posts: [],
  safetySettings: [],
  dvProfiles: [],
  cacheKeys: [],
  blockLookupFails: false,
  streaks: [],
  transactions: [],
  notifications: [],
  achievements: [],
  beforeStreakWrite: null,
};

jest.mock('../src/utils/prisma', () => {
  const where = (jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where')).matchesWhere;
  const streakKey = (args: { where: { id?: string; userId_type?: { userId: string; type: string } } }) =>
    args.where.userId_type ? { userId: args.where.userId_type.userId, type: args.where.userId_type.type } : { id: args.where.id };
  return {
    prisma: {
      user: {
        // The leaderboards: the clause the service sends is run over the members,
        // then ordered and cut to the page, as the database would.
        findMany: async (args: { where?: unknown; take?: number; orderBy?: { xp?: 'desc'; followers?: { _count: 'desc' } } }) => {
          const hits = store.users.filter((u) => where(u, args.where));
          if (args.orderBy?.xp) hits.sort((a, b) => b.xp - a.xp);
          if (args.orderBy?.followers) hits.sort((a, b) => ((b.followers as unknown[])?.length ?? 0) - ((a.followers as unknown[])?.length ?? 0));
          const page = typeof args.take === 'number' ? hits.slice(0, args.take) : hits;
          return page.map((u) => ({
            id: u.id,
            displayName: u.displayName ?? null,
            avatar: u.avatar ?? null,
            xp: u.xp,
            _count: { followers: ((u.followers as unknown[]) ?? []).length },
          }));
        },
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
      post: {
        count: async () => 0,
        findFirst: async () => null,
        // The posts board: members' posts counted per author, most first.
        groupBy: async (args: { where?: unknown; take?: number }) => {
          const counts = new Map<string, number>();
          for (const row of store.posts.filter((r) => where(r, args.where))) {
            const id = String(row.authorId);
            counts.set(id, (counts.get(id) ?? 0) + 1);
          }
          return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, args.take ?? counts.size)
            .map(([authorId, count]) => ({ authorId, _count: count }));
        },
      },
      // Who she has blocked, and who has blocked her, in both stores.
      userSafetySettings: {
        findUnique: async (args: { where: unknown }) => store.safetySettings.find((r) => where(r, args.where)) ?? null,
        findMany: async (args: { where?: unknown }) => {
          if (store.blockLookupFails) throw new Error('connection reset while reading the block list');
          return store.safetySettings.filter((r) => where(r, args.where));
        },
      },
      dvSafetyProfile: {
        findUnique: async (args: { where: unknown }) => store.dvProfiles.find((r) => where(r, args.where)) ?? null,
      },
      video: { count: async () => 0, findFirst: async () => null },
      follow: { count: async () => 0, findMany: async () => [] },
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
    // Public routes read who is asking when someone is signed in.
    optionalAuth: (req: { headers: Record<string, unknown>; user?: unknown }, _res: unknown, next: () => void) => {
      const id = req.headers['x-test-user'];
      if (typeof id === 'string') req.user = { id, email: `${id}@example.com`, role: 'USER' };
      next();
    },
  };
});

// A member's XP is cached for five minutes in production. Here every read goes
// to the store, so an assertion reads what was written rather than a cache.
jest.mock('../src/utils/cache', () => {
  const actual = jest.requireActual('../src/utils/cache') as Record<string, unknown>;
  return {
    ...actual,
    cacheGetOrSet: async (key: string, fetch: () => Promise<unknown>) => {
      store.cacheKeys.push(key);
      return fetch();
    },
    cacheDel: async () => true,
  };
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
  store.posts = [];
  store.safetySettings = [];
  store.dvProfiles = [];
  store.cacheKeys = [];
  store.blockLookupFails = false;
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


describe('The leaderboards name only members a stranger could find', () => {
  /**
   *   ada   — the member reading; she blocked hal from the Safety Centre
   *   bea   — an ordinary member
   *   cleo  — in Safe Mode, turned on from the DV safety page
   *   dina  — in Safe Mode, turned on from the Safety Centre (the other column)
   *   eli   — asked to be hidden from search
   *   faye  — has a private profile
   *   gwen  — an ordinary member with the least XP
   *   hal   — an ordinary member, blocked by Ada
   * Every one of them has posted, and has a streak, so each board has the same
   * temptation: the members to leave out are the ones scoring highest.
   */
  const member = (id: string, xp: number, extra: Record<string, unknown> = {}): { id: string; xp: number } & Row => ({
    id,
    xp,
    displayName: `Member ${id}`,
    avatar: `https://cdn/${id}.png`,
    isActive: true,
    // A real member has confirmed her address (sign-in refuses her until she
    // has), and the leaderboards leave an unconfirmed account out.
    emailVerified: true,
    // Neither suspended nor banned, as every account starts: moderation sets these, and
    // the lists leave a suspended or banned member out (openAccountWhere).
    isSuspended: false,
    bannedAt: null,
    // The profile is public unless its owner closed it (the column defaults to true).
    isPublic: true,
    dvSafetyProfile: null,
    profile: null,
    safetySettings: null,
    followers: [],
    ...extra,
  });

  beforeEach(() => {
    const cleo = member('cleo', 900, { dvSafetyProfile: { userId: 'cleo', isSafeMode: true, hideFromSearch: false, blockedUserIds: [] } });
    const dina = member('dina', 800, { profile: { userId: 'dina', isSafeMode: true, hideFromSearch: false } });
    const eli = member('eli', 700, { profile: { userId: 'eli', isSafeMode: false, hideFromSearch: true } });
    const faye = member('faye', 600, { safetySettings: { userId: 'faye', blockedUsers: [], profileVisibility: 'private' } });
    const adaRow = member('ada', 500, { safetySettings: { userId: 'ada', blockedUsers: ['hal'], profileVisibility: 'public' } });
    store.users = [adaRow, member('bea', 400), member('hal', 300), member('gwen', 100), cleo, dina, eli, faye];
    store.safetySettings = [adaRow.safetySettings as Row, faye.safetySettings as Row];
    store.dvProfiles = [cleo.dvSafetyProfile as Row];
    // The members to leave out have posted the most, so a board that cut the
    // page first and filtered after would come back empty.
    const posted: Record<string, number> = { cleo: 20, dina: 19, eli: 18, faye: 17, ada: 10, bea: 9, hal: 8, gwen: 7 };
    store.posts = store.users.flatMap((u) => Array.from({ length: posted[u.id] }, () => ({ authorId: u.id, createdAt: new Date(), author: u })));
    store.streaks = store.users.map((u, i) => ({ id: `s-${u.id}`, userId: u.id, type: 'post', currentStreak: 30 - i, longestStreak: 30 - i, user: u }));
  });

  // A streak row has an id of its own and carries the member under `user`.
  const idsOn = (leaderboard: Array<{ id?: string; user?: { id: string } }>) => leaderboard.map((e) => e.user?.id ?? e.id);

  it('shows a signed-out visitor the members she could find by searching, and not the ones she could not', async () => {
    const res = await request(app).get('/api/engagement/leaderboard').query({ type: 'xp', period: 'alltime' }).expect(200);

    // cleo, dina, eli and faye all out-score every one of these.
    expect(idsOn(res.body.leaderboard)).toEqual(['ada', 'bea', 'hal', 'gwen']);
    // Nothing in the response says who was left out, or that anyone was.
    const wire = JSON.stringify(res.body);
    for (const left of ['cleo', 'dina', 'eli', 'faye']) expect(wire).not.toContain(left);
  });

  it('keeps the other boards to the same members', async () => {
    const followers = await request(app).get('/api/engagement/leaderboard/creators').query({ period: 'alltime' }).expect(200);
    const xp = await request(app).get('/api/engagement/leaderboard/xp').expect(200);

    expect(idsOn(followers.body.leaderboard).sort()).toEqual(['ada', 'bea', 'gwen', 'hal']);
    expect(idsOn(xp.body.leaderboard)).toEqual(['ada', 'bea', 'hal', 'gwen']);
  });

  it('counts posts only for members who may be named, before the page is cut', async () => {
    const res = await request(app).get('/api/engagement/leaderboard').query({ type: 'posts', period: 'alltime', limit: '3' }).expect(200);

    // Ada has the most posts of the members who may be shown; the page is the
    // top three of those, not the top three of everyone with the hidden cut out.
    expect(idsOn(res.body.leaderboard)).toEqual(['ada', 'bea', 'hal']);
    expect(res.body.leaderboard[0].postCount).toBe(10);
  });

  it('keeps the streak board to the same members', async () => {
    const res = await request(app).get('/api/engagement/leaderboard').query({ type: 'streak', period: 'alltime' }).expect(200);

    const named = idsOn(res.body.leaderboard);
    for (const left of ['cleo', 'dina', 'eli', 'faye']) expect(named).not.toContain(left);
    expect(named).toEqual(expect.arrayContaining(['ada', 'bea', 'hal', 'gwen']));
  });

  it('takes a member Ada blocked off her page, though the cached board is shared by every viewer', async () => {
    const forAda = await request(app).get('/api/engagement/leaderboard').set(ada).query({ type: 'xp', period: 'alltime' }).expect(200);
    const forStranger = await request(app).get('/api/engagement/leaderboard').query({ type: 'xp', period: 'alltime' }).expect(200);

    expect(idsOn(forAda.body.leaderboard)).toEqual(['ada', 'bea', 'gwen']);
    // The same board, with hal on it, for someone who has not blocked him.
    expect(idsOn(forStranger.body.leaderboard)).toContain('hal');
  });

  it('takes a blocked member off the streak board too, where the row carries a streak id of its own', async () => {
    const res = await request(app).get('/api/engagement/leaderboard').set(ada).query({ type: 'streak', period: 'alltime' }).expect(200);

    const named = idsOn(res.body.leaderboard);
    expect(named).not.toContain('hal');
    expect(named).toEqual(expect.arrayContaining(['ada', 'bea', 'gwen']));
  });

  it('takes a member who blocked her off as well, whichever store the block is in', async () => {
    store.safetySettings.push({ userId: 'bea', blockedUsers: ['ada'], profileVisibility: 'public' });

    const res = await request(app).get('/api/engagement/leaderboard/xp').set(ada).query({ period: 'alltime' }).expect(200);

    expect(idsOn(res.body.leaderboard)).toEqual(['ada', 'gwen']);
  });

  it('tells a member her rank among the members shown, and nothing for one who is not shown', async () => {
    const shown = await request(app).get('/api/engagement/leaderboard').set(ada).query({ type: 'xp', period: 'alltime' }).expect(200);
    expect(shown.body.userRank).toBe(1);

    // Cleo is in Safe Mode and scores most, so the board does not carry her and
    // so has no rank to give her.
    const quiet = await request(app).get('/api/engagement/leaderboard').set({ 'x-test-user': 'cleo' }).query({ type: 'xp', period: 'alltime' }).expect(200);
    expect(quiet.body.userRank).toBeNull();
  });

  it('tells her her rank on the streak board too, whose rows carry the streak’s own id and the member beneath it', async () => {
    // Ada's post streak is the longest of the members who may be shown; the
    // row's `id` is `s-ada`, not `ada`, and the rank lookup used to compare
    // that id with hers and tell every member she was unranked.
    const res = await request(app).get('/api/engagement/leaderboard').set(ada).query({ type: 'streak', period: 'alltime' }).expect(200);

    expect(res.body.userRank).toBe(1);
  });

  it('keys the cache on the size, so the rank lookup and a page do not answer each other', async () => {
    await request(app).get('/api/engagement/leaderboard').set(ada).query({ type: 'xp', period: 'weekly', limit: '5' }).expect(200);

    const keys = store.cacheKeys.filter((k) => k.includes('xp'));
    expect(new Set(keys).size).toBe(2);
    expect(keys.some((k) => k.endsWith(':5'))).toBe(true);
    expect(keys.some((k) => k.endsWith(':1000'))).toBe(true);
  });

  it('does not mint a cache key, and so a fresh ranking query, for every spelling of a type or a period', async () => {
    const notABoard = await request(app).get('/api/engagement/leaderboard').query({ type: 'nonsense-board', period: 'alltime' }).expect(200);
    expect(notABoard.body.leaderboard).toEqual([]);

    await request(app).get('/api/engagement/leaderboard').query({ type: 'xp', period: 'someday-soon', limit: '-5' }).expect(200);

    expect(store.cacheKeys.some((k) => k.includes('nonsense-board'))).toBe(false);
    expect(store.cacheKeys.some((k) => k.includes('someday-soon'))).toBe(false);
    // An unknown period is the default one, and the size is held to at least one.
    expect(store.cacheKeys).toContain('leaderboard:xp:weekly:1');
  });

  it('answers an error, not a board of everyone, when the block lists cannot be read', async () => {
    store.blockLookupFails = true;

    const res = await request(app).get('/api/engagement/leaderboard/xp').set(ada);

    expect(res.status).toBe(500);
    expect(res.body.leaderboard).toBeUndefined();
  });

  it('does not need the lists for a signed-out visitor, who has blocked no one', async () => {
    store.blockLookupFails = true;

    const res = await request(app).get('/api/engagement/leaderboard/xp').expect(200);

    expect(idsOn(res.body.leaderboard)).toContain('bea');
  });
});
