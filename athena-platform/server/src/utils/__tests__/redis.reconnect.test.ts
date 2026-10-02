/**
 * What the shared Redis client does when Redis goes away and comes back.
 *
 * This client holds the locks that stop the nine scheduled sweeps running on
 * every instance at once, and the counters behind the API-wide rate limits. Its
 * retry strategy used to answer `null` after ten attempts, about six seconds
 * into an outage. ioredis reads `null` as "stop for good" and moves the client
 * to `end`; `isRedisAvailable()` was a flag that nothing set back to true; and
 * so a Redis that was restarted by its host left every API instance with a
 * dead client until the instance itself was restarted. In production that means
 * every sweep skipped (the escrow-expiry warnings, the reminders, the scheduled
 * posts) and no word of it anywhere. These tests stand in for the Redis server
 * and hold the client to: always try again, say what it is waiting for, and
 * answer "available" when the client says so and not before.
 *
 * ioredis is replaced by a stand-in with the same states and events, so what is
 * asserted is this module's use of them, not ioredis.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('ioredis', () => {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events');
  class FakeRedis extends EventEmitter {
    static instances: FakeRedis[] = [];
    status = 'wait';
    options: Record<string, any>;
    store = new Map<string, string>();
    connect = jest.fn(async () => {
      this.status = 'ready';
    });
    ping = jest.fn(async () => 'PONG');
    set = jest.fn(async (key: string, value: string) => {
      this.store.set(key, value);
      return 'OK';
    });
    get = jest.fn(async (key: string) => this.store.get(key) ?? null);
    del = jest.fn(async (key: string) => (this.store.delete(key) ? 1 : 0));
    constructor(_url: string, options: Record<string, any>) {
      super();
      this.options = options;
      FakeRedis.instances.push(this);
    }
    /** Moves the stand-in to a state and announces it, as ioredis does. */
    go(status: string) {
      this.status = status;
      this.emit(status);
    }
  }
  return { __esModule: true, default: FakeRedis };
});

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Redis from 'ioredis';
import { logger } from '../logger';
import { opsSnapshot, resetOpsMetrics } from '../ops-metrics';
import {
  REDIS_PING_TIMEOUT_MS,
  SWEEPS_SKIPPED_CONDITION,
  ensureRedisConnected,
  isRedisAvailable,
  pingRedis,
  redisReadyForTraffic,
  redisRetryDelay,
  resetSkippedSweeps,
  runExclusively,
} from '../redis';

type Fake = {
  status: string;
  options: { retryStrategy: (times: number) => number | null };
  connect: jest.Mock<() => Promise<void>>;
  ping: jest.Mock<() => Promise<string>>;
  go: (status: string) => void;
};

// The main client is the first one the module makes, then the subscriber and the publisher.
const main = () => (Redis as unknown as { instances: Fake[] }).instances[0];

const env = { ...process.env };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  main().status = 'ready';
  main().connect.mockImplementation(async () => {
    main().status = 'ready';
  });
  main().ping.mockImplementation(async () => 'PONG');
  resetOpsMetrics();
  resetSkippedSweeps();
});

afterEach(() => {
  jest.useRealTimers();
  process.env = { ...env };
});

describe('the retry strategy', () => {
  it('always answers with a delay, for every attempt of an outage that lasts an hour', () => {
    // ioredis treats anything that is not a number as "stop for good".
    for (let attempt = 1; attempt <= 1200; attempt += 1) {
      const delay = main().options.retryStrategy(attempt);
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(3000);
    }
  });

  it('does the same on the two pub/sub clients', () => {
    for (const client of (Redis as unknown as { instances: Fake[] }).instances) {
      expect(typeof client.options.retryStrategy(11)).toBe('number');
      expect(typeof client.options.retryStrategy(5000)).toBe('number');
    }
  });

  it('waits longer each time and then holds at three seconds', () => {
    expect(redisRetryDelay(1)).toBe(100);
    expect(redisRetryDelay(5)).toBe(500);
    expect(redisRetryDelay(30)).toBe(3000);
    expect(redisRetryDelay(31)).toBe(3000);
    expect(redisRetryDelay(100_000)).toBe(3000);
    // An attempt number that is not one, so a wait is still a wait.
    expect(redisRetryDelay(0)).toBe(100);
  });

  it('reports a long outage once, not once per attempt', () => {
    for (let attempt = 1; attempt <= 200; attempt += 1) main().options.retryStrategy(attempt);

    const reports = (logger.error as jest.Mock).mock.calls.filter(([message]) => String(message).includes('still unreachable'));
    expect(reports).toHaveLength(1);
    expect(String(reports[0][0])).toContain('keeps trying');
  });
});

describe('whether Redis is available', () => {
  it('is what the client says now: ready is yes, and anything else is no', () => {
    for (const status of ['wait', 'connecting', 'connect', 'reconnecting', 'close', 'end']) {
      main().status = status;
      expect(isRedisAvailable()).toBe(false);
    }
    main().status = 'ready';
    expect(isRedisAvailable()).toBe(true);
  });

  it('is yes again after an outage long enough that the old flag would have stayed no', () => {
    main().go('close');
    main().go('reconnecting');
    expect(isRedisAvailable()).toBe(false);
    for (let attempt = 1; attempt <= 50; attempt += 1) main().options.retryStrategy(attempt);
    jest.advanceTimersByTime(10 * 60_000);

    main().go('ready');

    expect(isRedisAvailable()).toBe(true);
  });
});

describe('a client that has ended', () => {
  it('is opened again after thirty seconds', () => {
    main().go('end');
    expect(main().connect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(29_999);
    expect(main().connect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2);

    expect(main().connect).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('connection has ended'));
  });

  it('is not opened a second time because it ended twice, and not at all if it recovered by itself', () => {
    main().go('end');
    main().go('end');
    jest.advanceTimersByTime(30_001);
    expect(main().connect).toHaveBeenCalledTimes(1);

    main().connect.mockClear();
    main().go('end');
    main().status = 'ready';
    jest.advanceTimersByTime(30_001);
    expect(main().connect).not.toHaveBeenCalled();
  });

  it('keeps trying if opening it fails: the next ending schedules the next try', () => {
    main().connect.mockImplementation(async () => {
      main().go('end');
    });

    main().go('end');
    jest.advanceTimersByTime(30_001);
    expect(main().connect).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30_001);

    expect(main().connect).toHaveBeenCalledTimes(2);
  });
});

describe('ensureRedisConnected', () => {
  it('opens a client that has not been opened, or that has ended', async () => {
    main().status = 'wait';
    await expect(ensureRedisConnected()).resolves.toBe(true);
    expect(main().connect).toHaveBeenCalledTimes(1);

    main().status = 'end';
    await expect(ensureRedisConnected()).resolves.toBe(true);
    expect(main().connect).toHaveBeenCalledTimes(2);
  });

  it('does not open a second socket beside a client that is waiting out its own retry', async () => {
    main().status = 'reconnecting';

    await expect(ensureRedisConnected()).resolves.toBe(false);

    expect(main().connect).not.toHaveBeenCalled();
  });

  it('says no when the server is not there, and does not throw', async () => {
    main().status = 'wait';
    main().connect.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(ensureRedisConnected()).resolves.toBe(false);
  });
});

describe('pingRedis and the readiness answer', () => {
  it('says yes for a Redis that answers PONG', async () => {
    await expect(pingRedis()).resolves.toBe(true);
  });

  it('says no for a client that is not ready, without waiting', async () => {
    main().status = 'reconnecting';

    await expect(pingRedis()).resolves.toBe(false);

    expect(main().ping).not.toHaveBeenCalled();
  });

  it('says no for a Redis that does not answer within a second', async () => {
    main().ping.mockImplementation(() => new Promise(() => undefined));

    const answer = pingRedis();
    await jest.advanceTimersByTimeAsync(REDIS_PING_TIMEOUT_MS + 1);

    await expect(answer).resolves.toBe(false);
  });

  it('says no for a Redis that refuses the command', async () => {
    main().ping.mockRejectedValue(new Error('LOADING Redis is loading the dataset in memory'));

    await expect(pingRedis()).resolves.toBe(false);
  });

  it('opens a client nobody has needed yet, so that a probe is also the first connection', async () => {
    main().status = 'wait';

    await expect(pingRedis()).resolves.toBe(true);

    expect(main().connect).toHaveBeenCalledTimes(1);
  });

  it('is ready in production only if Redis answers, when a REDIS_URL says it is needed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://cache.internal:6379';
    main().status = 'reconnecting';
    await expect(redisReadyForTraffic()).resolves.toBe(false);

    main().status = 'ready';
    await expect(redisReadyForTraffic()).resolves.toBe(true);
  });

  it('is ready outside production, and without a REDIS_URL, whatever Redis is doing', async () => {
    main().status = 'reconnecting';

    process.env.NODE_ENV = 'development';
    process.env.REDIS_URL = 'redis://localhost:6379';
    await expect(redisReadyForTraffic()).resolves.toBe(true);

    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    await expect(redisReadyForTraffic()).resolves.toBe(true);
  });
});

describe('a scheduled sweep while Redis is away', () => {
  const work = jest.fn(async () => 'ran');

  beforeEach(() => {
    work.mockClear();
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://cache.internal:6379';
  });

  it('is not run in production, and the condition says which sweeps are waiting', async () => {
    main().status = 'reconnecting';

    await expect(runExclusively('escrow-expiry', work)).resolves.toBeNull();
    await expect(runExclusively('scheduled-posts', work)).resolves.toBeNull();

    expect(work).not.toHaveBeenCalled();
    const condition = opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION];
    expect(condition.count).toBe(2);
    expect(condition.detail).toContain('escrow-expiry');
    expect(condition.detail).toContain('scheduled-posts');
    expect(condition.detail).toMatch(/resume by themselves/);
  });

  it('logs the first skip of each sweep and then goes quiet, so an outage is not nine hundred lines an hour', async () => {
    main().status = 'reconnecting';

    for (let minute = 0; minute < 60; minute += 1) await runExclusively('escrow-expiry', work);

    const skips = (logger.error as jest.Mock).mock.calls.filter(([message]) => String(message).includes('Skipping a scheduled sweep'));
    expect(skips).toHaveLength(1);
    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION].count).toBe(1);
  });

  it('runs again by itself when Redis answers, and the condition falls back to zero', async () => {
    main().status = 'reconnecting';
    await runExclusively('escrow-expiry', work);
    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION].count).toBe(1);

    main().go('ready');
    const result = await runExclusively('escrow-expiry', work);

    expect(result).toBe('ran');
    expect(work).toHaveBeenCalledTimes(1);
    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION]).toMatchObject({ count: 0, detail: null });
    expect(logger.info).toHaveBeenCalledWith(
      'Redis answers again: the scheduled sweeps that were skipped run at their next round',
      { sweeps: ['escrow-expiry'] }
    );
  });

  it('clears the condition for every sweep the moment Redis answers, whatever their schedule', async () => {
    main().status = 'reconnecting';
    await runExclusively('escrow-expiry', work);
    await runExclusively('wellness', work);
    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION].count).toBe(2);

    // A daily sweep has not run yet when this happens: the condition is about sweeps being held back.
    main().go('ready');

    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION]).toMatchObject({ count: 0, detail: null });
  });

  it('says nothing when Redis comes back and nothing had been skipped', async () => {
    main().go('ready');

    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION]).toBeUndefined();
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('scheduled sweeps that were skipped'), expect.anything());
  });

  it('runs unlocked outside production, which is a development convenience and says so once', async () => {
    process.env.NODE_ENV = 'development';
    main().status = 'reconnecting';

    await expect(runExclusively('escrow-expiry', work)).resolves.toBe('ran');
    await expect(runExclusively('escrow-expiry', work)).resolves.toBe('ran');

    expect(opsSnapshot().conditions[SWEEPS_SKIPPED_CONDITION]).toBeUndefined();
    expect((logger.warn as jest.Mock).mock.calls.filter(([m]) => String(m).includes('run unlocked'))).toHaveLength(1);
  });
});
