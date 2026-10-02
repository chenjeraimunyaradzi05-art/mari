import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
// The Redis client is whatever a test says it is: nothing at all for the
// no-Redis cases, a stand-in that behaves like Redis for the others.
const mockRedis: { client: unknown } = { client: null };
jest.mock('../cache', () => ({ getRedisClient: jest.fn(() => mockRedis.client) }));

import { clearFailedLogins, getLockoutStatus, recordFailedLogin, resetLoginAttemptMemory } from '../loginAttempts';
import { redisFallbackActive, resetRedisFallbackState } from '../redis-fallback';
import { opsSnapshot, resetOpsMetrics } from '../ops-metrics';

describe('Login lockout without Redis', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test' };
    delete process.env.REDIS_URL;
    mockRedis.client = null;
    resetLoginAttemptMemory();
  });
  afterEach(() => {
    process.env = env;
  });

  it('locks the address and account after the fifth failure, and says how long for', async () => {
    for (let i = 0; i < 4; i += 1) {
      await expect(recordFailedLogin('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    }
    const fifth = await recordFailedLogin('her@athena.com', '203.0.113.7');
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(0);

    const status = await getLockoutStatus('her@athena.com', '203.0.113.7');
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps addresses and accounts apart, and clears on success', async () => {
    for (let i = 0; i < 5; i += 1) await recordFailedLogin('her@athena.com', '203.0.113.7');
    await expect(getLockoutStatus('her@athena.com', '198.51.100.9')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    await expect(getLockoutStatus('someone@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });

    await clearFailedLogins('her@athena.com', '203.0.113.7');
    await expect(getLockoutStatus('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
  });

  it('is not reported as a Redis fault when Redis was never configured', async () => {
    resetRedisFallbackState();
    resetOpsMetrics();

    await recordFailedLogin('her@athena.com', '203.0.113.7');

    expect(opsSnapshot().conditions['redis_fallback.login_lockout']).toBeUndefined();
    expect((await redisFallbackActive.get()).values.find((v) => v.labels.component === 'login_lockout')?.value).toBe(0);
  });
});

/**
 * A stand-in that behaves like Redis where it matters here: a key made by INCR
 * has no expiry until something gives it one, SET ... NX does not overwrite,
 * and EX makes the key and its expiry in one step.
 */
function fakeRedis() {
  const keys = new Map<string, { value: string; ttl: number }>();
  const client = {
    keys,
    ttl: jest.fn(async (key: string) => {
      const entry = keys.get(key);
      return entry ? entry.ttl : -2;
    }),
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && keys.has(key)) return null;
      const ex = args.indexOf('EX');
      keys.set(key, { value: String(value), ttl: ex >= 0 ? Number(args[ex + 1]) : -1 });
      return 'OK';
    }),
    incr: jest.fn(async (key: string) => {
      const entry = keys.get(key) ?? { value: '0', ttl: -1 };
      entry.value = String(Number(entry.value) + 1);
      keys.set(key, entry);
      return Number(entry.value);
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      const entry = keys.get(key);
      if (!entry) return 0;
      entry.ttl = seconds;
      return 1;
    }),
    del: jest.fn(async (...names: string[]) => {
      let removed = 0;
      for (const name of names) if (keys.delete(name)) removed += 1;
      return removed;
    }),
  };
  return client;
}

describe('Login lockout through Redis', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test', REDIS_URL: 'redis://stand-in:6379' };
    resetLoginAttemptMemory();
    resetRedisFallbackState();
    resetOpsMetrics();
  });
  afterEach(() => {
    process.env = env;
    mockRedis.client = null;
  });

  const gauge = async () => (await redisFallbackActive.get()).values.find((v) => v.labels.component === 'login_lockout')?.value;

  it('locks on the fifth failure by setting the lock and clearing the counter', async () => {
    const redis = fakeRedis();
    mockRedis.client = redis;

    for (let i = 0; i < 4; i += 1) {
      await expect(recordFailedLogin('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    }
    const fifth = await recordFailedLogin('her@athena.com', '203.0.113.7');

    expect(fifth).toEqual({ locked: true, retryAfterSeconds: 900 });
    expect(redis.keys.has('login:lock:her_athena.com:203.0.113.7')).toBe(true);
    expect(redis.keys.has('login:fails:her_athena.com:203.0.113.7')).toBe(false);
    await expect(getLockoutStatus('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: true, retryAfterSeconds: 900 });
  });

  it('keeps the other addresses, and the other accounts, unlocked', async () => {
    const redis = fakeRedis();
    mockRedis.client = redis;
    for (let i = 0; i < 5; i += 1) await recordFailedLogin('her@athena.com', '203.0.113.7');

    await expect(getLockoutStatus('her@athena.com', '198.51.100.9')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    await expect(getLockoutStatus('someone@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
  });

  it('gives the counter its expiry in the same step that makes it, before it is counted', async () => {
    const redis = fakeRedis();
    mockRedis.client = redis;

    await recordFailedLogin('her@athena.com', '203.0.113.7');

    expect(redis.set).toHaveBeenCalledWith('login:fails:her_athena.com:203.0.113.7', '0', 'EX', 900, 'NX');
    expect(redis.set.mock.invocationCallOrder[0]).toBeLessThan(redis.incr.mock.invocationCallOrder[0]);
    expect(redis.keys.get('login:fails:her_athena.com:203.0.113.7')).toEqual({ value: '1', ttl: 900 });
  });

  it('leaves no counter without an expiry even when the process stops before a separate EXPIRE could run', async () => {
    const redis = fakeRedis();
    // The old code made the key with INCR and then asked for the expiry in a
    // second call. If that second call never happens, the counter lived for ever.
    redis.expire.mockRejectedValue(new Error('the process stopped here'));
    mockRedis.client = redis;

    await recordFailedLogin('her@athena.com', '203.0.113.7');

    expect(redis.keys.get('login:fails:her_athena.com:203.0.113.7')?.ttl).toBe(900);
  });

  it('does not restart the window on later failures', async () => {
    const redis = fakeRedis();
    mockRedis.client = redis;

    await recordFailedLogin('her@athena.com', '203.0.113.7');
    redis.keys.get('login:fails:her_athena.com:203.0.113.7')!.ttl = 400; // time has passed
    await recordFailedLogin('her@athena.com', '203.0.113.7');

    expect(redis.keys.get('login:fails:her_athena.com:203.0.113.7')).toEqual({ value: '2', ttl: 400 });
  });

  it('gives an expiry back to a counter an older version left without one', async () => {
    const redis = fakeRedis();
    redis.keys.set('login:fails:her_athena.com:203.0.113.7', { value: '2', ttl: -1 });
    mockRedis.client = redis;

    await recordFailedLogin('her@athena.com', '203.0.113.7');

    expect(redis.keys.get('login:fails:her_athena.com:203.0.113.7')).toEqual({ value: '3', ttl: 900 });
  });

  it('clears both counters on a successful sign-in', async () => {
    const redis = fakeRedis();
    mockRedis.client = redis;
    for (let i = 0; i < 5; i += 1) await recordFailedLogin('her@athena.com', '203.0.113.7');

    await clearFailedLogins('her@athena.com', '203.0.113.7');

    await expect(getLockoutStatus('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    expect(redis.keys.size).toBe(0);
  });

  describe('when Redis stops answering', () => {
    const failing = () => {
      const redis = fakeRedis();
      const down = jest.fn(async () => {
        throw new Error('connection reset');
      });
      redis.ttl = down as typeof redis.ttl;
      redis.set = down as unknown as typeof redis.set;
      redis.incr = down as unknown as typeof redis.incr;
      return redis;
    };

    it('still locks, from the in-process counters, rather than letting the guesses through', async () => {
      mockRedis.client = failing();

      for (let i = 0; i < 4; i += 1) {
        await expect(recordFailedLogin('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
      }
      await expect(recordFailedLogin('her@athena.com', '203.0.113.7')).resolves.toMatchObject({ locked: true });
      await expect(getLockoutStatus('her@athena.com', '203.0.113.7')).resolves.toMatchObject({ locked: true });
    });

    it('says so: the gauge an alert reads goes to 1 and a standing condition explains it', async () => {
      mockRedis.client = failing();

      await recordFailedLogin('her@athena.com', '203.0.113.7');

      expect(await gauge()).toBe(1);
      const condition = opsSnapshot().conditions['redis_fallback.login_lockout'];
      expect(condition.count).toBe(1);
      expect(condition.detail).toMatch(/sign-in lockout counters are in this process only/);
    });

    it('says it is over when Redis answers again', async () => {
      mockRedis.client = failing();
      await recordFailedLogin('her@athena.com', '203.0.113.7');
      expect(await gauge()).toBe(1);

      mockRedis.client = fakeRedis();
      await getLockoutStatus('her@athena.com', '203.0.113.7');

      expect(await gauge()).toBe(0);
      expect(opsSnapshot().conditions['redis_fallback.login_lockout'].count).toBe(0);
    });
  });
});
