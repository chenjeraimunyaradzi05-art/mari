/**
 * The second factor on the Google and Facebook doors.
 *
 * A member with two-factor on was refused on both with "sign in with email and
 * password". For a member who joined with Google or Facebook, and so has no
 * password, that was no way in at all: the only road back to her own account was
 * the reset-password email. The doors now take `twoFactorCode` (an authenticator
 * code or an unused recovery code) alongside the same provider credential, and
 * check it before anything is written to the account. The provider's proof is
 * the first factor; a provider login on its own still never opens a protected
 * account.
 */

import request from 'supertest';
import crypto from 'crypto';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

process.env.GOOGLE_CLIENT_ID = 'athena-google-client';
process.env.FACEBOOK_APP_ID = 'athena-fb-app';
process.env.FACEBOOK_APP_SECRET = 'athena-fb-secret';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/=|\s|-/g, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function currentCode(secret = SECRET): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn(), findMany: jest.fn(async () => []) },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    auditLog: { create: jest.fn(async () => ({})) },
    appeal: { findFirst: jest.fn(async () => null), create: jest.fn() },
    notification: { createMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../utils/secret-box', () => ({
  sealSecret: (plain: string) => `sealed:${plain}`,
  openSecret: (stored: string | null | undefined) =>
    typeof stored === 'string' && stored.startsWith('sealed:') ? stored.slice('sealed:'.length) : null,
  isSealed: (value: string | null | undefined) => typeof value === 'string' && value.startsWith('sealed:'),
}));

const claimStep = jest.fn<(userId: string, step: number) => Promise<boolean>>(async () => true);
jest.mock('../../utils/totp-replay', () => ({
  claimTotpStep: (userId: string, step: number) => claimStep(userId, step),
  resetTotpReplayMemory: jest.fn(),
  TOTP_REPLAY_TTL_SECONDS: 120,
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

const lockout = { locked: false, retryAfterSeconds: 0 };
jest.mock('../../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => lockout),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../../services/session.service', () => ({
  sessionService: { createSession: jest.fn(async () => ({ id: 'session-1' })) },
}));

jest.mock('../../services/login-alert.service', () => ({ noteSignIn: jest.fn(async () => undefined) }));

jest.mock('../../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sessionService } from '../../services/session.service';
import { recordFailedLogin } from '../../utils/loginAttempts';

const prisma: any = prismaTyped;
const failedLogin = recordFailedLogin as unknown as jest.Mock;
const createSession = sessionService.createSession as unknown as jest.Mock;
const realFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

const GOOGLE_SUB = 'google-sub-2fa';
const FACEBOOK_ID = 'fb-id-2fa';
const SAVED_CODE = 'ABCDE-FGHJK';
const hashOf = (printed: string) => `hashed:${printed.replace(/-/g, '')}`;

let recoveryCodes: string[];

/** A member who joined with a provider: no password, two-factor on, an address the provider vouches for. */
function protectedAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'her-account',
    email: 'her@example.com',
    firstName: 'Her',
    lastName: 'Self',
    displayName: 'Her Self',
    avatar: null,
    role: 'USER',
    persona: 'EARLY_CAREER',
    preferredLocale: 'en-AU',
    preferredCurrency: 'AUD',
    timezone: 'Australia/Brisbane',
    region: 'ANZ',
    referralCode: 'ABC',
    referralCredits: 0,
    womanSelfAttested: true,
    womanVerificationStatus: 'UNVERIFIED',
    country: 'AU',
    isPublic: true,
    allowMessages: true,
    isSuspended: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    twoFactorEnabled: true,
    twoFactorSecret: `sealed:${SECRET}`,
    twoFactorRecoveryCodes: [...recoveryCodes],
    emailVerified: true,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    googleId: GOOGLE_SUB,
    facebookId: FACEBOOK_ID,
    passwordHash: null,
    lockedAt: null,
    ...overrides,
  };
}

/** What the sign-in goes on to write, and hands back, once the code is accepted. */
function updated(account: Record<string, unknown>) {
  const { twoFactorSecret: _s, twoFactorRecoveryCodes: _c, passwordHash: _p, lockedAt: _l, ...rest } = account;
  void _s;
  void _c;
  void _p;
  void _l;
  return rest;
}

function googleSaysItIs() {
  // A new Response each time: a body can be read only once, and a test may sign in twice.
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          sub: GOOGLE_SUB,
          aud: 'athena-google-client',
          email: 'her@example.com',
          email_verified: 'true',
          given_name: 'Her',
          family_name: 'Self',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
  );
}

function facebookSaysItIs() {
  fetchMock.mockImplementation(async (input: any) => {
    const url = String(input);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes('/debug_token')) return json({ data: { app_id: 'athena-fb-app', is_valid: true, user_id: FACEBOOK_ID } });
    return json({ id: FACEBOOK_ID, email: 'her@example.com', first_name: 'Her', last_name: 'Self', name: 'Her Self' });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  lockout.locked = false;
  claimStep.mockResolvedValue(true);
  recoveryCodes = [hashOf(SAVED_CODE)];
  // The provider id is already linked, so the account is found by it.
  prisma.user.findUnique.mockImplementation(async () => protectedAccount());
  prisma.user.update.mockImplementation(async () => updated(protectedAccount()));
  prisma.user.updateMany.mockImplementation(async ({ where, data }: any) => {
    const wanted = where?.twoFactorRecoveryCodes?.has;
    if (!recoveryCodes.includes(wanted)) return { count: 0 };
    recoveryCodes = data.twoFactorRecoveryCodes.set;
    return { count: 1 };
  });
});

afterAll(() => {
  global.fetch = realFetch;
});

const DOORS = [
  {
    name: 'Google',
    path: '/api/auth/google',
    credential: { credential: 'id-token' },
    arrange: googleSaysItIs,
  },
  {
    name: 'Facebook',
    path: '/api/auth/facebook',
    credential: { accessToken: 'fb-token' },
    arrange: facebookSaysItIs,
  },
] as const;

describe.each(DOORS)('POST $path for a member with two-factor on', ({ name, path, credential, arrange }) => {
  const door = (extra: Record<string, unknown> = {}) => request(app).post(path).send({ ...credential, ...extra });

  beforeEach(() => arrange());

  it(`asks for the code instead of turning her away to a password she does not have, and writes nothing (${name})`, async () => {
    const res = await door().expect(401);

    expect(res.body.message).toBe('Two-factor code required');
    expect(res.body.message).not.toMatch(/password/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    // She has not been asked yet, which is not a wrong answer.
    expect(failedLogin).not.toHaveBeenCalled();
  });

  it(`signs her in with the same credential and a live authenticator code (${name})`, async () => {
    const res = await door({ twoFactorCode: currentCode() }).expect(200);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(createSession).toHaveBeenCalledTimes(1);
    // Never a secret in what comes back.
    expect(JSON.stringify(res.body)).not.toMatch(/twoFactorSecret|twoFactorRecoveryCodes|sealed:/);
  });

  it(`signs her in with a recovery code, which is then spent (${name})`, async () => {
    await door({ twoFactorCode: SAVED_CODE }).expect(200);

    expect(recoveryCodes).toEqual([]);
    const second = await door({ twoFactorCode: SAVED_CODE }).expect(401);
    expect(second.body.message).toBe('Invalid two-factor code');
  });

  it(`refuses a code that was already spent, and counts it (${name})`, async () => {
    claimStep.mockResolvedValue(false);

    const res = await door({ twoFactorCode: currentCode() }).expect(401);

    expect(res.body.message).toBe('Invalid two-factor code');
    expect(failedLogin).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it(`refuses a wrong code, counts it against the sign-in lockout, and writes nothing onto the account (${name})`, async () => {
    const res = await door({ twoFactorCode: '000000' }).expect(401);

    expect(res.body.message).toBe('Invalid two-factor code');
    expect(failedLogin).toHaveBeenCalledWith('her@example.com', expect.anything());
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it(`stops at 429 once the wrong answers have locked it, even for the right code (${name})`, async () => {
    lockout.locked = true;
    lockout.retryAfterSeconds = 900;

    const res = await door({ twoFactorCode: currentCode() }).expect(429);

    expect(res.body.message).toMatch(/Try again in 15 minutes/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it(`refuses a code that is not a six-digit code or a recovery code at the door (${name})`, async () => {
    await door({ twoFactorCode: '12' }).expect(400);
    await door({ twoFactorCode: 'x'.repeat(40) }).expect(400);
    await door({ twoFactorCode: 123456 }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it(`does not link the provider to an account held by an address, until the code is right (${name})`, async () => {
    // Nothing is linked to this provider id yet: the account is found by its address.
    prisma.user.findUnique.mockImplementation(async ({ where }: any) =>
      where.googleId || where.facebookId ? null : protectedAccount({ googleId: null, facebookId: null })
    );

    await door({ twoFactorCode: '000000' }).expect(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();

    await door({ twoFactorCode: currentCode() }).expect(200);
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data).toMatchObject(name === 'Google' ? { googleId: GOOGLE_SUB } : { facebookId: FACEBOOK_ID });
  });

  it(`still turns away a suspended account first, and never asks it for a code (${name})`, async () => {
    prisma.user.findUnique.mockImplementation(async () => protectedAccount({ isSuspended: true }));

    await door({ twoFactorCode: currentCode() }).expect(403);

    expect(claimStep).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it(`does not ask an account without two-factor for anything (${name})`, async () => {
    prisma.user.findUnique.mockImplementation(async () => protectedAccount({ twoFactorEnabled: false, twoFactorSecret: null }));
    prisma.user.update.mockImplementation(async () => updated(protectedAccount({ twoFactorEnabled: false })));

    await door().expect(200);

    expect(failedLogin).not.toHaveBeenCalled();
  });
});
