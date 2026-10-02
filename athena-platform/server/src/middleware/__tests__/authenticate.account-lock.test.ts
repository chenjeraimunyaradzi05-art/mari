/**
 * An account its owner has locked, or whose address is no longer confirmed,
 * holds no session in practice.
 *
 * Locking ends every session, and that is what normally stops a token. This is
 * the second line: authenticate reads the account on every request, so a token
 * that was minted while the lock was being made (a sign-in already part-way
 * through) is refused too, and an address an admin has un-confirmed does not
 * keep the sessions it already had.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('../../utils/jwt', () => ({
  verifyToken: jest.fn(),
}));
jest.mock('../../services/session.service', () => ({
  sessionService: { findActiveSessionByAccessToken: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { verifyToken } from '../../utils/jwt';
import { sessionService } from '../../services/session.service';
import {
  ACCOUNT_LOCKED_MESSAGE,
  EMAIL_NOT_VERIFIED_MESSAGE,
  SUSPENDED_ACCOUNT_MESSAGE,
  authenticate,
  authenticateSocketToken,
  isTwoFactorEnrolmentPath,
  optionalAuth,
} from '../auth';
import { errorHandler } from '../errorHandler';

const prisma: any = prismaTyped;
const verify: any = verifyToken;
const sessions: any = sessionService;

const member = (overrides: Record<string, unknown> = {}) => ({
  id: 'her',
  email: 'her@ourdomain.org',
  role: 'USER',
  persona: 'EARLY_CAREER',
  isSuspended: false,
  bannedAt: null,
  lockedAt: null,
  emailVerified: true,
  twoFactorEnabled: false,
  womanVerificationStatus: 'UNVERIFIED',
  dateOfBirth: null,
  ...overrides,
});

function appWithRoutes() {
  const app = express();
  app.get('/api/things', authenticate, (req: any, res) => res.json({ user: req.user.id }));
  app.get('/api/public', optionalAuth, (req: any, res) => res.json({ user: req.user?.id ?? null }));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  verify.mockReturnValue({ userId: 'her', email: 'her@ourdomain.org', role: 'USER', persona: 'EARLY_CAREER' });
  sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 'sess-1', userId: 'her' });
});

describe('authenticate and a locked account', () => {
  it('refuses a live token while the account is locked, in the lock wording and not the suspension one', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ lockedAt: new Date('2026-10-01T00:00:00Z') }));

    const res = await request(appWithRoutes()).get('/api/things').set('Authorization', 'Bearer tok').expect(403);

    expect(res.body.message).toBe(ACCOUNT_LOCKED_MESSAGE);
    expect(res.body.message).not.toBe(SUSPENDED_ACCOUNT_MESSAGE);
    // Both screens look for the word to offer a new unlock email.
    expect(res.body.message.toLowerCase()).toContain('locked');
    // Not "suspended": nobody on staff did this and there is nothing to appeal.
    expect(res.body.message.toLowerCase()).not.toContain('suspended');
  });

  it('lets the same account through once the lock is cleared', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    const res = await request(appWithRoutes()).get('/api/things').set('Authorization', 'Bearer tok').expect(200);
    expect(res.body.user).toBe('her');
  });

  it('says suspended before locked when she is both, so a suspension is never hidden behind the lock', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ isSuspended: true, lockedAt: new Date() }));
    const res = await request(appWithRoutes()).get('/api/things').set('Authorization', 'Bearer tok').expect(403);
    expect(res.body.message).toBe(SUSPENDED_ACCOUNT_MESSAGE);
  });

  it('reads a locked account as a stranger on a public page, as it does a suspended one', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ lockedAt: new Date() }));
    const res = await request(appWithRoutes()).get('/api/public').set('Authorization', 'Bearer tok').expect(200);
    expect(res.body.user).toBeNull();
  });

  it('refuses a socket handshake for a locked account', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ lockedAt: new Date() }));
    await expect(authenticateSocketToken('tok')).rejects.toMatchObject({ statusCode: 403, message: ACCOUNT_LOCKED_MESSAGE });
  });

  it('can still lock the account from a staff account that has not enrolled a second factor', () => {
    expect(isTwoFactorEnrolmentPath('POST', '/api/auth/lock')).toBe(true);
    // Only the lock: unlocking needs no session at all, and the rest stays refused.
    expect(isTwoFactorEnrolmentPath('POST', '/api/auth/change-password')).toBe(false);
  });
});

describe('authenticate and an address nobody has confirmed', () => {
  it('ends a session whose address was un-confirmed, with the sentence the sign-in page matches on', async () => {
    prisma.user.findUnique.mockResolvedValue(member({ emailVerified: false }));

    const res = await request(appWithRoutes()).get('/api/things').set('Authorization', 'Bearer tok').expect(403);

    expect(res.body.message).toBe(EMAIL_NOT_VERIFIED_MESSAGE);
    expect(res.body.message.toLowerCase()).toContain('verify your email');
  });

  it('does not read a row that does not say as an unconfirmed one', async () => {
    const row: Record<string, unknown> = member();
    delete row.emailVerified;
    prisma.user.findUnique.mockResolvedValue(row);
    await request(appWithRoutes()).get('/api/things').set('Authorization', 'Bearer tok').expect(200);
  });

  it('asks the database for both facts on every request', async () => {
    prisma.user.findUnique.mockResolvedValue(member());
    await request(appWithRoutes()).get('/api/things').set('Authorization', 'Bearer tok').expect(200);
    const select = prisma.user.findUnique.mock.calls[0][0].select;
    expect(select).toMatchObject({ lockedAt: true, emailVerified: true });
  });
});
