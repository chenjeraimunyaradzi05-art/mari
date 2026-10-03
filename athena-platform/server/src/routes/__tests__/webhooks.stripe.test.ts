import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    stripeWebhookEvent: {
      create: jest.fn(),
      delete: jest.fn(),
      // A refused insert is followed by reading the row back, and a handled
      // event is marked complete; see claimStripeEvent in webhook.routes.
      findUnique: jest.fn(),
      findFirst: jest.fn(async () => null),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    subscription: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      // Every succeeded intent that names its buyer now writes a Payment row,
      // which is what gives the invoice pipeline something to find.
      upsert: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    invoice: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    // An invoice is filed inside a transaction that first takes an advisory
    // lock on what it is for, so a webhook and an admin re-issue cannot both
    // file one. The transaction hands back this same client.
    $executeRaw: jest.fn(async () => 1),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { prisma };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: {
      constructEvent: jest.fn(),
    },
    // Present for compatibility with other modules importing Stripe.
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
    // A new membership is read back from Stripe once checkout completes.
    subscriptions: {
      retrieve: jest.fn(),
    },
  };

  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;

  return {
    __esModule: true,
    default: StripeMock,
  };
});

jest.mock('../../services/creator.service', () => {
  const actual: any = jest.requireActual('../../services/creator.service');
  return {
    ...actual,
    confirmGiftPurchaseFromPaymentIntent: jest.fn(),
  };
});

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { confirmGiftPurchaseFromPaymentIntent } from '../../services/creator.service';
import { ApiError } from '../../middleware/errorHandler';
import { opsSnapshot, resetOpsMetrics } from '../../utils/ops-metrics';
import { prisma } from '../../utils/prisma';

function getStripeClient(): any {
  return (Stripe as any).__client;
}

function createTestApp() {
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  // Minimal error handler compatible with existing error shape.
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

describe('Stripe webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetOpsMetrics();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_CAREER = 'price_career';
    process.env.STRIPE_PRICE_PROFESSIONAL = 'price_professional';
    process.env.STRIPE_PRICE_ENTREPRENEUR = 'price_entrepreneur';
    process.env.STRIPE_PRICE_CREATOR = 'price_creator';

    // Default: event not duplicate
    ((prisma as any).stripeWebhookEvent.create as any).mockResolvedValue({ id: 'evt_x' });
  });

  it('POST /api/webhooks/stripe processes gift_balance_purchase payment_intent.succeeded', async () => {
    const stripe = getStripeClient();
    const app = createTestApp();

    const paymentIntent = {
      id: 'pi_123',
      status: 'succeeded',
      amount: 500,
      // A real PaymentIntent always carries one, and the Payment row the
      // webhook now writes records it, so the fixture has to as well.
      currency: 'aud',
      metadata: {
        userId: 'user-123',
        type: 'gift_balance_purchase',
        // A gift point is a cent, so A$5.00 is 500 points.
        giftPoints: '500',
      },
    };

    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: { object: paymentIntent },
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from('{"ok":true}'))
      .expect(200);

    expect(res.body.received).toBe(true);
    expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
    expect(confirmGiftPurchaseFromPaymentIntent as any).toHaveBeenCalledWith('user-123', paymentIntent);
  });

  describe('a gift-balance payment the service refuses to credit', () => {
    const forgedIntent = {
      id: 'pi_forged',
      status: 'succeeded',
      amount: 50,
      amount_received: 50,
      currency: 'aud',
      metadata: { userId: 'user-123', type: 'gift_balance_purchase', giftPoints: '1000000' },
    };

    function deliverForged() {
      getStripeClient().webhooks.constructEvent.mockReturnValue({
        id: 'evt_forged',
        type: 'payment_intent.succeeded',
        data: { object: forgedIntent },
      });
      return request(createTestApp())
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=123,v1=abc')
        .send(Buffer.from('{"ok":true}'));
    }

    // The refusal is the same answer on every delivery, so handing it back to
    // Stripe would only make it retry for three days. It is counted as a failure
    // instead, which is what puts it in front of a person.
    it('is acknowledged and counted, not retried, when the points do not match the payment', async () => {
      (confirmGiftPurchaseFromPaymentIntent as any).mockRejectedValueOnce(
        new ApiError(409, 'The points on this payment do not match what was paid')
      );

      await deliverForged().expect(200);

      expect((prisma as any).stripeWebhookEvent.delete).not.toHaveBeenCalled();
      expect(opsSnapshot().operations['stripe_webhook.gift_purchase_refused']?.failure).toBe(1);
    });

    it('is handed back to Stripe to retry when the failure is ours, a database error for one', async () => {
      (confirmGiftPurchaseFromPaymentIntent as any).mockRejectedValueOnce(new Error('connection reset'));

      await deliverForged().expect(500);

      expect((prisma as any).stripeWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt_forged' } });
    });
  });

  it('POST /api/webhooks/stripe processes subscription checkout.session.completed', async () => {
    const stripe = getStripeClient();
    const app = createTestApp();

    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_sub_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          mode: 'subscription',
          customer: 'cus_123',
          subscription: 'sub_123',
          metadata: { userId: 'user-123', tier: 'PREMIUM_CAREER' },
        },
      },
    });

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from('{"ok":true}'))
      .expect(200);

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123' },
        create: expect.objectContaining({
          tier: 'PREMIUM_CAREER',
          status: 'ACTIVE',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          stripePriceId: 'price_career',
        }),
        update: expect.objectContaining({
          tier: 'PREMIUM_CAREER',
          status: 'ACTIVE',
          stripeSubscriptionId: 'sub_123',
          stripePriceId: 'price_career',
        }),
      })
    );
  });

  describe('a membership that has just been bought', () => {
    const completed = (id = 'evt_sub_trial') => ({
      id,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_trial',
          mode: 'subscription',
          customer: 'cus_123',
          subscription: 'sub_123',
          metadata: { userId: 'user-123', tier: 'PREMIUM_CAREER', currency: 'AUD', trialGranted: 'true' },
        },
      },
    });

    const liveSubscription = (overrides: Record<string, unknown> = {}) => ({
      id: 'sub_123',
      status: 'trialing',
      cancel_at_period_end: false,
      current_period_start: 1_900_000_000,
      current_period_end: 1_901_209_600,
      items: {
        data: [{ price: { id: 'price_career', unit_amount: 1999, currency: 'aud', recurring: { interval: 'month' } } }],
      },
      ...overrides,
    });

    function deliverCompleted(id?: string) {
      getStripeClient().webhooks.constructEvent.mockReturnValue(completed(id));
      return request(createTestApp())
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=123,v1=abc')
        .send(Buffer.from('{"ok":true}'));
    }

    // Checkout grants the tier and says ACTIVE. A trial is created already
    // running and may not be followed by another subscription event until it
    // ends, and one that came first would be overwritten by that ACTIVE. The
    // billing page's trial notice reads the status, the end date and the amount
    // from this row, so the row has to say what Stripe says.
    it('records that it is a trial, the day it ends and what it costs, from Stripe itself', async () => {
      getStripeClient().subscriptions.retrieve.mockResolvedValueOnce(liveSubscription());

      await deliverCompleted().expect(200);

      expect(getStripeClient().subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: expect.objectContaining({
          status: 'TRIALING',
          currentPeriodEnd: new Date(1_901_209_600 * 1000),
          currency: 'AUD',
          interval: 'month',
          cancelAtPeriodEnd: false,
        }),
      });
      const written = (prisma.subscription.update as any).mock.calls[0][0].data;
      expect(Number(written.amount)).toBeCloseTo(19.99);
    });

    it('still grants the tier when Stripe cannot be read back, and leaves the rest to its own events', async () => {
      getStripeClient().subscriptions.retrieve.mockRejectedValueOnce(new Error('stripe is down'));

      await deliverCompleted('evt_sub_trial_down').expect(200);

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-123' } })
      );
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('does not mark a tier that was just granted as cancelled because Stripe has already cancelled it', async () => {
      getStripeClient().subscriptions.retrieve.mockResolvedValueOnce(liveSubscription({ status: 'canceled' }));

      await deliverCompleted('evt_sub_trial_gone').expect(200);

      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  it('POST /api/webhooks/stripe processes customer.subscription.updated', async () => {
    const stripe = getStripeClient();
    const app = createTestApp();

    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub_db_1' });

    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_sub_2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          cancel_at_period_end: false,
          current_period_start: 1700000000,
          current_period_end: 1700003600,
          items: { data: [{ price: { id: 'price_professional' } }] },
        },
      },
    });

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from('{"ok":true}'))
      .expect(200);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_db_1' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          stripeSubscriptionId: 'sub_123',
          stripeCustomerId: 'cus_123',
          stripePriceId: 'price_professional',
          tier: 'PREMIUM_PROFESSIONAL',
          cancelAtPeriodEnd: false,
        }),
      })
    );
  });

  it('records what the member is actually paying from the price on the subscription', async () => {
    // Nothing wrote Subscription.amount before, so the billing page had no
    // figure to show and printed an invented A$29 in its place.
    const stripe = getStripeClient();
    const app = createTestApp();

    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub_db_1' });

    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_sub_amount',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          cancel_at_period_end: false,
          current_period_start: 1700000000,
          current_period_end: 1700003600,
          items: {
            data: [
              {
                price: {
                  id: 'price_professional',
                  unit_amount: 2499,
                  currency: 'aud',
                  recurring: { interval: 'month', interval_count: 1 },
                },
              },
            ],
          },
        },
      },
    });

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from('{"ok":true}'))
      .expect(200);

    const data = (prisma.subscription.update as any).mock.calls[0][0].data;
    expect(String(data.amount)).toBe('24.99');
    expect(data.currency).toBe('AUD');
    expect(data.interval).toBe('month');
  });

  it('POST /api/webhooks/stripe returns duplicate=true on replayed event', async () => {
    const stripe = getStripeClient();
    const app = createTestApp();

    const dupErr: any = new Error('duplicate');
    dupErr.code = 'P2002';
    (((prisma as any).stripeWebhookEvent.create as any)).mockRejectedValueOnce(dupErr);
    // The first delivery finished, so this one is a replay.
    (((prisma as any).stripeWebhookEvent.findUnique as any)).mockResolvedValueOnce({ completedAt: new Date(), claimedAt: new Date() });

    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_x', status: 'succeeded', amount: 100, metadata: {} } },
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from('{"ok":true}'))
      .expect(200);

    expect(res.body.received).toBe(true);
    expect(res.body.duplicate).toBe(true);
  });

  it('POST /api/webhooks/stripe returns 400 when signature missing', async () => {
    const app = createTestApp();
    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{"ok":true}'))
      .expect(400);

    expect(confirmGiftPurchaseFromPaymentIntent as any).not.toHaveBeenCalled();
  });

  it('POST /api/webhooks/stripe returns 400 when signature invalid', async () => {
    const stripe = getStripeClient();
    const app = createTestApp();
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=bad')
      .send(Buffer.from('{"ok":true}'))
      .expect(400);

    expect(confirmGiftPurchaseFromPaymentIntent as any).not.toHaveBeenCalled();
  });
});

describe('Stripe webhooks: tax invoices', () => {
  const prismaAny: any = prisma;

  const paidInvoiceEvent = (id: string) => ({
    id,
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_1',
        customer: 'cus_123',
        subscription: 'sub_123',
        amount_paid: 2900,
        currency: 'aud',
        created: 1_760_000_000,
        status: 'paid',
        status_transitions: { paid_at: 1_760_000_100 },
        lines: { data: [{ period: { start: 1_760_000_000, end: 1_762_592_000 } }] },
      },
    },
  });

  function deliver(event: Record<string, unknown>) {
    getStripeClient().webhooks.constructEvent.mockReturnValue(event);
    return request(createTestApp())
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from('{"ok":true}'));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    prismaAny.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt_x' });
    prismaAny.subscription.findFirst.mockResolvedValue({ id: 'sub_db_1' });
    prismaAny.subscription.findUnique.mockResolvedValue({
      id: 'sub_db_1',
      userId: 'user-123',
      tier: 'PREMIUM_CAREER',
      user: { displayName: 'Mei Chen', email: 'mei@example.com' },
    });
    prismaAny.invoice.findFirst.mockResolvedValue(null);
    prismaAny.invoice.count.mockResolvedValue(0);
    prismaAny.invoice.create.mockImplementation(async ({ data }: any) => ({ id: 'inv-1', ...data }));
    prismaAny.payment.findUnique.mockResolvedValue(null);
  });

  it('a paid membership period files exactly one invoice, with the amount Stripe took', async () => {
    await deliver(paidInvoiceEvent('evt_inv_1')).expect(200);

    expect(prismaAny.invoice.create).toHaveBeenCalledTimes(1);
    expect(prismaAny.invoice.create.mock.calls[0][0].data).toMatchObject({
      userId: 'user-123',
      subscriptionId: 'sub_db_1',
      amount: 29,
      currency: 'AUD',
      status: 'PAID',
      paidAt: new Date(1_760_000_100 * 1000),
    });
  });

  it('a replayed event files none', async () => {
    const dupErr: any = new Error('duplicate');
    dupErr.code = 'P2002';
    prismaAny.stripeWebhookEvent.create.mockRejectedValueOnce(dupErr);
    prismaAny.stripeWebhookEvent.findUnique.mockResolvedValueOnce({ completedAt: new Date(), claimedAt: new Date() });

    const res = await deliver(paidInvoiceEvent('evt_inv_1')).expect(200);

    expect(res.body.duplicate).toBe(true);
    expect(prismaAny.invoice.create).not.toHaveBeenCalled();
  });

  it('the same Stripe invoice under a new event id is not filed twice', async () => {
    prismaAny.invoice.findFirst.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-202609-00001', status: 'PAID' });

    await deliver(paidInvoiceEvent('evt_inv_2')).expect(200);

    expect(prismaAny.invoice.findFirst).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub_db_1', paidAt: new Date(1_760_000_100 * 1000) },
    });
    expect(prismaAny.invoice.create).not.toHaveBeenCalled();
  });

  // The document is refused until ATHENA says who it is, but the sale is not: the
  // event must be handled and filed, not thrown back at Stripe to be retried for
  // days with its side effects re-run, and not dropped for good.
  it.each([
    ['says who it is', true],
    ['has not said who it is', false],
  ])('a paid membership period is filed and the event answered 200 when ATHENA %s', async (_label, configured) => {
    const keys = ['ATHENA_LEGAL_NAME', 'ATHENA_ABN', 'ATHENA_BILLING_ADDRESS', 'ATHENA_BILLING_EMAIL'];
    const saved = keys.map((key) => process.env[key]);
    try {
      if (configured) {
        process.env.ATHENA_LEGAL_NAME = 'Example Trading Pty Ltd';
        process.env.ATHENA_ABN = '51824753556';
        process.env.ATHENA_BILLING_ADDRESS = 'Level 3, 100 Queen St|Brisbane QLD 4000';
        process.env.ATHENA_BILLING_EMAIL = 'billing@mail.example-trading.org';
      } else {
        for (const key of keys) delete process.env[key];
      }

      const res = await deliver(paidInvoiceEvent('evt_inv_identity')).expect(200);

      expect(res.body.received).toBe(true);
      expect(prismaAny.invoice.create).toHaveBeenCalledTimes(1);
      expect(prismaAny.stripeWebhookEvent.delete).not.toHaveBeenCalled();
    } finally {
      keys.forEach((key, index) => {
        if (saved[index] === undefined) delete process.env[key];
        else process.env[key] = saved[index];
      });
    }
  });

  it('a $0 invoice (the trial period) is not a tax invoice', async () => {
    const event = paidInvoiceEvent('evt_inv_trial');
    (event.data.object as any).amount_paid = 0;

    await deliver(event).expect(200);

    expect(prismaAny.subscription.findFirst).not.toHaveBeenCalled();
    expect(prismaAny.invoice.create).not.toHaveBeenCalled();
  });

  it('asks Stripe to retry when the subscription row has not been written yet', async () => {
    prismaAny.subscription.findFirst.mockResolvedValue(null);

    await deliver(paidInvoiceEvent('evt_inv_early')).expect(500);

    expect(prismaAny.invoice.create).not.toHaveBeenCalled();
    expect(prismaAny.stripeWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt_inv_early' } });
  });

  it('a succeeded payment intent with a Payment row marks it completed and files one invoice', async () => {
    prismaAny.payment.findUnique
      .mockResolvedValueOnce({ id: 'pay-1', status: 'PENDING' })
      .mockResolvedValueOnce({
        id: 'pay-1',
        userId: 'user-123',
        amount: { toNumber: () => 120 },
        currency: 'AUD',
        status: 'COMPLETED',
        method: 'card',
        type: 'MENTOR_SESSION',
        stripePaymentIntentId: 'pi_pay_1',
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: new Date('2026-09-01T00:00:00Z'),
        user: { displayName: 'Mei Chen', email: 'mei@example.com' },
      });

    await deliver({
      id: 'evt_pi_pay',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_pay_1', status: 'succeeded', amount: 12000, metadata: {} } },
    }).expect(200);

    expect(prismaAny.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'COMPLETED' } });
    expect(prismaAny.invoice.create).toHaveBeenCalledTimes(1);
    expect(prismaAny.invoice.create.mock.calls[0][0].data).toMatchObject({ paymentId: 'pay-1', status: 'PAID' });
  });

  it('a succeeded intent with no Payment row files nothing and does not fail the event', async () => {
    await deliver({
      id: 'evt_pi_none',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_orphan', status: 'succeeded', amount: 100, metadata: {} } },
    }).expect(200);

    expect(prismaAny.payment.update).not.toHaveBeenCalled();
    expect(prismaAny.invoice.create).not.toHaveBeenCalled();
  });
});
