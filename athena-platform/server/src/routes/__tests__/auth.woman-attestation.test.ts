/**
 * The women-only attestation, at every door that creates an account.
 *
 * ATHENA is a space for women, and the only thing a new account is asked is to
 * say so. That sentence is only worth anything if nothing creates an account
 * without it: not the email form with the field left out or sent as something
 * that merely looks true, not Google, not Facebook, and not a sign-up that
 * arrives with an invite code. Each refusal has to happen before anything is
 * written — before the account, before the invite is spent, before an email
 * goes out — so a refused attempt leaves no trace to clean up.
 *
 * A returning member signing in through Google or Facebook is not asked again:
 * she attested when she registered, and the box is collected nowhere else.
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
    inviteCode: { findFirst: jest.fn(), updateMany: jest.fn() },
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
import { sendVerificationEmail, sendWelcomeEmail } from '../../utils/email';

const prisma: any = prismaTyped;
const sendVerification: any = sendVerificationEmail;
const sendWelcome: any = sendWelcomeEmail;
const realFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

function memberRow(email: string) {
  return {
    id: 'member-1',
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
    emailVerified: true,
    emailVerifiedAt: new Date(),
    googleId: 'google-sub-1',
    facebookId: 'fb-1',
    passwordHash: null,
  };
}

const registration = {
  email: 'new.member@example.com',
  password: 'A-long-passphrase-1!',
  firstName: 'New',
  lastName: 'Member',
  dateOfBirth: '1990-04-01',
};

function googleSaysItIs(email: string) {
  fetchMock.mockResolvedValue(
    json({ sub: 'google-sub-1', aud: 'athena-google-client', email, email_verified: 'true', given_name: 'New', family_name: 'Member' })
  );
}

function facebookSaysItIs(email: string) {
  fetchMock
    .mockResolvedValueOnce(json({ data: { app_id: 'athena-facebook-app', is_valid: true, user_id: 'fb-1' } }))
    .mockResolvedValueOnce(json({ id: 'fb-1', email, first_name: 'New', last_name: 'Member', name: 'New Member' }));
}

/** Nothing exists yet: no account for the address, none for the provider id. */
function nobodyYet() {
  prisma.user.findUnique.mockResolvedValue(null);
}

/** Nothing at all may be written for a refused attempt. */
function expectNothingWritten() {
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(prisma.inviteCode.updateMany).not.toHaveBeenCalled();
  expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  expect(sendVerification).not.toHaveBeenCalled();
  expect(sendWelcome).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.TURNSTILE_SECRET_KEY;
  prisma.bannedIdentity.findUnique.mockResolvedValue(null);
  prisma.inviteCode.findFirst.mockResolvedValue({ id: 'invite-1', usesCount: 0, maxUses: 5 });
  nobodyYet();
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('POST /api/auth/register', () => {
  it('refuses a registration that leaves the confirmation out, and creates nothing', async () => {
    const res = await request(app).post('/api/auth/register').send(registration).expect(400);

    expect(res.body.message).toMatch(/confirm you are a woman/i);
    expectNothingWritten();
  });

  it.each([
    ['false', false],
    ['the string "true"', 'true'],
    ['the string "false"', 'false'],
    ['the number 1', 1],
    ['zero', 0],
    ['null', null],
    ['an empty string', ''],
    ['an array holding true', [true]],
    ['an object', { value: true }],
  ])('refuses a confirmation sent as %s', async (_label, womanSelfAttested) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...registration, womanSelfAttested })
      .expect(400);

    expect(res.body.message).toMatch(/confirm you are a woman/i);
    expectNothingWritten();
  });

  it('refuses a sign-up that arrives with an invite code but no confirmation, and does not spend the invite', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...registration, inviteCode: 'FRIEND-2026' })
      .expect(400);

    expect(prisma.inviteCode.updateMany).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('creates the account, stamped as attested, when the confirmation is a real true', async () => {
    prisma.user.create.mockResolvedValue(memberRow('new.member@example.com'));

    await request(app)
      .post('/api/auth/register')
      .send({ ...registration, womanSelfAttested: true })
      .expect(201);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create.mock.calls[0][0].data.womanSelfAttested).toBe(true);
  });

  it('keeps nothing else about her gender: no field the client sent is stored beside the confirmation', async () => {
    prisma.user.create.mockResolvedValue(memberRow('new.member@example.com'));

    await request(app)
      .post('/api/auth/register')
      .send({ ...registration, womanSelfAttested: true, gender: 'FEMALE', sex: 'F', womanVerificationStatus: 'VERIFIED' })
      .expect(201);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('gender');
    expect(data).not.toHaveProperty('sex');
    // Sending a status does not skip the check: it starts where everyone starts.
    expect(data).not.toHaveProperty('womanVerificationStatus');
  });
});

describe('POST /api/auth/google creating an account', () => {
  const body = { credential: 'id-token', mode: 'register', dateOfBirth: '1990-04-01' };

  it('refuses a sign-up with no confirmation before anything is written', async () => {
    googleSaysItIs('new.member@example.com');

    const res = await request(app).post('/api/auth/google').send(body).expect(400);

    expect(res.body.message).toMatch(/confirm you are a woman/i);
    expectNothingWritten();
  });

  it.each([
    ['false', false],
    ['the string "true"', 'true'],
    ['the number 1', 1],
  ])('refuses a confirmation sent as %s', async (_label, womanSelfAttested) => {
    googleSaysItIs('new.member@example.com');

    await request(app).post('/api/auth/google').send({ ...body, womanSelfAttested }).expect(400);

    expectNothingWritten();
  });

  it('does not create an account from the sign-in screen, whatever it sends', async () => {
    googleSaysItIs('new.member@example.com');

    await request(app)
      .post('/api/auth/google')
      .send({ credential: 'id-token', mode: 'login', womanSelfAttested: true, dateOfBirth: '1990-04-01' })
      .expect(404);

    expectNothingWritten();
  });

  it('creates the account, stamped as attested, when the confirmation is a real true', async () => {
    googleSaysItIs('new.member@example.com');
    prisma.user.create.mockResolvedValue(memberRow('new.member@example.com'));

    await request(app)
      .post('/api/auth/google')
      .send({ ...body, womanSelfAttested: true })
      .expect(201);

    expect(prisma.user.create.mock.calls[0][0].data.womanSelfAttested).toBe(true);
  });

  it('does not ask a returning member again', async () => {
    googleSaysItIs('new.member@example.com');
    prisma.user.findUnique.mockResolvedValue(memberRow('new.member@example.com'));
    prisma.user.update.mockResolvedValue(memberRow('new.member@example.com'));

    await request(app)
      .post('/api/auth/google')
      .send({ credential: 'id-token', mode: 'register' })
      .expect(200);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/facebook creating an account', () => {
  const body = { accessToken: 'fb-token', mode: 'register', dateOfBirth: '1990-04-01' };

  it('refuses a sign-up with no confirmation before anything is written', async () => {
    facebookSaysItIs('new.member@example.com');

    const res = await request(app).post('/api/auth/facebook').send(body).expect(400);

    expect(res.body.message).toMatch(/confirm you are a woman/i);
    expectNothingWritten();
  });

  it.each([
    ['false', false],
    ['the string "true"', 'true'],
    ['the number 1', 1],
  ])('refuses a confirmation sent as %s', async (_label, womanSelfAttested) => {
    facebookSaysItIs('new.member@example.com');

    await request(app).post('/api/auth/facebook').send({ ...body, womanSelfAttested }).expect(400);

    expectNothingWritten();
  });

  it('creates the account, stamped as attested, when the confirmation is a real true', async () => {
    facebookSaysItIs('new.member@example.com');
    prisma.user.create.mockResolvedValue(memberRow('new.member@example.com'));

    await request(app)
      .post('/api/auth/facebook')
      .send({ ...body, womanSelfAttested: true })
      .expect(201);

    expect(prisma.user.create.mock.calls[0][0].data.womanSelfAttested).toBe(true);
  });

  it('does not ask a returning member again', async () => {
    facebookSaysItIs('new.member@example.com');
    prisma.user.findUnique.mockResolvedValue(memberRow('new.member@example.com'));
    prisma.user.update.mockResolvedValue(memberRow('new.member@example.com'));

    await request(app)
      .post('/api/auth/facebook')
      .send({ accessToken: 'fb-token', mode: 'register' })
      .expect(200);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
