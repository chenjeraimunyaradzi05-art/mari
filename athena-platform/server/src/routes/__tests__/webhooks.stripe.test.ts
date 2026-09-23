import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: {
      create: jest.fn(),
      delete: jest.fn(),
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
  },
}));

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
        giftPoints: '50',
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

  it('POST /api/webhooks/stripe returns duplicate=true on replayed event', async () => {
    const stripe = getStripeClient();
    const app = createTestApp();

    const dupErr: any = new Error('duplicate');
    dupErr.code = 'P2002';
    (((prisma as any).stripeWebhookEvent.create as any)).mockRejectedValueOnce(dupErr);

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
