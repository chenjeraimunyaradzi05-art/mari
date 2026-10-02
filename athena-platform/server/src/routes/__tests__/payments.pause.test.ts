/**
 * The switch that stops ATHENA starting any new payment.
 *
 * The incident runbook told responders to "pause checkout (feature flag)" and no
 * flag by that name was read anywhere, so an admin who made one changed nothing.
 * The only stop was maintenance mode, which takes the whole product offline, and
 * which a scheduled sweep ignores. The `payments_paused` flag is what the runbook
 * meant: with it on, every function that starts money moving refuses with a 503
 * and the code PAYMENTS_PAUSED before it asks Stripe or writes a row, and what
 * gives money back, or only records what Stripe already did, stays open.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------

let pauseRow: Record<string, unknown> | null = null;

jest.mock('../../utils/prisma', () => {
  const model = () => new Proxy({}, { get: () => jest.fn(async () => null) });
  const explicit: Record<string, any> = {
    featureFlag: {
      findUnique: jest.fn(async (args: any) => (args?.where?.key === 'payments_paused' ? pauseRow : null)),
      upsert: jest.fn(async ({ create }: any) => ({ ...create, metadata: create.metadata })),
    },
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    subscription: { findUnique: jest.fn(), update: jest.fn(async () => ({})), findFirst: jest.fn() },
    creatorProfile: { findUnique: jest.fn(), findMany: jest.fn(async () => []), updateMany: jest.fn() },
    creatorPayout: { findFirst: jest.fn(async () => null) },
    businessRegistration: { findUnique: jest.fn(), update: jest.fn() },
    mentorSession: { findMany: jest.fn(async () => []), findUnique: jest.fn(), updateMany: jest.fn() },
    stripeWebhookEvent: {
      create: jest.fn(async () => ({ id: 'evt_x' })),
      findUnique: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      delete: jest.fn(),
    },
    payment: { findUnique: jest.fn(async () => null), update: jest.fn(), upsert: jest.fn(), updateMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    $executeRaw: jest.fn(async () => 1),
    $transaction: jest.fn(async (fn: any) => (typeof fn === 'function' ? fn(proxy) : Promise.all(fn))),
  };
  const proxy: any = new Proxy(explicit, {
    get(target, name: string) {
      return name in target ? target[name] : model();
    },
  });
  return { prisma: proxy };
});

let currentUser: Record<string, unknown> = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
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

const stripeClient = {
  customers: { create: jest.fn(async (): Promise<any> => ({ id: 'cus_1' })) },
  subscriptions: {
    list: jest.fn(async (_params?: any): Promise<any> => ({ data: [] })),
    retrieve: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 'sub_1', status: 'active', items: { data: [] } })),
    update: jest.fn(async (..._args: any[]): Promise<any> => ({ current_period_end: 1_900_000_000, status: 'active' })),
  },
  checkout: { sessions: { create: jest.fn(async (): Promise<any> => ({ id: 'cs_1', url: 'https://checkout.stripe.com/cs_1' })) } },
  paymentIntents: {
    create: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 'pi_new', client_secret: 'secret', status: 'requires_payment_method' })),
    capture: jest.fn(async (..._args: any[]): Promise<any> => ({ status: 'succeeded' })),
    cancel: jest.fn(async (..._args: any[]): Promise<any> => ({ status: 'canceled' })),
    retrieve: jest.fn(async (..._args: any[]): Promise<any> => ({ status: 'requires_capture', client_secret: 'secret' })),
  },
  transfers: { create: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 'tr_1' })) },
  payouts: { create: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 'po_1', status: 'pending', amount: 1000, currency: 'aud' })) },
  refunds: { create: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 're_1', amount: 4900 })) },
  webhooks: { constructEvent: jest.fn() },
  prices: { retrieve: jest.fn() },
};
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripeClient,
}));

let resolvedPriceId = 'price_1LiveCareerAud';
jest.mock('../../config/regions', () => {
  const actual: any = jest.requireActual('../../config/regions');
  return { ...actual, getPriceIdForTier: () => resolvedPriceId };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { resetMemoryRateLimits } from '../../middleware/rateLimiter';
import {
  DEFAULT_PAYMENTS_PAUSE_MESSAGE,
  assertPaymentsOpen,
  getPaymentsPause,
  isPaymentsPausedError,
  resetPaymentsPauseCache,
} from '../../services/feature-flags.service';
import { resetMaintenanceCache } from '../../services/feature-flags.service';
import { purchaseGiftBalance, requestPayout } from '../../services/creator.service';
import { createEscrowPayment, captureEscrowPayment, createPayout, cancelEscrowPayment, getEscrowClientSecret } from '../../services/stripe-connect.service';
import { processPayment } from '../../services/payments-orchestration.service';
import { getFormationPayment, refundFormationFee } from '../../services/formation.service';
import { captureSessionHold, releaseDueMentorSessions } from '../../services/mentor-payment-release.service';
import { startingAPayment } from '../../middleware/moneyLimits';

const prisma: any = prismaTyped;

const PAUSE_MESSAGE = 'Payments are paused while we check them. Nothing has been charged.';
const paused = (message: string | null = PAUSE_MESSAGE) => ({
  key: 'payments_paused',
  enabled: true,
  metadata: message === null ? {} : { message, startedAt: '2026-10-01T00:00:00.000Z' },
});

function everyStripeMoneyCallIsUntouched() {
  expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  expect(stripeClient.customers.create).not.toHaveBeenCalled();
  expect(stripeClient.paymentIntents.create).not.toHaveBeenCalled();
  expect(stripeClient.paymentIntents.capture).not.toHaveBeenCalled();
  expect(stripeClient.transfers.create).not.toHaveBeenCalled();
  expect(stripeClient.payouts.create).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  pauseRow = null;
  resetPaymentsPauseCache();
  resetMaintenanceCache();
  resetMemoryRateLimits();
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

// ---------------------------------------------------------------------------
// The state itself
// ---------------------------------------------------------------------------

describe('the pause state', () => {
  it('is open when no flag exists, so nothing has to be seeded or migrated', async () => {
    expect(await getPaymentsPause()).toMatchObject({ paused: false, message: DEFAULT_PAYMENTS_PAUSE_MESSAGE });
    await expect(assertPaymentsOpen()).resolves.toBeUndefined();
  });

  it('refuses with a 503, the code PAYMENTS_PAUSED and the admin\'s own words when the flag is on', async () => {
    pauseRow = paused();

    let thrown: any;
    try {
      await assertPaymentsOpen();
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.statusCode).toBe(503);
    expect(thrown?.message).toBe(PAUSE_MESSAGE);
    expect(thrown?.details).toEqual({ code: 'PAYMENTS_PAUSED' });
    expect(isPaymentsPausedError(thrown)).toBe(true);
  });

  it('says so in the default words when the admin wrote none', async () => {
    pauseRow = paused(null);
    await expect(assertPaymentsOpen()).rejects.toMatchObject({ message: DEFAULT_PAYMENTS_PAUSE_MESSAGE });
  });

  it('is open again when the flag is switched off', async () => {
    pauseRow = { ...paused(), enabled: false };
    await expect(assertPaymentsOpen()).resolves.toBeUndefined();
  });

  it('reads the flag once in five seconds, so every money path does not cost a query', async () => {
    pauseRow = paused();
    const realNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
      await getPaymentsPause();
      await getPaymentsPause();
      await getPaymentsPause();
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledTimes(1);

      now += 4_900;
      await getPaymentsPause();
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledTimes(1);

      // Five seconds on, a flag switched off during an incident takes effect.
      pauseRow = null;
      now += 200;
      expect((await getPaymentsPause()).paused).toBe(false);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realNow;
    }
  });

  it('can be read past the cache, which is what the admin console asks for', async () => {
    await getPaymentsPause();
    pauseRow = paused();
    expect((await getPaymentsPause()).paused).toBe(false);
    expect((await getPaymentsPause({ fresh: true })).paused).toBe(true);
  });

  it('fails open when the flag cannot be read: the database being down already stops the money paths', async () => {
    prisma.featureFlag.findUnique.mockRejectedValueOnce(new Error('database is down'));

    await expect(assertPaymentsOpen()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// What stops
// ---------------------------------------------------------------------------

describe('with payments paused, a new payment is refused before Stripe is asked', () => {
  beforeEach(() => {
    pauseRow = paused();
  });

  it('a membership checkout', async () => {
    const res = await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(503);

    expect(res.body.code).toBe('PAYMENTS_PAUSED');
    expect(res.body.message).toBe(PAUSE_MESSAGE);
    everyStripeMoneyCallIsUntouched();
    // And no customer record was left behind at Stripe for a checkout that never started.
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('a plan change', async () => {
    const res = await request(app).post('/api/subscriptions/change-plan').send({ tier: 'PREMIUM_PROFESSIONAL' }).expect(503);

    expect(res.body.code).toBe('PAYMENTS_PAUSED');
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('a gift balance purchase', async () => {
    const res = await request(app).post('/api/creator/balance/purchase').send({ amount: 10 }).expect(503);

    expect(res.body.code).toBe('PAYMENTS_PAUSED');
    everyStripeMoneyCallIsUntouched();
  });

  it('an escrow hold', async () => {
    const res = await request(app)
      .post('/api/connect/escrow')
      .send({ recipientId: 'seller-1', amount: 5000, currency: 'aud', sessionType: 'service_order' })
      .expect(503);

    expect(res.body.code).toBe('PAYMENTS_PAUSED');
    everyStripeMoneyCallIsUntouched();
  });

  it('a hold asked for some other way, by the service itself', async () => {
    await expect(
      createEscrowPayment({ buyerId: 'member-1', sellerId: 'seller-1', amount: 5000, currency: 'aud', sessionType: 'service_order' } as any)
    ).rejects.toMatchObject({ statusCode: 503, details: { code: 'PAYMENTS_PAUSED' } });
    everyStripeMoneyCallIsUntouched();
  });

  it('a capture, which would take money off a card and send it to a seller', async () => {
    await expect(captureEscrowPayment('pi_1', { id: 'member-1' })).rejects.toMatchObject({ details: { code: 'PAYMENTS_PAUSED' } });
    everyStripeMoneyCallIsUntouched();
  });

  it('a mentor payout', async () => {
    await expect(
      createPayout({ amount: 10, currency: 'aud', connectedAccountId: 'acct_1', description: 'Earnings' } as any)
    ).rejects.toMatchObject({ details: { code: 'PAYMENTS_PAUSED' } });
    everyStripeMoneyCallIsUntouched();
  });

  it('a gift balance purchase asked for by the service itself, not only through its route', async () => {
    await expect(purchaseGiftBalance('member-1', 10)).rejects.toMatchObject({ statusCode: 503, details: { code: 'PAYMENTS_PAUSED' } });
    everyStripeMoneyCallIsUntouched();
  });

  it('a card payment through the orchestration service, as the 503 and not as a "failed" payment result', async () => {
    await expect(
      processPayment({ userId: 'member-1', amount: 10, currency: 'AUD', description: 'Test' } as any)
    ).rejects.toMatchObject({ statusCode: 503, details: { code: 'PAYMENTS_PAUSED' } });
    everyStripeMoneyCallIsUntouched();
  });

  it('a legacy mentor session hold, which is captured past the escrow service', async () => {
    // No escrow row: the branch that goes to Stripe directly.
    await expect(captureSessionHold('pi_legacy')).rejects.toMatchObject({ statusCode: 503, details: { code: 'PAYMENTS_PAUSED' } });
    everyStripeMoneyCallIsUntouched();
  });

  it('the client secret of a hold still waiting for a card, which would be a way round the pause', async () => {
    await expect(getEscrowClientSecret('pi_waiting')).resolves.toBeNull();
    expect(stripeClient.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('a formation fee, including the client secret of an intent made before the pause', async () => {
    prisma.businessRegistration.findUnique.mockResolvedValue({
      id: 'reg-1',
      userId: 'member-1',
      status: 'PAYMENT_PENDING',
      type: 'COMPANY',
      businessName: 'Mei Studio',
      data: { stripePaymentIntentId: 'pi_existing' },
    });

    await expect(getFormationPayment('member-1', 'reg-1')).rejects.toMatchObject({ statusCode: 503, details: { code: 'PAYMENTS_PAUSED' } });

    expect(stripeClient.paymentIntents.retrieve).not.toHaveBeenCalled();
    everyStripeMoneyCallIsUntouched();
  });

  it('a creator payout, before the points are claimed, so no balance is taken for a transfer that is not going out', async () => {
    await expect(requestPayout('creator-1')).rejects.toMatchObject({ statusCode: 503, details: { code: 'PAYMENTS_PAUSED' } });

    expect(prisma.creatorProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.creatorProfile.updateMany).not.toHaveBeenCalled();
    everyStripeMoneyCallIsUntouched();
  });

  it('a request that starts a payment gets the refusal from the guard, ahead of the route and of the hourly allowance', async () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const next = jest.fn();

    startingAPayment({ user: { id: 'member-1' }, ip: '1.2.3.4' } as any, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as any)?.details).toEqual({ code: 'PAYMENTS_PAUSED' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('the plans the pricing page reads say so, with the message, so the Upgrade button can be held', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.paused).toBe(true);
    expect(res.body.data.pauseMessage).toBe(PAUSE_MESSAGE);
  });
});

describe('with payments open', () => {
  it('the plans say nothing is paused and carry no message', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);

    expect(res.body.data.paused).toBe(false);
    expect(res.body.data.pauseMessage).toBeNull();
  });

  it('a checkout starts, which is the control for everything above', async () => {
    const res = await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(200);

    expect(res.body.data.sessionId).toBe('cs_1');
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// What stays open
// ---------------------------------------------------------------------------

describe('with payments paused, what gives money back or only records it stays open', () => {
  beforeEach(() => {
    pauseRow = paused();
  });

  it('a membership can still be cancelled', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ userId: 'member-1', stripeSubscriptionId: 'sub_1' });

    await request(app).post('/api/subscriptions/cancel').expect(200);

    expect(stripeClient.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true });
  });

  it('a formation fee can still be refunded', async () => {
    prisma.businessRegistration.findUnique.mockResolvedValue({ id: 'reg-1', data: { paymentId: 'pi_paid' } });
    prisma.businessRegistration.update.mockResolvedValue({});

    const outcome = await refundFormationFee('reg-1', 'Refused at review');

    expect(outcome).toMatchObject({ status: 'refunded', refundId: 're_1' });
    expect(stripeClient.refunds.create).toHaveBeenCalledTimes(1);
  });

  it('a hold can still be released back to the buyer\'s card', async () => {
    prisma.escrowPayment = {
      findUnique: jest.fn(async () => ({ id: 'esc-1', buyerId: 'member-1', sellerId: 'seller-1', status: 'AUTHORIZED' })),
      update: jest.fn(async () => ({})),
    };
    stripeClient.paymentIntents.retrieve.mockResolvedValue({ status: 'requires_capture' });

    try {
      const outcome = await cancelEscrowPayment('pi_1', { id: 'member-1' }, 'Buyer asked to cancel');

      expect(outcome).toEqual({ status: 'canceled' });
      expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_1');
    } finally {
      delete prisma.escrowPayment;
    }
  });

  it('the Stripe webhook is still received and recorded: it only records what Stripe already did', async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      id: 'evt_paused_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_x', status: 'succeeded', amount: 100, currency: 'aud', metadata: {} } },
    });
    const saved = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    try {
      const res = await request(app)
        .post('/api/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=abc')
        .send(Buffer.from('{"ok":true}'))
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(prisma.stripeWebhookEvent.create).toHaveBeenCalled();
    } finally {
      if (saved === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = saved;
    }
  });

  it('a member can still read, and sign in: only payments stop', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// What waits instead of failing
// ---------------------------------------------------------------------------

describe('a scheduled collection waits for payments to reopen instead of marking people unpaid', () => {
  it('leaves due mentor sessions untouched, so none is marked FAILED and no mentor is told a payment needs attention', async () => {
    pauseRow = paused();

    const result = await releaseDueMentorSessions(new Date('2026-10-02T00:00:00Z'));

    expect(result).toEqual({ released: 0, failed: 0 });
    expect(prisma.mentorSession.findMany).not.toHaveBeenCalled();
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it('collects them as before once payments are open', async () => {
    pauseRow = null;

    await releaseDueMentorSessions(new Date('2026-10-02T00:00:00Z'));

    expect(prisma.mentorSession.findMany).toHaveBeenCalledTimes(1);
  });

  it('stops, marking nobody FAILED and telling no mentor, when a pause begins part-way through a run', async () => {
    pauseRow = null;
    const due = (id: string) => ({
      id,
      menteeId: 'mentee-1',
      currency: 'AUD',
      sessionAmount: 50,
      scheduledAt: new Date('2026-09-28T00:00:00Z'),
      stripePaymentIntentId: `pi_${id}`,
      mentorProfile: { userId: 'mentor-1' },
    });
    prisma.mentorSession.findMany.mockResolvedValueOnce([due('s1'), due('s2'), due('s3')]);
    prisma.mentorSession.findUnique.mockResolvedValue({ status: 'COMPLETED', paymentStatus: 'AUTHORIZED', disputedAt: null });
    prisma.mentorSession.updateMany.mockResolvedValue({ count: 1 });
    // The first session's card is charged, and the pause is switched on straight after it.
    stripeClient.paymentIntents.capture.mockImplementationOnce(async () => {
      pauseRow = paused();
      resetPaymentsPauseCache();
      return { status: 'succeeded' };
    });

    try {
      const result = await releaseDueMentorSessions(new Date('2026-10-02T00:00:00Z'));

      // One was collected before the pause. The second was refused for the pause, which is not a
      // card that could not be charged, so it is not counted as a failure and the run ends there.
      expect(result).toEqual({ released: 1, failed: 0 });
      expect(stripeClient.paymentIntents.capture).toHaveBeenCalledTimes(1);
      expect(prisma.mentorSession.updateMany.mock.calls.map((call: any[]) => call[0].data.paymentStatus)).toEqual(['CAPTURED']);
    } finally {
      prisma.mentorSession.findUnique.mockReset();
      prisma.mentorSession.updateMany.mockReset();
    }
  });
});

// ---------------------------------------------------------------------------
// The admin switch
// ---------------------------------------------------------------------------

describe('the admin switch', () => {
  const admin = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };

  beforeEach(() => {
    currentUser = admin;
  });

  it('shows an admin the state, read past the cache', async () => {
    pauseRow = paused();

    const res = await request(app).get('/api/admin/payments-pause').expect(200);

    expect(res.body).toMatchObject({ paused: true, message: PAUSE_MESSAGE });
    // Who did it is the audit log's, not the state's: the flag is served to anyone.
    expect(JSON.stringify(res.body)).not.toContain('admin-1');
  });

  it('pauses payments with the admin\'s words, from the next request, and writes who did it', async () => {
    const res = await request(app).post('/api/admin/payments-pause').send({ enabled: true, message: '  We are checking payments.  ' }).expect(200);

    expect(res.body).toMatchObject({ paused: true, message: 'We are checking payments.' });
    const written = prisma.featureFlag.upsert.mock.calls[0][0];
    expect(written.create).toMatchObject({ key: 'payments_paused', enabled: true, rolloutPercentage: 100 });
    expect(written.create.metadata.message).toBe('We are checking payments.');
    // The flag's metadata is served publicly while it is on, so no staff id goes in it.
    expect(JSON.stringify(written.create.metadata)).not.toContain('admin-1');
    // Durable record, not only a log line.
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0])).toContain('PAYMENTS_PAUSE_CHANGED');
  });

  it('takes effect at once for the money paths in this process, with no wait for the cache', async () => {
    pauseRow = null;
    await request(app).post('/api/admin/payments-pause').send({ enabled: true }).expect(200);
    // The route wrote the flag and the cache; the stub read path serves it too.
    pauseRow = paused(DEFAULT_PAYMENTS_PAUSE_MESSAGE);

    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
    await request(app).post('/api/subscriptions/checkout').send({ tier: 'PREMIUM_CAREER' }).expect(503);
  });

  it('resumes payments', async () => {
    pauseRow = paused();

    const res = await request(app).post('/api/admin/payments-pause').send({ enabled: false }).expect(200);

    expect(res.body.paused).toBe(false);
    expect(prisma.featureFlag.upsert.mock.calls[0][0].create.enabled).toBe(false);
  });

  it('does not restart the clock when the message is changed during a pause', async () => {
    pauseRow = paused('First words');

    const res = await request(app).post('/api/admin/payments-pause').send({ enabled: true, message: 'Better words' }).expect(200);

    expect(res.body.startedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(res.body.message).toBe('Better words');
  });

  it('is for admins: a member is refused, and nothing changes', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };

    await request(app).post('/api/admin/payments-pause').send({ enabled: true }).expect(403);
    await request(app).get('/api/admin/payments-pause').expect(403);

    expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it('wants a real boolean and a message of a sensible length', async () => {
    await request(app).post('/api/admin/payments-pause').send({ enabled: 'yes' }).expect(400);
    await request(app).post('/api/admin/payments-pause').send({ enabled: true, message: 'x'.repeat(501) }).expect(400);
    await request(app).post('/api/admin/payments-pause').send({ enabled: true, message: 42 }).expect(400);

    expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
  });
});
