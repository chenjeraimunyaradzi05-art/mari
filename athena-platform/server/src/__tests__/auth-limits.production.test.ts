/**
 * The auth limiters, with the numbers production runs, on the real app.
 *
 * auth-limits.mount.test.ts proves the limiters are in front of their routes
 * with the relaxed numbers every suite outside production gets (a hundred
 * sign-in tries instead of ten). That leaves the production figures, the ones
 * the trust page and the API documentation promise, to be read off the source.
 * This runs the app with NODE_ENV=production and limits on, and counts to them:
 * ten sign-in tries and ten sign-up tries per address in fifteen minutes, ten
 * on Google and Facebook sign-in between them, thirty refreshes a minute, and
 * five password-reset requests an hour across the three reset routes.
 *
 * The password-guessing lockout has its own suites (utils/__tests__/
 * loginAttempts.test.ts, routes/__tests__/auth.credential-lockout.test.ts);
 * here it is replaced with one that never locks, so a 429 can only have come
 * from a limiter.
 */

import request from 'supertest';
import { describe, it, expect, jest } from '@jest/globals';

process.env.NODE_ENV = 'production';
delete process.env.RATE_LIMIT_ENABLED;
delete process.env.REDIS_URL;
delete process.env.RATE_LIMIT_MAX;
delete process.env.METRICS_TOKEN;
process.env.PROXY_SHARED_SECRET = 'mount-test-proxy-secret-0123456789abcdef';
process.env.GOOGLE_CLIENT_ID = 'athena-google-client';
process.env.FACEBOOK_APP_ID = 'athena-facebook-app';
process.env.FACEBOOK_APP_SECRET = 'athena-facebook-secret';

jest.mock('../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    inviteCode: { findFirst: jest.fn(async () => null) },
    verificationToken: { findFirst: jest.fn(async () => null), deleteMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    session: { findFirst: jest.fn(async () => null) },
  },
}));

jest.mock('../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendAccountExistsEmail: jest.fn(async () => true),
}));

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../index';

let nextCaller = 0;

/** A caller of its own, so one test's budget is never another's. The web host's way of naming a visitor. */
function newCaller() {
  nextCaller += 1;
  return {
    'x-athena-proxy-secret': process.env.PROXY_SHARED_SECRET as string,
    'x-athena-client-ip': `203.0.113.${nextCaller}`,
  };
}

async function hit(path: string, headers: Record<string, string>, body: Record<string, unknown> = {}) {
  return request(app).post(path).set(headers).send(body);
}

/** Sends `times` requests and returns the status of each. */
async function sendMany(path: string, headers: Record<string, string>, times: number, body: Record<string, unknown> = {}) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await hit(path, headers, body)).status);
  }
  return statuses;
}

const login = { email: 'nobody@example.com', password: 'Whatever-Passw0rd!1' };

describe('production rate limits on the auth routes', () => {
  it('limits sign-in to ten tries in fifteen minutes from one address', async () => {
    const caller = newCaller();

    const statuses = await sendMany('/api/auth/login', caller, 10, login);
    expect(statuses.every((status) => status === 401)).toBe(true);

    const refused = await hit('/api/auth/login', caller, login);
    expect(refused.status).toBe(429);
    expect(refused.body.message).toBe('Too many login attempts, please try again later.');

    // Another address has its own ten.
    expect((await hit('/api/auth/login', newCaller(), login)).status).toBe(401);
  });

  it('limits sign-up to ten as well, on a counter of its own', async () => {
    const caller = newCaller();

    const statuses = await sendMany('/api/auth/register', caller, 10, {});
    expect(statuses.every((status) => status === 400)).toBe(true);

    const refused = await hit('/api/auth/register', caller, {});
    expect(refused.status).toBe(429);
    expect(refused.body.message).toBe('Too many sign-up attempts, please try again later.');

    // A classroom signing up does not spend the budget the same people sign in with.
    expect((await hit('/api/auth/login', caller, login)).status).toBe(401);
  });

  it('limits Google sign-in to ten, and Facebook shares that budget', async () => {
    const caller = newCaller();

    const statuses = await sendMany('/api/auth/google', caller, 4, { mode: 'register' });
    expect(statuses.every((status) => status !== 429)).toBe(true);
    const more = await sendMany('/api/auth/facebook', caller, 6, { mode: 'register' });
    expect(more.every((status) => status !== 429)).toBe(true);

    const google = await hit('/api/auth/google', caller, { mode: 'register' });
    expect(google.status).toBe(429);
    expect(google.body.message).toBe('Too many sign-in attempts, please try again later.');
    expect((await hit('/api/auth/facebook', caller, { mode: 'register' })).status).toBe(429);

    // Password sign-in is a different budget and is still open.
    expect((await hit('/api/auth/login', caller, login)).status).toBe(401);
  });

  it('limits refresh to thirty a minute', async () => {
    const caller = newCaller();

    const statuses = await sendMany('/api/auth/refresh', caller, 30, {});
    expect(statuses.every((status) => status !== 429)).toBe(true);

    const refused = await hit('/api/auth/refresh', caller, {});
    expect(refused.status).toBe(429);
    expect(refused.body.message).toBe('Too many refresh requests, please slow down.');
  });

  it('gives forgot-password, resend-verification and reset-password five an hour between them', async () => {
    const caller = newCaller();
    const address = { email: 'nobody@example.com' };

    expect((await hit('/api/auth/forgot-password', caller, address)).status).toBe(200);
    expect((await hit('/api/auth/forgot-password', caller, address)).status).toBe(200);
    expect((await hit('/api/auth/resend-verification', caller, address)).status).toBe(200);
    expect((await hit('/api/auth/resend-verification', caller, address)).status).toBe(200);
    expect((await hit('/api/auth/reset-password', caller, { token: 'x'.repeat(64), password: 'Brand-New-Passw0rd!2' })).status).not.toBe(429);

    // The sixth, on any of the three, is refused: one budget, not three.
    for (const path of ['/api/auth/forgot-password', '/api/auth/resend-verification', '/api/auth/reset-password']) {
      const refused = await hit(path, caller, address);
      expect(refused.status).toBe(429);
      expect(refused.body.message).toBe('Too many password reset attempts, please try again later.');
    }

    // Another address is unaffected.
    expect((await hit('/api/auth/forgot-password', newCaller(), address)).status).toBe(200);
  });
});
