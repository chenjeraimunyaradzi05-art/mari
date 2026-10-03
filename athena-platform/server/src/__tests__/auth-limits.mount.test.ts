/**
 * The limiters are mounted, not just defined.
 *
 * The overall budget used to be a single address limiter, and a second, tiered
 * one sat defined in middleware/rateLimiter.ts and was mounted nowhere, which
 * nothing could notice because no test sent the real app a request and looked
 * at what the limiters did. These do, through src/index.ts as it is mounted:
 * the budget that follows the caller, sign-in and sign-up on counters of their
 * own, and the password-reset limit.
 *
 * Outside production the numbers are relaxed (an anonymous address gets 2000
 * calls, sign-in 100); what is checked here is that each limiter is in front of
 * the route it is meant for and counts what it is meant to count. The
 * production numbers are checked where the limiters are built
 * (middleware/__tests__/apiBudget.test.ts).
 */

import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

delete process.env.METRICS_TOKEN;

import { app } from '../index';
import { generateAccessToken } from '../utils/jwt';

const token = (userId: string, role = 'USER') =>
  generateAccessToken({ userId, email: `${userId}@athena.test`, role, persona: 'EARLY_CAREER' });

describe('the overall API budget', () => {
  it('is in front of /api, and counts an address with no token as anonymous', async () => {
    const res = await request(app).get('/api/maintenance');

    expect(res.headers['ratelimit-limit']).toBe('2000');
    expect(res.headers['x-ratelimit-limit']).toBe('2000');
  });

  it('counts a signed-in member under a budget of her own, larger than an address gets', async () => {
    const anonymous = await request(app).get('/api/maintenance');
    const member = await request(app).get('/api/maintenance').set('Authorization', `Bearer ${token('ada')}`);
    const staff = await request(app).get('/api/maintenance').set('Authorization', `Bearer ${token('mod', 'MODERATOR')}`);

    expect(Number(member.headers['ratelimit-limit'])).toBeGreaterThan(Number(anonymous.headers['ratelimit-limit']));
    expect(Number(staff.headers['ratelimit-limit'])).toBeGreaterThan(Number(member.headers['ratelimit-limit']));
  });

  it('does not let a forged token claim the member budget', async () => {
    const res = await request(app).get('/api/maintenance').set('Authorization', 'Bearer not.a.token');

    expect(res.headers['ratelimit-limit']).toBe('2000');
  });

  it('leaves the metrics scrape and the health probes outside /api alone', async () => {
    const res = await request(app).get('/livez');
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});

describe('the credential limiters', () => {
  it('count sign-in and sign-up on separate counters', async () => {
    // 100 sign-in attempts outside production. Each is refused as invalid, which
    // is after the limiter has counted it.
    let last = 0;
    for (let i = 0; i < 101; i += 1) {
      last = (await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' })).status;
    }
    expect(last).toBe(429);

    // Signing up is on its own counter, so it is still answered (as invalid).
    const register = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });
    expect(register.status).toBe(400);
  }, 60_000);

  it('limit password reset to a handful an hour', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' })).status);
    }

    expect(statuses.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
