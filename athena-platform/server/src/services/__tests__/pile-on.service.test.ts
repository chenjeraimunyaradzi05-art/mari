/**
 * A pile-on is no single account doing anything unusual: a few dozen of them
 * each comment, mention or follow the same woman inside an hour. The
 * per-account limits cannot see that, so this counts the accounts that reach
 * her and are not already her followers, and past a threshold quiets her
 * alerts from them and tells staff. These pin when it trips, when it does not,
 * and that it never turns on the person it exists to protect.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type Query = jest.Mock<(args?: any) => Promise<any>>;

const followFindMany = jest.fn() as Query;
const adminFlagCreate = jest.fn() as Query;
const notificationCreate = jest.fn() as Query;
jest.mock('../../utils/prisma', () => ({
  prisma: {
    follow: { findMany: followFindMany },
    adminFlag: { create: adminFlagCreate },
    notification: { create: notificationCreate },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const recordFailure = jest.fn();
const recordCondition = jest.fn();
jest.mock('../../utils/ops-metrics', () => ({ recordFailure, recordCondition }));

const notifyAdmins = jest.fn() as Query;
jest.mock('../admin-notify.service', () => ({ notifyAdmins }));

// Redis, when a test asks for it: the few commands the service uses, over
// plain maps, so two "instances" can be shown sharing one count.
let fakeRedis: ReturnType<typeof makeFakeRedis> | null = null;
jest.mock('../../utils/cache', () => ({ getRedisClient: () => fakeRedis }));

function makeFakeRedis() {
  const sets = new Map<string, Map<string, number>>();
  const strings = new Map<string, string>();
  const redis = {
    sets,
    strings,
    pipeline() {
      const ops: Array<() => unknown> = [];
      const chain = {
        zadd: (key: string, score: string, member: string) => {
          ops.push(() => {
            const set = sets.get(key) ?? new Map<string, number>();
            set.set(member, Number(score));
            sets.set(key, set);
            return 1;
          });
          return chain;
        },
        zremrangebyscore: (key: string, min: number, max: number) => {
          ops.push(() => {
            const set = sets.get(key) ?? new Map<string, number>();
            for (const [member, score] of set) if (score >= min && score <= max) set.delete(member);
            return 0;
          });
          return chain;
        },
        zrevrange: (key: string, start: number, stop: number) => {
          ops.push(() =>
            [...(sets.get(key) ?? new Map<string, number>()).entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(start, stop + 1)
              .map(([member]) => member)
          );
          return chain;
        },
        expire: () => {
          ops.push(() => 1);
          return chain;
        },
        exec: async () => ops.map((op) => [null, op()]),
      };
      return chain;
    },
    exists: async (key: string) => (strings.has(key) ? 1 : 0),
    set: async (key: string, value: string, _px: string, _ms: number, nx: string) => {
      if (nx === 'NX' && strings.has(key)) return null;
      strings.set(key, value);
      return 'OK';
    },
  };
  return redis;
}

import { PILE_ON_FLAG_TYPE, pileOnSettings, quietedByPileOn, resetPileOnState } from '../pile-on.service';

const SAVED_ENV = { ...process.env };
const NOW = Date.UTC(2026, 9, 1, 10, 0, 0);
const MINUTE = 60_000;

/** Three strangers are enough here; the default is a number a busy day does not reach. */
function useThreshold(threshold: number) {
  process.env.PILE_ON_THRESHOLD = String(threshold);
}

/** Who follows her, among whichever accounts are asked about. */
function herFollowers(...ids: string[]) {
  followFindMany.mockImplementation(async (args: any) =>
    ids.filter((id) => args.where.followerId.in.includes(id)).map((followerId) => ({ followerId }))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPileOnState();
  fakeRedis = null;
  delete process.env.REDIS_URL;
  delete process.env.PILE_ON_THRESHOLD;
  delete process.env.PILE_ON_WINDOW_MINUTES;
  delete process.env.PILE_ON_CALM_MINUTES;
  herFollowers();
  adminFlagCreate.mockResolvedValue({ id: 'flag-1' });
  notificationCreate.mockResolvedValue({ id: 'n-1' });
  notifyAdmins.mockResolvedValue(1);
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

describe('the settings an operator can change', () => {
  it('are conservative by default', () => {
    expect(pileOnSettings()).toEqual({ threshold: 15, windowMs: 60 * MINUTE, calmMs: 120 * MINUTE });
  });

  it('are read from the environment, and a value that is not a positive number is ignored', () => {
    process.env.PILE_ON_THRESHOLD = '6';
    process.env.PILE_ON_WINDOW_MINUTES = '30';
    process.env.PILE_ON_CALM_MINUTES = 'soon';

    expect(pileOnSettings()).toEqual({ threshold: 6, windowMs: 30 * MINUTE, calmMs: 120 * MINUTE });
  });
});

describe('quietedByPileOn, in this process', () => {
  it('lets everything through while the crowd is small, and asks the database nothing', async () => {
    useThreshold(3);

    expect(await quietedByPileOn('mei', 'a1', NOW)).toBe(false);
    expect(await quietedByPileOn('mei', 'a2', NOW + 1)).toBe(false);

    expect(followFindMany).not.toHaveBeenCalled();
    expect(adminFlagCreate).not.toHaveBeenCalled();
  });

  it('trips on the threshold, quiets that account, tells staff once and tells her', async () => {
    useThreshold(3);

    await quietedByPileOn('mei', 'a1', NOW);
    await quietedByPileOn('mei', 'a2', NOW + 1);
    const third = await quietedByPileOn('mei', 'a3', NOW + 2);

    expect(third).toBe(true);

    // The flag is about her, as the person being contacted, and says so.
    expect(adminFlagCreate).toHaveBeenCalledTimes(1);
    const flag = adminFlagCreate.mock.calls[0][0].data;
    expect(flag).toMatchObject({ userId: 'mei', type: PILE_ON_FLAG_TYPE, severity: 'HIGH', flaggedById: 'system' });
    expect(flag.reason).toMatch(/not the person at fault/);
    expect(flag.notes).toContain('3 distinct accounts');
    for (const id of ['a1', 'a2', 'a3']) expect(flag.notes).toContain(id);

    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect(notifyAdmins.mock.calls[0][0].data).toMatchObject({ flagId: 'flag-1', flagType: PILE_ON_FLAG_TYPE });

    // And she is told, in words that do not promise what the platform does not do.
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const notice = notificationCreate.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: 'mei', type: 'SYSTEM' });
    expect(notice.message).toMatch(/Nothing has been removed/);
    expect(notice.message).toMatch(/moderators have been told/);

    expect(recordCondition).toHaveBeenLastCalledWith('social.pile_on_active', 1, expect.any(String));
  });

  it('raises it once however many more accounts follow, and keeps quieting strangers', async () => {
    useThreshold(3);
    for (const [index, id] of ['a1', 'a2', 'a3'].entries()) await quietedByPileOn('mei', id, NOW + index);

    expect(await quietedByPileOn('mei', 'a4', NOW + 10)).toBe(true);
    expect(await quietedByPileOn('mei', 'a5', NOW + 11)).toBe(true);

    expect(adminFlagCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });

  it('does not count her own followers: a crowd of friends is a good day', async () => {
    useThreshold(3);
    herFollowers('f1', 'f2', 'f3', 'f4');

    for (const [index, id] of ['f1', 'f2', 'f3', 'f4'].entries()) {
      expect(await quietedByPileOn('mei', id, NOW + index)).toBe(false);
    }

    expect(adminFlagCreate).not.toHaveBeenCalled();
  });

  it('counts only the strangers among a mixed crowd', async () => {
    useThreshold(3);
    herFollowers('f1', 'f2');

    for (const [index, id] of ['f1', 'f2', 's1', 's2'].entries()) await quietedByPileOn('mei', id, NOW + index);
    expect(adminFlagCreate).not.toHaveBeenCalled();

    expect(await quietedByPileOn('mei', 's3', NOW + 10)).toBe(true);
    expect(adminFlagCreate).toHaveBeenCalledTimes(1);
    // Her followers are not among the accounts handed to staff as the crowd.
    const notes: string = adminFlagCreate.mock.calls[0][0].data.notes;
    expect(notes).toContain('3 distinct accounts');
    expect(notes).not.toContain('f1');
  });

  it('lets her followers through once her alerts are quieted', async () => {
    useThreshold(3);
    herFollowers('friend');
    for (const [index, id] of ['s1', 's2', 's3'].entries()) await quietedByPileOn('mei', id, NOW + index);

    expect(await quietedByPileOn('mei', 'friend', NOW + 20)).toBe(false);
    expect(await quietedByPileOn('mei', 's4', NOW + 21)).toBe(true);
  });

  it('counts the same account once however often it returns', async () => {
    useThreshold(3);

    for (let i = 0; i < 20; i += 1) await quietedByPileOn('mei', 'one-persistent-account', NOW + i);

    expect(adminFlagCreate).not.toHaveBeenCalled();
  });

  it('forgets an account that reached her longer ago than the window', async () => {
    useThreshold(3);
    process.env.PILE_ON_WINDOW_MINUTES = '60';

    await quietedByPileOn('mei', 'a1', NOW);
    await quietedByPileOn('mei', 'a2', NOW + MINUTE);
    // Two hours on, only the newcomers count.
    expect(await quietedByPileOn('mei', 'a3', NOW + 120 * MINUTE)).toBe(false);
    expect(await quietedByPileOn('mei', 'a4', NOW + 121 * MINUTE)).toBe(false);

    expect(adminFlagCreate).not.toHaveBeenCalled();
  });

  it('ends after the calm period, and can be raised again by a new crowd', async () => {
    useThreshold(3);
    process.env.PILE_ON_CALM_MINUTES = '10';
    for (const [index, id] of ['a1', 'a2', 'a3'].entries()) await quietedByPileOn('mei', id, NOW + index);
    expect(adminFlagCreate).toHaveBeenCalledTimes(1);

    // An hour and a half later, the old crowd has aged out of the window as well.
    const later = NOW + 90 * MINUTE;
    expect(await quietedByPileOn('mei', 'b1', later)).toBe(false);
    expect(await quietedByPileOn('mei', 'b2', later + 1)).toBe(false);
    expect(await quietedByPileOn('mei', 'b3', later + 2)).toBe(true);

    expect(adminFlagCreate).toHaveBeenCalledTimes(2);
  });

  it('keeps one member apart from another', async () => {
    useThreshold(3);

    await quietedByPileOn('mei', 'a1', NOW);
    await quietedByPileOn('mei', 'a2', NOW);
    await quietedByPileOn('priya', 'a3', NOW);

    expect(adminFlagCreate).not.toHaveBeenCalled();
  });

  it('never counts a member as reaching herself', async () => {
    expect(await quietedByPileOn('mei', 'mei', NOW)).toBe(false);
    expect(await quietedByPileOn('', 'a1', NOW)).toBe(false);
  });

  it('answers "no" rather than throw when the database fails, so the notification goes out as before', async () => {
    useThreshold(2);
    followFindMany.mockRejectedValue(new Error('connection reset'));

    await quietedByPileOn('mei', 'a1', NOW);
    await expect(quietedByPileOn('mei', 'a2', NOW + 1)).resolves.toBe(false);

    expect(recordFailure).toHaveBeenCalledWith('pile-on.check', expect.any(Error));
    expect(adminFlagCreate).not.toHaveBeenCalled();
  });

  it('is still in force when the staff flag could not be written, and says nothing it cannot back up', async () => {
    useThreshold(3);
    adminFlagCreate.mockRejectedValue(new Error('write failed'));

    for (const [index, id] of ['a1', 'a2'].entries()) await quietedByPileOn('mei', id, NOW + index);
    expect(await quietedByPileOn('mei', 'a3', NOW + 2)).toBe(true);

    expect(notifyAdmins).not.toHaveBeenCalled();
    expect(notificationCreate.mock.calls[0][0].data.message).not.toMatch(/moderators have been told/);
  });

  it('writes at most the first twenty-five accounts into the staff note', async () => {
    useThreshold(30);
    for (let i = 0; i < 30; i += 1) await quietedByPileOn('mei', `acct-${String(i).padStart(2, '0')}`, NOW + i);

    const notes: string = adminFlagCreate.mock.calls[0][0].data.notes;
    expect(notes).toMatch(/first 25 of 30/);
    expect(notes.split('\n').filter((line) => line.startsWith('acct-'))).toHaveLength(25);
  });
});

describe('quietedByPileOn, with Redis', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://fake';
    fakeRedis = makeFakeRedis();
  });

  it('keeps the crowd in a sorted set per member, so every instance sees the same one', async () => {
    useThreshold(3);

    await quietedByPileOn('mei', 'a1', NOW);
    await quietedByPileOn('mei', 'a2', NOW + 1);

    expect([...fakeRedis!.sets.get('pileon:contacts:mei')!.keys()].sort()).toEqual(['a1', 'a2']);
  });

  it('trips on the shared count, and only the first instance to notice raises it', async () => {
    useThreshold(3);
    await quietedByPileOn('mei', 'a1', NOW);
    await quietedByPileOn('mei', 'a2', NOW + 1);
    expect(await quietedByPileOn('mei', 'a3', NOW + 2)).toBe(true);

    // Another instance, with nothing of its own in memory, sees the marker.
    resetPileOnState();
    expect(await quietedByPileOn('mei', 'a4', NOW + 3)).toBe(true);

    expect(adminFlagCreate).toHaveBeenCalledTimes(1);
    expect(fakeRedis!.strings.has('pileon:calm:mei')).toBe(true);
  });

  it('carries on counting in this process when Redis fails', async () => {
    useThreshold(2);
    fakeRedis!.pipeline = () => {
      throw new Error('ECONNRESET');
    };
    fakeRedis!.exists = async () => {
      throw new Error('ECONNRESET');
    };
    fakeRedis!.set = async () => {
      throw new Error('ECONNRESET');
    };

    await quietedByPileOn('mei', 'a1', NOW);
    expect(await quietedByPileOn('mei', 'a2', NOW + 1)).toBe(true);

    expect(recordFailure).toHaveBeenCalledWith('pile-on.redis', expect.any(Error));
    expect(adminFlagCreate).toHaveBeenCalledTimes(1);
  });
});
