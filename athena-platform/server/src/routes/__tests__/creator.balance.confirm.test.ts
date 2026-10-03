import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('stripe', () => ({
  __esModule: true,
  default: (() => {
    const stripeClient = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      transfers: {
        create: jest.fn(),
      },
      accountLinks: {
        create: jest.fn(),
      },
      accounts: {
        createLoginLink: jest.fn(),
      },
    };

    return jest.fn().mockImplementation(() => stripeClient);
  })(),
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    giftBalancePurchase: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import Stripe from 'stripe';
import { app } from '../../index';
import { prisma } from '../../utils/prisma';

function getStripeInstance(): any {
  const ctor: any = Stripe as any;
  // jest.clearAllMocks() resets mock.calls/results/instances; ensure we have one.
  if (!ctor.mock.results?.[0]?.value) {
    // eslint-disable-next-line new-cap
    new ctor('sk_test', { apiVersion: '2023-10-16' });
  }
  // For mocked constructors that return an explicit object, Jest tracks the returned
  // value in mock.results; mock.instances can be the raw `this` without our fields.
  return ctor.mock.results[0].value;
}

/**
 * An intent as Stripe returns it once the buyer has paid A$5.00. A gift point is
 * one cent, so that bought 500 points, and the metadata says so.
 */
function paidIntent(overrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
  return {
    id: 'pi_123',
    status: 'succeeded',
    amount: 500,
    amount_received: 500,
    currency: 'aud',
    metadata: {
      userId: 'user-123',
      type: 'gift_balance_purchase',
      giftPoints: '500',
      ...metadata,
    },
    ...overrides,
  };
}

describe('Creator gift balance confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mimic Prisma transaction callback signature used in service.
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
  });

  it('POST /api/creator/balance/purchase/confirm credits points (idempotent)', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue(paidIntent());

    (prisma.giftBalancePurchase.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'gbp_1', giftPoints: 500 });

    (prisma.giftBalancePurchase.create as any).mockResolvedValue({ id: 'gbp_1' });
    (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

    const res1 = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_123' })
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data.giftPoints).toBe(500);
    expect(res1.body.data.alreadyProcessed).toBe(false);

    const res2 = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_123' })
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data.giftPoints).toBe(500);
    expect(res2.body.data.alreadyProcessed).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.giftBalancePurchase.create).toHaveBeenCalledTimes(1);
    // What was recorded and credited is the money received, in cents.
    expect((prisma.giftBalancePurchase.create as any).mock.calls[0][0].data).toMatchObject({
      paymentIntentId: 'pi_123',
      amountCents: 500,
      giftPoints: 500,
    });
  });

  it('POST /api/creator/balance/purchase/confirm forbids confirming for another user', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paidIntent({ id: 'pi_other' }, { userId: 'someone-else' })
    );

    const res = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_other' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  // The points are worked out from the money Stripe received. Metadata is a note
  // written when the intent was created, so an intent whose note says a million
  // points while the receipt says fifty cents must credit nothing.
  it('credits nothing when the points the metadata claims do not match the amount paid', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paidIntent({ id: 'pi_forged', amount: 50, amount_received: 50 }, { giftPoints: '1000000' })
    );

    const res = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_forged' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(prisma.giftBalancePurchase.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a claim that is lower than what was paid as well, so the two always agree', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue(paidIntent({ id: 'pi_low' }, { giftPoints: '1' }));

    await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_low' })
      .expect(409);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('credits nothing for a payment made in another currency', async () => {
    const stripe = getStripeInstance();
    // A million dong is about A$65. Counted at a point per hundredth of a unit it
    // was a million points, which a creator paid out in dollars.
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paidIntent(
        { id: 'pi_vnd', amount: 1000000, amount_received: 1000000, currency: 'vnd' },
        { giftPoints: '1000000' }
      )
    );

    await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_vnd' })
      .expect(409);

    expect(prisma.giftBalancePurchase.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('reads the amount received, not the amount asked for', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paidIntent({ id: 'pi_partial', amount: 500, amount_received: 100 }, { giftPoints: '500' })
    );

    await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_partial' })
      .expect(409);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an intent that has not succeeded', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue(
      paidIntent({ id: 'pi_open', status: 'requires_payment_method' })
    );

    await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_open' })
      .expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('Creator gift balance purchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Points were bought in whichever currency the member had chosen and cashed
  // out one for one by a creator in hers, so VND, IDR or PHP bought points that
  // an AUD creator withdrew as many times the money. Whatever she has chosen,
  // the charge is in Australian dollars, in whole cents.
  it.each(['VND', 'IDR', 'PHP', 'usd'])(
    'charges in AUD whatever currency the buyer prefers (%s)',
    async (preferredCurrency) => {
      const stripe = getStripeInstance();
      (prisma.user.findUnique as any).mockResolvedValue({ preferredCurrency, region: 'AU' });
      stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_new', client_secret: 'pi_new_secret' });

      const res = await request(app).post('/api/creator/balance/purchase').send({ amount: 10 }).expect(200);

      const created = stripe.paymentIntents.create.mock.calls[0][0];
      expect(created.currency).toBe('aud');
      expect(created.amount).toBe(1000);
      // A point is a cent: A$10.00 buys 1000, and the metadata says the same.
      expect(created.metadata).toMatchObject({
        type: 'gift_balance_purchase',
        giftPoints: '1000',
        userId: 'user-123',
      });
      expect(res.body.data).toMatchObject({
        amount: 10,
        giftPoints: 1000,
        currency: 'AUD',
        paymentIntentId: 'pi_new',
      });
    }
  );

  it('charges a whole number of cents for an amount with a fraction of a cent', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_frac', client_secret: 's' });

    const res = await request(app).post('/api/creator/balance/purchase').send({ amount: 5.555 }).expect(200);

    const created = stripe.paymentIntents.create.mock.calls[0][0];
    expect(Number.isInteger(created.amount)).toBe(true);
    // The points follow what is charged, so what she pays and what she gets agree.
    expect(created.metadata.giftPoints).toBe(String(created.amount));
    expect(res.body.data.giftPoints).toBe(created.amount);
  });

  it.each([4.99, 1001, 0, -5])('refuses an amount outside A$5 to A$1000 (%s)', async (amount) => {
    const stripe = getStripeInstance();

    await request(app).post('/api/creator/balance/purchase').send({ amount }).expect(400);

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
});
