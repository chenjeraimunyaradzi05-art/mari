import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// No Redis at all: the limiter must still limit.
jest.mock('../../utils/cache', () => ({ getRedisClient: jest.fn(() => null) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getRedisClient } from '../../utils/cache';
import { createRateLimiter, memorySlidingWindow, resetMemoryRateLimits, slidingWindowRateLimit } from '../rateLimiter';

function appWith(max: number) {
  const app = express();
  app.use(createRateLimiter({ max, windowMs: 60_000, keyGenerator: () => 'same-caller' }));
  app.get('/login', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Rate limiting without Redis', () => {
  beforeEach(() => resetMemoryRateLimits());

  it('falls back to an in-process sliding window instead of allowing everything', async () => {
    const app = appWith(2);
    await request(app).get('/login').expect(200);
    await request(app).get('/login').expect(200);
    const refused = await request(app).get('/login').expect(429);
    expect(refused.headers['retry-after']).toBeDefined();
    expect(refused.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('lets the window slide so a caller is not locked out for good', () => {
    const t0 = 1_000_000;
    expect(memorySlidingWindow('k', 1000, 2, t0).allowed).toBe(true);
    expect(memorySlidingWindow('k', 1000, 2, t0 + 10).allowed).toBe(true);
    expect(memorySlidingWindow('k', 1000, 2, t0 + 20).allowed).toBe(false);
    // The first hit has aged out of the window.
    const later = memorySlidingWindow('k', 1000, 2, t0 + 1001);
    expect(later.allowed).toBe(true);
    expect(later.resetAt).toBe(t0 + 10 + 1000);
  });

  it('keeps callers apart', () => {
    expect(memorySlidingWindow('a', 1000, 1, 0).allowed).toBe(true);
    expect(memorySlidingWindow('a', 1000, 1, 1).allowed).toBe(false);
    expect(memorySlidingWindow('b', 1000, 1, 1).allowed).toBe(true);
  });
});

/**
 * Redis that goes away and comes back. Every call decides for itself whether to
 * use Redis, so the limiter needs no restart to notice either: it counts in the
 * process while Redis fails, and in Redis again on the first call that works.
 */
describe('Rate limiting through an outage and back', () => {
  const env = { ...process.env };

  /** A Redis that knows the few commands the sliding window uses, and can be made to fail. */
  function fakeRedis() {
    const sets = new Map<string, Array<{ score: number; member: string }>>();
    const state = { fail: false, windowCalls: 0 };
    const client = {
      state,
      sets,
      pipeline() {
        const ops: Array<() => unknown> = [];
        const chain: any = {
          zremrangebyscore(key: string, min: number, max: number) {
            ops.push(() => {
              sets.set(key, (sets.get(key) ?? []).filter((entry) => entry.score < min || entry.score > max));
              return 0;
            });
            return chain;
          },
          zcard(key: string) {
            ops.push(() => (sets.get(key) ?? []).length);
            return chain;
          },
          zadd(key: string, score: string, member: string) {
            ops.push(() => {
              sets.set(key, [...(sets.get(key) ?? []), { score: Number(score), member }]);
              return 1;
            });
            return chain;
          },
          expire() {
            ops.push(() => 1);
            return chain;
          },
          async exec() {
            state.windowCalls += 1;
            if (state.fail) throw new Error('connection lost');
            return ops.map((op) => [null, op()]);
          },
        };
        return chain;
      },
      async zrange(key: string) {
        const entries = sets.get(key) ?? [];
        return entries.length ? [entries[0].member, String(entries[0].score)] : [];
      },
    };
    return client;
  }

  beforeEach(() => {
    resetMemoryRateLimits();
    process.env.REDIS_URL = 'redis://stand-in:6379';
  });

  afterEach(() => {
    process.env = { ...env };
    (getRedisClient as jest.Mock).mockReturnValue(null);
  });

  it('counts in the process while Redis fails, and still refuses', async () => {
    const redis = fakeRedis();
    redis.state.fail = true;
    (getRedisClient as jest.Mock).mockReturnValue(redis);

    expect((await slidingWindowRateLimit('who', 60_000, 2)).allowed).toBe(true);
    expect((await slidingWindowRateLimit('who', 60_000, 2)).allowed).toBe(true);
    expect((await slidingWindowRateLimit('who', 60_000, 2)).allowed).toBe(false);
    expect(redis.sets.size).toBe(0);
  });

  it('goes back to counting in Redis on the first call after it recovers, without a restart', async () => {
    const redis = fakeRedis();
    (getRedisClient as jest.Mock).mockReturnValue(redis);

    redis.state.fail = true;
    await slidingWindowRateLimit('who', 60_000, 5);
    await slidingWindowRateLimit('who', 60_000, 5);
    expect(redis.sets.size).toBe(0);

    redis.state.fail = false;
    const result = await slidingWindowRateLimit('who', 60_000, 5);

    expect(result.allowed).toBe(true);
    expect(redis.sets.get('ratelimit:who')).toHaveLength(1);
  });

  it('refuses in Redis once the budget there is spent', async () => {
    const redis = fakeRedis();
    (getRedisClient as jest.Mock).mockReturnValue(redis);

    expect((await slidingWindowRateLimit('who', 60_000, 1)).allowed).toBe(true);
    expect((await slidingWindowRateLimit('who', 60_000, 1)).allowed).toBe(false);
  });
});
