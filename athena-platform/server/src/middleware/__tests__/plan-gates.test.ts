/**
 * The plan gates in middleware/auth used to refuse with 401. The web app's
 * axios interceptor reads a 401 as an expired session, so a member on the
 * wrong plan had her refresh token rotated and the request retried before
 * she saw why. A plan refusal is a 403 with a code the client can read.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const subscriptionFindUnique = jest.fn() as jest.Mock<(args?: unknown) => Promise<unknown>>;
jest.mock('../../utils/prisma', () => ({
  prisma: { subscription: { findUnique: subscriptionFindUnique }, user: { findUnique: jest.fn() } },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { requirePremium, requireSubscriptionTier } from '../auth';
import { errorHandler } from '../errorHandler';

function appAs(role: string | null) {
  const app = express();
  app.use((req: any, _res, next) => {
    if (role) req.user = { id: 'u1', email: 'u@athena.com', role, persona: 'PROFESSIONAL' };
    next();
  });
  app.get('/premium', requirePremium, (_req, res) => res.json({ ok: true }));
  app.get('/pro', requireSubscriptionTier('PRO'), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requirePremium', () => {
  it('refuses a free member with 403 PREMIUM_REQUIRED, not a 401', async () => {
    subscriptionFindUnique.mockResolvedValue({ tier: 'FREE', status: 'ACTIVE' });
    const res = await request(appAs('USER')).get('/premium').expect(403);
    expect(res.body).toMatchObject({ success: false, code: 'PREMIUM_REQUIRED' });
  });

  it('refuses a lapsed paid tier the same way', async () => {
    subscriptionFindUnique.mockResolvedValue({ tier: 'PRO', status: 'PAST_DUE' });
    const res = await request(appAs('USER')).get('/premium').expect(403);
    expect(res.body.code).toBe('PREMIUM_REQUIRED');
  });

  it('lets an active or trialling paid tier through', async () => {
    subscriptionFindUnique.mockResolvedValue({ tier: 'PRO', status: 'TRIALING' });
    await request(appAs('USER')).get('/premium').expect(200);
  });

  it('still answers 401 when nobody is signed in', async () => {
    await request(appAs(null)).get('/premium').expect(401);
  });
});

describe('requireSubscriptionTier', () => {
  it('refuses the wrong tier with 403 PREMIUM_REQUIRED', async () => {
    subscriptionFindUnique.mockResolvedValue({ tier: 'BASIC', status: 'ACTIVE' });
    const res = await request(appAs('USER')).get('/pro').expect(403);
    expect(res.body.code).toBe('PREMIUM_REQUIRED');
  });

  it('refuses no subscription with 403, and passes the named tier', async () => {
    subscriptionFindUnique.mockResolvedValue(null);
    await request(appAs('USER')).get('/pro').expect(403);

    subscriptionFindUnique.mockResolvedValue({ tier: 'PRO', status: 'ACTIVE' });
    await request(appAs('USER')).get('/pro').expect(200);
  });
});
