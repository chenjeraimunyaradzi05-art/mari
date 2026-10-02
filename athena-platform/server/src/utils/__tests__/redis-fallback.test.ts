import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * When Redis goes away after boot, the sign-in lockout and both rate limiters
 * keep counting in this process rather than letting requests through. That is
 * the right behaviour and it used to be silent: a warning line at most once a
 * minute. The counters are then per instance, so a guessing run is slowed
 * rather than stopped. These tests are what make the fallback visible: a gauge
 * for alerts.yml (AthenaRedisFallbackActive) and a standing condition for
 * /health/detailed.
 */

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../redis', () => ({
  redis: null,
  isRedisAvailable: () => true,
  ensureRedisConnected: async () => true,
}));
const mockCache: { client: unknown } = { client: null };
jest.mock('../cache', () => ({ getRedisClient: jest.fn(() => mockCache.client) }));

import { register } from '../metrics';
import { opsSnapshot, resetOpsMetrics } from '../ops-metrics';
import {
  REDIS_FALLBACK_COMPONENTS,
  noteRedisFallback,
  noteRedisRecovered,
  redisFallbackActive,
  resetRedisFallbackState,
} from '../redis-fallback';
import { SharedRateLimitStore, type CounterClient } from '../rate-limit-store';
import { resetMemoryRateLimits, slidingWindowRateLimit } from '../../middleware/rateLimiter';

const env = { ...process.env };

const gauge = async (component: string) =>
  (await redisFallbackActive.get()).values.find((value) => value.labels.component === component)?.value;

beforeEach(() => {
  process.env = { ...env, NODE_ENV: 'test', REDIS_URL: 'redis://stand-in:6379' };
  resetRedisFallbackState();
  resetOpsMetrics();
  resetMemoryRateLimits();
  mockCache.client = null;
});

afterEach(() => {
  process.env = env;
});

describe('noteRedisFallback and noteRedisRecovered', () => {
  it('publishes a series for every component from the start, at zero, so a rule on it has something to read', async () => {
    const exposition = await register.metrics();

    for (const component of REDIS_FALLBACK_COMPONENTS) {
      expect(exposition).toContain(`athena_redis_fallback_active{component="${component}"} 0`);
    }
  });

  it('sets the gauge and a standing condition that says what is wrong and what to do', async () => {
    noteRedisFallback('login_lockout', 'Redis request failed');

    expect(await gauge('login_lockout')).toBe(1);
    const condition = opsSnapshot().conditions['redis_fallback.login_lockout'];
    expect(condition.count).toBe(1);
    expect(condition.detail).toMatch(/in this process only/);
    expect(condition.detail).toMatch(/Redis request failed/);
    expect(condition.detail).toMatch(/runbook/);
  });

  it('keeps the components apart', async () => {
    noteRedisFallback('rate_limit_counters', 'Redis is not ready');

    expect(await gauge('rate_limit_counters')).toBe(1);
    expect(await gauge('login_lockout')).toBe(0);
    expect(await gauge('rate_limit_sliding_window')).toBe(0);
  });

  it('clears both when Redis works again, and says nothing about a component that was never affected', async () => {
    noteRedisRecovered('login_lockout');
    expect(opsSnapshot().conditions['redis_fallback.login_lockout']).toBeUndefined();

    noteRedisFallback('login_lockout', 'Redis request failed');
    noteRedisRecovered('login_lockout');

    expect(await gauge('login_lockout')).toBe(0);
    expect(opsSnapshot().conditions['redis_fallback.login_lockout'].count).toBe(0);
  });

  it('is not a fault where Redis was never configured, which is development and the test suite', async () => {
    delete process.env.REDIS_URL;

    noteRedisFallback('login_lockout', 'Redis is not configured');

    expect(await gauge('login_lockout')).toBe(0);
    expect(opsSnapshot().conditions['redis_fallback.login_lockout']).toBeUndefined();
  });
});

describe('the express-rate-limit counters', () => {
  function counterClient(failing: boolean): CounterClient {
    const hits = new Map<string, number>();
    return {
      multi() {
        const keys: string[] = [];
        const chain = {
          incr(key: string) {
            keys.push(key);
            return chain;
          },
          pttl() {
            return chain;
          },
          async exec() {
            if (failing) throw new Error('connection lost');
            const next = (hits.get(keys[0]) ?? 0) + 1;
            hits.set(keys[0], next);
            return [
              [null, next],
              [null, 60_000],
            ] as Array<[Error | null, unknown]>;
          },
        };
        return chain;
      },
      async pexpire() {
        return 1;
      },
      async decr() {
        return 0;
      },
      async del() {
        return 1;
      },
    };
  }

  it('reports the fallback when a Redis call fails, still counts, and reports the recovery', async () => {
    const down = new SharedRateLimitStore('rl:test:', { client: counterClient(true), available: () => true });
    const first = await down.increment('caller');
    const second = await down.increment('caller');

    // Counted in the process, not let through.
    expect([first.totalHits, second.totalHits]).toEqual([1, 2]);
    expect(await gauge('rate_limit_counters')).toBe(1);

    const up = new SharedRateLimitStore('rl:test:', { client: counterClient(false), available: () => true });
    await up.increment('caller');

    expect(await gauge('rate_limit_counters')).toBe(0);
  });

  it('reports the fallback when Redis is configured but not ready', async () => {
    const store = new SharedRateLimitStore('rl:test:', { client: counterClient(false), available: () => false });

    await store.increment('caller');

    expect(await gauge('rate_limit_counters')).toBe(1);
    expect(opsSnapshot().conditions['redis_fallback.rate_limit_counters'].detail).toMatch(/Redis is not ready/);
  });
});

describe('the sliding-window limiter', () => {
  it('reports the fallback when its Redis pipeline fails, still limits, and reports the recovery', async () => {
    mockCache.client = {
      pipeline() {
        throw new Error('connection lost');
      },
    };

    const first = await slidingWindowRateLimit('caller-a', 60_000, 1);
    const second = await slidingWindowRateLimit('caller-a', 60_000, 1);

    expect([first.allowed, second.allowed]).toEqual([true, false]);
    expect(await gauge('rate_limit_sliding_window')).toBe(1);

    mockCache.client = {
      pipeline() {
        const chain = {
          zremrangebyscore: () => chain,
          zcard: () => chain,
          zadd: () => chain,
          expire: () => chain,
          exec: async () =>
            [
              [null, 0],
              [null, 0],
              [null, 1],
              [null, 1],
            ] as Array<[Error | null, unknown]>,
        };
        return chain;
      },
      zrange: async () => [] as string[],
    };

    await slidingWindowRateLimit('caller-b', 60_000, 5);

    expect(await gauge('rate_limit_sliding_window')).toBe(0);
  });
});
