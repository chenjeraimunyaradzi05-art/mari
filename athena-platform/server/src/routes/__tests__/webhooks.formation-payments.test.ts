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
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    mentorSession: { update: jest.fn() },
    subscription: { upsert: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    // Every succeeded intent now writes the money onto the Payment table,
    // which is what the invoice pipeline reads. findUnique answering null
    // keeps the invoice hook a no-op for this suite, which is about the
    // registration's state, not its document.
    payment: { upsert: jest.fn(), findUnique: jest.fn(async () => null), update: jest.fn() },
    notification: { createMany: jest.fn() },
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
      // Written by createAcceleratorEnrollmentPayment before the client secret
      // went out: the webhook only believes the intent the enrolment started.
      paymentId: 'pi_accel',
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
      paymentId: 'pi_accel_short',
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
      paymentId: 'pi_accel_failed',
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

  // The webhook used to believe the intent's own metadata about which place it
  // paid for and what that place cost. A payment of one dollar whose metadata
  // named an expensive place and quoted one dollar marked that place paid.
  describe('an intent the enrolment did not start is not believed', () => {
    const intentEvent = (id: string, amountCents: number, metadata: Record<string, string>) => ({
      id: `evt_${id}`,
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id,
          status: 'succeeded',
          amount: amountCents,
          amount_received: amountCents,
          currency: 'aud',
          metadata: { type: 'accelerator_enrollment', enrollmentId: 'enr-forged', ...metadata },
        },
      },
    });

    it('does not mark a place paid on a dollar that quotes its own price', async () => {
      const enrollment = stubEnrollment({
        id: 'enr-forged',
        userId: 'user-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentId: 'pi_real_intent',
        cohort: { id: 'cohort-1', priceAud: 2500 },
      });

      // Somebody else's intent, created by some other route with chosen
      // metadata: it names the enrolment and quotes 100 cents, so 100 cents
      // would have been enough.
      getStripeClient().webhooks.constructEvent.mockReturnValue(
        intentEvent('pi_forged', 100, { amountCents: '100' })
      );

      await sendEvent(createTestApp()).expect(200);

      expect(enrollment.paymentStatus).toBe('PENDING');
      expect(enrollment.status).toBe('PENDING');
      expect(enrollment.paymentId).toBe('pi_real_intent');
      expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
    });

    it('does not mark a place paid by a full-price payment that belongs to another intent', async () => {
      const enrollment = stubEnrollment({
        id: 'enr-forged',
        userId: 'user-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentId: null,
        cohort: { id: 'cohort-1', priceAud: 2500 },
      });

      getStripeClient().webhooks.constructEvent.mockReturnValue(
        intentEvent('pi_stranger', 250000, { amountCents: '250000', userId: 'user-1' })
      );

      await sendEvent(createTestApp()).expect(200);

      expect(enrollment.paymentStatus).toBe('PENDING');
      expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
    });

    it('does not apply an intent whose metadata names a different member', async () => {
      const enrollment = stubEnrollment({
        id: 'enr-forged',
        userId: 'user-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentId: 'pi_mine',
        cohort: { id: 'cohort-1', priceAud: 2500 },
      });

      getStripeClient().webhooks.constructEvent.mockReturnValue(
        intentEvent('pi_mine', 250000, { amountCents: '250000', userId: 'someone-else' })
      );

      await sendEvent(createTestApp()).expect(200);

      expect(enrollment.paymentStatus).toBe('PENDING');
      expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
    });

    it('still refuses the enrolment\'s own intent when it was paid short of the quote', async () => {
      const enrollment = stubEnrollment({
        id: 'enr-forged',
        userId: 'user-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentId: 'pi_recorded',
        cohort: { id: 'cohort-1', priceAud: 2500 },
      });

      // The server quoted the full price on its own intent, and only 5000 cents
      // arrived.
      getStripeClient().webhooks.constructEvent.mockReturnValue(
        intentEvent('pi_recorded', 5000, { amountCents: '250000', userId: 'user-1' })
      );

      await sendEvent(createTestApp()).expect(200);

      expect(enrollment.paymentStatus).toBe('PENDING');
      expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
    });

    it('does not let a cancelled earlier intent mark the live one failed', async () => {
      const enrollment = stubEnrollment({
        id: 'enr-forged',
        userId: 'user-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentId: 'pi_live',
        cohort: { id: 'cohort-1', priceAud: 2500 },
      });

      getStripeClient().webhooks.constructEvent.mockReturnValue({
        id: 'evt_old_cancel',
        type: 'payment_intent.canceled',
        data: {
          object: {
            id: 'pi_old',
            status: 'canceled',
            amount: 250000,
            currency: 'aud',
            metadata: { type: 'accelerator_enrollment', enrollmentId: 'enr-forged' },
          },
        },
      });

      await sendEvent(createTestApp()).expect(200);

      expect(enrollment.paymentStatus).toBe('PENDING');
      expect(enrollment.paymentId).toBe('pi_live');
    });
  });
});
