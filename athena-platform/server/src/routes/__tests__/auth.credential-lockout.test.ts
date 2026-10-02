/**
 * The credential checks behind a session count their failures.
 *
 * Changing the password, turning two-factor on or off and minting new recovery
 * codes each ask for the current password or an authenticator code. They
 * answered a wrong one as often as it was asked and never counted it, under
 * only the general limit of a hundred requests in fifteen minutes, so a stolen
 * access token (or a phone left unlocked) could guess the password that guards
 * everything else, and a six-digit code is a million guesses. Five wrong
 * answers across the four routes now lock all four for fifteen minutes, per
 * member, counted in the sign-in lockout's store but in a bucket of their own.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

process.env.RATE_LIMIT_ENABLED = 'false';
delete process.env.REDIS_URL;

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  ...(jest.requireActual('../../middleware/auth') as object),
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'user-1', role: 'USER', sessionId: 'session-1', email: 'her@example.com' };
    next();
  },
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

// A code is right only when a test says so.
const mockMatchTotpStep = jest.fn<(code: string, secret: string) => number | null>(() => null);
jest.mock('../../utils/totp', () => ({
  ...(jest.requireActual('../../utils/totp') as object),
  matchTotpStep: (code: string, secret: string) => mockMatchTotpStep(code, secret),
}));
jest.mock('../../utils/totp-replay', () => ({ claimTotpStep: jest.fn(async () => true) }));
jest.mock('../../utils/secret-box', () => ({
  ...(jest.requireActual('../../utils/secret-box') as object),
  openSecret: (stored: string) => stored,
  sealSecret: (plain: string) => plain,
}));

jest.mock('../../services/session.service', () => ({
  RefreshConflictError: class RefreshConflictError extends Error {},
  sessionService: {
    revokeAllUserSessions: jest.fn(async () => undefined),
    createSession: jest.fn(async () => ({ id: 'session-1' })),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { comparePassword } from '../../utils/password';
import { getLockoutStatus, resetLoginAttemptMemory } from '../../utils/loginAttempts';

const prisma: any = prismaTyped;
const compare: any = comparePassword;

const PASSWORD = 'Right-Passw0rd!1';
const NEW_PASSWORD = 'Brand-New-Passw0rd!2';

function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    passwordHash: `hashed:${PASSWORD}`,
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    twoFactorRecoveryCodes: [],
    ...overrides,
  };
}

const wrongPassword = () => request(app).post('/api/auth/change-password').send({ currentPassword: 'Wrong-Passw0rd!9', newPassword: NEW_PASSWORD });
const rightPassword = () => request(app).post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
const disable = (body: Record<string, unknown>) => request(app).post('/api/auth/2fa/disable').send(body);
const recoveryCodes = (body: Record<string, unknown>) => request(app).post('/api/auth/2fa/recovery-codes').send(body);
// With the right password: turning it on asks for one, and these are about the code.
const enable = (code = '000000', currentPassword: string = PASSWORD) =>
  request(app).post('/api/auth/2fa/enable').send({ code, currentPassword });

beforeEach(() => {
  jest.clearAllMocks();
  resetLoginAttemptMemory();
  mockMatchTotpStep.mockReturnValue(null);
  prisma.user.findUnique.mockResolvedValue(memberRow());
});

describe('change-password', () => {
  it('answers a wrong current password 403 until the fifth wrong one, which locks it for fifteen minutes', async () => {
    // 403 and not 401: neither client lists this route among the ones a 401
    // means "wrong password" for, so a 401 made them refresh the session and
    // send the same wrong password again, spending two attempts for one slip.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await wrongPassword().expect(403);
      expect(res.body.message).toBe('Current password is incorrect');
    }

    const locking = await wrongPassword().expect(429);
    expect(locking.body.message).toMatch(/Too many incorrect attempts\. Try again in 15 minutes\./);
  });

  it('refuses even the right password while locked, without comparing anything', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) await wrongPassword();
    compare.mockClear();
    prisma.user.findUnique.mockClear();

    await rightPassword().expect(429);

    expect(compare).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('forgets the failures when the right password is given', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) await wrongPassword().expect(403);

    await rightPassword().expect(200);

    // The count started again: four more wrong ones are still only 403s.
    for (let attempt = 1; attempt <= 4; attempt += 1) await wrongPassword().expect(403);
  });
});

describe('the four routes share one budget per member', () => {
  it('locks change-password, both two-factor routes that take a code, and enable together', async () => {
    // 403 and not 401 on all four: a client answers a 401 by refreshing its
    // session and sending the request again, which would count one mistyped
    // password twice against the five.
    await wrongPassword().expect(403);
    await disable({ currentPassword: 'Wrong-Passw0rd!9' }).expect(403);
    await recoveryCodes({ currentPassword: 'Wrong-Passw0rd!9' }).expect(403);
    await disable({ currentPassword: PASSWORD, code: '123456' }).expect(400);
    // The fifth wrong answer, wherever it comes, is the one that locks.
    await recoveryCodes({ currentPassword: PASSWORD, code: '123456' }).expect(429);

    await rightPassword().expect(429);
    await enable().expect(429);
    await disable({ currentPassword: PASSWORD, code: '123456' }).expect(429);
    await recoveryCodes({ currentPassword: PASSWORD, code: '123456' }).expect(429);
  });

  it('counts a wrong authenticator code on enable', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await enable().expect(400);
    }

    await enable().expect(429);
  });

  it('does not count a code that is right, and a right one clears the count', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await disable({ currentPassword: PASSWORD, code: '123456' }).expect(400);
    }

    mockMatchTotpStep.mockReturnValue(1234);
    await disable({ currentPassword: PASSWORD, code: '123456' }).expect(200);

    // The four wrong ones are forgotten: four more still only get refused.
    mockMatchTotpStep.mockReturnValue(null);
    prisma.user.findUnique.mockResolvedValue(memberRow());
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await disable({ currentPassword: PASSWORD, code: '123456' }).expect(400);
    }
  });

  it('is not tripped by right answers however many there are', async () => {
    mockMatchTotpStep.mockReturnValue(1234);
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await disable({ currentPassword: PASSWORD, code: '123456' }).expect(200);
    }
  });

  it('keeps one member\'s failures from locking another', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) await wrongPassword();
    await wrongPassword().expect(429);

    prisma.user.findUnique.mockResolvedValue(memberRow({ id: 'user-2' }));
    await request(app)
      .post('/api/auth/change-password')
      .set('x-test-user', 'user-2')
      .send({ currentPassword: 'Wrong-Passw0rd!9', newPassword: NEW_PASSWORD })
      .expect(403);
  });
});

describe('what a session holder can and cannot do to sign-in', () => {
  it('keeps the count apart from the sign-in lockout, so failing here never locks her out of signing in', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) await wrongPassword();
    await wrongPassword().expect(429);

    // The sign-in bucket is keyed by address and caller; nothing was recorded there.
    await expect(getLockoutStatus('her@example.com', '::ffff:127.0.0.1')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    await expect(getLockoutStatus('her@example.com', '127.0.0.1')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    // And the credential-check bucket is the one that holds the lock.
    await expect(getLockoutStatus('credential-check:user-1')).resolves.toMatchObject({ locked: true });
  });
});
