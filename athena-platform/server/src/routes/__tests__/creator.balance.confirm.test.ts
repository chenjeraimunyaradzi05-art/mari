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

describe('Creator gift balance confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mimic Prisma transaction callback signature used in service.
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
  });

  it('POST /api/creator/balance/purchase/confirm credits points (idempotent)', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
      amount: 500, // cents
      metadata: {
        userId: 'user-123',
        type: 'gift_balance_purchase',
        giftPoints: '50',
      },
    });

    (prisma.giftBalancePurchase.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'gbp_1', giftPoints: 50 });

    (prisma.giftBalancePurchase.create as any).mockResolvedValue({ id: 'gbp_1' });
    (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

    const res1 = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_123' })
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data.giftPoints).toBe(50);
    expect(res1.body.data.alreadyProcessed).toBe(false);

    const res2 = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_123' })
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data.giftPoints).toBe(50);
    expect(res2.body.data.alreadyProcessed).toBe(true);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.giftBalancePurchase.create).toHaveBeenCalledTimes(1);
  });

  it('POST /api/creator/balance/purchase/confirm forbids confirming for another user', async () => {
    const stripe = getStripeInstance();
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_other',
      status: 'succeeded',
      amount: 500,
      metadata: {
        userId: 'someone-else',
        type: 'gift_balance_purchase',
        giftPoints: '50',
      },
    });

    const res = await request(app)
      .post('/api/creator/balance/purchase/confirm')
      .send({ paymentIntentId: 'pi_other' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });
});
