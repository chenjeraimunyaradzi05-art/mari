/**
 * The emails a member cannot get in, or back in, without: what is counted when
 * they fail, what the sign-up page is told, what a failed resend leaves her, and
 * what a second registration for an unconfirmed address does.
 *
 * Before this a refused or lost confirmation email was a line in the log. The
 * member was told to try again later, her old link had already been deleted by
 * the resend that failed, nothing counted it anywhere an alert could read, and
 * the address stayed held by whoever had typed it first, with their password.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';
// The reset and resend routes allow five requests an hour from one address, which
// a suite that sends a dozen would trip; the limits are tested where they live.
process.env.RATE_LIMIT_ENABLED = 'false';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(async () => []),
    },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    inviteCode: { findFirst: jest.fn(async () => null), updateMany: jest.fn() },
    verificationToken: { create: jest.fn(), deleteMany: jest.fn(async () => ({ count: 0 })) },
    session: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
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
  // A marker the route should hand to the sender for the one send a request waits on.
  INTERACTIVE_DELIVERY: { maxAttempts: 2, marker: 'interactive' },
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
import {
  INTERACTIVE_DELIVERY,
  sendAccountExistsEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../utils/email';
import { opsSnapshot } from '../../utils/ops-metrics';
import { authEmailTotal } from '../../utils/metrics';

const prisma: any = prismaTyped;
const sendVerification: any = sendVerificationEmail;
const sendPasswordReset: any = sendPasswordResetEmail;
const sendAccountExists: any = sendAccountExistsEmail;

const HOUR = 60 * 60 * 1000;

let sequence = 0;
const anotherAddress = () => `member.${++sequence}@example.com`;
const EMAIL = 'nadia@example.com';

const registration = {
  email: EMAIL,
  password: 'A-long-passphrase-1!',
  firstName: 'Nadia',
  lastName: 'Okonkwo',
  womanSelfAttested: true,
  dateOfBirth: '1990-04-01',
  persona: 'CREATOR',
};

const createdRow = {
  id: 'new-member',
  email: EMAIL,
  firstName: 'Nadia',
  lastName: 'Okonkwo',
  displayName: 'Nadia Okonkwo',
  role: 'USER',
  persona: 'CREATOR',
};

/** The account row an address already has, unconfirmed and `ageMs` old. */
function unconfirmed(overrides: Record<string, unknown> = {}, ageMs = 2 * HOUR) {
  return {
    id: 'squatter-account',
    email: EMAIL,
    firstName: 'Previous',
    emailVerified: false,
    createdAt: new Date(Date.now() - ageMs),
    lastLoginAt: null,
    googleId: null,
    facebookId: null,
    isSuspended: false,
    bannedAt: null,
    ...overrides,
  };
}

/** Deferred mail goes after the reply, so a test waits for the call instead of assuming it. */
async function until(condition: () => boolean, what: string, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** The authEmailTotal count for one label pair. */
async function counted(kind: string, outcome: 'sent' | 'failed'): Promise<number> {
  const metric = await authEmailTotal.get();
  return metric.values.find((v) => v.labels.kind === kind && v.labels.outcome === outcome)?.value ?? 0;
}

function failuresOf(operation: string): number {
  return opsSnapshot().operations[operation]?.failure ?? 0;
}

function successesOf(operation: string): number {
  return opsSnapshot().operations[operation]?.success ?? 0;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.TURNSTILE_SECRET_KEY;
  prisma.bannedIdentity.findUnique.mockResolvedValue(null);
  prisma.inviteCode.findFirst.mockResolvedValue(null);
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.create.mockResolvedValue(createdRow);
  prisma.user.updateMany.mockResolvedValue({ count: 1 });
  prisma.verificationToken.create.mockResolvedValue({ id: 'new-link', createdAt: new Date('2026-10-01T00:00:00Z') });
  prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
  sendVerification.mockResolvedValue(true);
  sendPasswordReset.mockResolvedValue(true);
  sendAccountExists.mockResolvedValue(true);
});

describe('registration when the confirmation email cannot be sent', () => {
  it('answers 503 with the machine code the sign-up page reads, and keeps the account it made', async () => {
    sendVerification.mockResolvedValue(false);

    const res = await request(app).post('/api/auth/register').send(registration);

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: 'VERIFICATION_EMAIL_FAILED',
      message: 'Verification email could not be sent. Please try resending verification later.',
    });
    // The account is saved; resending is the way forward, not signing up again.
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.verificationToken.create).toHaveBeenCalledTimes(1);
  });

  it('answers 503 the same way when the send throws', async () => {
    sendVerification.mockRejectedValue(new Error('socket hang up'));

    const res = await request(app).post('/api/auth/register').send(registration);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('VERIFICATION_EMAIL_FAILED');
  });

  it('counts the failure where /health/detailed and the alert can read it, without the address', async () => {
    sendVerification.mockResolvedValue(false);
    const failedBefore = await counted('verification', 'failed');
    const opsBefore = failuresOf('auth.email.verification');

    await request(app).post('/api/auth/register').send(registration);

    expect(await counted('verification', 'failed')).toBe(failedBefore + 1);
    expect(failuresOf('auth.email.verification')).toBe(opsBefore + 1);
    const recent = opsSnapshot().recentFailures.filter((failure) => failure.operation === 'auth.email.verification');
    expect(recent.length).toBeGreaterThan(0);
    expect(JSON.stringify(recent)).not.toContain(EMAIL);
  });

  it('counts a delivered one as sent and answers the same 201 a taken address gets', async () => {
    const sentBefore = await counted('verification', 'sent');
    const opsBefore = successesOf('auth.email.verification');

    const res = await request(app).post('/api/auth/register').send(registration);

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ verificationRequired: true });
    expect(res.body.code).toBeUndefined();
    expect(await counted('verification', 'sent')).toBe(sentBefore + 1);
    expect(successesOf('auth.email.verification')).toBe(opsBefore + 1);
  });

  it('asks the sender for the short policy, because this is the one send the request waits on', async () => {
    await request(app).post('/api/auth/register').send(registration);

    expect(sendVerification).toHaveBeenCalledTimes(1);
    expect(sendVerification.mock.calls[0][3]).toBe(INTERACTIVE_DELIVERY);
  });
});

describe('POST /api/auth/resend-verification when the mail is refused', () => {
  const account = { id: 'member-1', email: EMAIL, firstName: 'Nadia', emailVerified: false };

  it('withdraws only the link it just made, so the one she already holds still works', async () => {
    prisma.user.findUnique.mockResolvedValue(account);
    sendVerification.mockResolvedValue(false);
    const failedBefore = await counted('resend_verification', 'failed');

    await request(app).post('/api/auth/resend-verification').send({ email: anotherAddress() }).expect(200);
    await until(() => prisma.verificationToken.deleteMany.mock.calls.length > 0, 'the new link to be withdrawn');

    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'new-link' } });
    // The older link was never touched: nothing was asked to delete by account and kind.
    for (const [args] of prisma.verificationToken.deleteMany.mock.calls) {
      expect(args.where.userId).toBeUndefined();
    }
    expect(await counted('resend_verification', 'failed')).toBe(failedBefore + 1);
  });

  it('retires the older links, and only those made before the new one, once the mail has gone', async () => {
    prisma.user.findUnique.mockResolvedValue(account);

    await request(app).post('/api/auth/resend-verification').send({ email: anotherAddress() }).expect(200);
    await until(() => prisma.verificationToken.deleteMany.mock.calls.length > 0, 'the older links to be retired');

    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'member-1',
        type: 'EMAIL_VERIFICATION',
        createdAt: { lt: new Date('2026-10-01T00:00:00Z') },
      },
    });
  });

  it('writes the new link before it sends the mail, so a link can never be retired ahead of its replacement', async () => {
    prisma.user.findUnique.mockResolvedValue(account);
    const order: string[] = [];
    prisma.verificationToken.create.mockImplementation(async () => {
      order.push('create');
      return { id: 'new-link', createdAt: new Date() };
    });
    sendVerification.mockImplementation(async () => {
      order.push('send');
      return true;
    });
    prisma.verificationToken.deleteMany.mockImplementation(async () => {
      order.push('retire');
      return { count: 1 };
    });

    await request(app).post('/api/auth/resend-verification').send({ email: anotherAddress() }).expect(200);
    await until(() => order.includes('retire'), 'the older links to be retired');

    expect(order).toEqual(['create', 'send', 'retire']);
  });
});

describe('POST /api/auth/forgot-password when the mail is refused', () => {
  it('keeps the reset link she already holds, withdraws the new one, and counts it', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'member-1', email: EMAIL, firstName: 'Nadia' });
    sendPasswordReset.mockResolvedValue(false);
    const failedBefore = await counted('password_reset', 'failed');
    const opsBefore = failuresOf('auth.email.password_reset');

    await request(app).post('/api/auth/forgot-password').send({ email: anotherAddress() }).expect(200);
    await until(() => prisma.verificationToken.deleteMany.mock.calls.length > 0, 'the new link to be withdrawn');

    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'new-link' } });
    expect(await counted('password_reset', 'failed')).toBe(failedBefore + 1);
    expect(failuresOf('auth.email.password_reset')).toBe(opsBefore + 1);
  });

  it('answers the same for a refused send as for a delivered one, so the failure is not an oracle', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'member-1', email: EMAIL, firstName: 'Nadia' });
    sendPasswordReset.mockResolvedValue(false);
    const refused = await request(app).post('/api/auth/forgot-password').send({ email: anotherAddress() });

    prisma.user.findUnique.mockResolvedValue(null);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: anotherAddress() });

    expect(refused.status).toBe(200);
    expect(refused.body).toEqual(unknown.body);
  });
});

describe('registering over an unconfirmed account that has been waiting for more than an hour', () => {
  /** Whatever a brand-new address would be answered with. */
  async function newAddressAnswer() {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    return request(app).post('/api/auth/register').send({ ...registration, email: 'someone.new@example.com' });
  }

  it('starts the account over: the new password, names and date of birth replace the old, and she is sent a fresh link', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(unconfirmed());

    const res = await request(app).post('/api/auth/register').send(registration);
    await until(() => sendVerification.mock.calls.length > 0, 'the fresh confirmation email');

    // The same answer a new address gets: the form still cannot be used to ask who has an account.
    const fresh = await newAddressAnswer();
    expect(res.status).toBe(201);
    expect(res.body).toEqual(fresh.body);

    expect(prisma.user.create).toHaveBeenCalledTimes(1); // only for the comparison address above
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.updateMany.mock.calls[0][0];
    // Conditions repeated in the write, so a confirmation or a sign-in that
    // lands between the read and the write leaves the account alone.
    expect(where).toMatchObject({
      id: 'squatter-account',
      emailVerified: false,
      googleId: null,
      facebookId: null,
      lastLoginAt: null,
      // A suspension or a ban placed between the read and the write is a
      // reason not to hand the account over, the same as the read said.
      isSuspended: false,
      bannedAt: null,
    });
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    expect(Date.now() - where.createdAt.lte.getTime()).toBeGreaterThanOrEqual(HOUR - 1000);
    expect(data).toMatchObject({
      passwordHash: `hashed:${registration.password}`,
      firstName: 'Nadia',
      lastName: 'Okonkwo',
      displayName: 'Nadia Okonkwo',
      persona: 'CREATOR',
      womanSelfAttested: true,
    });
    expect(data.dateOfBirth).toBeInstanceOf(Date);
    // Starting over starts the clock over: the new registrant gets her own hour.
    expect(Date.now() - data.createdAt.getTime()).toBeLessThan(5000);

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'squatter-account' } });
    // The email greets her by the name she just typed, not the previous one.
    expect(sendVerification.mock.calls[0].slice(0, 2)).toEqual([EMAIL, 'Nadia']);
    expect(sendAccountExists).not.toHaveBeenCalled();
  });

  it('leaves an account alone that has not yet been waiting an hour: it is probably her own, still being confirmed', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(unconfirmed({}, 30 * 60 * 1000));

    const res = await request(app).post('/api/auth/register').send(registration);
    await until(() => sendVerification.mock.calls.length > 0, 'the fresh confirmation email');

    expect(res.status).toBe(201);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    // She still gets a fresh link, under the name the account already has.
    expect(sendVerification.mock.calls[0].slice(0, 2)).toEqual([EMAIL, 'Previous']);
  });

  it.each([
    ['one that has signed in', { lastLoginAt: new Date() }],
    ['one linked to Google', { googleId: 'google-sub' }],
    ['one linked to Facebook', { facebookId: 'fb-id' }],
    ['one that is suspended', { isSuspended: true }],
    ['one that is banned', { bannedAt: new Date() }],
    ['one whose age is not known', { createdAt: undefined }],
  ])('never takes over %s', async (_label, overrides) => {
    prisma.user.findUnique.mockResolvedValueOnce(unconfirmed(overrides));

    const res = await request(app).post('/api/auth/register').send(registration);

    expect(res.status).toBe(201);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it('never takes over a confirmed account: its owner is told, and nothing changes', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(unconfirmed({ emailVerified: true }));

    const res = await request(app).post('/api/auth/register').send(registration);
    await until(() => sendAccountExists.mock.calls.length > 0, 'the account-exists email');

    expect(res.status).toBe(201);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(sendVerification).not.toHaveBeenCalled();
  });

  it('does nothing further when the account was confirmed between the read and the write', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(unconfirmed());
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app).post('/api/auth/register').send(registration);
    await until(() => sendVerification.mock.calls.length > 0, 'the fresh confirmation email');

    expect(res.status).toBe(201);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(sendVerification.mock.calls[0].slice(0, 2)).toEqual([EMAIL, 'Previous']);
  });

  it('still refuses a bad invite code for this address exactly as it would for a new one', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(unconfirmed());

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...registration, inviteCode: 'NOSUCHCODE' });

    expect(res.status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
