/**
 * A ban that holds at the door.
 *
 * Banning an account used to suspend that one row, so the person banned for
 * threatening a member could register again the same afternoon with the same
 * address, or with a "+2" in it. Every path that creates an account now asks
 * the ban list first — the email form, Google and Facebook — and the refusal
 * says only that the address cannot be used. It never says the address was
 * banned: anyone can type someone else's address into a sign-up form.
 *
 * The ban service runs for real here, keyed hash and all; only the table it
 * reads is mocked, so a change to how addresses are normalised or hashed is
 * caught by these tests too.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

process.env.GOOGLE_CLIENT_ID = 'athena-google-client';
process.env.FACEBOOK_APP_ID = 'athena-facebook-app';
process.env.FACEBOOK_APP_SECRET = 'athena-facebook-secret';
process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn(async () => []) },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    verificationToken: { create: jest.fn(async () => ({})) },
    auditLog: { create: jest.fn(async () => ({})) },
    notification: { createMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
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
import { BANNED_REGISTRATION_MESSAGE, hashEmailForBan } from '../../services/banned-identity.service';

const prisma: any = prismaTyped;
const realFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

/** The ban list holds exactly these addresses, as the service would have written them. */
function banned(...emails: string[]) {
  const hashes = new Set(emails.map((email) => hashEmailForBan(email)));
  prisma.bannedIdentity.findUnique.mockImplementation(async ({ where }: any) =>
    hashes.has(where.emailHash) ? { id: 'ban-1' } : null
  );
}

function newAccount(email: string) {
  return {
    id: 'new-account',
    email,
    firstName: 'New',
    lastName: 'Member',
    displayName: 'New Member',
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
  };
}

/** Nobody holds the address or the provider id yet. */
function noExistingAccount() {
  prisma.user.findUnique.mockResolvedValue(null);
}

const registration = {
  email: 'him+again@example.com',
  password: 'A-long-passphrase-1!',
  firstName: 'New',
  lastName: 'Member',
  womanSelfAttested: true,
  dateOfBirth: '1990-04-01',
};

function googleSaysItIs(email: string) {
  fetchMock.mockResolvedValue(
    json({ sub: 'google-sub-9', aud: 'athena-google-client', email, email_verified: 'true', given_name: 'New', family_name: 'Member' })
  );
}

function facebookSaysItIs(email: string) {
  fetchMock
    .mockResolvedValueOnce(json({ data: { app_id: 'athena-facebook-app', is_valid: true, user_id: 'fb-9' } }))
    .mockResolvedValueOnce(json({ id: 'fb-9', email, first_name: 'New', last_name: 'Member', name: 'New Member' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.TURNSTILE_SECRET_KEY;
  prisma.bannedIdentity.findUnique.mockResolvedValue(null);
  noExistingAccount();
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('POST /api/auth/register', () => {
  it('refuses a banned address even with a +tag added, and says only that it cannot be used', async () => {
    banned('him@example.com');

    const res = await request(app).post('/api/auth/register').send(registration).expect(403);

    expect(res.body.message).toBe(BANNED_REGISTRATION_MESSAGE);
    expect(JSON.stringify(res.body)).not.toMatch(/bann/i);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it('lets an address nobody banned register as before', async () => {
    banned('someone-else@example.com');
    prisma.user.create.mockResolvedValue(newAccount('him+again@example.com'));

    await request(app).post('/api/auth/register').send(registration).expect(201);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  it('refuses rather than registering when the ban list cannot be read', async () => {
    prisma.bannedIdentity.findUnique.mockRejectedValue(new Error('database unavailable'));

    await request(app).post('/api/auth/register').send(registration).expect(500);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/google creating an account', () => {
  it('refuses a banned address, and creates nothing', async () => {
    banned('him@example.com');
    googleSaysItIs('him@example.com');

    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'id-token', mode: 'register', womanSelfAttested: true, dateOfBirth: '1990-04-01' })
      .expect(403);

    expect(res.body.message).toBe(BANNED_REGISTRATION_MESSAGE);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('still creates the account for an address nobody banned', async () => {
    googleSaysItIs('new@example.com');
    prisma.user.create.mockResolvedValue(newAccount('new@example.com'));

    await request(app)
      .post('/api/auth/google')
      .send({ credential: 'id-token', mode: 'register', womanSelfAttested: true, dateOfBirth: '1990-04-01' })
      .expect(201);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/facebook creating an account', () => {
  it('refuses a banned Gmail address written with dots, and creates nothing', async () => {
    banned('himself@gmail.com');
    facebookSaysItIs('him.self@gmail.com');

    const res = await request(app)
      .post('/api/auth/facebook')
      .send({ accessToken: 'fb-token', mode: 'register', womanSelfAttested: true, dateOfBirth: '1990-04-01' })
      .expect(403);

    expect(res.body.message).toBe(BANNED_REGISTRATION_MESSAGE);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('still creates the account for an address nobody banned', async () => {
    facebookSaysItIs('new@example.com');
    prisma.user.create.mockResolvedValue(newAccount('new@example.com'));

    await request(app)
      .post('/api/auth/facebook')
      .send({ accessToken: 'fb-token', mode: 'register', womanSelfAttested: true, dateOfBirth: '1990-04-01' })
      .expect(201);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });
});
