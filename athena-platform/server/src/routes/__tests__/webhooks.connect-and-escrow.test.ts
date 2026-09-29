/**
 * The Stripe events that keep escrow rows and connected accounts honest.
 *
 * Three gaps, each of which left a screen saying something untrue:
 *  - Events about connected accounts are signed by the Connect endpoint's own
 *    secret, and this route only knew the platform's, so none of them was
 *    ever accepted: account.updated never fired, and a withdrawal that bounced
 *    at the bank was never mentioned to the woman whose money it was.
 *  - A hold captured anywhere but captureEscrowPayment (the Stripe dashboard,
 *    or a capture whose row write failed) left its row saying "held".
 *  - A declined card marked the row FAILED, and when the buyer's next card
 *    authorised on the same intent the row stayed FAILED while her money was
 *    held.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: { create: jest.fn(), delete: jest.fn() },
    mentorSession: { update: jest.fn(async () => ({})) },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 1 })) },
    serviceOrder: { findFirst: jest.fn(async () => null) },
    payment: { upsert: jest.fn(), findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 0 })) },
    user: { findFirst: jest.fn(async () => null) },
    notification: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
    accounts: { createLoginLink: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const stripe = (Stripe as any).__client;

function createTestApp() {
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

function post() {
  return request(createTestApp())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=x')
    .send(Buffer.from('{}'));
}

function deliver(event: Record<string, unknown>) {
  stripe.webhooks.constructEvent.mockReturnValue(event);
  return post();
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_platform';
  delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
  prisma.user.findFirst.mockResolvedValue(null);
});

describe('The Connect endpoint’s secret', () => {
  const connectEvent = {
    id: 'evt_c',
    type: 'payout.failed',
    account: 'acct_mentor',
    created: 1789000000,
    data: { object: { id: 'po_1', amount: 15000, currency: 'aud', automatic: false, failure_message: 'The bank account has been closed.' } },
  };

  it('accepts an event signed by the Connect endpoint when that secret is set', async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect';
    stripe.webhooks.constructEvent.mockImplementation((_body: unknown, _sig: unknown, secret: string) => {
      if (secret !== 'whsec_connect') throw new Error('No signatures found matching the expected signature');
      return connectEvent;
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledTimes(2);
  });

  it('still turns away a signature neither secret made', async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect';
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await post();

    expect(res.status).toBe(400);
    expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
  });
});

describe('A member’s bank payout', () => {
  const payoutEvent = (type: string, payout: Record<string, unknown>, account: string | undefined = 'acct_mentor') => ({
    id: `evt_${type}`,
    type,
    account,
    created: 1789000000,
    data: { object: { id: 'po_1', amount: 15000, currency: 'aud', automatic: false, ...payout } },
  });

  it('tells her when her withdrawal bounced, why, and that the money is back in her balance', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mentor-1' });

    await deliver(payoutEvent('payout.failed', { failure_message: 'The bank account has been closed.' })).expect(200);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { stripeConnectAccountId: 'acct_mentor' },
      select: { id: true },
    });
    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: 'mentor-1', title: 'Your withdrawal did not reach your bank', link: '/dashboard/earnings' });
    expect(notice.message).toContain('150.00 AUD');
    expect(notice.message).toContain('The bank account has been closed.');
    expect(notice.message).toMatch(/back in your balance/);
  });

  it('tells her when a withdrawal she asked for has been paid', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mentor-1' });

    await deliver(payoutEvent('payout.paid', {})).expect(200);

    expect(prisma.notification.create.mock.calls[0][0].data.title).toBe('Your withdrawal has been paid');
  });

  it('leaves Stripe’s own scheduled payouts to Stripe', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mentor-1' });

    await deliver(payoutEvent('payout.paid', { automatic: true })).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('ignores ATHENA’s own payouts, which carry no account, and accounts no member owns', async () => {
    await deliver(payoutEvent('payout.failed', {}, undefined)).expect(200);
    await deliver(payoutEvent('payout.failed', {})).expect(200);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('Escrow rows follow the intent', () => {
  it('marks a hold captured anywhere as CAPTURED, only while it is still held', async () => {
    await deliver({
      id: 'evt_s',
      type: 'payment_intent.succeeded',
      created: 1789000000,
      data: { object: { id: 'pi_hold', capture_method: 'manual', amount: 25000, amount_received: 25000, currency: 'aud', metadata: { buyerId: 'b', sellerId: 's' } } },
    }).expect(200);

    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_hold', status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
      data: { status: 'CAPTURED', capturedAt: new Date(1789000000 * 1000) },
    });
  });

  it('does not touch escrow for a payment that was never a hold', async () => {
    await deliver({
      id: 'evt_s2',
      type: 'payment_intent.succeeded',
      created: 1789000000,
      data: { object: { id: 'pi_gift', capture_method: 'automatic', amount: 500, amount_received: 500, currency: 'aud', metadata: {} } },
    }).expect(200);

    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });

  it('moves a hold whose first card was declined to AUTHORIZED when the next one authorises', async () => {
    await deliver({
      id: 'evt_a',
      type: 'payment_intent.amount_capturable_updated',
      created: 1789000000,
      data: { object: { id: 'pi_hold', metadata: {} } },
    }).expect(200);

    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_hold', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'AUTHORIZED' },
    });
  });
});
