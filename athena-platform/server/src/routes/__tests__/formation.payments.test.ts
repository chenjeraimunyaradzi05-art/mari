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

// Whether staff are told is what these tests look at; who the admins are is not.
jest.mock('../../services/admin-notify.service', () => ({
  notifyAdmins: jest.fn(async (..._args: any[]) => 1),
}));

import Stripe from 'stripe';
import { prisma as prismaTyped } from '../../utils/prisma';
import { notifyAdmins } from '../../services/admin-notify.service';
import { FORMATION_FEES_CENTS } from '../../config/price-book';

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

describe('GET /api/formation/fees', () => {
  it('serves the amount the payment step charges for every structure, in whole cents and in dollars', async () => {
    const res = await request(createTestApp()).get('/api/formation/fees').expect(200);

    expect(res.body.data.currency).toBe('AUD');
    expect(res.body.data.fees).toEqual([
      { type: 'SOLE_TRADER', amountCents: 4900, amount: 49 },
      { type: 'PARTNERSHIP', amountCents: 9900, amount: 99 },
      { type: 'COMPANY', amountCents: 49900, amount: 499 },
      { type: 'TRUST', amountCents: 69900, amount: 699 },
    ]);
    // The same table the payment step reads, not a copy of it.
    for (const fee of res.body.data.fees) {
      expect(fee.amountCents).toBe((FORMATION_FEES_CENTS as Record<string, number>)[fee.type]);
    }
  });

  it('says what the fee is for, what it leaves out and how it is refunded, and states no government fee or turnaround figure', async () => {
    const res = await request(createTestApp()).get('/api/formation/fees').expect(200);
    const { terms, gst } = res.body.data;

    expect(terms.covers.length).toBeGreaterThan(0);
    expect(terms.notCovered.join(' ')).toMatch(/government register/);
    expect(terms.refund.join(' ')).toMatch(/refunded in full/);
    // Nobody has decided what a register charges or how long review takes, so no
    // number is printed for either.
    expect(JSON.stringify(terms)).not.toMatch(/[0-9]/);
    expect(gst.statement).toMatch(/Australian dollars/);
  });

  it('is registered ahead of the guard, so it is served without a session', () => {
    // The mocked authenticate in this file lets everyone in, so the order is read
    // from the router itself: /fees sits before the first router-level middleware.
    const stack: any[] = (formationRoutes as any).stack;
    const feesAt = stack.findIndex((layer) => layer.route?.path === '/fees');
    const guardAt = stack.findIndex((layer) => !layer.route);
    expect(feesAt).toBeGreaterThanOrEqual(0);
    expect(guardAt).toBeGreaterThan(feesAt);
  });
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
      }),
      { idempotencyKey: expect.stringMatching(/^formation-fee-reg-1-/) }
    );

    expect(registration.status).toBe('PAYMENT_PENDING');
    expect(registration.data.stripePaymentIntentId).toBe('pi_new');

    // Two submits that arrive together both find no intent to reuse; the same
    // key hands the second the intent the first made.
    expect((getStripeClient().paymentIntents.create.mock.calls[0] as any[])[1]).toEqual({
      idempotencyKey: `formation-fee-reg-1-${COMPANY_FEE_CENTS}-first`,
    });
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

    // The intent this one replaces is in the key, so a replacement made after
    // the first was cancelled is a new request and not the dead one handed back
    // for the next twenty-four hours.
    expect((getStripeClient().paymentIntents.create.mock.calls[0] as any[])[1]).toEqual({
      idempotencyKey: `formation-fee-reg-1-${COMPANY_FEE_CENTS}-pi_stale`,
    });
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

  describe('a payment that is not the fee', () => {
    const paymentPending = () =>
      stubRegistration({
        ...draftCompany(),
        status: 'PAYMENT_PENDING',
        data: { ...draftCompany().data, stripePaymentIntentId: 'pi_short' },
      });

    it('tells the admins when the browser confirms it, which is what makes "Support has been notified" true', async () => {
      const registration = paymentPending();
      getStripeClient().paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_short',
        status: 'succeeded',
        amount: 100,
        amount_received: 100,
        currency: 'aud',
        metadata: { registrationId: 'reg-1' },
      });

      const res = await request(createTestApp())
        .post('/api/formation/reg-1/confirm-payment')
        .send({ paymentIntentId: 'pi_short' })
        .expect(400);

      expect(res.body.message).toMatch(/Support has been notified/);
      expect(registration.status).toBe('PAYMENT_PENDING');
      expect(notifyAdmins).toHaveBeenCalledTimes(1);
      const notice: any = (notifyAdmins as jest.Mock).mock.calls[0][0];
      expect(notice.title).toBe('A formation payment does not match the fee');
      // What was taken and what was due, so whoever opens it can act.
      expect(notice.message).toContain('paid 1.00 AUD against a fee of 499.00 AUD');
      expect(notice).toMatchObject({ link: '/admin/formation', data: { kind: 'FORMATION_PAYMENT_MISMATCH', id: 'reg-1' } });
    });

    it('tells the admins when the webhook delivers it, and still does not call the registration paid', async () => {
      const registration = paymentPending();
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- the service reads its environment at import
      const formation = require('../../services/formation.service');

      const outcome = await formation.confirmFormationPaymentFromWebhook({
        id: 'pi_wrong_currency',
        amount: COMPANY_FEE_CENTS,
        amount_received: COMPANY_FEE_CENTS,
        currency: 'usd',
        metadata: { registrationId: 'reg-1' },
      });

      expect(outcome).toEqual({ status: 'amount_mismatch', registrationId: 'reg-1' });
      expect(registration.status).toBe('PAYMENT_PENDING');
      expect(notifyAdmins).toHaveBeenCalledTimes(1);
      expect((notifyAdmins as jest.Mock).mock.calls[0][0]).toMatchObject({ message: expect.stringContaining('paid 499.00 USD against a fee of 499.00 AUD') });
    });

    it('does not tell the admins about a payment that is exactly the fee', async () => {
      paymentPending();
      getStripeClient().paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_short',
        status: 'succeeded',
        amount: COMPANY_FEE_CENTS,
        amount_received: COMPANY_FEE_CENTS,
        currency: 'aud',
        metadata: { registrationId: 'reg-1' },
      });

      await request(createTestApp()).post('/api/formation/reg-1/confirm-payment').send({ paymentIntentId: 'pi_short' }).expect(200);

      const titles = (notifyAdmins as jest.Mock).mock.calls.map((call: any[]) => call[0].title);
      expect(titles).not.toContain('A formation payment does not match the fee');
      expect(titles).toContain('A business registration is waiting for review');
    });
  });

  it('rejects a confirmation with no payment intent id', async () => {
    stubRegistration({ ...draftCompany(), status: 'PAYMENT_PENDING' });

    await request(createTestApp())
      .post('/api/formation/reg-1/confirm-payment')
      .send({})
      .expect(400);
  });
});
