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
  subscriptions: { list: jest.fn(async (_params?: any): Promise<any> => ({ data: [] })) },
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
import { TRIAL_DAYS } from '../../config/price-book';
import { resetMemoryRateLimits } from '../../middleware/rateLimiter';

const prisma: any = prismaTyped;

describe('POST /api/subscriptions/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // One member makes every request here, and a member may start only so many
    // payments an hour (middleware/moneyLimits.ts), so the window starts empty.
    resetMemoryRateLimits();
    // clearAllMocks keeps an implementation a test queued with mockResolvedValueOnce
    // only until it is used; the default for a fresh customer is no history.
    stripeClient.subscriptions.list.mockResolvedValue({ data: [] });
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

  it('keys the customer and the session on the member, so two taps on Upgrade make one of each at Stripe', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      email: 'mei@example.com',
      firstName: 'Mei',
      lastName: 'Chen',
      country: 'Australia',
      subscription: { stripeCustomerId: null },
    });

    await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

    const customerOptions = (stripeClient.customers.create.mock.calls[0] as any[])[1];
    expect(customerOptions.idempotencyKey).toMatch(/^membership-customer-member-1-\d+$/);
    const sessionOptions = (stripeClient.checkout.sessions.create.mock.calls[0] as any[])[1];
    // Her, the tier, the currency and the minute: a second tab in the same
    // minute shares the session; another tier is another session.
    expect(sessionOptions.idempotencyKey).toMatch(/^membership-checkout-member-1-PREMIUM_CAREER-[A-Z]{3}-\d+$/);
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

  describe('the free trial', () => {
    const sessionParams = () => (stripeClient.checkout.sessions.create.mock.calls[0] as any[])[0];

    it('gives a first-time subscriber the trial, with the card collected up front', async () => {
      stripeClient.subscriptions.list.mockResolvedValueOnce({ data: [] });

      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

      const params = sessionParams();
      expect(params.subscription_data.trial_period_days).toBe(TRIAL_DAYS);
      expect(params.metadata.trialGranted).toBe('true');
      // A card trial, and it says so: the card is collected at the start and
      // charged when the trial ends. Not a no-card trial that converts.
      expect(params.payment_method_collection).toBe('always');
      expect(params.payment_method_types).toEqual(['card']);
    });

    it('says, under the button, when the first charge comes and how to stop it', async () => {
      stripeClient.subscriptions.list.mockResolvedValueOnce({ data: [] });

      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

      const message: string = sessionParams().custom_text.submit.message;
      expect(message).toContain(`${TRIAL_DAYS}-day free trial`);
      expect(message).toMatch(/nothing is charged now/i);
      expect(message).toMatch(/charged .* on the day the trial ends/i);
      expect(message).toMatch(/cancel/i);
      // Stripe caps this field; a message it refuses would fail the checkout.
      expect(message.length).toBeLessThanOrEqual(1200);
    });

    // Stripe would grant a fresh trial on every new subscription, so a member
    // could cancel and resubscribe for ever and never pay.
    it('gives no second trial to a customer who has had a subscription before', async () => {
      stripeClient.subscriptions.list.mockResolvedValueOnce({ data: [{ id: 'sub_old', status: 'canceled' }] });

      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

      const params = sessionParams();
      expect(params.subscription_data).toBeUndefined();
      expect(JSON.stringify(params)).not.toContain('trial_period_days');
      expect(params.metadata.trialGranted).toBe('false');
      expect(params.custom_text.submit.message).toMatch(/charged .* today/i);
      expect(params.custom_text.submit.message).not.toMatch(/free trial/i);
    });

    it('looks for earlier subscriptions of every status, not only the live ones', async () => {
      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

      expect(stripeClient.subscriptions.list).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing', status: 'all' })
      );
    });
  });

  // A second checkout used to make a second Stripe subscription: the webhook then
  // pointed her row at the new one and the first went on billing her card with
  // nothing of ours pointing at it. Stripe is asked rather than the row, because
  // a membership bought a moment ago is not on the row until its webhook arrives.
  describe('a member who already has a membership', () => {
    it.each(['active', 'trialing', 'past_due'])('is refused when Stripe has one that is %s, and nothing is created', async (status) => {
      stripeClient.subscriptions.list.mockResolvedValueOnce({ data: [{ id: 'sub_live', status, cancel_at_period_end: false }] });

      const res = await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(409);

      expect(res.body.message).toMatch(/already have an ATHENA membership/i);
      expect(res.body.message).toMatch(/Manage billing/);
      expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('is refused even when her row on our side has not caught up yet, because Stripe is the one asked', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'member-1',
        email: 'mei@example.com',
        firstName: 'Mei',
        lastName: 'Chen',
        country: 'Australia',
        subscription: { stripeCustomerId: 'cus_existing', tier: 'FREE', status: 'ACTIVE', stripeSubscriptionId: null },
      });
      stripeClient.subscriptions.list.mockResolvedValueOnce({ data: [{ id: 'sub_just_bought', status: 'trialing' }] });

      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(409);

      expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('is told the day a membership she cancelled ends, and that she keeps it until then', async () => {
      const endsAt = Math.floor(new Date('2026-11-14T00:00:00Z').getTime() / 1000);
      stripeClient.subscriptions.list.mockResolvedValueOnce({
        data: [{ id: 'sub_live', status: 'active', cancel_at_period_end: true, current_period_end: endsAt }],
      });

      const res = await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(409);

      expect(res.body.message).toMatch(/set to end on 14 November 2026/);
      expect(res.body.message).toMatch(/not be charged twice/);
    });

    it('is let through when every earlier membership has ended, whatever a stale row still says', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'member-1',
        email: 'mei@example.com',
        firstName: 'Mei',
        lastName: 'Chen',
        country: 'Australia',
        subscription: { stripeCustomerId: 'cus_existing', tier: 'PREMIUM_CAREER', status: 'ACTIVE', stripeSubscriptionId: 'sub_old' },
      });
      stripeClient.subscriptions.list.mockResolvedValueOnce({
        data: [
          { id: 'sub_old', status: 'canceled' },
          { id: 'sub_older', status: 'incomplete_expired' },
        ],
      });

      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

      expect(stripeClient.checkout.sessions.create).toHaveBeenCalled();
    });

    it('looks through up to a hundred subscriptions, so a live one is not hidden behind ended ones', async () => {
      await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

      expect(stripeClient.subscriptions.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });
  });

  // Checkout is built on the server from a tier the member names and a price id
  // held in configuration. Nothing the browser sends can change what is charged.
  describe('a tampered request', () => {
    it('ignores a price, an amount, a currency, a trial length and return addresses in the body', async () => {
      resolvedPriceId = 'price_1LiveCareerAud';

      await request(app)
        .post('/api/subscriptions/checkout')
        .send({
          tier: 'PREMIUM_CAREER',
          priceId: 'price_attackers_own',
          price: 'price_attackers_own',
          amount: 1,
          unit_amount: 1,
          currency: 'jpy',
          trial_period_days: 3650,
          line_items: [{ price: 'price_attackers_own', quantity: 100 }],
          success_url: 'https://evil.example/thanks',
          cancel_url: 'https://evil.example/no',
          metadata: { tier: 'PREMIUM_CREATOR', userId: 'someone-else' },
        })
        .expect(200);

      const params = (stripeClient.checkout.sessions.create.mock.calls[0] as any[])[0];
      expect(params.line_items).toEqual([{ price: 'price_1LiveCareerAud', quantity: 1 }]);
      expect(params.subscription_data.trial_period_days).toBe(TRIAL_DAYS);
      // The tier and the member in the signed metadata are the server's own.
      expect(params.metadata).toMatchObject({ userId: 'member-1', tier: 'PREMIUM_CAREER' });
      expect(params.customer).toBe('cus_existing');
      expect(params.success_url).not.toContain('evil.example');
      expect(params.cancel_url).not.toContain('evil.example');
      const serialised = JSON.stringify(params);
      expect(serialised).not.toContain('price_attackers_own');
      expect(serialised).not.toContain('unit_amount');
      expect(serialised).not.toContain('jpy');
    });

    it('refuses a tier that is not on the list, whatever else the body says', async () => {
      await request(app)
        .post('/api/subscriptions/checkout')
        .send({ tier: 'FREE', priceId: 'price_1LiveCareerAud' })
        .expect(400);
      await request(app).post('/api/subscriptions/checkout').send({ priceId: 'price_1LiveCareerAud' }).expect(400);

      expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
    });
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
