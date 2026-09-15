import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../redis', () => ({
  redis: null,
  isRedisAvailable: () => false,
  ensureRedisConnected: async () => false,
}));

import { CounterClient, SharedRateLimitStore } from '../rate-limit-store';

/** A Redis that only knows INCR, PTTL, PEXPIRE, DECR and DEL, in memory. */
function fakeRedis(): CounterClient & { keys: Map<string, { value: number; expiresAt: number | null }>; fail: boolean } {
  const keys = new Map<string, { value: number; expiresAt: number | null }>();
  const fake = {
    keys,
    fail: false,
    multi() {
      const ops: Array<() => unknown> = [];
      const chain = {
        incr(key: string) {
          ops.push(() => {
            const entry = keys.get(key) ?? { value: 0, expiresAt: null };
            entry.value += 1;
            keys.set(key, entry);
            return entry.value;
          });
          return chain;
        },
        pttl(key: string) {
          ops.push(() => {
            const entry = keys.get(key);
            if (!entry) return -2;
            return entry.expiresAt === null ? -1 : Math.max(0, entry.expiresAt - Date.now());
          });
          return chain;
        },
        async exec() {
          if (fake.fail) throw new Error('connection lost');
          return ops.map((op) => [null, op()] as [Error | null, unknown]);
        },
      };
      return chain;
    },
    async pexpire(key: string, ms: number) {
      const entry = keys.get(key);
      if (entry) entry.expiresAt = Date.now() + ms;
      return 1;
    },
    async decr(key: string) {
      const entry = keys.get(key);
      if (entry) entry.value -= 1;
      return entry?.value ?? 0;
    },
    async del(key: string) {
      return keys.delete(key) ? 1 : 0;
    },
  };
  return fake;
}

function appWith(store: SharedRateLimitStore, max: number) {
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, max, store, standardHeaders: true, legacyHeaders: false, keyGenerator: () => 'same-caller', validate: false }));
  app.get('/', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('SharedRateLimitStore', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  it('counts in Redis when it is there, sharing the budget under one prefix', async () => {
    const client = fakeRedis();
    const store = new SharedRateLimitStore('rl:test:', { client, available: () => true });
    const app = appWith(store, 2);

    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
    const refused = await request(app).get('/').expect(429);
    expect(refused.headers['ratelimit-remaining']).toBe('0');
    expect(client.keys.get('rl:test:same-caller')?.value).toBe(3);
    expect(client.keys.get('rl:test:same-caller')?.expiresAt).not.toBeNull();
  });

  it('falls back to the process when Redis fails, and still refuses', async () => {
    const client = fakeRedis();
    client.fail = true;
    const store = new SharedRateLimitStore('rl:test:', { client, available: () => true });
    const app = appWith(store, 1);

    await request(app).get('/').expect(200);
    await request(app).get('/').expect(429);
  });

  it('counts in the process when Redis is not configured at all', async () => {
    const store = new SharedRateLimitStore('rl:test:');
    const app = appWith(store, 1);
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(429);
  });

  it('starts a new window once the old one has passed, and can forget a caller', async () => {
    const store = new SharedRateLimitStore('rl:test:', { client: null });
    store.init({ windowMs: 1000 } as any);
    const t0 = 5_000_000;
    expect(store.memoryIncrement('k', t0).totalHits).toBe(1);
    expect(store.memoryIncrement('k', t0 + 10).totalHits).toBe(2);
    expect(store.memoryIncrement('k', t0 + 1001).totalHits).toBe(1);

    await store.resetKey('k');
    expect(store.memoryIncrement('k', t0 + 1002).totalHits).toBe(1);
    await store.decrement('k');
    expect(store.memoryIncrement('k', t0 + 1003).totalHits).toBe(1);
  });
});
