/**
 * What a membership costs, and the two membership routes that had no test at
 * all: the billing portal and cancellation.
 *
 * The price half exists because the platform used to show three different
 * prices for the same thing and charge a fourth. The billing page said A$29 and
 * A$99, lib/pricing.ts said A$29 a month or A$290 a year, the server's own
 * pricing table said A$9.99, and the Pro button started a checkout for whatever
 * the Stripe price really was. /plans now reads the Stripe price checkout will
 * charge, and these tests hold it to that: the number comes from Stripe, a
 * placeholder price shows no number, and a failure shows no number rather than
 * a remembered or invented one.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
  },
}));

let currentUser: any = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
    // Signed in or not, as each test sets it, without a real token.
    optionalAuth: (req: any, _res: any, next: any) => {
      if (currentUser) req.user = { ...currentUser };
      next();
    },
  };
});

// Real-looking ids for every tier except Creator, which is left on its
// placeholder the way an unfinished deployment would be.
jest.mock('../../config/regions', () => {
  const actual: any = jest.requireActual('../../config/regions');
  const ids: Record<string, string> = {
    PREMIUM_CAREER: 'price_1CareerLive',
    PREMIUM_PROFESSIONAL: 'price_1ProfessionalLive',
    PREMIUM_ENTREPRENEUR: 'price_1EntrepreneurLive',
    PREMIUM_CREATOR: 'price_creator',
  };
  return { ...actual, getPriceIdForTier: (tier: string) => ids[tier] };
});

const stripePrices: Record<string, any> = {
  price_1CareerLive: {
    id: 'price_1CareerLive',
    active: true,
    unit_amount: 999,
    currency: 'aud',
    recurring: { interval: 'month', interval_count: 1 },
  },
  price_1ProfessionalLive: {
    id: 'price_1ProfessionalLive',
    active: true,
    unit_amount: 2499,
    currency: 'aud',
    recurring: { interval: 'month', interval_count: 1 },
  },
  price_1EntrepreneurLive: {
    id: 'price_1EntrepreneurLive',
    active: false,
    unit_amount: 1999,
    currency: 'aud',
    recurring: { interval: 'month', interval_count: 1 },
  },
};

const stripeClient = {
  prices: {
    retrieve: jest.fn(async (id: string): Promise<any> => {
      const price = stripePrices[id];
      if (!price) throw Object.assign(new Error(`No such price: '${id}'`), { code: 'resource_missing' });
      return price;
    }),
  },
  billingPortal: {
    sessions: { create: jest.fn(async (): Promise<any> => ({ url: 'https://billing.stripe.com/p/session_1' })) },
  },
  subscriptions: { update: jest.fn(async (_id: string, _params: any): Promise<any> => ({})) },
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
import { clearPlanPriceCache } from '../../services/payments-orchestration.service';
import {
  CREATOR_REVENUE_SHARE_PERCENT,
  ESCROW_DEFAULT_FEE_PERCENT,
  GIFT_POINT_VALUE_AUD,
  MENTOR_PLATFORM_FEE_RATE,
  MINIMUM_PAYOUT_AUD,
  REFUND_DAYS,
  TRIAL_DAYS,
} from '../../config/price-book';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  clearPlanPriceCache();
  currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
  prisma.user.findUnique.mockResolvedValue({ region: 'ANZ', preferredCurrency: null });
});

const planFor = (body: any, tier: string) => body.data.plans.find((p: any) => p.tier === tier);

describe('GET /api/subscriptions/plans', () => {
  it('prices each tier from the Stripe price checkout will charge', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.currency).toBe('AUD');
    expect(planFor(res.body, 'PREMIUM_CAREER')).toEqual({
      tier: 'PREMIUM_CAREER',
      available: true,
      currency: 'AUD',
      unitAmount: 999,
      amount: 9.99,
      interval: 'month',
      intervalCount: 1,
    });
    expect(stripeClient.prices.retrieve).toHaveBeenCalledWith('price_1CareerLive');
  });

  it('shows no price for a tier still on its placeholder id, and does not ask Stripe about it', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(planFor(res.body, 'PREMIUM_CREATOR')).toEqual({ tier: 'PREMIUM_CREATOR', available: false });
    expect(stripeClient.prices.retrieve).not.toHaveBeenCalledWith('price_creator');
  });

  it('shows no price for a price that has been switched off in Stripe', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(planFor(res.body, 'PREMIUM_ENTREPRENEUR').available).toBe(false);
  });

  it('never offers a tier checkout would refuse', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);
    const tiers = res.body.data.plans.map((p: any) => p.tier);

    // ENTERPRISE is what the billing page's button used to send, and checkout
    // answered it with a 400 every time.
    expect(tiers).not.toContain('ENTERPRISE');
    expect(tiers).toEqual(['PREMIUM_CAREER', 'PREMIUM_PROFESSIONAL', 'PREMIUM_ENTREPRENEUR', 'PREMIUM_CREATOR']);
  });

  it('shows no number rather than an old one when Stripe cannot be asked, and asks again next time', async () => {
    stripeClient.prices.retrieve.mockRejectedValueOnce(new Error('stripe is down'));

    const first = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(planFor(first.body, 'PREMIUM_CAREER').available).toBe(false);
    expect(planFor(first.body, 'PREMIUM_CAREER').amount).toBeUndefined();

    // A failed read is not cached, so the outage is not remembered after it ends.
    const second = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(planFor(second.body, 'PREMIUM_CAREER').amount).toBe(9.99);
  });

  it('prices a signed-in member in the currency checkout will charge her in', async () => {
    prisma.user.findUnique.mockResolvedValue({ region: 'ANZ', preferredCurrency: 'nzd' });

    const res = await request(app).get('/api/subscriptions/plans?currency=USD').expect(200);

    // Her own preference, not the query string, because that is what checkout reads.
    expect(res.body.data.currency).toBe('NZD');
  });

  it('prices a visitor in the currency she asks for, and in Australian dollars otherwise', async () => {
    currentUser = null;

    const asked = await request(app).get('/api/subscriptions/plans?currency=usd').expect(200);
    expect(asked.body.data.currency).toBe('USD');

    const nonsense = await request(app).get('/api/subscriptions/plans?currency=%3Cscript%3E').expect(200);
    expect(nonsense.body.data.currency).toBe('AUD');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

/**
 * The numbers a price page prints beside the price - the trial, the refund
 * window, what ATHENA keeps, the GST sentence - come from the one price book,
 * so a page that reads this cannot say one thing while checkout and the Terms
 * say another.
 */
describe('GET /api/subscriptions/plans: the rest of the price book', () => {
  const saved = {
    abn: process.env.ATHENA_ABN,
    from: process.env.ATHENA_GST_REGISTERED_FROM,
  };

  afterEach(() => {
    if (saved.abn === undefined) delete process.env.ATHENA_ABN;
    else process.env.ATHENA_ABN = saved.abn;
    if (saved.from === undefined) delete process.env.ATHENA_GST_REGISTERED_FROM;
    else process.env.ATHENA_GST_REGISTERED_FROM = saved.from;
  });

  it('serves the trial, the refund window and the fees from the book', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.trialDays).toBe(TRIAL_DAYS);
    expect(res.body.data.refundDays).toBe(REFUND_DAYS);
    expect(res.body.data.fees).toEqual({
      mentoringPlatformPercent: Math.round(MENTOR_PLATFORM_FEE_RATE * 100),
      marketplacePlatformPercent: ESCROW_DEFAULT_FEE_PERCENT,
      creatorSharePercent: { ...CREATOR_REVENUE_SHARE_PERCENT },
      giftPointValueAud: GIFT_POINT_VALUE_AUD,
      minimumPayoutAud: MINIMUM_PAYOUT_AUD,
    });
  });

  it('says plainly that no GST is added while ATHENA is not registered', async () => {
    delete process.env.ATHENA_ABN;
    delete process.env.ATHENA_GST_REGISTERED_FROM;

    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.gst.registered).toBe(false);
    expect(res.body.data.gst.statement).toMatch(/not registered for GST/);
    expect(res.body.data.gst.statement).toMatch(/AUD/);
  });

  it('says prices include GST once there is an ABN and a registration that has begun', async () => {
    // Passes the ABN checksum, which is the only reason it is used.
    process.env.ATHENA_ABN = '51824753556';
    process.env.ATHENA_GST_REGISTERED_FROM = '2020-01-01';

    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.gst.registered).toBe(true);
    expect(res.body.data.gst.statement).toMatch(/include GST/);
  });

  it('does not claim a registration that has not begun, or an ABN with no registration', async () => {
    process.env.ATHENA_ABN = '51824753556';
    process.env.ATHENA_GST_REGISTERED_FROM = '2999-01-01';
    const notYet = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(notYet.body.data.gst.registered).toBe(false);

    delete process.env.ATHENA_GST_REGISTERED_FROM;
    const abnOnly = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(abnOnly.body.data.gst.registered).toBe(false);
  });

  it('sends no GST sentence beside a price in another currency, because it opens "Prices are in Australian dollars"', async () => {
    // A deployment that has set up a US-dollar price for a member who chose US
    // dollars shows that price. The sentence would sit beside it and be false.
    const career = stripePrices.price_1CareerLive;
    const was = career.currency;
    career.currency = 'usd';
    try {
      const res = await request(app).get('/api/subscriptions/plans').expect(200);

      expect(planFor(res.body, 'PREMIUM_CAREER').currency).toBe('USD');
      expect(res.body.data.gst).toBeNull();
      // The rest of the book is still served.
      expect(res.body.data.trialDays).toBe(TRIAL_DAYS);
    } finally {
      career.currency = was;
    }
  });
});

describe('GET /api/payments/pricing, which the mobile upgrade screen reads', () => {
  it('reports the Stripe prices, not a table of its own', async () => {
    const { body: pricing } = await request(app).get('/api/payments/pricing?region=AU').expect(200);

    expect(pricing.currency).toBe('AUD');
    // Career and Professional are live monthly prices. Entrepreneur is switched
    // off and Creator is a placeholder, so they are left out, not guessed at.
    expect(pricing.subscriptionTiers).toEqual({ PREMIUM_CAREER: 9.99, PREMIUM_PROFESSIONAL: 24.99 });
  });

  it('leaves out a yearly price rather than showing it as a monthly one', async () => {
    stripePrices.price_1ProfessionalLive.recurring = { interval: 'year', interval_count: 1 };
    try {
      const { body: pricing } = await request(app).get('/api/payments/pricing?region=AU').expect(200);
      expect(pricing.subscriptionTiers).toEqual({ PREMIUM_CAREER: 9.99 });
      expect(pricing.prices.find((p: any) => p.tier === 'PREMIUM_PROFESSIONAL')?.interval).toBe('year');
    } finally {
      stripePrices.price_1ProfessionalLive.recurring = { interval: 'month', interval_count: 1 };
    }
  });
});

describe('POST /api/subscriptions/portal', () => {
  it('opens the portal for her own Stripe customer and brings her back to a page that exists', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeCustomerId: 'cus_mei' });

    const res = await request(app).post('/api/subscriptions/portal').expect(200);

    expect(res.body.data.url).toBe('https://billing.stripe.com/p/session_1');
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({ where: { userId: 'member-1' } });
    const [params] = stripeClient.billingPortal.sessions.create.mock.calls[0] as any[];
    expect(params.customer).toBe('cus_mei');
    // /settings/billing was a 404.
    expect(params.return_url).toMatch(/\/dashboard\/settings\/billing$/);
  });

  it('refuses a member who has never been a Stripe customer, without calling Stripe', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeCustomerId: null });

    await request(app).post('/api/subscriptions/portal').expect(400);
    expect(stripeClient.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/subscriptions/cancel', () => {
  it('cancels her own subscription at the end of the period, not immediately', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_mei' });

    await request(app).post('/api/subscriptions/cancel').expect(200);

    expect(stripeClient.subscriptions.update).toHaveBeenCalledWith('sub_mei', { cancel_at_period_end: true });
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: 'member-1' },
      data: { cancelAtPeriodEnd: true },
    });
  });

  // A cancel is a promise about a date. The page said only that it had been
  // cancelled, which reads as ending now.
  it('says the day the membership ends, as Stripe has it', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_mei' });
    stripeClient.subscriptions.update.mockResolvedValueOnce({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: Math.floor(Date.UTC(2026, 10, 12, 3, 0, 0) / 1000),
    });

    const res = await request(app).post('/api/subscriptions/cancel').expect(200);

    expect(res.body.data).toEqual({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-11-12T03:00:00.000Z',
      trialing: false,
    });
  });

  it('says so when it is a trial she is cancelling, which is the day the first charge would have been taken', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_mei' });
    stripeClient.subscriptions.update.mockResolvedValueOnce({
      status: 'trialing',
      cancel_at_period_end: true,
      current_period_end: Math.floor(Date.UTC(2026, 9, 15, 0, 0, 0) / 1000),
    });

    const res = await request(app).post('/api/subscriptions/cancel').expect(200);

    expect(res.body.data).toMatchObject({ trialing: true, currentPeriodEnd: '2026-10-15T00:00:00.000Z' });
    // Still at the end of the period, never now.
    expect(stripeClient.subscriptions.update).toHaveBeenCalledWith('sub_mei', { cancel_at_period_end: true });
    expect((stripeClient.subscriptions as any).cancel).toBeUndefined();
  });

  it('still cancels, with no date, when Stripe does not give one', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_mei' });

    const res = await request(app).post('/api/subscriptions/cancel').expect(200);

    expect(res.body.data).toEqual({ cancelAtPeriodEnd: true, currentPeriodEnd: null, trialing: false });
  });

  it('cannot cancel somebody else’s subscription: it reads her own row, never one named in the request', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_mei' });

    await request(app).post('/api/subscriptions/cancel').send({ userId: 'someone-else', subscriptionId: 'sub_other' }).expect(200);

    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({ where: { userId: 'member-1' } });
    expect(stripeClient.subscriptions.update).toHaveBeenCalledWith('sub_mei', { cancel_at_period_end: true });
  });

  it('refuses when there is nothing to cancel, and changes nothing', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: null });

    await request(app).post('/api/subscriptions/cancel').expect(400);
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('does not record a cancellation Stripe refused', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_mei' });
    stripeClient.subscriptions.update.mockRejectedValueOnce(new Error('stripe is down'));

    await request(app).post('/api/subscriptions/cancel').expect(500);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/subscriptions/plans: what Free and a paid membership get', () => {
  const CHAT_ENV = ['AI_CHAT_FREE_MAX_REQUESTS', 'AI_CHAT_FREE_WINDOW_SECONDS', 'AI_CHAT_PREMIUM_MAX_REQUESTS', 'AI_CHAT_PREMIUM_WINDOW_SECONDS'];
  const savedChat = Object.fromEntries(CHAT_ENV.map((name) => [name, process.env[name]]));

  afterEach(() => {
    for (const name of CHAT_ENV) {
      if (savedChat[name] === undefined) delete process.env[name];
      else process.env[name] = savedChat[name];
    }
  });

  it('serves the table the paid routes are gated by, so the pricing page prints what the server enforces', async () => {
    for (const name of CHAT_ENV) delete process.env[name];

    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.entitlements).toEqual({
      free: { aiTools: false, aiChat: { messages: 20, windowSeconds: 86_400 } },
      paid: { aiTools: true, aiChat: { messages: 200, windowSeconds: 86_400 } },
    });
  });

  it('follows the chat limits an operator has set, with no change to the page', async () => {
    process.env.AI_CHAT_FREE_MAX_REQUESTS = '12';
    process.env.AI_CHAT_PREMIUM_MAX_REQUESTS = '300';

    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.entitlements.free.aiChat.messages).toBe(12);
    expect(res.body.data.entitlements.paid.aiChat.messages).toBe(300);
  });

  it('lists nothing a plan does not really change: no application cap, mentor limit or course discount', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    for (const plan of ['free', 'paid']) {
      expect(Object.keys(res.body.data.entitlements[plan]).sort()).toEqual(['aiChat', 'aiTools']);
    }
  });

  it('says payments are not paused when nothing has paused them', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.paused).toBe(false);
    expect(res.body.data.pauseMessage).toBeNull();
  });
});
