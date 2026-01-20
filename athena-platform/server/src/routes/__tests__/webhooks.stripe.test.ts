import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: {
      create: jest.fn(),
    },
    subscription: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
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
