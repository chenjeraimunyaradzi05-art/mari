/**
 * Card disputes and refunds, and what they do to the people behind the payment.
 *
 * A dispute used to be a log line and one email: never stored, never frozen, never
 * closed out, and when ATHENA lost one the member kept what the payment had bought. A
 * refund of any size marked the whole sale refunded and left the tier, the gift
 * points and the tax invoice as the sale had made them. What is covered here is
 * each of those, and the property that makes them safe to ship: every step can run
 * twice, in any order, because Stripe delivers events at least once and in no
 * promised order.
 */

jest.mock('../../utils/prisma', () => {
  // An in-memory PaymentDispute table, so the tests can watch one row move
  // through several events the way the real one does.
  const rows = new Map<string, any>();
  let next = 1;

  const matches = (row: any, where: any = {}): boolean => {
    if (where.id && typeof where.id === 'object' && where.id.not !== undefined && row.id === where.id.not) return false;
    if (typeof where.id === 'string' && row.id !== where.id) return false;
    if (where.holdsReleasedAt === null && row.holdsReleasedAt !== null) return false;
    if (where.heldCreatorProfileIds?.hasSome && !where.heldCreatorProfileIds.hasSome.some((x: string) => row.heldCreatorProfileIds.includes(x))) {
      return false;
    }
    if (typeof where.outcome === 'string' && row.outcome !== where.outcome) return false;
    if (where.outcome?.in && !where.outcome.in.includes(row.outcome)) return false;
    return true;
  };

  return {
    prisma: {
      __rows: rows,
      paymentDispute: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.stripeDisputeId) return [...rows.values()].find((r) => r.stripeDisputeId === where.stripeDisputeId) ?? null;
          return rows.get(where.id) ?? null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `pd-${next++}`,
            kind: null,
            userId: null,
            paymentId: null,
            escrowPaymentId: null,
            effectsAppliedAt: null,
            effects: null,
            heldCreatorProfileIds: [],
            holdsReleasedAt: null,
            closedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          rows.set(row.id, row);
          return { ...row };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = rows.get(where.id);
          Object.assign(row, data);
          return { ...row };
        }),
        findMany: jest.fn(async ({ where, take, cursor }: any = {}) => {
          const found = [...rows.values()]
            .filter((r) => matches(r, where))
            .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
          const from = cursor ? found.findIndex((r) => r.id === cursor.id) + 1 : 0;
          return found.slice(from, take ? from + take : undefined).map((r) => ({ ...r }));
        }),
      },
      escrowPayment: { findUnique: jest.fn(async () => null) },
      payment: { findUnique: jest.fn(async () => null) },
      subscription: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), update: jest.fn(async () => ({})) },
      giftBalancePurchase: { findUnique: jest.fn(async () => null) },
      giftTransaction: { findMany: jest.fn(async () => []) },
      creatorProfile: { findMany: jest.fn(async () => []) },
      user: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const stripe = {
  charges: { retrieve: jest.fn() },
  invoices: { retrieve: jest.fn() },
  subscriptions: { cancel: jest.fn(async () => ({})) },
};
jest.mock('../../utils/stripe', () => ({ getStripe: () => stripe, isStripeConfigured: () => true }));

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));
jest.mock('../admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));
jest.mock('../content-report.service', () => ({ trustAndSafetyMailbox: jest.fn(() => 'safety@example.com') }));
jest.mock('../stripe-connect.service', () => ({
  minorUnitScale: (currency: string) => (['JPY', 'KRW'].includes(String(currency).toUpperCase()) ? 1 : 100),
}));
jest.mock('../creator.service', () => ({
  reverseGiftPurchase: jest.fn(async () => null),
  holdCreatorPayouts: jest.fn(async (ids: string[]) => ids.length),
  releaseCreatorPayouts: jest.fn(async (ids: string[]) => ids.length),
}));
jest.mock('../invoice.service', () => ({
  creditInvoiceForPayment: jest.fn(async () => ({ invoiceId: 'inv-1', invoiceNumber: 'INV-202610-00001', credited: 29, cancelled: true, changed: true })),
  creditSubscriptionInvoice: jest.fn(async () => ({ invoiceId: 'inv-2', invoiceNumber: 'INV-202610-00002', credited: 29, cancelled: true, changed: true })),
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { recordFailure } from '../../utils/ops-metrics';
import { notifyAdmins } from '../admin-notify.service';
import { trustAndSafetyMailbox } from '../content-report.service';
import { holdCreatorPayouts, releaseCreatorPayouts, reverseGiftPurchase } from '../creator.service';
import { creditInvoiceForPayment, creditSubscriptionInvoice } from '../invoice.service';
import {
  applyRefundEffects,
  listDisputesForAdmin,
  outcomeOf,
  recordDisputeEvent,
  releaseDisputeHolds,
} from '../payment-disputes.service';

const prisma: any = prismaTyped;

const OPENED = 1_760_000_000;

const dispute = (over: Record<string, unknown> = {}) => ({
  id: 'dp_1',
  charge: 'ch_1',
  payment_intent: 'pi_1',
  amount: 2900,
  currency: 'aud',
  reason: 'fraudulent',
  status: 'needs_response',
  created: OPENED,
  evidence_details: { due_by: OPENED + 14 * 86400 },
  ...over,
});

let eventNo = 0;
const event = (type: string, object: Record<string, unknown> = dispute(), created = OPENED + eventNo) =>
  ({ id: `evt_${++eventNo}`, type, created, data: { object } }) as any;

const rows = () => [...prisma.__rows.values()];

beforeEach(() => {
  jest.clearAllMocks();
  prisma.__rows.clear();
  eventNo = 0;
  prisma.escrowPayment.findUnique.mockResolvedValue(null);
  prisma.payment.findUnique.mockResolvedValue(null);
  prisma.subscription.findFirst.mockResolvedValue(null);
  prisma.subscription.findUnique.mockResolvedValue(null);
  prisma.giftBalancePurchase.findUnique.mockResolvedValue(null);
  prisma.giftTransaction.findMany.mockResolvedValue([]);
  prisma.creatorProfile.findMany.mockResolvedValue([]);
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.findMany.mockResolvedValue([]);
  (reverseGiftPurchase as jest.Mock).mockResolvedValue(null);
  (trustAndSafetyMailbox as jest.Mock).mockReturnValue('safety@example.com');
  stripe.charges.retrieve.mockReset();
  stripe.invoices.retrieve.mockReset();
  stripe.subscriptions.cancel.mockResolvedValue({});
});

describe('The outcome Stripe’s status stands for', () => {
  it('is open until Stripe decides, then won, lost or closed', () => {
    for (const status of ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review']) {
      expect(outcomeOf(status)).toBe('OPEN');
    }
    expect(outcomeOf('won')).toBe('WON');
    expect(outcomeOf('lost')).toBe('LOST');
    // An early warning that was withdrawn, or a charge refunded before it became a chargeback.
    expect(outcomeOf('warning_closed')).toBe('CLOSED');
    expect(outcomeOf('charge_refunded')).toBe('CLOSED');
  });
});

describe('Recording a dispute', () => {
  it('writes one row with Stripe’s own figures, tells the admins in the app, and emails the mailbox', async () => {
    const result = await recordDisputeEvent(event('charge.dispute.created'));

    expect(result).toMatchObject({ created: true, outcome: 'OPEN', settled: false });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({
      stripeDisputeId: 'dp_1',
      paymentIntentId: 'pi_1',
      chargeId: 'ch_1',
      amount: 2900,
      currency: 'AUD',
      reason: 'fraudulent',
      status: 'needs_response',
      outcome: 'OPEN',
      fundsWithdrawn: false,
    });
    expect(rows()[0].evidenceDueBy).toEqual(new Date((OPENED + 14 * 86400) * 1000));

    const notice = (notifyAdmins as jest.Mock).mock.calls[0][0] as any;
    expect(notice.title).toBe('A card payment has been disputed');
    expect(notice.link).toBe('/admin/disputes');
    expect(notice.message).toContain('29.00 AUD');

    const mail = (sendEmail as jest.Mock).mock.calls[0][0] as any;
    expect(mail.to).toBe('safety@example.com');
    expect(mail.text).toContain('29.00 AUD');
  });

  it('lands later events for the same dispute on the same row, and does not announce it again', async () => {
    await recordDisputeEvent(event('charge.dispute.created'));
    (notifyAdmins as jest.Mock).mockClear();

    const again = await recordDisputeEvent(event('charge.dispute.updated', dispute({ reason: 'product_not_received' })));

    expect(again.created).toBe(false);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].reason).toBe('product_not_received');
    expect(notifyAdmins).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('still tells the admins, once, when an update is the first event to reach ATHENA for a dispute that is open', async () => {
    const first = await recordDisputeEvent(event('charge.dispute.updated', dispute({ status: 'under_review' })));

    expect(first).toMatchObject({ created: true, outcome: 'OPEN' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect((notifyAdmins as jest.Mock).mock.calls[0][0]).toMatchObject({ link: '/admin/disputes' });

    // The rest of its events land on the row it made, and say nothing more.
    await recordDisputeEvent(event('charge.dispute.funds_withdrawn', dispute({ status: 'under_review' })));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('carries on with the row another event wrote between its read and its insert', async () => {
    const duplicate: any = new Error('Unique constraint failed');
    duplicate.code = 'P2002';
    // The first read finds nothing, the insert is refused, the second read finds the other event's row.
    const row = { id: 'pd-x', stripeDisputeId: 'dp_1', outcome: 'OPEN', status: 'needs_response', heldCreatorProfileIds: [], holdsReleasedAt: null, effectsAppliedAt: null, kind: null, effects: null, fundsWithdrawn: false, closedAt: null, evidenceDueBy: null, openedAt: new Date() };
    prisma.__rows.set('pd-x', row);
    prisma.paymentDispute.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    prisma.paymentDispute.create.mockRejectedValueOnce(duplicate);

    const result = await recordDisputeEvent(event('charge.dispute.funds_withdrawn'));

    expect(result.created).toBe(false);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].fundsWithdrawn).toBe(true);
  });

  it('follows the money out of ATHENA’s balance and back, and nothing else moves it', async () => {
    await recordDisputeEvent(event('charge.dispute.created'));
    expect(rows()[0].fundsWithdrawn).toBe(false);

    await recordDisputeEvent(event('charge.dispute.funds_withdrawn'));
    expect(rows()[0].fundsWithdrawn).toBe(true);

    await recordDisputeEvent(event('charge.dispute.updated', dispute({ status: 'under_review' })));
    expect(rows()[0].fundsWithdrawn).toBe(true);

    await recordDisputeEvent(event('charge.dispute.funds_reinstated', dispute({ status: 'won' })));
    expect(rows()[0].fundsWithdrawn).toBe(false);
  });

  it('keeps a decided dispute decided when an older update arrives after the decision', async () => {
    await recordDisputeEvent(event('charge.dispute.created'));
    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));
    const closedAt = rows()[0].closedAt;

    const late = await recordDisputeEvent(event('charge.dispute.updated', dispute({ status: 'needs_response' })));

    expect(late.outcome).toBe('LOST');
    expect(rows()[0]).toMatchObject({ outcome: 'LOST', status: 'lost' });
    expect(rows()[0].closedAt).toEqual(closedAt);
  });

  it('records a decision that arrives before the dispute’s own opening event', async () => {
    const result = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'won' })));

    expect(result).toMatchObject({ created: true, outcome: 'WON', settled: true });
    expect(rows()[0].closedAt).toBeInstanceOf(Date);
  });

  it('sends nothing to a mailbox ATHENA does not have, and still records and announces the dispute', async () => {
    (trustAndSafetyMailbox as jest.Mock).mockReturnValue(null);

    await recordDisputeEvent(event('charge.dispute.created'));

    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith('stripe.dispute-alert', expect.any(Error));
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(1);
  });

  it('puts an alert the mail provider refused on the operations screen, and still records and announces the dispute', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce(false);

    await recordDisputeEvent(event('charge.dispute.created'));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(recordFailure).toHaveBeenCalledWith(
      'stripe.dispute-alert',
      expect.objectContaining({ message: expect.stringContaining('dp_1') })
    );
    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(1);
  });

  it('records no failure when the alert was delivered', async () => {
    await recordDisputeEvent(event('charge.dispute.created'));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('writes a yen dispute in whole yen and Stripe’s strings into the mail as text', async () => {
    await recordDisputeEvent(event('charge.dispute.created', dispute({ currency: 'jpy', amount: 15000, reason: '<img src=x onerror=alert(1)>' })));

    const mail = (sendEmail as jest.Mock).mock.calls[0][0] as any;
    expect(mail.text).toContain('15000 JPY');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).not.toMatch(/<img\b/);
  });
});

describe('Finding out what was disputed', () => {
  it('matches a gift top-up, a marketplace hold and a mentoring session to their own rows', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'member-1', type: 'GIFT_BALANCE' });
    await recordDisputeEvent(event('charge.dispute.created'));
    expect(rows()[0]).toMatchObject({ kind: 'GIFT_BALANCE', userId: 'member-1', paymentId: 'pay-1', escrowPaymentId: null });

    prisma.__rows.clear();
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', buyerId: 'buyer-1' });
    await recordDisputeEvent(event('charge.dispute.created', dispute({ id: 'dp_2', payment_intent: 'pi_2' })));
    expect(rows()[0]).toMatchObject({ kind: 'ESCROW', userId: 'buyer-1', escrowPaymentId: 'esc-1' });

    prisma.__rows.clear();
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-3', userId: 'mentee-1', type: 'MENTOR_SESSION' });
    await recordDisputeEvent(event('charge.dispute.created', dispute({ id: 'dp_3', payment_intent: 'pi_3' })));
    // The Payment row names it more exactly than the hold does.
    expect(rows()[0]).toMatchObject({ kind: 'MENTOR_SESSION', paymentId: 'pay-3', escrowPaymentId: 'esc-1' });
  });

  it('finds a membership through the Stripe invoice behind the charge', async () => {
    stripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', invoice: 'in_1' });
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', subscription: 'sub_s1', customer: 'cus_1', created: OPENED - 100, status_transitions: { paid_at: OPENED - 50 } });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'member-1', stripeSubscriptionId: 'sub_s1' });

    await recordDisputeEvent(event('charge.dispute.created'));

    expect(rows()[0]).toMatchObject({ kind: 'SUBSCRIPTION', userId: 'member-1' });
    expect(rows()[0].effects).toEqual({ subscriptionId: 'sub-1' });
  });

  it('records the dispute anyway when Stripe cannot be asked, and asks again on the next event', async () => {
    stripe.charges.retrieve.mockRejectedValueOnce(new Error('Stripe is down'));

    await recordDisputeEvent(event('charge.dispute.created'));
    expect(rows()[0].kind).toBeNull();

    stripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', invoice: 'in_1' });
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', subscription: 'sub_s1', customer: 'cus_1', created: OPENED, status_transitions: { paid_at: OPENED } });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'member-1', stripeSubscriptionId: 'sub_s1' });
    await recordDisputeEvent(event('charge.dispute.updated'));

    expect(rows()[0].kind).toBe('SUBSCRIPTION');
  });

  it('says so, and moves nothing, for a charge it cannot match', async () => {
    stripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', invoice: null });

    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(rows()[0].kind).toBeNull();
    expect(lost.applied.join(' ')).toMatch(/could not match/);
    expect(reverseGiftPurchase).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

describe('A lost dispute on gift points', () => {
  beforeEach(() => {
    prisma.payment.findUnique.mockImplementation(async ({ where }: any) =>
      where.id ? { refundedAmount: '0' } : { id: 'pay-1', userId: 'member-1', type: 'GIFT_BALANCE' }
    );
  });

  it('takes the points back, credits the invoice, and pauses the creators the points had already been spent on', async () => {
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({
      userId: 'member-1',
      purchasedAt: new Date('2026-09-20T00:00:00Z'),
      tookBackPoints: 200,
      shortfallPoints: 300,
      alreadyApplied: false,
    });
    prisma.giftTransaction.findMany.mockResolvedValue([{ receiverId: 'creator-user-1' }, { receiverId: 'creator-user-2' }]);
    prisma.creatorProfile.findMany.mockResolvedValue([{ id: 'cp-1' }, { id: 'cp-2' }]);

    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    // The whole disputed amount, in cents, as the cumulative figure.
    expect(reverseGiftPurchase).toHaveBeenCalledWith('pi_1', 2900);
    expect(holdCreatorPayouts).toHaveBeenCalledWith(['cp-1', 'cp-2'], expect.stringContaining('dp_1'));
    // Only the creators this member gifted to, since the points were bought.
    expect(prisma.giftTransaction.findMany.mock.calls[0][0].where).toEqual({
      senderId: 'member-1',
      createdAt: { gte: new Date('2026-09-20T00:00:00Z') },
    });
    expect(creditInvoiceForPayment).toHaveBeenCalledWith('pay-1', 29);

    expect(rows()[0]).toMatchObject({ outcome: 'LOST', heldCreatorProfileIds: ['cp-1', 'cp-2'] });
    expect(rows()[0].effectsAppliedAt).toBeInstanceOf(Date);
    expect(lost.applied.join(' ')).toMatch(/Took back 200 gift points/);
    expect(lost.applied.join(' ')).toMatch(/300 points had already been spent/);
    expect(lost.applied.join(' ')).toMatch(/nobody has been debited/);

    const notice = (notifyAdmins as jest.Mock).mock.calls.at(-1)![0] as any;
    expect(notice.title).toBe('A card dispute was lost');
    expect(notice.message).toMatch(/already been spent/);
  });

  it('counts a part refund already given as returned money, so the points are taken back once between them', async () => {
    prisma.payment.findUnique.mockImplementation(async ({ where }: any) =>
      where.id ? { refundedAmount: '10' } : { id: 'pay-1', userId: 'member-1', type: 'GIFT_BALANCE' }
    );
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 0, shortfallPoints: 0, alreadyApplied: true });

    await recordDisputeEvent(event('charge.dispute.created'));
    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost', amount: 1500 })));

    // A$10 refunded and A$15 disputed: A$25 has gone back, 2500 cents, cumulative.
    expect(reverseGiftPurchase).toHaveBeenCalledWith('pi_1', 2500);
  });

  it('applies its effects once however many times the decision is delivered', async () => {
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 500, shortfallPoints: 0, alreadyApplied: false });

    await recordDisputeEvent(event('charge.dispute.created'));
    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));
    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));
    await recordDisputeEvent(event('charge.dispute.funds_withdrawn', dispute({ status: 'lost' })));

    expect(reverseGiftPurchase).toHaveBeenCalledTimes(1);
    expect(creditInvoiceForPayment).toHaveBeenCalledTimes(1);
  });

  it('finishes the work a process that died part way left behind, on the next event', async () => {
    // The decision was recorded and the process died before its effects were applied.
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 500, shortfallPoints: 0, alreadyApplied: false });
    await recordDisputeEvent(event('charge.dispute.created'));
    (reverseGiftPurchase as jest.Mock).mockRejectedValueOnce(new Error('database went away'));

    await expect(recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })))).rejects.toThrow('database went away');
    expect(rows()[0]).toMatchObject({ outcome: 'LOST', effectsAppliedAt: null });
    // Nothing was done, so nobody has been told it was.
    expect((notifyAdmins as jest.Mock).mock.calls.some(([n]: any[]) => n.title === 'A card dispute was lost')).toBe(false);

    // Stripe delivers it again.
    const retried = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(reverseGiftPurchase).toHaveBeenCalledTimes(2);
    expect(rows()[0].effectsAppliedAt).toBeInstanceOf(Date);
    // The retry found the dispute already decided, and still says what was done, once.
    expect(retried.settled).toBe(true);
    const losses = (notifyAdmins as jest.Mock).mock.calls.filter(([n]: any[]) => n.title === 'A card dispute was lost');
    expect(losses).toHaveLength(1);
    expect(losses[0][0].message).toMatch(/Took back 500 gift points/);
  });

  it('keeps the effects it has applied when the invoice cannot be credited, and says to do that by hand', async () => {
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 500, shortfallPoints: 0, alreadyApplied: false });
    (creditInvoiceForPayment as jest.Mock).mockRejectedValueOnce(new Error('invoice table locked'));

    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(lost.applied.join(' ')).toMatch(/Took back 500 gift points/);
    expect(lost.applied.join(' ')).toMatch(/credit it by hand/);
    expect(recordFailure).toHaveBeenCalledWith('stripe_webhook.dispute_invoice_credit', expect.any(Error));
    expect(rows()[0].effectsAppliedAt).toBeInstanceOf(Date);
  });
});

describe('A dispute that is still open on gift points', () => {
  const purchase = { userId: 'member-1', giftPoints: 500, reversedPoints: 0, createdAt: new Date('2026-09-20T00:00:00Z') };

  beforeEach(() => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'member-1', type: 'GIFT_BALANCE' });
    prisma.giftBalancePurchase.findUnique.mockResolvedValue(purchase);
    prisma.giftTransaction.findMany.mockResolvedValue([{ receiverId: 'creator-user-1' }]);
    prisma.creatorProfile.findMany.mockResolvedValue([{ id: 'cp-1' }]);
  });

  it('pauses the creators the member has gifted to, as soon as it opens, when the points bought have been spent', async () => {
    prisma.user.findUnique.mockResolvedValue({ giftBalance: 120 });

    const opened = await recordDisputeEvent(event('charge.dispute.created'));

    expect(holdCreatorPayouts).toHaveBeenCalledWith(['cp-1'], expect.stringContaining('dp_1'));
    expect(rows()[0].heldCreatorProfileIds).toEqual(['cp-1']);
    expect(opened.applied.join(' ')).toMatch(/Paused withdrawals for 1 creator/);
    // Nobody is debited and nothing is taken while Stripe has not decided.
    expect(reverseGiftPurchase).not.toHaveBeenCalled();
  });

  it('pauses nobody when every point bought is still held: nothing has reached a creator', async () => {
    prisma.user.findUnique.mockResolvedValue({ giftBalance: 800 });

    await recordDisputeEvent(event('charge.dispute.created'));

    expect(holdCreatorPayouts).not.toHaveBeenCalled();
    expect(rows()[0].heldCreatorProfileIds).toEqual([]);
  });

  it('does not pause them again on every later event', async () => {
    prisma.user.findUnique.mockResolvedValue({ giftBalance: 120 });

    await recordDisputeEvent(event('charge.dispute.created'));
    await recordDisputeEvent(event('charge.dispute.updated'));
    await recordDisputeEvent(event('charge.dispute.funds_withdrawn'));

    expect(holdCreatorPayouts).toHaveBeenCalledTimes(1);
  });

  it('ends the pause when ATHENA wins, which is the pause’s whole purpose', async () => {
    prisma.user.findUnique.mockResolvedValue({ giftBalance: 120 });
    await recordDisputeEvent(event('charge.dispute.created'));

    const won = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'won' })));

    expect(releaseCreatorPayouts).toHaveBeenCalledWith(['cp-1']);
    expect(rows()[0].holdsReleasedAt).toBeInstanceOf(Date);
    expect(won.applied.join(' ')).toMatch(/open again for 1 creator/);
    expect(reverseGiftPurchase).not.toHaveBeenCalled();
    expect((notifyAdmins as jest.Mock).mock.calls.at(-1)![0].title).toBe('A card dispute was won');
  });

  it('keeps a creator paused when another dispute is still holding the creator', async () => {
    prisma.user.findUnique.mockResolvedValue({ giftBalance: 120 });
    await recordDisputeEvent(event('charge.dispute.created'));
    // A second dispute, still open, also holds cp-1 and cp-9.
    prisma.__rows.set('other', {
      id: 'other',
      stripeDisputeId: 'dp_other',
      outcome: 'OPEN',
      holdsReleasedAt: null,
      heldCreatorProfileIds: ['cp-1', 'cp-9'],
      openedAt: new Date(),
    });

    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'won' })));

    expect(releaseCreatorPayouts).toHaveBeenCalledWith([]);
  });
});

describe('A lost dispute on a membership', () => {
  beforeEach(() => {
    stripe.charges.retrieve.mockResolvedValue({ id: 'ch_1', invoice: 'in_1' });
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', subscription: 'sub_s1', customer: 'cus_1', created: OPENED - 100, status_transitions: { paid_at: OPENED - 50 } });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'member-1', stripeSubscriptionId: 'sub_s1' });
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tier: 'PREMIUM_CAREER', status: 'ACTIVE', stripeSubscriptionId: 'sub_s1' });
  });

  it('ends it as customer.subscription.deleted does, cancels it at Stripe, and credits the period’s invoice', async () => {
    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(prisma.subscription.update.mock.calls[0][0]).toEqual({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ tier: 'FREE', status: 'CANCELED', stripePriceId: null, cancelAtPeriodEnd: false, currentPeriodStart: null, currentPeriodEnd: null }),
    });
    // Billed again on a card that has just disputed the last payment: so it is cancelled.
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_s1');
    expect(prisma.subscription.update.mock.calls[1][0]).toEqual({ where: { id: 'sub-1' }, data: { stripeSubscriptionId: null } });
    // The invoice is found as the one filed for that period: by the instant Stripe says it was paid.
    expect(creditSubscriptionInvoice).toHaveBeenCalledWith('sub-1', new Date((OPENED - 50) * 1000), 29);
    expect(lost.applied.join(' ')).toMatch(/cancelled the subscription at Stripe/);
  });

  it('still ends the membership, and tells the admins to cancel at Stripe, when Stripe would not', async () => {
    stripe.subscriptions.cancel.mockRejectedValueOnce(new Error('Stripe is down'));

    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(prisma.subscription.update.mock.calls[0][0].data.tier).toBe('FREE');
    // Not unlinked from the Stripe subscription that is still billing the member.
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
    expect(lost.applied.join(' ')).toMatch(/Cancel it in Stripe so the member is not billed again/);
    expect(recordFailure).toHaveBeenCalledWith('stripe_webhook.dispute_subscription_cancel', expect.any(Error));
  });

  it('says it had already ended when it had', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', tier: 'FREE', status: 'CANCELED', stripeSubscriptionId: null });

    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(lost.applied.join(' ')).toMatch(/already ended/);
  });

  it('does nothing to a membership when the dispute is won', async () => {
    await recordDisputeEvent(event('charge.dispute.created'));
    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'won' })));

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe('A lost dispute on a payment that went to somebody else', () => {
  it('records the loss and leaves the seller’s money where it is, for a person to decide', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', buyerId: 'buyer-1' });

    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));

    expect(lost.applied.join(' ')).toMatch(/seller was paid out of it and has not been debited/);
    expect(lost.applied.join(' ')).toMatch(/reverse the transfer in Stripe/);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(reverseGiftPurchase).not.toHaveBeenCalled();
    expect(holdCreatorPayouts).not.toHaveBeenCalled();
  });

  it('does not touch a formation registration or an accelerator place on its own', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-f', userId: 'member-1', type: 'FORMATION' });
    await recordDisputeEvent(event('charge.dispute.created'));
    const lost = await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));
    expect(lost.applied.join(' ')).toMatch(/formation fee/);

    prisma.__rows.clear();
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-a', userId: 'member-1', type: 'ACCELERATOR' });
    await recordDisputeEvent(event('charge.dispute.created', dispute({ id: 'dp_9' })));
    const lostAccelerator = await recordDisputeEvent(event('charge.dispute.closed', dispute({ id: 'dp_9', status: 'lost' })));
    expect(lostAccelerator.applied.join(' ')).toMatch(/accelerator place/);
  });
});

describe('A refund', () => {
  const charge = (over: Record<string, unknown> = {}) =>
    ({ id: 'ch_1', payment_intent: 'pi_1', amount: 25000, amount_refunded: 25000, refunded: true, currency: 'aud', ...over }) as any;

  it('does nothing when nothing came back', async () => {
    await applyRefundEffects(charge({ amount_refunded: 0, refunded: false }));

    expect(reverseGiftPurchase).not.toHaveBeenCalled();
    expect(creditInvoiceForPayment).not.toHaveBeenCalled();
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('takes the gift points back in proportion, from the cumulative figure, and credits the invoice in dollars', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 100, shortfallPoints: 0, alreadyApplied: false });

    const effects = await applyRefundEffects(charge({ amount: 1000, amount_refunded: 250, refunded: false }));

    expect(reverseGiftPurchase).toHaveBeenCalledWith('pi_1', 250);
    expect(creditInvoiceForPayment).toHaveBeenCalledWith('pay-1', 2.5);
    expect(effects).toMatchObject({ giftPointsTakenBack: 100, giftPointsShort: 0, invoiceNumber: 'INV-202610-00001' });
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('tells the admins, and debits nobody, when the points refunded had already been spent', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 100, shortfallPoints: 400, alreadyApplied: false });

    const effects = await applyRefundEffects(charge());

    expect(effects.giftPointsShort).toBe(400);
    const notice = (notifyAdmins as jest.Mock).mock.calls[0][0] as any;
    expect(notice.title).toBe('A refunded gift purchase was already spent');
    expect(notice.message).toMatch(/Nobody has been debited/);
    expect(holdCreatorPayouts).not.toHaveBeenCalled();
  });

  it('does not say anything a second time when the same refund is delivered again', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
    (reverseGiftPurchase as jest.Mock).mockResolvedValue({ userId: 'member-1', purchasedAt: new Date(), tookBackPoints: 0, shortfallPoints: 0, alreadyApplied: true });
    (creditInvoiceForPayment as jest.Mock).mockResolvedValueOnce({ invoiceId: 'inv-1', invoiceNumber: 'INV-1', credited: 250, cancelled: true, changed: false });

    const effects = await applyRefundEffects(charge());

    expect(effects.giftPointsTakenBack).toBe(0);
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('reads a zero-decimal refund in whole units', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1' });

    await applyRefundEffects(charge({ amount: 5000, amount_refunded: 1500, refunded: false, currency: 'jpy' }));

    expect(creditInvoiceForPayment).toHaveBeenCalledWith('pay-1', 1500);
  });

  it('credits a membership period’s invoice, and leaves the plan alone but tells the admins when it was refunded in full', async () => {
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', subscription: 'sub_s1', customer: 'cus_1', created: OPENED - 100, status_transitions: { paid_at: OPENED - 50 } });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'member-1', stripeSubscriptionId: 'sub_s1' });

    await applyRefundEffects(charge({ amount: 2900, amount_refunded: 2900, invoice: 'in_1' }));

    expect(creditSubscriptionInvoice).toHaveBeenCalledWith('sub-1', new Date((OPENED - 50) * 1000), 29);
    // A refund does not say whether the member is leaving: the plan is not touched.
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    const notice = (notifyAdmins as jest.Mock).mock.calls[0][0] as any;
    expect(notice.title).toBe('A membership payment was refunded');
    expect(notice.message).toMatch(/The plan is unchanged/);
  });

  it('does not bother the admins about a part refund of a membership, which is a goodwill gesture', async () => {
    stripe.invoices.retrieve.mockResolvedValue({ id: 'in_1', subscription: 'sub_s1', customer: 'cus_1', created: OPENED, status_transitions: { paid_at: OPENED } });
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', userId: 'member-1', stripeSubscriptionId: 'sub_s1' });

    await applyRefundEffects(charge({ amount: 2900, amount_refunded: 500, refunded: false, invoice: 'in_1' }));

    expect(creditSubscriptionInvoice).toHaveBeenCalledWith('sub-1', expect.any(Date), 5);
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('is processed again, rather than left without its credit, when Stripe cannot say which membership it was', async () => {
    stripe.invoices.retrieve.mockRejectedValue(new Error('Stripe is down'));

    await expect(applyRefundEffects(charge({ invoice: 'in_1' }))).rejects.toThrow('Stripe is down');
  });

  it('tells the admins that a refund after a marketplace payment was released may have left it with the seller', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', capturedAt: new Date() });

    await applyRefundEffects(charge());

    const notice = (notifyAdmins as jest.Mock).mock.calls[0][0] as any;
    expect(notice.title).toBe('A released marketplace payment was refunded');
    expect(notice.message).toMatch(/the seller keeps the money/);
  });

  it('says nothing about a hold that was never released, which a refund cannot leave with anybody', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', capturedAt: null });

    await applyRefundEffects(charge());

    expect(notifyAdmins).not.toHaveBeenCalled();
  });
});

describe('What the admins see', () => {
  const seed = async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', userId: 'member-1', type: 'GIFT_BALANCE' });
    prisma.user.findUnique.mockResolvedValue({ giftBalance: 0 });
    prisma.giftBalancePurchase.findUnique.mockResolvedValue({ userId: 'member-1', giftPoints: 500, reversedPoints: 0, createdAt: new Date() });
    prisma.giftTransaction.findMany.mockResolvedValue([{ receiverId: 'c1' }]);
    prisma.creatorProfile.findMany.mockResolvedValue([{ id: 'cp-1' }]);
    await recordDisputeEvent(event('charge.dispute.created'));
    await recordDisputeEvent(event('charge.dispute.created', dispute({ id: 'dp_2', payment_intent: 'pi_2', created: OPENED + 10 })));
    prisma.user.findMany.mockResolvedValue([{ id: 'member-1', displayName: 'Sarah K', firstName: 'Sarah', lastName: 'K' }]);
  };

  it('lists disputes newest first with the member, the deadline and how many creators are held', async () => {
    await seed();

    const page = await listDisputesForAdmin({ outcome: 'OPEN' });

    expect(page.disputes.map((d) => d.stripeDisputeId)).toEqual(['dp_2', 'dp_1']);
    expect(page.disputes[0]).toMatchObject({
      amount: 2900,
      currency: 'AUD',
      outcome: 'OPEN',
      kind: 'GIFT_BALANCE',
      kindLabel: 'a gift balance top-up',
      member: { id: 'member-1', name: 'Sarah K' },
      creatorsHeld: 1,
    });
    expect(page.disputes[0].evidenceDueBy).toBe(new Date((OPENED + 14 * 86400) * 1000).toISOString());
    expect(page.nextCursor).toBeNull();
  });

  it('pages, and ignores an outcome it does not know', async () => {
    await seed();

    const first = await listDisputesForAdmin({ limit: 1, outcome: 'NONSENSE' });
    expect(first.disputes).toHaveLength(1);
    expect(first.nextCursor).toBe(first.disputes[0].id);

    const second = await listDisputesForAdmin({ limit: 1, cursor: first.nextCursor! });
    expect(second.disputes[0].stripeDisputeId).toBe('dp_1');
  });

  it('releases the pause a decided dispute left, once, and leaves an open one alone', async () => {
    await seed();
    const row = rows().find((r) => r.stripeDisputeId === 'dp_1')!;
    // The other dispute holds the same creator; its pause is already over, so it
    // is not what keeps the creator paused.
    rows().find((r) => r.stripeDisputeId === 'dp_2')!.holdsReleasedAt = new Date();

    // Still open: Stripe has not decided, and the pause is the protection.
    expect(await releaseDisputeHolds(row.id)).toBe(0);
    expect(releaseCreatorPayouts).not.toHaveBeenCalled();

    await recordDisputeEvent(event('charge.dispute.closed', dispute({ status: 'lost' })));
    expect(rows().find((r) => r.id === row.id)!.holdsReleasedAt).toBeNull();

    expect(await releaseDisputeHolds(row.id)).toBe(1);
    expect(releaseCreatorPayouts).toHaveBeenCalledWith(['cp-1']);
    // Said once: a second press has nothing left to release.
    expect(await releaseDisputeHolds(row.id)).toBe(0);
    expect(await releaseDisputeHolds('no-such-dispute')).toBeNull();
  });
});
