import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * A reviewer's Reject, and a date of birth under the minimum, used to close a
 * handful of routes (messages, stories, group chat, housing) and leave the rest
 * of the platform open: a refused member could still post, comment, join
 * groups, upload video and go live. The refusal is now made once, in
 * authenticate, for every write — and these tests are what keep a new route
 * from being the hole.
 */

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
import { authenticate } from '../auth';
import { errorHandler } from '../errorHandler';
import { accountStandingRefusal, isStandingExemptPath } from '../account-standing';

const prisma: any = prismaTyped;
const verify: any = verifyToken;
const sessions: any = sessionService;

const ADULT = new Date('1990-04-01T00:00:00Z');
const MINOR = new Date(Date.now() - 15 * 365 * 24 * 60 * 60 * 1000);

describe('accountStandingRefusal', () => {
  it('lets a member in good standing do anything', () => {
    const good = { womanVerificationStatus: 'VERIFIED', dateOfBirth: ADULT };
    expect(accountStandingRefusal(good, 'POST', '/api/posts')).toBeNull();
    expect(accountStandingRefusal({ womanVerificationStatus: 'UNVERIFIED', dateOfBirth: ADULT }, 'DELETE', '/api/groups/g1')).toBeNull();
    expect(accountStandingRefusal({ womanVerificationStatus: 'PENDING', dateOfBirth: ADULT }, 'POST', '/api/video')).toBeNull();
  });

  it('refuses every write by a REJECTED member with the body the per-route gate already sends', () => {
    const rejected = { womanVerificationStatus: 'REJECTED', dateOfBirth: ADULT };
    for (const [method, path] of [
      ['POST', '/api/posts'],
      ['POST', '/api/posts/p1/comments'],
      ['POST', '/api/groups/g1/join'],
      ['POST', '/api/channels/c1/join'],
      ['POST', '/api/video'],
      ['POST', '/api/livestream'],
      ['PUT', '/api/groups/g1'],
      ['PATCH', '/api/users/me/profile'],
      ['DELETE', '/api/posts/p1'],
    ]) {
      const refusal = accountStandingRefusal(rejected, method, path);
      expect(refusal).toMatchObject({ code: 'WOMAN_VERIFICATION_REJECTED', status: 'REJECTED' });
      expect(refusal?.error).toMatch(/appeal/i);
    }
  });

  it('refuses a writer under the minimum age, and says nothing about the number', () => {
    const refusal = accountStandingRefusal({ womanVerificationStatus: 'VERIFIED', dateOfBirth: MINOR }, 'POST', '/api/posts');
    expect(refusal).toMatchObject({ code: 'MINIMUM_AGE_NOT_MET' });
    expect(JSON.stringify(refusal)).not.toMatch(/\b18\b/);
  });

  it('never refuses a read, so she can still see why and where to go', () => {
    const rejected = { womanVerificationStatus: 'REJECTED', dateOfBirth: MINOR };
    expect(accountStandingRefusal(rejected, 'GET', '/api/posts')).toBeNull();
    expect(accountStandingRefusal(rejected, 'HEAD', '/api/posts')).toBeNull();
    expect(accountStandingRefusal(rejected, 'OPTIONS', '/api/posts')).toBeNull();
  });

  it('asks an account with no date of birth for one on its first write, and says where to give it', () => {
    // Every account that predates the column has none. ATHENA is for adults and
    // never asked, so the first write is where she is asked, once.
    const refusal = accountStandingRefusal({ womanVerificationStatus: 'UNVERIFIED', dateOfBirth: null }, 'POST', '/api/posts');
    expect(refusal).toMatchObject({ code: 'DATE_OF_BIRTH_REQUIRED', setup: '/dashboard/settings/profile' });
    expect(refusal?.error).toMatch(/date of birth/i);
    // Not under age: nothing about a number, and not the final answer.
    expect(JSON.stringify(refusal)).not.toMatch(/\b18\b/);
    expect(refusal).not.toMatchObject({ code: 'MINIMUM_AGE_NOT_MET' });
  });

  it('does not ask for what was never read: undefined is "not asked", only null is "empty"', () => {
    expect(accountStandingRefusal({ womanVerificationStatus: 'UNVERIFIED' }, 'POST', '/api/posts')).toBeNull();
  });

  it('still lets an account with no date of birth read, so she can see her own settings', () => {
    expect(accountStandingRefusal({ dateOfBirth: null }, 'GET', '/api/posts')).toBeNull();
    expect(accountStandingRefusal({ dateOfBirth: null }, 'GET', '/api/users/me')).toBeNull();
  });

  it('answers a recorded under-age date before it asks for a missing one, and a rejected check before both', () => {
    expect(accountStandingRefusal({ womanVerificationStatus: 'REJECTED', dateOfBirth: null }, 'POST', '/api/posts')).toMatchObject({
      code: 'WOMAN_VERIFICATION_REJECTED',
    });
    expect(accountStandingRefusal({ womanVerificationStatus: 'VERIFIED', dateOfBirth: MINOR }, 'POST', '/api/posts')).toMatchObject({
      code: 'MINIMUM_AGE_NOT_MET',
    });
  });

  it('refuses an impossible date of birth the way it refuses a young one', () => {
    expect(
      accountStandingRefusal({ womanVerificationStatus: 'VERIFIED', dateOfBirth: new Date('2090-01-01') }, 'POST', '/api/posts')
    ).toMatchObject({ code: 'MINIMUM_AGE_NOT_MET' });
  });
});

describe('what a refused member can still reach', () => {
  const rejected = { womanVerificationStatus: 'REJECTED', dateOfBirth: ADULT };

  it('keeps sign-in, privacy rights, safety help and the way to appeal open', () => {
    for (const [method, path] of [
      ['POST', '/api/auth/logout'],
      ['POST', '/api/auth/change-password'],
      ['DELETE', '/api/auth/sessions/s1'],
      ['POST', '/api/gdpr/dsar/delete'],
      ['PUT', '/api/gdpr/consents'],
      ['POST', '/api/safety/reports'],
      ['POST', '/api/safety/dv/panic'],
      ['POST', '/api/compliance/report-content'],
      ['POST', '/api/appeals'],
      ['POST', '/api/feedback'],
      ['PATCH', '/api/notifications/read-all'],
      ['POST', '/api/subscriptions/cancel'],
      ['DELETE', '/api/users/me'],
      ['PATCH', '/api/users/me'],
      ['POST', '/api/users/me/woman-verification'],
      ['POST', '/api/users/me/date-of-birth'],
    ]) {
      expect(accountStandingRefusal(rejected, method, path)).toBeNull();
    }
  });

  it('keeps every one of those open to an account with no date of birth, and the way to give it above all', () => {
    const legacy = { womanVerificationStatus: 'VERIFIED', dateOfBirth: null };
    for (const [method, path] of [
      ['POST', '/api/users/me/date-of-birth'],
      ['PATCH', '/api/users/me'],
      ['POST', '/api/auth/logout'],
      ['POST', '/api/gdpr/dsar/delete'],
      ['DELETE', '/api/users/me'],
      ['POST', '/api/safety/dv/panic'],
      ['POST', '/api/compliance/report-content'],
      ['POST', '/api/appeals'],
      ['POST', '/api/subscriptions/cancel'],
    ]) {
      expect(accountStandingRefusal(legacy, method, path)).toBeNull();
    }
    // And only those: the rest of the writes ask her first.
    expect(accountStandingRefusal(legacy, 'POST', '/api/subscriptions/checkout')).toMatchObject({ code: 'DATE_OF_BIRTH_REQUIRED' });
    expect(accountStandingRefusal(legacy, 'POST', '/api/reels')).toMatchObject({ code: 'DATE_OF_BIRTH_REQUIRED' });
  });

  it('keeps her safety plan open to every account in bad standing, to write and to wipe, and nothing else under /api/impact', () => {
    // The plan is mounted under /api/impact, not /api/safety, so the prefix does
    // not cover it. Missing it would shut the one private record a woman in
    // danger most needs to a legacy account (no date of birth), to a refused
    // check and, worst, to an account under the minimum age.
    const legacy = { womanVerificationStatus: 'VERIFIED', dateOfBirth: null };
    const rejected = { womanVerificationStatus: 'REJECTED', dateOfBirth: ADULT };
    const minor = { womanVerificationStatus: 'VERIFIED', dateOfBirth: MINOR };

    for (const account of [legacy, rejected, minor]) {
      expect(accountStandingRefusal(account, 'POST', '/api/impact/safety-plan')).toBeNull();
      expect(accountStandingRefusal(account, 'DELETE', '/api/impact/safety-plan')).toBeNull();
    }

    // Only those two. The rest of what lives there is not safety help.
    expect(accountStandingRefusal(legacy, 'POST', '/api/impact/accessibility')).toMatchObject({ code: 'DATE_OF_BIRTH_REQUIRED' });
    expect(accountStandingRefusal(minor, 'POST', '/api/impact/metrics')).toMatchObject({ code: 'MINIMUM_AGE_NOT_MET' });
    expect(isStandingExemptPath('PUT', '/api/impact/safety-plan')).toBe(false);
    expect(isStandingExemptPath('POST', '/api/impact/safety-plan/extra')).toBe(false);
  });

  it('matches exactly: a similar path or another method is another route', () => {
    expect(isStandingExemptPath('POST', '/api/authors')).toBe(false);
    expect(isStandingExemptPath('POST', '/api/appeals/a1/decide')).toBe(false);
    expect(isStandingExemptPath('GET', '/api/appeals')).toBe(false);
    expect(isStandingExemptPath('POST', '/api/users/me/skills')).toBe(false);
    expect(isStandingExemptPath('POST', '/api/users/u1/follow')).toBe(false);
    expect(isStandingExemptPath('POST', '/api/subscriptions/checkout')).toBe(false);
  });

  it('folds case and a trailing slash the way Express does, and never trusts a path that climbs', () => {
    expect(isStandingExemptPath('POST', '/API/Appeals/')).toBe(true);
    expect(isStandingExemptPath('post', '/api/safety/dv/panic')).toBe(true);
    expect(isStandingExemptPath('POST', '/api/auth/../posts')).toBe(false);
    expect(isStandingExemptPath('POST', '/api/auth/%2e%2e/posts')).toBe(false);
    expect(accountStandingRefusal(rejected, 'POST', '/api/auth/../posts')).toMatchObject({
      code: 'WOMAN_VERIFICATION_REJECTED',
    });
  });
});

function appWithRoutes() {
  const app = express();
  app.use(express.json());
  app.post('/api/posts', authenticate, (_req, res) => res.status(201).json({ posted: true }));
  app.get('/api/posts', authenticate, (_req, res) => res.json({ posts: [] }));
  app.post('/api/groups/:id/join', authenticate, (_req, res) => res.json({ joined: true }));
  app.post('/api/appeals', authenticate, (_req, res) => res.status(201).json({ appealed: true }));
  app.post('/api/auth/logout', authenticate, (_req, res) => res.json({ out: true }));
  app.use(errorHandler);
  return app;
}

function signedInAs(account: Record<string, unknown>) {
  verify.mockReturnValue({ userId: 'u-1', email: 'u@athena.com', role: 'USER', persona: 'EARLY_CAREER' });
  sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 'sess-1', userId: 'u-1' });
  prisma.user.findUnique.mockResolvedValue({
    id: 'u-1',
    email: 'u@athena.com',
    role: 'USER',
    persona: 'EARLY_CAREER',
    isSuspended: false,
    twoFactorEnabled: false,
    ...account,
  });
}

describe('authenticate applies it to every route behind it', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stops a REJECTED member posting or joining a group, before the handler runs', async () => {
    signedInAs({ womanVerificationStatus: 'REJECTED', dateOfBirth: ADULT });

    const post = await request(appWithRoutes()).post('/api/posts').set('Authorization', 'Bearer tok').expect(403);
    expect(post.body.code).toBe('WOMAN_VERIFICATION_REJECTED');
    expect(post.body.setup).toBe('/dashboard/settings/profile');
    expect(post.body.posted).toBeUndefined();

    const join = await request(appWithRoutes()).post('/api/groups/g1/join').set('Authorization', 'Bearer tok').expect(403);
    expect(join.body.code).toBe('WOMAN_VERIFICATION_REJECTED');
  });

  it('stops an under-age account the same way', async () => {
    signedInAs({ womanVerificationStatus: 'UNVERIFIED', dateOfBirth: MINOR });

    const res = await request(appWithRoutes()).post('/api/posts').set('Authorization', 'Bearer tok').expect(403);
    expect(res.body.code).toBe('MINIMUM_AGE_NOT_MET');
  });

  it('asks a legacy account for her date of birth on a write, before the handler runs, and not on a read', async () => {
    signedInAs({ womanVerificationStatus: 'VERIFIED', dateOfBirth: null });

    const post = await request(appWithRoutes()).post('/api/posts').set('Authorization', 'Bearer tok').expect(403);
    expect(post.body.code).toBe('DATE_OF_BIRTH_REQUIRED');
    expect(post.body.setup).toBe('/dashboard/settings/profile');
    expect(post.body.posted).toBeUndefined();

    await request(appWithRoutes()).get('/api/posts').set('Authorization', 'Bearer tok').expect(200);
    await request(appWithRoutes()).post('/api/auth/logout').set('Authorization', 'Bearer tok').expect(200);
    await request(appWithRoutes()).post('/api/appeals').set('Authorization', 'Bearer tok').expect(201);
  });

  it('lets her write the moment a date of birth is on her account', async () => {
    signedInAs({ womanVerificationStatus: 'VERIFIED', dateOfBirth: ADULT });

    await request(appWithRoutes()).post('/api/posts').set('Authorization', 'Bearer tok').expect(201);
  });

  it('still lets a refused member read, appeal and sign out', async () => {
    signedInAs({ womanVerificationStatus: 'REJECTED', dateOfBirth: ADULT });

    await request(appWithRoutes()).get('/api/posts?page=2').set('Authorization', 'Bearer tok').expect(200);
    await request(appWithRoutes()).post('/api/appeals').set('Authorization', 'Bearer tok').expect(201);
    await request(appWithRoutes()).post('/api/auth/logout').set('Authorization', 'Bearer tok').expect(200);
  });

  it('lets her write again once an appeal has put her back to PENDING', async () => {
    signedInAs({ womanVerificationStatus: 'PENDING', dateOfBirth: ADULT });

    await request(appWithRoutes()).post('/api/posts').set('Authorization', 'Bearer tok').expect(201);
  });

  it('asks the database for the two facts, so the answer is today\'s and not the token\'s', async () => {
    signedInAs({ womanVerificationStatus: 'VERIFIED', dateOfBirth: ADULT });

    await request(appWithRoutes()).post('/api/posts').set('Authorization', 'Bearer tok').expect(201);

    const select = prisma.user.findUnique.mock.calls[0][0].select;
    expect(select.womanVerificationStatus).toBe(true);
    expect(select.dateOfBirth).toBe(true);
  });
});
