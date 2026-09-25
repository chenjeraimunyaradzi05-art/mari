/**
 * The paid-membership checkout, which had no test file of its own.
 *
 * What is covered here is the guard that stops a member being sent to Stripe
 * with a price that does not exist. Every tier's price id falls back to a
 * literal — 'price_career', 'price_professional' and so on — when its
 * STRIPE_PRICE_* variable is unset, and nothing validates those at boot: a
 * deployment with no Stripe configuration at all starts cleanly, and the first
 * anyone hears of it is a woman pressing Upgrade and getting Stripe's
 * 'No such price: price_career' back as a 500 after a customer record has
 * already been created in her name.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
  },
}));

let currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

// The price ids in config/regions are read from the environment at import
// time, so they cannot be changed from inside a test. The resolver is replaced
// instead, which is the seam the route actually depends on.
let resolvedPriceId = 'price_career';
jest.mock('../../config/regions', () => {
  const actual: any = jest.requireActual('../../config/regions');
  return { ...actual, getPriceIdForTier: () => resolvedPriceId };
});

const stripeClient = {
  customers: { create: jest.fn(async (): Promise<any> => ({ id: 'cus_1' })) },
  subscriptions: { list: jest.fn(async (): Promise<any> => ({ data: [] })) },
  checkout: {
    sessions: {
      create: jest.fn(async (): Promise<any> => ({ id: 'cs_1', url: 'https://checkout.stripe.com/cs_1' })),
    },
  },
};
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripeClient,
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('POST /api/subscriptions/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolvedPriceId = 'price_1LiveCareerAud';
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      email: 'mei@example.com',
      firstName: 'Mei',
      lastName: 'Chen',
      country: 'Australia',
      subscription: { stripeCustomerId: 'cus_existing' },
    });
  });

  it('starts a checkout for a configured tier', async () => {
    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .send({ tier: 'PREMIUM_CAREER' })
      .expect(200);

    expect(res.body.data.sessionId).toBe('cs_1');
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalled();
  });

  it('refuses a tier the server does not sell, without touching Stripe', async () => {
    // 'ENTERPRISE' is the one the billing page's own button still sends.
    await request(app).post('/api/subscriptions/checkout').send({ tier: 'ENTERPRISE' }).expect(400);

    expect(stripeClient.customers.create).not.toHaveBeenCalled();
    expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('refuses an upgrade against a placeholder price id, and says the deployment is not configured', async () => {
    resolvedPriceId = 'price_career';

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .send({ tier: 'PREMIUM_CAREER' })
      .expect(503);

    expect(res.body.error?.message ?? res.body.message).toMatch(/not configured/i);
    expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('does not leave a Stripe customer behind for a checkout that could never start', async () => {
    // The price is resolved before the customer is created, so an unconfigured
    // deployment refuses the upgrade without first putting a record in this
    // member's name at Stripe that nothing will ever use.
    resolvedPriceId = 'price_entrepreneur';
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      email: 'mei@example.com',
      firstName: 'Mei',
      lastName: 'Chen',
      country: 'Australia',
      subscription: null,
    });

    await request(app)
      .post('/api/subscriptions/checkout')
      .send({ tier: 'PREMIUM_ENTREPRENEUR' })
      .expect(503);

    expect(stripeClient.customers.create).not.toHaveBeenCalled();
  });
});
