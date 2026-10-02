import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Who writes the facts on a payment intent.
 *
 * The Stripe webhook reads an intent's metadata as the truth about what was
 * bought: whose it is, which session, enrolment or registration it belongs to,
 * how many gift points, what was quoted. POST /api/payments/process used to let
 * a signed-in member choose all of it, and the route is gone. processPayment is
 * what remains, and it is server code: the caller's `metadata` can carry free
 * text but never a reserved key, and the keys the sale needs go in
 * `serverMetadata`, which no request body reaches.
 */

const stripeClient = {
  paymentIntents: {
    create: jest.fn(async (_params: any): Promise<any> => ({
      id: 'pi_new',
      status: 'requires_payment_method',
      client_secret: 'pi_new_secret',
    })),
    retrieve: jest.fn(async (_id: string): Promise<any> => ({ id: 'pi_old', status: 'requires_payment_method' })),
    cancel: jest.fn(async (_id: string, _params?: any): Promise<any> => ({ id: 'pi_old', status: 'canceled' })),
  },
  customers: { create: jest.fn(async (): Promise<any> => ({ id: 'cus_new' })) },
};

jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripeClient,
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(async () => ({ stripeCustomerId: 'cus_1' })),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    user: { findUnique: jest.fn(async () => ({ email: 'mei@example.com', displayName: 'Mei' })) },
    acceleratorEnrollment: {
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  confirmAcceleratorEnrollmentPayment,
  createAcceleratorEnrollmentPayment,
  processPayment,
} from '../payments-orchestration.service';

const prisma: any = prismaTyped;

const createdIntent = () => (stripeClient.paymentIntents.create.mock.calls[0] as any[])[0];

describe('processPayment metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
  });

  it('removes every reserved key from what the caller supplies, and keeps free text', async () => {
    await processPayment({
      userId: 'member-1',
      amount: 1,
      currency: 'AUD',
      description: 'A dollar',
      metadata: {
        type: 'gift_balance_purchase',
        userId: 'member-1',
        giftPoints: '1000000',
        sessionId: 'someone-elses-session',
        menteeId: 'someone-else',
        registrationId: 'reg-1',
        enrollmentId: 'enr-1',
        cohortId: 'coh-1',
        amountCents: '100',
        currency: 'VND',
        buyerId: 'a',
        sellerId: 'b',
        sessionType: 'service_order',
        payoutId: 'po-1',
        mentorProfileId: 'mp-1',
        reference: 'order 1234',
      },
    });

    const metadata = createdIntent().metadata;
    expect(metadata).toEqual({ reference: 'order 1234' });
  });

  it('writes the server\'s own keys, and a caller cannot override one of them', async () => {
    await processPayment(
      {
        userId: 'member-1',
        amount: 2500,
        currency: 'AUD',
        description: 'Accelerator cohort',
        metadata: { type: 'gift_balance_purchase', amountCents: '1', note: 'hello' },
      },
      { type: 'accelerator_enrollment', enrollmentId: 'enr-1', amountCents: '250000' }
    );

    expect(createdIntent().metadata).toEqual({
      note: 'hello',
      type: 'accelerator_enrollment',
      enrollmentId: 'enr-1',
      amountCents: '250000',
    });
  });

  it('charges in the currency\'s own smallest unit, so a zero-decimal currency is not charged a hundred times over', async () => {
    await processPayment({ userId: 'member-1', amount: 1000, currency: 'JPY' as any, description: 'Yen' });
    expect(createdIntent().amount).toBe(1000);
    expect(createdIntent().currency).toBe('jpy');

    jest.clearAllMocks();
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    await processPayment({ userId: 'member-1', amount: 12.34, currency: 'AUD', description: 'Dollars' });
    expect(createdIntent().amount).toBe(1234);
  });
});

describe('createAcceleratorEnrollmentPayment', () => {
  const params = {
    enrollmentId: 'enr-1',
    userId: 'member-1',
    cohortId: 'coh-1',
    cohortName: 'Spring cohort',
    priceAud: 2500,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ paymentId: null });
  });

  it('writes the type, the enrolment and the quoted price itself, and records the intent against the enrolment', async () => {
    const result = await createAcceleratorEnrollmentPayment(params);

    expect(createdIntent()).toMatchObject({
      amount: 250000,
      currency: 'aud',
      metadata: {
        type: 'accelerator_enrollment',
        enrollmentId: 'enr-1',
        cohortId: 'coh-1',
        userId: 'member-1',
        amountCents: '250000',
      },
    });
    // The webhook only believes the intent the enrolment itself started.
    expect(prisma.acceleratorEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enr-1' },
      data: { paymentId: 'pi_new' },
    });
    expect(result.paymentIntentId).toBe('pi_new');
    expect(result.clientSecret).toBe('pi_new_secret');
  });

  // Two presses of "pay" that arrive together both read the same earlier intent,
  // so they send the same key and Stripe hands the second the intent the first
  // made. The earlier intent is part of the key, so that once it is cancelled the
  // next press is a new request and not the cancelled intent handed back.
  it('keys the intent on the enrolment, the price and the intent it replaces', async () => {
    await createAcceleratorEnrollmentPayment(params);
    expect((stripeClient.paymentIntents.create.mock.calls[0] as any[])[1]).toEqual({
      idempotencyKey: 'accelerator-pay-enr-1-250000-first',
    });

    jest.clearAllMocks();
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ paymentId: 'pi_old' });
    await createAcceleratorEnrollmentPayment(params);
    expect((stripeClient.paymentIntents.create.mock.calls[0] as any[])[1]).toEqual({
      idempotencyKey: 'accelerator-pay-enr-1-250000-pi_old',
    });

    jest.clearAllMocks();
    prisma.subscription.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ paymentId: 'pi_old' });
    await createAcceleratorEnrollmentPayment({ ...params, priceAud: 3000 });
    // A repriced cohort is a different request, not one Stripe would call a mismatch.
    expect((stripeClient.paymentIntents.create.mock.calls[0] as any[])[1]).toEqual({
      idempotencyKey: 'accelerator-pay-enr-1-300000-pi_old',
    });
  });

  // Cancelling the earlier intent makes Stripe send payment_intent.canceled for
  // it, which can reach the webhook before the new id is written and mark the
  // place FAILED while she is paying the new intent.
  it('puts back a FAILED the cancelled intent left on the place, for the new intent only', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ paymentId: 'pi_old' });

    await createAcceleratorEnrollmentPayment(params);

    expect(prisma.acceleratorEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: 'enr-1', paymentId: 'pi_new', paymentStatus: 'FAILED' },
      data: { paymentStatus: 'PENDING' },
    });
  });

  it('cancels the intent from an earlier press of pay, so only one is ever payable', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ paymentId: 'pi_old' });

    await createAcceleratorEnrollmentPayment(params);

    expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_old', { cancellation_reason: 'abandoned' });
    expect(stripeClient.paymentIntents.create).toHaveBeenCalledTimes(1);
  });

  it('starts no second payment while the first is going through', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue({ paymentId: 'pi_old' });
    stripeClient.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_old', status: 'processing' });

    const result = await createAcceleratorEnrollmentPayment(params);

    expect(stripeClient.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripeClient.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(result.status).toBe('pending');
    expect(result.error).toMatch(/already going through/i);
  });
});

// A payment confirms a place only when it is the intent that place itself
// started, for the price that was quoted, in dollars. Metadata on an intent is a
// note the server wrote; it is never the thing that decides.
describe('confirmAcceleratorEnrollmentPayment', () => {
  const intent = (over: Record<string, unknown> = {}, metadata: Record<string, string> = {}) =>
    ({
      id: 'pi_own',
      status: 'succeeded',
      amount: 250000,
      amount_received: 250000,
      currency: 'aud',
      metadata: { type: 'accelerator_enrollment', enrollmentId: 'enr-1', userId: 'member-1', cohortId: 'coh-1', amountCents: '250000', ...metadata },
      ...over,
    }) as any;

  const enrolment = (over: Record<string, unknown> = {}) => ({
    id: 'enr-1',
    userId: 'member-1',
    paymentId: 'pi_own',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    cohort: { priceAud: 2500 },
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolment());
  });

  it('confirms the place for the intent it started, at the price it was quoted', async () => {
    const result = await confirmAcceleratorEnrollmentPayment(intent());

    expect(result).toEqual({ status: 'confirmed', enrollmentId: 'enr-1' });
    expect(prisma.acceleratorEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enr-1' },
      data: { paymentStatus: 'PAID', paymentId: 'pi_own', status: 'ACTIVE' },
    });
  });

  it('does not confirm a place for a payment that names it but is not the intent it started, whatever the metadata says it cost', async () => {
    // A dollar paid on some other intent, labelled with a quote of a dollar.
    const result = await confirmAcceleratorEnrollmentPayment(
      intent({ id: 'pi_other', amount: 100, amount_received: 100 }, { amountCents: '100' })
    );

    expect(result).toEqual({ status: 'intent_mismatch', enrollmentId: 'enr-1' });
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('does not confirm a place for somebody else’s intent: the metadata has to name the member who holds it', async () => {
    const result = await confirmAcceleratorEnrollmentPayment(intent({}, { userId: 'someone-else' }));

    expect(result.status).toBe('intent_mismatch');
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('does not confirm a place when less was received than was quoted', async () => {
    const result = await confirmAcceleratorEnrollmentPayment(intent({ amount: 250000, amount_received: 100 }));

    expect(result.status).toBe('amount_mismatch');
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('does not confirm a place paid in another currency for the same number', async () => {
    const result = await confirmAcceleratorEnrollmentPayment(intent({ currency: 'vnd' }));

    expect(result.status).toBe('amount_mismatch');
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });

  it('falls back to the cohort’s price in the database when the intent carries no quote', async () => {
    const noQuote = intent({ amount: 100, amount_received: 100 }, { amountCents: '' });

    expect((await confirmAcceleratorEnrollmentPayment(noQuote)).status).toBe('amount_mismatch');
    expect(
      (await confirmAcceleratorEnrollmentPayment(intent({}, { amountCents: '' }))).status
    ).toBe('confirmed');
  });

  it('says a place already paid is already processed, and writes nothing', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(enrolment({ paymentStatus: 'PAID' }));

    const result = await confirmAcceleratorEnrollmentPayment(intent());

    expect(result.status).toBe('already_processed');
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
  });
});
