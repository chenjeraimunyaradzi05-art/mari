/**
 * Changing the plan of a membership that is already running, and reading where
 * it stands.
 *
 * Checkout refuses a member who already has a membership, so a plan change had
 * nowhere to go but the Stripe portal, when the portal happened to be set up for
 * it. POST /api/subscriptions/change-plan moves the one subscription Stripe is
 * billing onto the new tier's price, in the currency she is already billed in,
 * and never charges anything itself: Stripe works out the difference to the day
 * and adds it to, or takes it from, her next bill.
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

// What each tier costs in each currency is read from the environment when the
// table is built, so the resolver is replaced, as the checkout suite does.
const priceIds: Record<string, string> = {
  'PREMIUM_CAREER:AUD': 'price_1CareerAud',
  'PREMIUM_PROFESSIONAL:AUD': 'price_1ProfessionalAud',
  'PREMIUM_CAREER:USD': 'price_1CareerUsd',
};
jest.mock('../../config/regions', () => {
  const actual: any = jest.requireActual('../../config/regions');
  return {
    ...actual,
    getPriceIdForTier: (tier: string, currency: string) =>
      priceIds[`${tier}:${currency.toUpperCase()}`] ?? priceIds[`${tier}:AUD`] ?? 'price_career',
  };
});

const stripeClient = {
  subscriptions: {
    retrieve: jest.fn(async (_id?: string): Promise<any> => ({})),
    update: jest.fn(async (_id?: string, _params?: any): Promise<any> => ({})),
  },
  prices: { retrieve: jest.fn(async (_id?: string): Promise<any> => ({})) },
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
import { resetMemoryRateLimits } from '../../middleware/rateLimiter';
import { PAST_DUE_GRACE_DAYS } from '../../config/price-book';

const prisma: any = prismaTyped;

const DAY = 24 * 60 * 60 * 1000;

const row = (overrides: Record<string, unknown> = {}) => ({
  userId: 'member-1',
  tier: 'PREMIUM_CAREER',
  status: 'ACTIVE',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  stripePriceId: 'price_1CareerAud',
  currency: 'AUD',
  currentPeriodStart: new Date(Date.now() - 3 * DAY),
  currentPeriodEnd: new Date(Date.now() + 27 * DAY),
  ...overrides,
});

const liveSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  status: 'active',
  current_period_end: Math.floor((Date.now() + 27 * DAY) / 1000),
  items: { data: [{ id: 'si_1', price: { id: 'price_1CareerAud', currency: 'aud' } }] },
  ...overrides,
});

const newPrice = (overrides: Record<string, unknown> = {}) => ({
  id: 'price_1ProfessionalAud',
  active: true,
  currency: 'aud',
  unit_amount: 2499,
  recurring: { interval: 'month' },
  ...overrides,
});

describe('POST /api/subscriptions/change-plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMemoryRateLimits();
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
    prisma.subscription.findUnique.mockResolvedValue(row());
    stripeClient.subscriptions.retrieve.mockResolvedValue(liveSubscription());
    stripeClient.subscriptions.update.mockResolvedValue({});
    stripeClient.prices.retrieve.mockResolvedValue(newPrice());
  });

  const change = (tier: unknown = 'PREMIUM_PROFESSIONAL') => request(app).post('/api/subscriptions/change-plan').send({ tier });

  it('swaps the price on the one subscription and asks Stripe to prorate it, rather than starting a second subscription', async () => {
    const res = await change().expect(200);

    expect(stripeClient.subscriptions.update).toHaveBeenCalledTimes(1);
    const [id, params] = stripeClient.subscriptions.update.mock.calls[0] as any[];
    expect(id).toBe('sub_1');
    expect(params).toEqual({
      items: [{ id: 'si_1', price: 'price_1ProfessionalAud' }],
      proration_behavior: 'create_prorations',
    });
    expect(res.body.data.tier).toBe('PREMIUM_PROFESSIONAL');
    expect(res.body.message).toMatch(/worked out to the day/);
  });

  it('writes the new tier, price and amount on her row at once, so the page she is looking at is right', async () => {
    await change().expect(200);

    const data = prisma.subscription.update.mock.calls[0][0].data;
    expect(prisma.subscription.update.mock.calls[0][0].where).toEqual({ userId: 'member-1' });
    expect(data).toMatchObject({ tier: 'PREMIUM_PROFESSIONAL', stripePriceId: 'price_1ProfessionalAud', currency: 'AUD', interval: 'month' });
    expect(String(data.amount)).toBe('24.99');
  });

  it('says a trial carries on, and that nothing is charged until it ends', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row({ status: 'TRIALING' }));
    stripeClient.subscriptions.retrieve.mockResolvedValue(liveSubscription({ status: 'trialing' }));

    const res = await change().expect(200);

    expect(res.body.data.trialing).toBe(true);
    expect(res.body.message).toMatch(/free trial carries on/);
  });

  it('looks the price up in the currency she is billed in, not the one she has since chosen', async () => {
    stripeClient.subscriptions.retrieve.mockResolvedValue(
      liveSubscription({ items: { data: [{ id: 'si_1', price: { id: 'price_1ProfessionalUsd', currency: 'usd' } }] } })
    );
    stripeClient.prices.retrieve.mockResolvedValue(newPrice({ id: 'price_1CareerUsd', currency: 'usd' }));
    prisma.subscription.findUnique.mockResolvedValue(row({ tier: 'PREMIUM_PROFESSIONAL', currency: 'USD' }));

    await change('PREMIUM_CAREER').expect(200);

    expect(stripeClient.prices.retrieve).toHaveBeenCalledWith('price_1CareerUsd');
    expect((stripeClient.subscriptions.update.mock.calls[0] as any[])[1].items[0].price).toBe('price_1CareerUsd');
  });

  it('refuses, and changes nothing, when the new tier has no price in her currency', async () => {
    // getPriceIdForTier falls back to the Australian-dollar price, which Stripe
    // would refuse for a subscription billed in another currency.
    stripeClient.subscriptions.retrieve.mockResolvedValue(
      liveSubscription({ items: { data: [{ id: 'si_1', price: { id: 'price_x', currency: 'usd' } }] } })
    );
    stripeClient.prices.retrieve.mockResolvedValue(newPrice({ currency: 'aud' }));

    const res = await change().expect(409);

    expect(res.body.message).toMatch(/not available in USD/);
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('refuses a price that is not active at Stripe', async () => {
    stripeClient.prices.retrieve.mockResolvedValue(newPrice({ active: false }));

    await change().expect(409);

    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('refuses a tier the server does not sell, without touching Stripe', async () => {
    await change('ENTERPRISE').expect(400);
    await change('FREE').expect(400);
    await request(app).post('/api/subscriptions/change-plan').send({}).expect(400);

    expect(stripeClient.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('refuses a free member, who has nothing to change, and points her at the plans', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row({ tier: 'FREE', stripeSubscriptionId: null, status: 'ACTIVE' }));

    const res = await change().expect(409);

    expect(res.body.message).toMatch(/do not have a membership to change/);
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('refuses a member with no subscription row at all', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);

    await change().expect(409);

    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('refuses a cancelled membership', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row({ status: 'CANCELED', stripeSubscriptionId: null }));

    await change().expect(409);

    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('asks a member whose payment failed to put her card right first', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row({ status: 'PAST_DUE' }));

    const res = await change().expect(409);

    expect(res.body.message).toMatch(/Update your card with Manage billing first/);
    expect(stripeClient.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('says so when she is already on the plan', async () => {
    const res = await change('PREMIUM_CAREER').expect(400);

    expect(res.body.message).toMatch(/already on this plan/);
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('says so when the price she is on is already the tier asked for, even if our row lags', async () => {
    stripeClient.subscriptions.retrieve.mockResolvedValue(
      liveSubscription({ items: { data: [{ id: 'si_1', price: { id: 'price_1ProfessionalAud', currency: 'aud' } }] } })
    );

    await change().expect(400);

    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('refuses when Stripe says the membership is no longer active, whatever our row says', async () => {
    stripeClient.subscriptions.retrieve.mockResolvedValue(liveSubscription({ status: 'canceled' }));

    await change().expect(409);

    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('will not guess which price to swap on a subscription with more than one', async () => {
    stripeClient.subscriptions.retrieve.mockResolvedValue(
      liveSubscription({
        items: {
          data: [
            { id: 'si_1', price: { id: 'price_1CareerAud', currency: 'aud' } },
            { id: 'si_2', price: { id: 'price_addon', currency: 'aud' } },
          ],
        },
      })
    );

    await change().expect(409);

    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('refuses a placeholder price id with a 503, the same as checkout', async () => {
    priceIds['PREMIUM_PROFESSIONAL:AUD'] = 'price_professional';
    try {
      await change().expect(503);
      expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
    } finally {
      priceIds['PREMIUM_PROFESSIONAL:AUD'] = 'price_1ProfessionalAud';
    }
  });

  it('does not write her row when Stripe refuses the change', async () => {
    stripeClient.subscriptions.update.mockRejectedValueOnce(new Error('card_declined'));

    await change().expect(500);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/subscriptions/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
  });

  it('says the paid tools are on for a membership that is paid up', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row());

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data).toMatchObject({ tier: 'PREMIUM_CAREER', status: 'ACTIVE', entitled: true, graceEndsAt: null });
  });

  it('gives the day the tools pause for a payment that failed, and says they are still on until then', async () => {
    const began = new Date(Date.now() - 2 * DAY);
    prisma.subscription.findUnique.mockResolvedValue(row({ status: 'PAST_DUE', currentPeriodStart: began }));

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data.entitled).toBe(true);
    expect(new Date(res.body.data.graceEndsAt).getTime()).toBe(began.getTime() + PAST_DUE_GRACE_DAYS * DAY);
  });

  it('says they are paused once the grace has gone by', async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      row({ status: 'PAST_DUE', currentPeriodStart: new Date(Date.now() - (PAST_DUE_GRACE_DAYS + 3) * DAY) })
    );

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data.entitled).toBe(false);
    expect(res.body.data.graceEndsAt).toEqual(expect.any(String));
  });

  it('is not entitled on the free plan', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row({ tier: 'FREE', status: 'ACTIVE', stripeSubscriptionId: null }));

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data.entitled).toBe(false);
  });
});

describe('GET /api/subscriptions/me: what she gets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
  });

  it('carries the entitlements for a membership that is paid up: the tools and the larger chat window', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row());

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data.entitlements).toMatchObject({ plan: 'paid', tier: 'PREMIUM_CAREER', status: 'ACTIVE', aiTools: true });
    expect(res.body.data.entitlements.aiChat.messages).toBeGreaterThan(0);
  });

  it('says a membership past its grace has the free entitlements, which is what the AI routes will answer her with', async () => {
    prisma.subscription.findUnique.mockResolvedValue(
      row({ status: 'PAST_DUE', currentPeriodStart: new Date(Date.now() - (PAST_DUE_GRACE_DAYS + 3) * DAY) })
    );

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data.entitlements).toMatchObject({ plan: 'free', aiTools: false, status: 'PAST_DUE' });
    expect(res.body.data.entitled).toBe(false);
  });

  it('and the two agree for a free member', async () => {
    prisma.subscription.findUnique.mockResolvedValue(row({ tier: 'FREE', status: 'ACTIVE', stripeSubscriptionId: null }));

    const res = await request(app).get('/api/subscriptions/me').expect(200);

    expect(res.body.data.entitlements.plan).toBe('free');
    expect(res.body.data.entitled).toBe(false);
  });
});
