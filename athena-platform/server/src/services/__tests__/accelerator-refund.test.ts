/**
 * Giving an accelerator fee back, and making sure an abandoned place cannot be
 * charged for.
 *
 * Staff used to refund a place in the Stripe dashboard and type a reference
 * into the admin screen, so a "refunded" place was only as true as the typing
 * and the Payment row the webhook wrote for the fee still read COMPLETED. And a
 * founder who left an unpaid place could still finish the checkout she had
 * open, which charged her card for a place that no longer existed.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const stripe = {
  refunds: { create: jest.fn(async (..._args: any[]): Promise<any> => ({ id: 're_1', amount: 250000 })) },
  paymentIntents: {
    retrieve: jest.fn(async (..._args: any[]): Promise<any> => ({ status: 'requires_payment_method' })),
    cancel: jest.fn(async (..._args: any[]): Promise<any> => ({ status: 'canceled' })),
  },
};

let stripeConfigured = true;
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => stripeConfigured,
  getStripe: () => stripe,
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
    acceleratorEnrollment: {
      findUnique: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({ id: 'e1', ...data })),
    },
    payment: { updateMany: jest.fn(async () => ({ count: 1 })) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  cancelUnpaidAcceleratorIntent,
  refundAcceleratorEnrollmentPayment,
} from '../payments-orchestration.service';

const prisma: any = prismaTyped;

const paidPlace = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  userId: 'founder-1',
  status: 'ACTIVE',
  paymentStatus: 'PAID',
  paymentId: 'pi_fee',
  ...over,
});

describe('refundAcceleratorEnrollmentPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stripeConfigured = true;
  });

  it('refunds through Stripe once, then moves the place and the Payment row together', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace());

    const result = await refundAcceleratorEnrollmentPayment('e1', 'Cohort cancelled');

    expect(result).toEqual({ status: 'refunded', refundId: 're_1', amountCents: 250000 });
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_fee' }),
      { idempotencyKey: 'accelerator-refund-e1' }
    );
    expect(prisma.acceleratorEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { paymentStatus: 'REFUNDED', status: 'DROPPED' },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_fee' },
      data: { status: 'REFUNDED' },
    });
  });

  it('keeps a completed place completed when its fee goes back', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace({ status: 'COMPLETED' }));

    await refundAcceleratorEnrollmentPayment('e1', 'Goodwill');

    expect(prisma.acceleratorEnrollment.update.mock.calls[0][0].data).toEqual({ paymentStatus: 'REFUNDED' });
  });

  it('repairs the rows when Stripe says the charge was already refunded', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace());
    stripe.refunds.create.mockRejectedValueOnce(
      Object.assign(new Error('Charge has already been refunded'), { code: 'charge_already_refunded' })
    );

    const result = await refundAcceleratorEnrollmentPayment('e1', 'Retry');

    expect(result.status).toBe('already_refunded');
    expect(prisma.acceleratorEnrollment.update).toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalled();
  });

  it('records nothing when Stripe refuses the refund', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace());
    stripe.refunds.create.mockRejectedValueOnce(new Error('card network unavailable'));

    const result = await refundAcceleratorEnrollmentPayment('e1', 'Cohort cancelled');

    expect(result.status).toBe('unavailable');
    expect(prisma.acceleratorEnrollment.update).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('refunds nothing for a place never paid for, or paid for with no card', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace({ paymentStatus: 'PENDING' }));
    expect((await refundAcceleratorEnrollmentPayment('e1', 'x')).status).toBe('nothing_to_refund');

    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace({ paymentId: null }));
    expect((await refundAcceleratorEnrollmentPayment('e1', 'x')).status).toBe('nothing_to_refund');

    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it('does not refund twice', async () => {
    prisma.acceleratorEnrollment.findUnique.mockResolvedValue(paidPlace({ paymentStatus: 'REFUNDED' }));
    expect((await refundAcceleratorEnrollmentPayment('e1', 'x')).status).toBe('already_refunded');
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});

describe('cancelUnpaidAcceleratorIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stripeConfigured = true;
  });

  it('cancels a checkout she never finished, so it cannot charge her later', async () => {
    await expect(cancelUnpaidAcceleratorIntent('pi_open')).resolves.toBe('clear');
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_open', { cancellation_reason: 'abandoned' });
  });

  it('keeps the place when the payment is already going through', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ status: 'processing' });
    await expect(cancelUnpaidAcceleratorIntent('pi_paying')).resolves.toBe('in_flight');
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('believes Stripe over the race when a cancel fails', async () => {
    stripe.paymentIntents.cancel.mockRejectedValueOnce(new Error('intent has succeeded'));
    stripe.paymentIntents.retrieve
      .mockResolvedValueOnce({ status: 'requires_payment_method' })
      .mockResolvedValueOnce({ status: 'succeeded' });
    await expect(cancelUnpaidAcceleratorIntent('pi_race')).resolves.toBe('in_flight');
  });

  it('has nothing to cancel for a place with no intent', async () => {
    await expect(cancelUnpaidAcceleratorIntent(null)).resolves.toBe('clear');
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
});
