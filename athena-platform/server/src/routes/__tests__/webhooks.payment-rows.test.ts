import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

/**
 * Two money paths that had no code behind them at all.
 *
 * Nothing anywhere called prisma.payment.create, so the Payment table was
 * permanently empty: every one-off sale completed, the entitlement was
 * granted, and no document was ever issued for it. And nothing listened for
 * the settlement of a creator payout transfer, so every CreatorPayout row
 * ever written was still PENDING with a null completedAt, which is the exact
 * filter the earnings statement reads.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: { create: jest.fn(), delete: jest.fn() },
    payment: { upsert: jest.fn(), findUnique: jest.fn(async () => null), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 0 })) },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
    mentorSession: { update: jest.fn(), findFirst: jest.fn(async () => null) },
    businessRegistration: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null), update: jest.fn() },
    acceleratorEnrollment: { findUnique: jest.fn(async () => null), update: jest.fn() },
    creatorPayout: { findFirst: jest.fn(), update: jest.fn() },
    creatorProfile: { update: jest.fn() },
    user: { findMany: jest.fn(async () => []) },
    notification: { createMany: jest.fn() },
    invoice: { findFirst: jest.fn(), count: jest.fn(async () => 0), create: jest.fn() },
    $transaction: jest.fn(async (operations: unknown) => operations),
  },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    refunds: { create: jest.fn() },
    transfers: { create: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

jest.mock('../../services/creator.service', () => ({
  confirmGiftPurchaseFromPaymentIntent: jest.fn(),
}));

jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ notify: jest.fn() })),
  notificationService: { notify: jest.fn() },
}));

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

function deliver(event: Record<string, unknown>) {
  stripe.webhooks.constructEvent.mockReturnValue(event);
  return request(createTestApp())
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=1,v1=x')
    .send(Buffer.from('{}'));
}

const succeeded = (id: string, amountCents: number, metadata: Record<string, string>) => ({
  id: `evt_${id}`,
  type: 'payment_intent.succeeded',
  created: 1_760_000_000,
  data: {
    object: {
      id,
      status: 'succeeded',
      amount: amountCents,
      amount_received: amountCents,
      currency: 'aud',
      payment_method_types: ['card'],
      latest_charge: 'ch_1',
      metadata,
    },
  },
});

describe('A succeeded payment becomes a Payment row', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt_x' });
    prisma.payment.findUnique.mockResolvedValue(null);
  });

  it('records a formation fee against the registration that owes it', async () => {
    await deliver(
      succeeded('pi_formation', 49900, { type: 'business_formation', registrationId: 'reg-1', userId: 'user-1' })
    ).expect(200);

    expect(prisma.payment.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.payment.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ stripePaymentIntentId: 'pi_formation' });
    expect(call.create).toMatchObject({
      userId: 'user-1',
      amount: 499,
      currency: 'AUD',
      status: 'COMPLETED',
      method: 'card',
      type: 'FORMATION',
      referenceId: 'reg-1',
      stripeChargeId: 'ch_1',
    });
  });

  it('takes a mentor session\'s buyer from menteeId, which is the only place it is', async () => {
    await deliver(
      succeeded('pi_mentor', 12000, { type: 'mentor_session', sessionId: 'sess-1', menteeId: 'mentee-9', mentorProfileId: 'mp-1' })
    ).expect(200);

    expect(prisma.payment.upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'mentee-9',
      type: 'MENTOR_SESSION',
      referenceId: 'sess-1',
    });
  });

  it('records a gift top-up and an accelerator place', async () => {
    await deliver(succeeded('pi_gift', 2000, { type: 'gift_balance_purchase', userId: 'user-2', giftPoints: '2000' })).expect(200);
    expect(prisma.payment.upsert.mock.calls[0][0].create).toMatchObject({ userId: 'user-2', type: 'GIFT_BALANCE', referenceId: null });

    jest.clearAllMocks();
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt_y' });
    prisma.payment.findUnique.mockResolvedValue(null);

    await deliver(
      succeeded('pi_cohort', 150000, { type: 'accelerator_enrollment', enrollmentId: 'enr-1', userId: 'user-3', cohortId: 'coh-1', amountCents: '150000' })
    ).expect(200);
    expect(prisma.payment.upsert.mock.calls[0][0].create).toMatchObject({ userId: 'user-3', type: 'ACCELERATOR', referenceId: 'enr-1' });
  });

  it('writes nothing for an intent that does not say whose it is', async () => {
    await deliver(succeeded('pi_anonymous', 500, {})).expect(200);
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
  });

  it('leaves marketplace escrow on its own table rather than claiming the sale', async () => {
    // Escrow intents carry buyerId and sellerId and no `type`: the money is
    // the provider's, so a Payment row for the whole of it would say ATHENA
    // sold something it did not.
    await deliver(succeeded('pi_escrow', 40000, { buyerId: 'user-4', sellerId: 'user-5', sessionType: 'service_order' })).expect(200);
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
  });

  it('does not make Stripe retry forever when the buyer has since been erased', async () => {
    const fk: any = new Error('foreign key constraint failed');
    fk.code = 'P2003';
    prisma.payment.upsert.mockRejectedValueOnce(fk);

    await deliver(succeeded('pi_orphan', 4900, { type: 'business_formation', registrationId: 'reg-2', userId: 'gone' })).expect(200);

    expect(prisma.stripeWebhookEvent.delete).not.toHaveBeenCalled();
  });
});

describe('A creator payout transfer reaches its end state', () => {
  const transferEvent = (type: 'transfer.created' | 'transfer.reversed', overrides: Record<string, unknown> = {}) => ({
    id: `evt_${type}_1`,
    type,
    created: 1_760_000_500,
    data: {
      object: {
        id: 'tr_1',
        amount: 9000,
        amount_reversed: 0,
        currency: 'aud',
        metadata: { type: 'creator_payout', userId: 'creator-1' },
        ...overrides,
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt_x' });
    prisma.creatorPayout.findFirst.mockResolvedValue({
      id: 'payout-1',
      status: 'PENDING',
      amount: 90,
      creatorProfileId: 'profile-1',
    });
  });

  it('marks the payout COMPLETED with the instant Stripe recorded', async () => {
    await deliver(transferEvent('transfer.created')).expect(200);

    expect(prisma.creatorPayout.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: { status: 'COMPLETED', completedAt: new Date(1_760_000_500 * 1000) },
    });
  });

  it('gives her balance back, in gift points, when the transfer is reversed', async () => {
    await deliver(transferEvent('transfer.reversed', { amount_reversed: 9000 })).expect(200);

    expect(prisma.creatorPayout.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'payout-1' }, data: expect.objectContaining({ status: 'FAILED' }) })
    );
    expect(prisma.creatorProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { pendingPayout: { increment: 9000 } },
    });
  });

  it('restores only the share that came back on a partial reversal', async () => {
    await deliver(transferEvent('transfer.reversed', { amount_reversed: 3000 })).expect(200);

    expect(prisma.creatorProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { pendingPayout: { increment: 3000 } },
    });
    expect(prisma.creatorPayout.update.mock.calls[0][0].data.status).toBe('PENDING');
  });

  it('ignores the transfer every destination charge creates', async () => {
    prisma.creatorPayout.findFirst.mockResolvedValue(null);

    const res = await deliver({
      id: 'evt_transfer_other',
      type: 'transfer.created',
      created: 1_760_000_500,
      data: { object: { id: 'tr_charge', amount: 12000, amount_reversed: 0, currency: 'aud', metadata: {} } },
    }).expect(200);

    expect(res.body.received).toBe(true);
    expect(prisma.creatorPayout.update).not.toHaveBeenCalled();
  });

  it('asks Stripe to retry when the payout row has not caught up yet', async () => {
    // The transfer has to exist before its id can be stored against the row,
    // so the event can genuinely arrive first.
    prisma.creatorPayout.findFirst.mockResolvedValue(null);

    await deliver(transferEvent('transfer.created')).expect(500);

    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt_transfer.created_1' } });
  });
});
