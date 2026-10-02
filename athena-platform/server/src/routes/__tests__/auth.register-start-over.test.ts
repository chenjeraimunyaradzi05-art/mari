/**
 * Registering an address whose account was never confirmed.
 *
 * Whoever registered an address first used to hold it, and held its password
 * too: a typo left an account nobody could confirm, and somebody's registration
 * of an address that was not theirs meant the real owner, clicking the link we
 * then sent, confirmed an account whose password was somebody else's. A new
 * registration for such an address now starts the account over, but only when
 * nothing has ever been done with it, and only after a grace period, because
 * the same rule in the wrong place is an account takeover.
 *
 * What this pins is the line between the two:
 *  - an account nobody has confirmed, signed in to, or linked a provider to,
 *    that has waited more than an hour, is rewritten with the new password,
 *    names and date of birth, and the owner of the inbox is mailed a fresh link;
 *  - everything else (a young account, one that has been used, one that is
 *    suspended or banned, one that is confirmed) is left exactly as it is;
 *  - whichever happens, the reply is the one every address gets.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(async () => []) },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    inviteCode: { findFirst: jest.fn(async () => null), updateMany: jest.fn() },
    verificationToken: {
      create: jest.fn(async () => ({ id: 'token-1', createdAt: new Date() })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    session: { deleteMany: jest.fn(async () => ({ count: 0 })) },
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
  sendAccountExistsEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { sendAccountExistsEmail, sendVerificationEmail } from '../../utils/email';

const prisma: any = prismaTyped;
const sendVerification: any = sendVerificationEmail;
const sendAccountExists: any = sendAccountExistsEmail;

const HOUR = 60 * 60 * 1000;
const OWNER_ADDRESS = 'owner@example.com';

const registration = {
  email: OWNER_ADDRESS,
  password: 'Newcomers-Passphrase-1!',
  firstName: 'Newcomer',
  lastName: 'Registrant',
  dateOfBirth: '1992-03-04',
  womanSelfAttested: true,
};

/** An account as the registration route reads it, unconfirmed and a day old unless a test says otherwise. */
function waitingAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-waiting',
    email: OWNER_ADDRESS,
    firstName: 'Original',
    emailVerified: false,
    createdAt: new Date(Date.now() - 24 * HOUR),
    lastLoginAt: null,
    googleId: null,
    facebookId: null,
    isSuspended: false,
    bannedAt: null,
    ...overrides,
  };
}

/** Deferred mail is sent after the reply, so a test waits for the call instead of assuming it. */
async function waitForCall(mock: jest.Mock, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (mock.mock.calls.length === 0) {
    if (Date.now() - started > timeoutMs) throw new Error('The deferred email was never handed to the provider');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function register(body: Record<string, unknown> = registration) {
  return request(app).post('/api/auth/register').send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.TURNSTILE_SECRET_KEY;
  prisma.bannedIdentity.findUnique.mockResolvedValue(null);
  prisma.inviteCode.findFirst.mockResolvedValue(null);
  prisma.user.updateMany.mockResolvedValue({ count: 1 });
  prisma.verificationToken.create.mockResolvedValue({ id: 'token-1', createdAt: new Date() });
});

describe('an unconfirmed account that has waited out the grace period', () => {
  it('is started over with the new registration, and its owner is mailed a fresh link', async () => {
    prisma.user.findUnique.mockResolvedValue(waitingAccount());

    const res = await register().expect(201);

    expect(res.body).toEqual({
      success: true,
      message: 'Registration received. If this address can be used, an email is on its way.',
      data: { verificationRequired: true },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();

    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.updateMany.mock.calls[0][0];
    // The write repeats every condition the read made, so an account confirmed,
    // signed in to or linked between the read and the write is left alone.
    expect(where).toMatchObject({
      id: 'user-waiting',
      emailVerified: false,
      googleId: null,
      facebookId: null,
      lastLoginAt: null,
    });
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    expect(Date.now() - where.createdAt.lte.getTime()).toBeGreaterThanOrEqual(HOUR - 1000);
    expect(data).toMatchObject({
      passwordHash: `hashed:${registration.password}`,
      firstName: 'Newcomer',
      lastName: 'Registrant',
      displayName: 'Newcomer Registrant',
      womanSelfAttested: true,
    });
    expect(data.dateOfBirth).toBeInstanceOf(Date);
    // A full grace period for the new registrant, too.
    expect(Date.now() - data.createdAt.getTime()).toBeLessThan(5000);

    // Nothing should be signed in to an account nobody confirmed; this makes sure.
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-waiting' } });

    // The confirmation link, not the "you already have an account" notice, to
    // the address on file, greeting the name now on the account.
    await waitForCall(sendVerification);
    expect(sendVerification.mock.calls[0][0]).toBe(OWNER_ADDRESS);
    expect(sendVerification.mock.calls[0][1]).toBe('Newcomer');
    expect(sendAccountExists).not.toHaveBeenCalled();
  });

  it('gets the same reply as an address nobody has registered', async () => {
    prisma.user.findUnique.mockResolvedValue(waitingAccount());
    const restarted = await register();

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-new', email: 'someone.else@example.com' });
    const fresh = await register({ ...registration, email: 'someone.else@example.com' });

    expect(restarted.status).toBe(201);
    expect(restarted.status).toBe(fresh.status);
    expect(restarted.body).toEqual(fresh.body);
  });

  it('is left as it was, and still mailed a link, when it is confirmed between the read and the write', async () => {
    prisma.user.findUnique.mockResolvedValue(waitingAccount());
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await register().expect(201);

    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    await waitForCall(sendVerification);
    // Nothing of the new registration is on the account, so the old name stands.
    expect(sendVerification.mock.calls[0][1]).toBe('Original');
  });
});

describe('an account that must not be started over', () => {
  it('is not, while it is younger than the grace period, but its owner is still sent a link', async () => {
    prisma.user.findUnique.mockResolvedValue(waitingAccount({ createdAt: new Date(Date.now() - 10 * 60 * 1000) }));

    await register().expect(201);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    await waitForCall(sendVerification);
    expect(sendVerification.mock.calls[0][1]).toBe('Original');
  });

  it.each([
    ['one that has been signed in to', { lastLoginAt: new Date() }],
    ['one with a Google sign-in on it', { googleId: 'google-sub-1' }],
    ['one with a Facebook sign-in on it', { facebookId: 'fb-1' }],
    ['a suspended one', { isSuspended: true }],
    ['a banned one', { bannedAt: new Date() }],
    ['one whose creation time is unknown', { createdAt: undefined }],
  ])('is not, for %s', async (_label, overrides) => {
    prisma.user.findUnique.mockResolvedValue(waitingAccount(overrides));

    const res = await register().expect(201);

    expect(res.body.data).toEqual({ verificationRequired: true });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('is not, once the address is confirmed, however old: its owner is told by email that nothing changed', async () => {
    prisma.user.findUnique.mockResolvedValue(waitingAccount({ emailVerified: true, firstName: 'Confirmed' }));

    await register().expect(201);

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    await waitForCall(sendAccountExists);
    expect(sendAccountExists).toHaveBeenCalledWith(OWNER_ADDRESS, 'Confirmed');
    expect(sendVerification).not.toHaveBeenCalled();
  });
});
