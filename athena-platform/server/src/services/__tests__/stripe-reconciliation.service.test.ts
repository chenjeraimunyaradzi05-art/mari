/**
 * The comparison of ATHENA's money rows against Stripe's, which did not exist.
 *
 * Each case below is a disagreement that used to be found, if at all, by the
 * member it happened to: a hold Stripe took with no row, a capture made in the
 * Stripe dashboard that left the seller's screen saying "pending", a payment
 * received with no Payment row and so no invoice, a creator payout that never
 * learned its transfer, a membership Stripe cancelled that ATHENA still honours.
 * What is covered is the line between the two outcomes: a row that is merely
 * behind is moved as the webhook would have moved it, and anything that is a
 * decision is reported and left alone.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    escrowPayment: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 1 })) },
    payment: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 1 })) },
    invoice: { findMany: jest.fn(async () => []) },
    creatorPayout: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 1 })) },
    subscription: { findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []) },
    notification: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({})) },
    paymentDispute: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const stripe = {
  paymentIntents: { list: jest.fn() },
  transfers: { list: jest.fn(), retrieve: jest.fn() },
  subscriptions: { list: jest.fn() },
  disputes: { list: jest.fn() },
};

jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: jest.fn(() => true),
  getStripe: () => stripe,
}));

jest.mock('../../utils/redis', () => ({
  runExclusively: jest.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => true),
}));

jest.mock('../../utils/ops-metrics', () => ({
  recordCondition: jest.fn(),
  recordFailure: jest.fn(),
  recordSuccess: jest.fn(),
}));

jest.mock('../formation.service', () => ({ FORMATION_PAYMENT_TYPE: 'business_formation' }));
jest.mock('../payments-orchestration.service', () => ({ ACCELERATOR_PAYMENT_TYPE: 'accelerator_enrollment' }));
jest.mock('../invoice.service', () => ({
  createInvoiceForPayment: jest.fn(async () => ({ invoiceNumber: 'ATH-2026-0001' })),
}));
jest.mock('../creator.service', () => ({ settleCreatorPayout: jest.fn(async () => true) }));
jest.mock('../stripe-connect.service', () => ({ minorUnitScale: () => 100 }));

import { prisma as prismaTyped } from '../../utils/prisma';
import { isStripeConfigured } from '../../utils/stripe';
import { recordCondition } from '../../utils/ops-metrics';
import { createInvoiceForPayment } from '../invoice.service';
import { settleCreatorPayout } from '../creator.service';
import {
  getLastReconciliationReport,
  reconcileAndRecord,
  runStripeReconciliation,
} from '../stripe-reconciliation.service';

const prisma: any = prismaTyped;
const NOW = new Date('2026-09-20T00:00:00.000Z');

const onePage = <T>(data: T[]) => ({ data, has_more: false });

const escrowIntent = (overrides: Record<string, unknown> = {}) => ({
  id: 'pi_1',
  status: 'requires_capture',
  amount: 25000,
  amount_received: 0,
  currency: 'aud',
  created: Math.floor(NOW.getTime() / 1000) - 3 * 24 * 60 * 60,
  metadata: { buyerId: 'buyer-1', sellerId: 'seller-1', sessionType: 'service_order' },
  latest_charge: null,
  canceled_at: null,
  cancellation_reason: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks keeps whatever a previous test told a mock to return, so
  // every answer a test may change is put back to "nothing here" first.
  (isStripeConfigured as jest.Mock).mockReturnValue(true);
  stripe.paymentIntents.list.mockResolvedValue(onePage([]));
  stripe.transfers.list.mockResolvedValue(onePage([]));
  stripe.subscriptions.list.mockResolvedValue(onePage([]));
  stripe.disputes.list.mockResolvedValue(onePage([]));
  prisma.paymentDispute.findMany.mockResolvedValue([]);
  prisma.escrowPayment.findMany.mockResolvedValue([]);
  prisma.escrowPayment.updateMany.mockResolvedValue({ count: 1 });
  prisma.payment.findMany.mockResolvedValue([]);
  prisma.payment.updateMany.mockResolvedValue({ count: 1 });
  prisma.invoice.findMany.mockResolvedValue([]);
  prisma.creatorPayout.findMany.mockResolvedValue([]);
  prisma.creatorPayout.updateMany.mockResolvedValue({ count: 1 });
  prisma.subscription.findMany.mockResolvedValue([]);
  prisma.user.findMany.mockResolvedValue([]);
  prisma.notification.findFirst.mockResolvedValue(null);
});

const needing = (report: Awaited<ReturnType<typeof runStripeReconciliation>>) =>
  report.findings.filter(f => f.outcome === 'needs_attention');

describe('Escrow holds', () => {
  it('reports money Stripe holds for a hold ATHENA has no row for, and changes nothing', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent()]));

    const report = await runStripeReconciliation(NOW);

    expect(report.needsAttention).toBe(1);
    expect(needing(report)[0]).toMatchObject({ kind: 'ESCROW_ROW_MISSING', stripeId: 'pi_1', localId: null });
    expect(needing(report)[0].detail).toContain('250.00 AUD');
    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });

  it('does not report an unpaid intent with no row, which holds nothing', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent({ status: 'requires_payment_method' })]));

    const report = await runStripeReconciliation(NOW);

    expect(report.findings).toHaveLength(0);
  });

  it('moves a row that is only behind Stripe, conditionally on the status it read', async () => {
    // Captured in the Stripe dashboard: the seller has the money and her
    // earnings screen said it was still pending.
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent({ status: 'succeeded', latest_charge: { refunded: false } })]));
    prisma.escrowPayment.findMany.mockResolvedValue([
      { id: 'escrow-1', paymentIntentId: 'pi_1', status: 'AUTHORIZED', capturedAt: null },
    ]);

    const report = await runStripeReconciliation(NOW);

    expect(report.repaired).toBe(1);
    expect(report.needsAttention).toBe(0);
    const [args] = prisma.escrowPayment.updateMany.mock.calls[0];
    expect(args.where).toEqual({ id: 'escrow-1', status: 'AUTHORIZED' });
    expect(args.data.status).toBe('CAPTURED');
  });

  it('treats a declined card that later authorised as behind, not wrong', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent()]));
    prisma.escrowPayment.findMany.mockResolvedValue([
      { id: 'escrow-1', paymentIntentId: 'pi_1', status: 'FAILED', capturedAt: null },
    ]);

    const report = await runStripeReconciliation(NOW);

    expect(report.repaired).toBe(1);
    expect(prisma.escrowPayment.updateMany.mock.calls[0][0].data).toEqual({ status: 'AUTHORIZED' });
  });

  it('reports a row that says the money went back when Stripe says the seller has it', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent({ status: 'succeeded', latest_charge: { refunded: false } })]));
    prisma.escrowPayment.findMany.mockResolvedValue([
      { id: 'escrow-1', paymentIntentId: 'pi_1', status: 'REFUNDED', capturedAt: null },
    ]);

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'ESCROW_STATUS_CONFLICT', localId: 'escrow-1' });
    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });
});

describe('Payments and their invoices', () => {
  const paidIntent = (overrides: Record<string, unknown> = {}) => ({
    id: 'pi_pay',
    status: 'succeeded',
    amount: 4900,
    amount_received: 4900,
    currency: 'aud',
    created: Math.floor(NOW.getTime() / 1000) - 2 * 24 * 60 * 60,
    metadata: { type: 'business_formation', userId: 'member-1' },
    latest_charge: { refunded: false },
    ...overrides,
  });

  it('reports a payment Stripe took with no Payment row, rather than inventing one', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([paidIntent()]));

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'PAYMENT_ROW_MISSING', stripeId: 'pi_pay' });
    expect(needing(report)[0].detail).toMatch(/Resend the payment_intent.succeeded event/);
  });

  it('marks a Payment refunded when Stripe refunded the charge', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([paidIntent({ latest_charge: { refunded: true } })]));
    prisma.payment.findMany.mockResolvedValue([{ id: 'payment-1', stripePaymentIntentId: 'pi_pay', status: 'COMPLETED' }]);

    const report = await runStripeReconciliation(NOW);

    expect(report.repaired).toBe(1);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'COMPLETED' },
      data: { status: 'REFUNDED' },
    });
  });

  it('files the invoice a completed payment never got', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([paidIntent()]));
    prisma.payment.findMany.mockResolvedValue([{ id: 'payment-1', stripePaymentIntentId: 'pi_pay', status: 'COMPLETED' }]);
    prisma.invoice.findMany.mockResolvedValue([]);

    const report = await runStripeReconciliation(NOW);

    expect(createInvoiceForPayment).toHaveBeenCalledWith('payment-1');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'INVOICE_MISSING', outcome: 'repaired' }));
  });

  it('leaves a payment that already has its invoice alone', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([paidIntent()]));
    prisma.payment.findMany.mockResolvedValue([{ id: 'payment-1', stripePaymentIntentId: 'pi_pay', status: 'COMPLETED' }]);
    prisma.invoice.findMany.mockResolvedValue([{ paymentId: 'payment-1' }]);

    const report = await runStripeReconciliation(NOW);

    expect(createInvoiceForPayment).not.toHaveBeenCalled();
    expect(report.findings).toHaveLength(0);
  });
});

describe('Creator payouts', () => {
  it('settles a payout whose transfer exists, exactly as the webhook would', async () => {
    prisma.creatorPayout.findMany.mockResolvedValue([
      { id: 'payout-1', stripeTransferId: 'tr_1', createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000), amount: 120 },
    ]);
    stripe.transfers.retrieve.mockResolvedValue({ id: 'tr_1', reversed: false, created: 1789900000 });

    const report = await runStripeReconciliation(NOW);

    expect(settleCreatorPayout).toHaveBeenCalledWith('tr_1', new Date(1789900000 * 1000));
    expect(report.repaired).toBe(1);
  });

  it('links a payout that never learned its transfer, by the payoutId the transfer carries', async () => {
    prisma.creatorPayout.findMany.mockResolvedValue([
      { id: 'payout-2', stripeTransferId: null, createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000), amount: 80 },
    ]);
    stripe.transfers.list.mockResolvedValue(
      onePage([{ id: 'tr_2', reversed: false, created: 1789900000, metadata: { type: 'creator_payout', payoutId: 'payout-2' } }])
    );

    const report = await runStripeReconciliation(NOW);

    expect(prisma.creatorPayout.updateMany).toHaveBeenCalledWith({
      where: { id: 'payout-2', stripeTransferId: null },
      data: { stripeTransferId: 'tr_2' },
    });
    expect(settleCreatorPayout).toHaveBeenCalledWith('tr_2', expect.any(Date));
    expect(report.repaired).toBe(1);
  });

  it('reports a day-old payout Stripe has no transfer for: her points were taken and nothing was sent', async () => {
    prisma.creatorPayout.findMany.mockResolvedValue([
      { id: 'payout-3', stripeTransferId: null, createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000), amount: 55 },
    ]);

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'CREATOR_PAYOUT_NO_TRANSFER', localId: 'payout-3' });
  });

  it('does not call a payout transferless when the transfer list was too long to read to the end', async () => {
    prisma.creatorPayout.findMany.mockResolvedValue([
      { id: 'payout-3', stripeTransferId: null, createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000), amount: 55 },
    ]);
    stripe.transfers.list.mockResolvedValue({ data: [{ id: 'tr_other', metadata: {} }], has_more: true });

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)).toHaveLength(0);
    expect(report.incomplete).toContainEqual(expect.stringMatching(/transfer list/));
  });
});

describe('Memberships', () => {
  it('reports a membership ATHENA honours that Stripe has cancelled, and does not change it', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-row-1', userId: 'member-1', status: 'ACTIVE', stripeSubscriptionId: 'sub_1' },
    ]);
    stripe.subscriptions.list.mockResolvedValue(onePage([{ id: 'sub_1', status: 'canceled' }]));

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'SUBSCRIPTION_STATUS_CONFLICT', localId: 'sub-row-1' });
  });

  it('is quiet when the two agree', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-row-1', userId: 'member-1', status: 'PAST_DUE', stripeSubscriptionId: 'sub_1' },
    ]);
    stripe.subscriptions.list.mockResolvedValue(onePage([{ id: 'sub_1', status: 'past_due' }]));

    const report = await runStripeReconciliation(NOW);

    expect(report.findings).toHaveLength(0);
  });
});

describe('How much of a sale has gone back', () => {
  // A part refund leaves the hold CAPTURED and records the figure beside it. A
  // row whose figure is behind Stripe's missed the charge.refunded event.
  const capturedIntent = (amountRefunded: number | undefined) =>
    escrowIntent({
      status: 'succeeded',
      latest_charge: { refunded: false, ...(amountRefunded === undefined ? {} : { amount_refunded: amountRefunded }) },
    });
  const capturedRow = (refundedAmount: number) => ({
    id: 'escrow-1',
    paymentIntentId: 'pi_1',
    status: 'CAPTURED',
    capturedAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    refundedAmount,
  });

  it('brings a hold that missed a part refund up to what Stripe says, and says so', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([capturedIntent(1000)]));
    prisma.escrowPayment.findMany.mockResolvedValue([capturedRow(0)]);

    const report = await runStripeReconciliation(NOW);

    // Conditional on the figure it read, so a webhook landing at the same moment is not overwritten.
    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'escrow-1', refundedAmount: { lt: 1000 } },
      data: { refundedAmount: 1000 },
    });
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'REFUND_AMOUNT_CONFLICT', outcome: 'repaired', localId: 'escrow-1' }));
    expect(report.findings[0].detail).toContain('10.00 AUD');
  });

  it('is quiet when the two agree, and when Stripe gave no figure', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([capturedIntent(1000)]));
    prisma.escrowPayment.findMany.mockResolvedValue([capturedRow(1000)]);
    expect((await runStripeReconciliation(NOW)).findings).toHaveLength(0);

    stripe.paymentIntents.list.mockResolvedValue(onePage([capturedIntent(undefined)]));
    prisma.escrowPayment.findMany.mockResolvedValue([capturedRow(1000)]);
    expect((await runStripeReconciliation(NOW)).findings).toHaveLength(0);
    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });

  it('reports, and does not lower, a row that claims more came back than Stripe knows of', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([capturedIntent(500)]));
    prisma.escrowPayment.findMany.mockResolvedValue([capturedRow(2500)]);

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'REFUND_AMOUNT_CONFLICT', localId: 'escrow-1' });
    expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
  });

  it('writes the refunded figure with the status when a full refund is the repair, so it is not reported next run', async () => {
    stripe.paymentIntents.list.mockResolvedValue(
      onePage([escrowIntent({ status: 'succeeded', latest_charge: { refunded: true, amount_refunded: 25000 } })])
    );
    prisma.escrowPayment.findMany.mockResolvedValue([capturedRow(0)]);

    await runStripeReconciliation(NOW);

    const [args] = prisma.escrowPayment.updateMany.mock.calls.at(-1);
    expect(args.data).toMatchObject({ status: 'REFUNDED', refundedAmount: 25000 });
  });

  it('reports a Payment row behind a part refund and leaves it for the refund event to repair', async () => {
    // A refund also takes back gift points and credits the invoice; only the
    // webhook for the refund does those, so the cure is to resend it.
    stripe.paymentIntents.list.mockResolvedValue(
      onePage([
        {
          id: 'pi_pay',
          status: 'succeeded',
          amount: 4900,
          amount_received: 4900,
          currency: 'aud',
          created: Math.floor(NOW.getTime() / 1000) - 2 * 24 * 60 * 60,
          metadata: { type: 'business_formation', userId: 'member-1' },
          latest_charge: { refunded: false, amount_refunded: 1000 },
        },
      ])
    );
    prisma.payment.findMany.mockResolvedValue([{ id: 'payment-1', stripePaymentIntentId: 'pi_pay', status: 'COMPLETED', refundedAmount: '0' }]);
    prisma.invoice.findMany.mockResolvedValue([{ paymentId: 'payment-1' }]);

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'REFUND_AMOUNT_CONFLICT', localId: 'payment-1' });
    expect(needing(report)[0].detail).toMatch(/Resend the charge.refunded event/);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });
});

describe('Card disputes', () => {
  const longAgo = Math.floor(NOW.getTime() / 1000) - 5 * 24 * 60 * 60;
  const dispute = (over: Record<string, unknown> = {}) => ({
    id: 'dp_1',
    amount: 12000,
    currency: 'aud',
    reason: 'fraudulent',
    status: 'needs_response',
    created: longAgo,
    ...over,
  });

  it('reports a dispute Stripe has that ATHENA never heard of, because its evidence deadline is running', async () => {
    stripe.disputes.list.mockResolvedValue(onePage([dispute()]));

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'DISPUTE_MISSING', stripeId: 'dp_1', localId: null });
    expect(needing(report)[0].detail).toContain('120.00 AUD');
    expect(needing(report)[0].detail).toMatch(/Resend the charge.dispute.created event/);
    expect(report.checked.disputes).toBe(1);
  });

  it('reads Stripe far enough back to catch a dispute that opened weeks ago', async () => {
    await runStripeReconciliation(NOW);

    const [args] = stripe.disputes.list.mock.calls[0];
    // Ninety days: a dispute is decided long after the charge it is about.
    expect(args.created.gte).toBe(Math.floor((NOW.getTime() - 90 * 24 * 60 * 60 * 1000) / 1000));
  });

  it('does not call a dispute that opened a moment ago missing: its webhook may be on the way', async () => {
    stripe.disputes.list.mockResolvedValue(onePage([dispute({ created: Math.floor(NOW.getTime() / 1000) - 60 })]));

    const report = await runStripeReconciliation(NOW);

    expect(report.findings).toHaveLength(0);
  });

  it('reports a dispute ATHENA still has open that Stripe has decided', async () => {
    stripe.disputes.list.mockResolvedValue(onePage([dispute({ status: 'lost' })]));
    prisma.paymentDispute.findMany.mockResolvedValue([{ id: 'pd-1', stripeDisputeId: 'dp_1', outcome: 'OPEN' }]);

    const report = await runStripeReconciliation(NOW);

    expect(needing(report)[0]).toMatchObject({ kind: 'DISPUTE_STATUS_CONFLICT', localId: 'pd-1' });
    expect(needing(report)[0].detail).toMatch(/Resend the charge.dispute.closed event/);
  });

  it('is quiet when the two agree, and when a decided dispute is reported with a status that has moved on', async () => {
    stripe.disputes.list.mockResolvedValue(onePage([dispute({ status: 'under_review' }), dispute({ id: 'dp_2', status: 'won' })]));
    prisma.paymentDispute.findMany.mockResolvedValue([
      { id: 'pd-1', stripeDisputeId: 'dp_1', outcome: 'OPEN' },
      { id: 'pd-2', stripeDisputeId: 'dp_2', outcome: 'WON' },
    ]);

    const report = await runStripeReconciliation(NOW);

    expect(report.findings).toHaveLength(0);
    expect(report.checked.disputes).toBe(2);
  });

  it('says it could not read the disputes, and still reconciles everything else', async () => {
    // A key that may not read disputes must not take the rest of the run down.
    stripe.disputes.list.mockRejectedValue(new Error('This API key does not have the required permissions'));
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent()]));

    const report = await runStripeReconciliation(NOW);

    expect(report.incomplete).toContainEqual(expect.stringMatching(/disputes: Stripe would not list them/));
    expect(needing(report)[0]).toMatchObject({ kind: 'ESCROW_ROW_MISSING' });
  });
});

describe('Reporting', () => {
  it('says it was skipped, and compares nothing, without a Stripe key', async () => {
    (isStripeConfigured as jest.Mock).mockReturnValue(false);

    const report = await runStripeReconciliation(NOW);

    expect(report.skipped).toMatch(/not configured/);
    expect(stripe.paymentIntents.list).not.toHaveBeenCalled();
  });

  it('puts the count needing a person on the health gauge, tells the admins, and keeps the report', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent()]));
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    const report = await reconcileAndRecord(NOW);

    expect(recordCondition).toHaveBeenCalledWith('stripe_reconciliation.needs_attention', 1, expect.any(String));
    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: 'admin-1', title: 'Payment records disagree with Stripe' });
    expect(notice.data.findings).toEqual([{ kind: 'ESCROW_ROW_MISSING', stripeId: 'pi_1', localId: null }]);
    expect(await getLastReconciliationReport()).toEqual(report);
  });

  it('does not tell the admins again the same day', async () => {
    stripe.paymentIntents.list.mockResolvedValue(onePage([escrowIntent()]));
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'earlier' });

    await reconcileAndRecord(NOW);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('clears the gauge when everything agrees', async () => {
    await reconcileAndRecord(NOW);

    expect(recordCondition).toHaveBeenCalledWith('stripe_reconciliation.needs_attention', 0, null);
  });
});
