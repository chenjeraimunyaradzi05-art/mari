import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subscription: {
      findMany: jest.fn(async () => []),
    },
    featureFlag: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(),
    },
  },
}));

// The role a request carries comes from a header so one suite can play both
// the admin the routes are for and the member they must refuse. requireRole
// is a real check here, not a pass-through, so a route that forgot to ask for
// ADMIN would fail the refusal test.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'staff-1', role: String(req.headers['x-test-role'] || 'ADMIN'), email: 'staff@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' }),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { resetMaintenanceCache } from '../../services/feature-flags.service';
import { monthlyAmount } from '../admin-config.routes';

const prisma: any = prismaTyped;

const WATCHED = [
  'STRIPE_SECRET_KEY',
  'SENDGRID_API_KEY',
  'REDIS_URL',
  'RATE_LIMIT_MAX',
  'RATE_LIMIT_WINDOW_MS',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'CDN_URL',
  'AI_OPENAI_API_KEY',
  'OPENAI_API_KEY',
  'OPENSEARCH_NODE',
  'OPENSEARCH_ENABLED',
  'SENTRY_DSN',
];

describe('GET /api/admin/ops/config', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    resetMaintenanceCache();
    for (const key of WATCHED) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of WATCHED) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('refuses anyone who is not an admin', async () => {
    const res = await request(app).get('/api/admin/ops/config').set('x-test-role', 'USER');
    expect(res.status).toBe(403);

    const moderator = await request(app).get('/api/admin/ops/config').set('x-test-role', 'MODERATOR');
    expect(moderator.status).toBe(403);
  });

  it('reports what is configured without leaking a single value', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_LEAKMENOT_stripe';
    process.env.SENDGRID_API_KEY = 'SG.LEAKMENOT_sendgrid';
    process.env.REDIS_URL = 'redis://:LEAKMENOT_password@cache.internal:6379';
    process.env.AI_OPENAI_API_KEY = 'sk-LEAKMENOT_openai';
    process.env.RATE_LIMIT_MAX = '250';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    const res = await request(app).get('/api/admin/ops/config');

    expect(res.status).toBe(200);
    expect(res.body.integrations).toMatchObject({ stripe: true, email: true, redis: true, ai: true, sentry: false });
    expect(res.body.rateLimit).toMatchObject({ max: 250, windowMs: 60000 });
    expect(res.body.storage.backend).toBe('local');
    expect(res.body.maintenance).toMatchObject({ enabled: false });
    expect(res.body.security.staffTwoFactor).toMatch(/^(required|optional)$/);

    // The lifetimes are measured from a signed token, so they are real numbers
    // and the refresh token outlives the access token.
    expect(res.body.tokens.accessSeconds).toBeGreaterThan(0);
    expect(res.body.tokens.refreshSeconds).toBeGreaterThan(res.body.tokens.accessSeconds);

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain('LEAKMENOT');
    expect(serialised).not.toContain('cache.internal');
    expect(serialised).not.toContain(process.env.JWT_SECRET || 'dev-only-secret-not-for-production');
  });

  it('treats a placeholder from .env.example as not configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_configured';
    process.env.SENDGRID_API_KEY = '   ';

    const res = await request(app).get('/api/admin/ops/config');

    expect(res.status).toBe(200);
    expect(res.body.integrations.stripe).toBe(false);
    expect(res.body.integrations.email).toBe(false);
    expect(res.body.build.commitSha === null || typeof res.body.build.commitSha === 'string').toBe(true);
  });
});

describe('GET /api/admin/ops/revenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses anyone who is not an admin', async () => {
    const res = await request(app).get('/api/admin/ops/revenue').set('x-test-role', 'USER');
    expect(res.status).toBe(403);
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it('only counts paying tiers that are active or trialing', async () => {
    await request(app).get('/api/admin/ops/revenue');

    expect(prisma.subscription.findMany.mock.calls.at(-1)[0].where).toEqual({
      status: { in: ['ACTIVE', 'TRIALING'] },
      tier: { not: 'FREE' },
    });
  });

  it('normalises a yearly amount to a month and reports the unrecorded ones instead of pricing them', async () => {
    prisma.subscription.findMany.mockResolvedValueOnce([
      { tier: 'PREMIUM_PROFESSIONAL', status: 'ACTIVE', amount: '24.99', interval: 'month', currency: 'aud' },
      { tier: 'PREMIUM_PROFESSIONAL', status: 'TRIALING', amount: '240', interval: 'year', currency: 'AUD' },
      { tier: 'ENTERPRISE', status: 'ACTIVE', amount: null, interval: null, currency: null },
    ]);

    const res = await request(app).get('/api/admin/ops/revenue');

    expect(res.status).toBe(200);
    expect(res.body.mrr).toBe(44.99);
    expect(res.body.arr).toBe(539.88);
    expect(res.body.currency).toBe('AUD');
    expect(res.body.mixedCurrencies).toBe(false);
    expect(res.body.subscriptions).toEqual({ paying: 3, recorded: 2, notRecorded: 1 });

    const enterprise = res.body.byTier.find((t: any) => t.tier === 'ENTERPRISE');
    expect(enterprise).toMatchObject({ count: 1, recorded: 0, notRecorded: 1, mrr: null });
    const professional = res.body.byTier.find((t: any) => t.tier === 'PREMIUM_PROFESSIONAL');
    expect(professional).toMatchObject({ count: 2, recorded: 2, notRecorded: 0, mrr: 44.99, currency: 'AUD' });
  });

  it('answers null, not zero, when no amount was recorded at all', async () => {
    prisma.subscription.findMany.mockResolvedValueOnce([
      { tier: 'ENTERPRISE', status: 'ACTIVE', amount: null, interval: null, currency: null },
      { tier: 'PREMIUM_CAREER', status: 'ACTIVE', amount: '9.99', interval: null, currency: 'AUD' },
    ]);

    const res = await request(app).get('/api/admin/ops/revenue');

    expect(res.body.mrr).toBeNull();
    expect(res.body.arr).toBeNull();
    expect(res.body.subscriptions).toEqual({ paying: 2, recorded: 0, notRecorded: 2 });
  });

  it('does not add two currencies into one figure', async () => {
    prisma.subscription.findMany.mockResolvedValueOnce([
      { tier: 'PREMIUM_CAREER', status: 'ACTIVE', amount: '9.99', interval: 'month', currency: 'AUD' },
      { tier: 'PREMIUM_CAREER', status: 'ACTIVE', amount: '6.99', interval: 'month', currency: 'USD' },
    ]);

    const res = await request(app).get('/api/admin/ops/revenue');

    expect(res.body.mrr).toBeNull();
    expect(res.body.mixedCurrencies).toBe(true);
    expect(res.body.subscriptions.recorded).toBe(2);
  });
});

describe('monthlyAmount', () => {
  it('divides a year by twelve and leaves the unknown alone', () => {
    expect(monthlyAmount('120', 'year')).toBe(10);
    expect(monthlyAmount(29, 'month')).toBe(29);
    expect(monthlyAmount(29, 'fortnight')).toBeNull();
    expect(monthlyAmount(null, 'month')).toBeNull();
    expect(monthlyAmount('not a number', 'month')).toBeNull();
  });
});
