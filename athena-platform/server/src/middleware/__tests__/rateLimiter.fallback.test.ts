import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// No Redis at all: the limiter must still limit.
jest.mock('../../utils/cache', () => ({ getRedisClient: jest.fn(() => null) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createRateLimiter, memorySlidingWindow, resetMemoryRateLimits } from '../rateLimiter';

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
