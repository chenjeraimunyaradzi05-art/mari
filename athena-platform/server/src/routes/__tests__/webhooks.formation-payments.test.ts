import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
    businessRegistration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    acceleratorEnrollment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    mentorSession: { update: jest.fn() },
    subscription: { upsert: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    customers: { create: jest.fn() },
    transfers: { create: jest.fn() },
  };

  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;

  return { __esModule: true, default: StripeMock };
});

// The formation state machine notifies through a NotificationService instance,
// which would otherwise reach for prisma models this suite does not stub.
jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ notify: jest.fn() })),
  notificationService: { notify: jest.fn() },
}));

jest.mock('../../services/creator.service', () => ({
  confirmGiftPurchaseFromPaymentIntent: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

function getStripeClient(): any {
  return (Stripe as any).__client;
}

function createTestApp() {
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

/**
 * A registration that reads back whatever was last written to it, so the two
 * state-machine hops (PAYMENT_SUCCESS then SUBMIT) see each other's work the
 * way they would against a real database.
 */
function stubRegistration(initial: Record<string, any>) {
  const registration: Record<string, any> = { ...initial };

  (prisma.businessRegistration.findUnique as any).mockImplementation(async () => ({
    ...registration,
    user: { id: registration.userId, email: 'founder@example.com', firstName: 'Fay' },
  }));

  (prisma.businessRegistration.update as any).mockImplementation(async ({ data }: any) => {
    Object.assign(registration, data);
    return { ...registration };
  });

  return registration;
}

function stubEnrollment(initial: Record<string, any>) {
  const enrollment: Record<string, any> = { ...initial };

  (prisma.acceleratorEnrollment.findUnique as any).mockImplementation(async () => ({ ...enrollment }));
  (prisma.acceleratorEnrollment.update as any).mockImplementation(async ({ data }: any) => {
    Object.assign(enrollment, data);
    return { ...enrollment };
  });

  return enrollment;
}

function sendEvent(app: express.Express) {
  return request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=123,v1=abc')
    .send(Buffer.from('{"ok":true}'));
}

const COMPANY_FEE_CENTS = 49900;

describe('Stripe webhooks: formation payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    (prisma.stripeWebhookEvent.create as any).mockResolvedValue({ id: 'evt_x' });
  });

  it('advances a paid company registration out of PAYMENT_PENDING', async () => {
    const registration = stubRegistration({
      id: 'reg-1',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'PAYMENT_PENDING',
      data: { stripePaymentIntentId: 'pi_formation' },
      stateHistory: [],
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_formation_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_formation',
          status: 'succeeded',
          amount: COMPANY_FEE_CENTS,
          amount_received: COMPANY_FEE_CENTS,
          currency: 'aud',
          metadata: { type: 'business_formation', registrationId: 'reg-1', userId: 'user-1' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(registration.status).toBe('SUBMITTED');
    expect(registration.data.paymentId).toBe('pi_formation');
    expect(registration.data.paidAmountCents).toBe(COMPANY_FEE_CENTS);
    expect(registration.stateHistory.map((h: any) => h.to)).toEqual(['PAYMENT_COMPLETE', 'SUBMITTED']);
  });

  it('refuses to mark a registration paid when the amount is not the fee', async () => {
    const registration = stubRegistration({
      id: 'reg-2',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'PAYMENT_PENDING',
      data: { stripePaymentIntentId: 'pi_short' },
      stateHistory: [],
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_formation_2',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_short',
          status: 'succeeded',
          amount: 100,
          amount_received: 100,
          currency: 'aud',
          metadata: { type: 'business_formation', registrationId: 'reg-2', userId: 'user-1' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(registration.status).toBe('PAYMENT_PENDING');
    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('refuses a payment in a currency the formation fee was never quoted in', async () => {
    const registration = stubRegistration({
      id: 'reg-3',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'PAYMENT_PENDING',
      data: {},
      stateHistory: [],
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_formation_3',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_usd',
          status: 'succeeded',
          amount: COMPANY_FEE_CENTS,
          amount_received: COMPANY_FEE_CENTS,
          currency: 'usd',
          metadata: { type: 'business_formation', registrationId: 'reg-3' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(registration.status).toBe('PAYMENT_PENDING');
  });

  it('does not transition twice when Stripe sends the payment again', async () => {
    const registration = stubRegistration({
      id: 'reg-4',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'SUBMITTED',
      data: { stripePaymentIntentId: 'pi_formation', paymentId: 'pi_formation' },
      stateHistory: [{ from: 'PAYMENT_COMPLETE', to: 'SUBMITTED' }],
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_formation_replay',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_formation',
          status: 'succeeded',
          amount: COMPANY_FEE_CENTS,
          amount_received: COMPANY_FEE_CENTS,
          currency: 'aud',
          metadata: { type: 'business_formation', registrationId: 'reg-4' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
    expect(registration.stateHistory).toHaveLength(1);
  });

  it('records a failed card without stranding the registration', async () => {
    const registration = stubRegistration({
      id: 'reg-5',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'PAYMENT_PENDING',
      data: { stripePaymentIntentId: 'pi_declined' },
      stateHistory: [],
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_formation_failed',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_declined',
          status: 'requires_payment_method',
          amount: COMPANY_FEE_CENTS,
          currency: 'aud',
          last_payment_error: { message: 'Your card was declined.' },
          metadata: { type: 'business_formation', registrationId: 'reg-5' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(registration.status).toBe('PAYMENT_PENDING');
    expect(registration.data.lastPaymentFailure).toEqual(
      expect.objectContaining({ paymentIntentId: 'pi_declined', reason: 'failed' })
    );
  });

  it('releases the idempotency record when a handler fails, so Stripe can retry', async () => {
    (prisma.businessRegistration.findUnique as any).mockRejectedValue(new Error('database is down'));

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_formation_boom',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_boom',
          status: 'succeeded',
          amount: COMPANY_FEE_CENTS,
          amount_received: COMPANY_FEE_CENTS,
          currency: 'aud',
          metadata: { type: 'business_formation', registrationId: 'reg-6' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(500);

    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({
      where: { id: 'evt_formation_boom' },
    });
  });
});

describe('Stripe webhooks: accelerator enrollment payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    (prisma.stripeWebhookEvent.create as any).mockResolvedValue({ id: 'evt_x' });
  });

  it('activates the enrollment once the cohort fee is paid', async () => {
    const enrollment = stubEnrollment({
      id: 'enr-1',
      userId: 'user-1',
      cohortId: 'cohort-1',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      cohort: { id: 'cohort-1', priceAud: 2500 },
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_accel_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_accel',
          status: 'succeeded',
          amount: 250000,
          amount_received: 250000,
          currency: 'aud',
          metadata: {
            type: 'accelerator_enrollment',
            enrollmentId: 'enr-1',
            cohortId: 'cohort-1',
            amountCents: '250000',
          },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(enrollment.paymentStatus).toBe('PAID');
    expect(enrollment.status).toBe('ACTIVE');
    expect(enrollment.paymentId).toBe('pi_accel');
  });

  it('does not activate a spot that was underpaid', async () => {
    const enrollment = stubEnrollment({
      id: 'enr-2',
      userId: 'user-1',
      cohortId: 'cohort-1',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      cohort: { id: 'cohort-1', priceAud: 2500 },
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_accel_2',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_accel_short',
          status: 'succeeded',
          amount: 5000,
          amount_received: 5000,
          currency: 'aud',
          metadata: {
            type: 'accelerator_enrollment',
            enrollmentId: 'enr-2',
            amountCents: '250000',
          },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(enrollment.paymentStatus).toBe('PENDING');
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('leaves an already paid enrollment untouched on replay', async () => {
    stubEnrollment({
      id: 'enr-3',
      userId: 'user-1',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      paymentId: 'pi_accel',
      cohort: { id: 'cohort-1', priceAud: 2500 },
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_accel_3',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_accel',
          status: 'succeeded',
          amount: 250000,
          amount_received: 250000,
          currency: 'aud',
          metadata: { type: 'accelerator_enrollment', enrollmentId: 'enr-3', amountCents: '250000' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('marks the enrollment failed when the payment does not go through', async () => {
    const enrollment = stubEnrollment({
      id: 'enr-4',
      userId: 'user-1',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      cohort: { id: 'cohort-1', priceAud: 2500 },
    });

    getStripeClient().webhooks.constructEvent.mockReturnValue({
      id: 'evt_accel_4',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_accel_failed',
          status: 'requires_payment_method',
          amount: 250000,
          currency: 'aud',
          metadata: { type: 'accelerator_enrollment', enrollmentId: 'enr-4' },
        },
      },
    });

    await sendEvent(createTestApp()).expect(200);

    expect(enrollment.paymentStatus).toBe('FAILED');
    expect(enrollment.status).toBe('PENDING');
  });
});
