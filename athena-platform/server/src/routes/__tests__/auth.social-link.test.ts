/**
 * The Google and Facebook doors, and the check on the password one.
 *
 * Linking a provider used to write the provider id onto an account with a raw
 * UPDATE before asking whether the account could be signed into that way at
 * all. A Google request that matched a suspended account, or one guarded by a
 * second factor, was refused — after it had attached a new way in. These hold
 * the order: refusals first, nothing written for a refused request, the link
 * written through Prisma so a collision is a 409 rather than a Postgres error,
 * and a row saying it happened.
 *
 * The last block is the human check on password sign-up, which is enforced
 * only when TURNSTILE_SECRET_KEY is set and has to stop a script before the
 * database is ever asked about the address.
 */

import request from 'supertest';
import { Prisma } from '@prisma/client';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

process.env.GOOGLE_CLIENT_ID = 'athena-google-client';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn(async () => ({})) },
    appeal: { findFirst: jest.fn(async () => null), create: jest.fn() },
    notification: { createMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

jest.mock('../../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../../services/session.service', () => ({
  sessionService: { createSession: jest.fn(async () => ({ id: 'session-1' })) },
}));

jest.mock('../../services/login-alert.service', () => ({
  noteSignIn: jest.fn(async () => undefined),
}));

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

const prisma: any = prismaTyped;
const realFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

const GOOGLE_SUB = 'google-sub-123';

function googleSaysItIs(email = 'her@example.com') {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        sub: GOOGLE_SUB,
        aud: 'athena-google-client',
        email,
        email_verified: 'true',
        given_name: 'Her',
        family_name: 'Self',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  );
}

function account(overrides: Record<string, unknown> = {}) {
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
    twoFactorEnabled: false,
    emailVerified: true,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    googleId: null,
    facebookId: null,
    passwordHash: 'hashed:her-own',
    ...overrides,
  };
}

/** Nothing is linked to this Google id yet; the address belongs to `byEmail`. */
function lookups(byEmail: Record<string, unknown> | null) {
  prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.googleId || where.facebookId) return null;
    if (where.email) return byEmail;
    return null;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.TURNSTILE_SECRET_KEY;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('POST /api/auth/google on an existing account', () => {
  it('refuses a suspended account without writing anything onto it', async () => {
    googleSaysItIs();
    lookups(account({ isSuspended: true }));

    await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(403);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses an account behind a second factor without linking Google to it first', async () => {
    googleSaysItIs();
    lookups(account({ twoFactorEnabled: true }));

    const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(401);

    expect(res.body.message).toMatch(/Two-factor code required/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('links Google through Prisma, keeps the verified date, and records the link', async () => {
    googleSaysItIs();
    const existing = account();
    lookups(existing);
    prisma.user.update.mockResolvedValue(account({ googleId: GOOGLE_SUB }));

    await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(200);

    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.googleId).toBe(GOOGLE_SUB);
    expect(data.emailVerifiedAt).toEqual(existing.emailVerifiedAt);
    // Her own password, on an address she had already proved, stays.
    expect(data).not.toHaveProperty('passwordHash');
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({
      accountAction: 'SIGN_IN_PROVIDER_LINKED',
      provider: 'Google',
      clearedUnprovenPassword: false,
    });
  });

  it('drops a password set on her address before anyone proved it was hers', async () => {
    // Someone registers her address first and waits. When she arrives
    // through Google, the password they chose must not open her account.
    googleSaysItIs();
    lookups(account({ emailVerified: false, emailVerifiedAt: null, passwordHash: 'hashed:not-hers' }));
    prisma.user.update.mockResolvedValue(account({ googleId: GOOGLE_SUB }));

    await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(200);

    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.passwordHash).toBeNull();
    expect(data.emailVerified).toBe(true);
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({ clearedUnprovenPassword: true });
  });

  it('refuses to move an account onto a second Google identity', async () => {
    googleSaysItIs();
    lookups(account({ googleId: 'some-other-google-account' }));

    await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(409);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('answers a provider id collision with a 409, not a database error', async () => {
    googleSaysItIs();
    lookups(account());
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['googleId'] },
      })
    );

    const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' }).expect(409);

    expect(res.body.message).toMatch(/already linked to a different ATHENA account/);
  });
});

describe('POST /api/auth/google creating an account', () => {
  it('writes the Google id with the account rather than afterwards', async () => {
    googleSaysItIs('new@example.com');
    lookups(null);
    prisma.user.create.mockResolvedValue(account({ id: 'new-account', email: 'new@example.com' }));

    await request(app)
      .post('/api/auth/google')
      .send({ credential: 'id-token', mode: 'register', womanSelfAttested: true, dateOfBirth: '1990-04-01' })
      .expect(201);

    expect(prisma.user.create.mock.calls[0][0].data.googleId).toBe(GOOGLE_SUB);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('the human check on password sign-up', () => {
  const body = {
    email: 'new@example.com',
    password: 'A-long-passphrase-1!',
    firstName: 'New',
    lastName: 'Member',
    womanSelfAttested: true,
    dateOfBirth: '1990-04-01',
  };

  it('stops a sign-up with no token before the address is looked up', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';

    const res = await request(app).post('/api/auth/register').send(body).expect(400);

    expect(res.body.message).toMatch(/check that you are a person/);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a token Cloudflare does not accept', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 }));

    await request(app).post('/api/auth/register').send({ ...body, humanCheckToken: 'forged' }).expect(400);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(String((init as RequestInit).body)).toContain('secret=test-secret');
  });

  it('says the check is on our side when Cloudflare cannot be reached, and does not let the sign-up through', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    fetchMock.mockRejectedValue(new Error('network down'));

    await request(app).post('/api/auth/register').send({ ...body, humanCheckToken: 'token' }).expect(503);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('lets a passed check through to the ordinary sign-up rules', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    prisma.user.findUnique.mockResolvedValue(account({ email: 'new@example.com' }));

    // The address is taken, which is the first thing the ordinary rules check.
    await request(app).post('/api/auth/register').send({ ...body, humanCheckToken: 'token' }).expect(409);
  });

  it('is not asked for where no key is configured', async () => {
    prisma.user.findUnique.mockResolvedValue(account({ email: 'new@example.com' }));

    await request(app).post('/api/auth/register').send(body).expect(409);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/suspension-appeal', () => {
  const appeal = { email: 'her@example.com', password: 'her-own', reason: 'I was reported by my ex-partner to get me off here.' };

  it('files the appeal a suspended member could never send, against her own account, without signing her in', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her-account', passwordHash: 'hashed:her-own', isSuspended: true });
    prisma.appeal.create.mockImplementation(async ({ data }: any) => ({ id: 'appeal-1', status: data.status, createdAt: new Date() }));

    const res = await request(app).post('/api/auth/suspension-appeal').send(appeal).expect(201);

    expect(prisma.appeal.create.mock.calls[0][0].data).toMatchObject({
      userId: 'her-account',
      type: 'ACCOUNT_SUSPENSION',
      status: 'PENDING',
      reason: appeal.reason,
    });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.data).not.toHaveProperty('accessToken');
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'USER_APPEAL_SUBMIT', targetUserId: 'her-account' });
  });

  it('proves the account is hers the way sign-in does, and counts a wrong password as a failed sign-in', async () => {
    const { recordFailedLogin } = jest.requireMock('../../utils/loginAttempts') as { recordFailedLogin: jest.Mock };
    prisma.user.findUnique.mockResolvedValue({ id: 'her-account', passwordHash: 'hashed:her-own', isSuspended: true });

    const res = await request(app).post('/api/auth/suspension-appeal').send({ ...appeal, password: 'a-guess' }).expect(401);

    expect(res.body.message).toBe('Invalid email or password');
    expect(recordFailedLogin).toHaveBeenCalled();
    expect(prisma.appeal.create).not.toHaveBeenCalled();
  });

  it('sends an account that is not suspended to sign in instead', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her-account', passwordHash: 'hashed:her-own', isSuspended: false });

    await request(app).post('/api/auth/suspension-appeal').send(appeal).expect(409);
    expect(prisma.appeal.create).not.toHaveBeenCalled();
  });

  it('keeps one appeal waiting at a time', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her-account', passwordHash: 'hashed:her-own', isSuspended: true });
    prisma.appeal.findFirst.mockResolvedValueOnce({ id: 'appeal-0' });

    await request(app).post('/api/auth/suspension-appeal').send(appeal).expect(409);
    expect(prisma.appeal.create).not.toHaveBeenCalled();
  });

  it('asks for at least a sentence', async () => {
    await request(app).post('/api/auth/suspension-appeal').send({ ...appeal, reason: 'no' }).expect(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
