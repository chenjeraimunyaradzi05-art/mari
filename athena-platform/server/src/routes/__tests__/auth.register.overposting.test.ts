/**
 * A sign-up body cannot choose what the account is.
 *
 * Registration reads six named fields and builds the account row from them, so
 * a body that also says `role: 'ADMIN'` (or names a verification status, a
 * suspension, a two-factor flag or an id) is ignored rather than written. This
 * pins that behaviour: if the handler is ever changed to spread the body into
 * `prisma.user.create`, every one of these keys reaches the row and this fails.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendAccountExistsEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async () => 'hashed-password'),
  comparePassword: jest.fn(async () => true),
}));

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async () => ({ id: 'new-member', email: 'new.member@example.com', firstName: 'New', role: 'USER' })),
      update: jest.fn(async () => ({})),
    },
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    inviteCode: { findFirst: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 0 })) },
    verificationToken: { create: jest.fn(async () => ({})) },
    referral: { create: jest.fn(async () => ({})) },
    notification: { create: jest.fn(async () => ({})) },
    $queryRaw: jest.fn(async () => 1),
    $disconnect: jest.fn(async () => undefined),
  },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const VALID_BODY = {
  email: 'new.member@example.com',
  password: 'Password123!',
  firstName: 'New',
  lastName: 'Member',
  womanSelfAttested: true,
  dateOfBirth: '1990-05-12',
};

describe('POST /api/auth/register ignores what a body says about the account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('never writes a role, a verification status, a suspension, a two-factor flag or an id from the body', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        ...VALID_BODY,
        role: 'SUPER_ADMIN',
        id: 'chosen-id',
        emailVerified: true,
        isSuspended: false,
        bannedAt: null,
        twoFactorEnabled: true,
        womanVerificationStatus: 'VERIFIED',
        womanVerifiedAt: '2026-01-01T00:00:00Z',
        giftBalance: 1_000_000,
        referralCredits: 1_000_000,
        user: { update: { role: 'ADMIN' } },
      })
      .expect(201);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.user.create.mock.calls[0][0];

    for (const key of [
      'role',
      'id',
      'emailVerified',
      'isSuspended',
      'bannedAt',
      'twoFactorEnabled',
      'womanVerificationStatus',
      'womanVerifiedAt',
      'giftBalance',
      'user',
    ]) {
      expect(data).not.toHaveProperty(key);
    }
    // The one credit field a body names is not the one the account starts with:
    // the referral top-up only happens through a valid referral code.
    expect(data).not.toHaveProperty('referralCredits');

    // What the account does start as comes from the handler, not the sender.
    expect(data).toMatchObject({
      email: 'new.member@example.com',
      womanSelfAttested: true,
      subscription: { create: { tier: 'FREE', status: 'ACTIVE' } },
    });
  });
});
