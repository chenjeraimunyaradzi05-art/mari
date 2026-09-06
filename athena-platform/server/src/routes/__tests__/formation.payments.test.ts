import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    businessRegistration: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'user-1', role: 'USER', email: 'u@a.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('stripe', () => {
  const stripeClient = {
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  };

  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;

  return { __esModule: true, default: StripeMock };
});

jest.mock('../../services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({ notify: jest.fn() })),
  notificationService: { notify: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

// The formation service builds its Stripe client at import time, so the key has
// to be in place before the module is pulled in - a top-level import would be
// hoisted above this assignment and the service would take the no-Stripe path.
process.env.STRIPE_SECRET_KEY = 'sk_test_formation';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a static import would hoist above the env assignment
const formationRoutes = require('../formation.routes').default;

function getStripeClient(): any {
  return (Stripe as any).__client;
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/formation', formationRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

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

const COMPANY_FEE_CENTS = 49900;

const draftCompany = () => ({
  id: 'reg-1',
  userId: 'user-1',
  type: 'COMPANY',
  status: 'DRAFT',
  businessName: 'Kestrel Studio Pty Ltd',
  data: {
    businessName: 'Kestrel Studio Pty Ltd',
    directors: [{ name: 'Fay Nolan' }],
    registeredAddress: { line1: '12 Boundary St', city: 'Brisbane', state: 'QLD', postcode: '4000' },
  },
  stateHistory: [],
});

describe('Formation payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'founder@example.com' });
  });

  it('submitting a company registration hands back a payment the client can collect', async () => {
    const registration = stubRegistration(draftCompany());

    getStripeClient().paymentIntents.create.mockResolvedValue({
      id: 'pi_new',
      client_secret: 'pi_new_secret',
      status: 'requires_payment_method',
      amount: COMPANY_FEE_CENTS,
      currency: 'aud',
    });

    const res = await request(createTestApp())
      .post('/api/formation/reg-1/submit')
      .send({})
      .expect(200);

    expect(res.body.payment).toEqual(
      expect.objectContaining({
        paymentIntentId: 'pi_new',
        clientSecret: 'pi_new_secret',
        amountCents: COMPANY_FEE_CENTS,
        currency: 'aud',
      })
    );

    // Without the type discriminator the webhook cannot route the payment back
    // to this registration, which is what left registrations stuck.
    expect(getStripeClient().paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: COMPANY_FEE_CENTS,
        currency: 'aud',
        metadata: expect.objectContaining({
          type: 'business_formation',
          registrationId: 'reg-1',
          userId: 'user-1',
        }),
      })
    );

    expect(registration.status).toBe('PAYMENT_PENDING');
    expect(registration.data.stripePaymentIntentId).toBe('pi_new');
  });

  it('reuses the existing intent when an applicant comes back to pay', async () => {
    stubRegistration({
      ...draftCompany(),
      status: 'PAYMENT_PENDING',
      data: { ...draftCompany().data, stripePaymentIntentId: 'pi_existing' },
    });

    getStripeClient().paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_existing',
      client_secret: 'pi_existing_secret',
      status: 'requires_payment_method',
      amount: COMPANY_FEE_CENTS,
      currency: 'aud',
    });

    const res = await request(createTestApp())
      .post('/api/formation/reg-1/payment-intent')
      .send({})
      .expect(200);

    expect(res.body.paymentIntentId).toBe('pi_existing');
    expect(getStripeClient().paymentIntents.create).not.toHaveBeenCalled();
  });

  it('mints a new intent when the old one no longer matches the fee', async () => {
    const registration = stubRegistration({
      ...draftCompany(),
      status: 'PAYMENT_PENDING',
      data: { ...draftCompany().data, stripePaymentIntentId: 'pi_stale' },
    });

    getStripeClient().paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_stale',
      client_secret: 'pi_stale_secret',
      status: 'requires_payment_method',
      amount: 100,
      currency: 'aud',
    });

    getStripeClient().paymentIntents.create.mockResolvedValue({
      id: 'pi_fresh',
      client_secret: 'pi_fresh_secret',
      status: 'requires_payment_method',
      amount: COMPANY_FEE_CENTS,
      currency: 'aud',
    });

    const res = await request(createTestApp())
      .post('/api/formation/reg-1/payment-intent')
      .send({})
      .expect(200);

    expect(res.body.paymentIntentId).toBe('pi_fresh');
    expect(registration.data.stripePaymentIntentId).toBe('pi_fresh');
  });

  it('refuses a payment intent that was minted for someone else', async () => {
    const registration = stubRegistration({
      ...draftCompany(),
      status: 'PAYMENT_PENDING',
      data: { ...draftCompany().data, stripePaymentIntentId: 'pi_ours' },
    });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .send({ paymentIntentId: 'pi_someone_elses' })
      .expect(400);

    expect(registration.status).toBe('PAYMENT_PENDING');
    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('refuses to confirm a payment Stripe has not settled', async () => {
    const registration = stubRegistration({
      ...draftCompany(),
      status: 'PAYMENT_PENDING',
      data: { ...draftCompany().data, stripePaymentIntentId: 'pi_pending' },
    });

    getStripeClient().paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_pending',
      status: 'requires_payment_method',
      amount: COMPANY_FEE_CENTS,
      amount_received: 0,
      currency: 'aud',
      metadata: { registrationId: 'reg-1' },
    });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .send({ paymentIntentId: 'pi_pending' })
      .expect(400);

    expect(registration.status).toBe('PAYMENT_PENDING');
  });

  it('confirms a settled payment and moves the registration into review', async () => {
    const registration = stubRegistration({
      ...draftCompany(),
      status: 'PAYMENT_PENDING',
      data: { ...draftCompany().data, stripePaymentIntentId: 'pi_paid' },
    });

    getStripeClient().paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_paid',
      status: 'succeeded',
      amount: COMPANY_FEE_CENTS,
      amount_received: COMPANY_FEE_CENTS,
      currency: 'aud',
      metadata: { registrationId: 'reg-1' },
    });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .send({ paymentIntentId: 'pi_paid' })
      .expect(200);

    expect(registration.status).toBe('SUBMITTED');
    expect(registration.data.paymentId).toBe('pi_paid');
  });

  it('treats a registration the webhook already confirmed as success, not an error', async () => {
    stubRegistration({
      ...draftCompany(),
      status: 'SUBMITTED',
      data: { ...draftCompany().data, stripePaymentIntentId: 'pi_paid', paymentId: 'pi_paid' },
    });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .send({ paymentIntentId: 'pi_paid' })
      .expect(200);

    expect(prisma.businessRegistration.update).not.toHaveBeenCalled();
  });

  it('will not let one applicant pay against another applicant\'s registration', async () => {
    stubRegistration({ ...draftCompany(), status: 'PAYMENT_PENDING' });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .set('x-test-user', 'intruder-9')
      .send({ paymentIntentId: 'pi_paid' })
      .expect(403);
  });

  it('rejects a confirmation with no payment intent id', async () => {
    stubRegistration({ ...draftCompany(), status: 'PAYMENT_PENDING' });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .send({})
      .expect(400);
  });
});
