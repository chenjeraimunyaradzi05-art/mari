import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

jest.mock('../../utils/prisma', () => {
  // The dispute table, kept in memory so that a dispute can be watched moving
  // through the events the way the real row does.
  const disputes = new Map<string, any>();
  const prismaMock: any = {
    __disputes: disputes,
    stripeWebhookEvent: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    mentorSession: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 0 })), findUnique: jest.fn(async () => null) },
    // A refund now follows the money onto the Payment row and back to a
    // formation registration paid with that intent.
    payment: { updateMany: jest.fn(async () => ({ count: 0 })), findUnique: jest.fn(async () => null) },
    businessRegistration: { findFirst: jest.fn(async () => null), update: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    // What a refund does to the points a gift top-up bought.
    giftBalancePurchase: { findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 1 })) },
    user: { findUnique: jest.fn(async () => ({ giftBalance: 0 })), updateMany: jest.fn(async () => ({ count: 1 })) },
    paymentDispute: {
      findUnique: jest.fn(async ({ where }: any) => disputes.get(where.stripeDisputeId) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `pd-${disputes.size + 1}`,
          kind: null,
          userId: null,
          closedAt: null,
          effectsAppliedAt: null,
          effects: null,
          heldCreatorProfileIds: [],
          holdsReleasedAt: null,
          ...data,
        };
        disputes.set(data.stripeDisputeId, row);
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = [...disputes.values()].find((r) => r.id === where.id);
        Object.assign(row, data);
        return { ...row };
      }),
      findMany: jest.fn(async () => []),
    },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg))),
  };
  return { prisma: prismaMock };
});

// The in-app notice to the admins is its own service; what matters here is that
// the webhook causes it.
jest.mock('../../services/admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));

jest.mock('stripe', () => {
  const stripeClient = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn() },
    accountLinks: { create: jest.fn() },
    accounts: { createLoginLink: jest.fn() },
  };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

// deliverEmail is the form that says whether a refusal is worth another try; the
// trial reminder reads it. sendEmail is what the dispute alert and the failed
// renewal use.
jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  deliverEmail: jest.fn(async () => ({ ok: true, retryable: false, status: 202, reason: null, attempts: 1 })),
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';
import { deliverEmail, sendEmail } from '../../utils/email';
import { notifyAdmins } from '../../services/admin-notify.service';
import { PAST_DUE_GRACE_DAYS } from '../../config/price-book';

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

describe('Refunds, disputes and failed renewals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.TRUST_SAFETY_EMAIL = 'safety@example.com';
    process.env.CLIENT_URL = 'https://app.example';
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
    prisma.__disputes.clear();
    prisma.giftBalancePurchase.findUnique.mockResolvedValue(null);
    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.escrowPayment.findUnique.mockResolvedValue(null);
  });

  it('a refunded charge marks the mentoring session it paid for', async () => {
    await deliver({
      id: 'evt_r',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_9', amount: 12000, amount_refunded: 12000, refunded: true, currency: 'aud' } },
    }).expect(200);

    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_9', paymentStatus: { in: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED'] } },
      data: { paymentStatus: 'REFUNDED' },
    });
  });

  // charge.refunded fires for a part of the money as much as for all of it. The
  // rows used to be marked REFUNDED on the first event, so a A$10 goodwill refund
  // on a A$250 order read as the whole sale refunded, and the provider's
  // earnings, the buyer's history and the invoice all lost it.
  describe('a refund moves a sale only as far as the money went back', () => {
    const refund = (over: Record<string, unknown> = {}, id = 'evt_refund') => ({
      id,
      type: 'charge.refunded',
      data: {
        object: { id: 'ch_1', payment_intent: 'pi_9', amount: 25000, amount_refunded: 25000, refunded: true, currency: 'aud', ...over },
      },
    });

    it('marks everything REFUNDED, and records the amount, when the charge is refunded in full', async () => {
      await deliver(refund()).expect(200);

      expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
        where: { paymentIntentId: 'pi_9', status: { not: 'REFUNDED' } },
        data: expect.objectContaining({ status: 'REFUNDED', refundedAmount: 25000 }),
      });
      const paymentWrite = prisma.payment.updateMany.mock.calls[0][0];
      expect(paymentWrite.where).toEqual({ stripePaymentIntentId: 'pi_9', status: { not: 'REFUNDED' } });
      expect(paymentWrite.data.status).toBe('REFUNDED');
      expect(String(paymentWrite.data.refundedAmount)).toBe('250');
      expect(prisma.mentorSession.updateMany).toHaveBeenCalledTimes(1);
    });

    it('reads a full refund from the amounts when the flag is not there', async () => {
      await deliver(refund({ refunded: undefined })).expect(200);

      expect(prisma.escrowPayment.updateMany.mock.calls[0][0].data.status).toBe('REFUNDED');
    });

    it('does not mark a sale refunded for a part refund, and records how much came back', async () => {
      await deliver(refund({ amount_refunded: 1000, refunded: false })).expect(200);

      // Nothing is REFUNDED: not the session, not the hold, not the money row.
      expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
      for (const call of [...prisma.escrowPayment.updateMany.mock.calls, ...prisma.payment.updateMany.mock.calls]) {
        expect(call[0].data.status).toBeUndefined();
      }
      // Cumulative, and only ever up: a figure that is not larger than what is
      // already recorded matches nothing.
      expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
        where: { paymentIntentId: 'pi_9', refundedAmount: { lt: 1000 } },
        data: { refundedAmount: 1000 },
      });
      const paymentWrite = prisma.payment.updateMany.mock.calls[0][0];
      expect(String(paymentWrite.data.refundedAmount)).toBe('10');
      expect(String(paymentWrite.where.refundedAmount.lt)).toBe('10');
    });

    it('a part refund followed by the rest ends REFUNDED, however the two arrive', async () => {
      await deliver(refund({ amount_refunded: 1000, refunded: false }, 'evt_part')).expect(200);
      await deliver(refund({ amount_refunded: 25000, refunded: true }, 'evt_rest')).expect(200);

      const last = prisma.escrowPayment.updateMany.mock.calls.at(-1)[0];
      expect(last.data).toMatchObject({ status: 'REFUNDED', refundedAmount: 25000 });
    });

    it('does nothing for a refund event that says nothing came back', async () => {
      await deliver(refund({ amount_refunded: 0, refunded: false })).expect(200);

      expect(prisma.escrowPayment.updateMany).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
    });

    it('records a part refund in a zero-decimal currency in whole units', async () => {
      await deliver(refund({ amount: 5000, amount_refunded: 1500, refunded: false, currency: 'jpy' })).expect(200);

      expect(String(prisma.payment.updateMany.mock.calls[0][0].data.refundedAmount)).toBe('1500');
    });

    it('still tells a formation registration how much was refunded', async () => {
      await deliver(refund({ amount_refunded: 1000, refunded: false })).expect(200);

      // reconcileFormationRefund looks for a registration paid with this intent.
      expect(prisma.businessRegistration.findFirst).toHaveBeenCalled();
    });
  });

  // The refund took the money and left what it bought. The points a gift top-up
  // bought go back in proportion to the money that did, once, however many times
  // Stripe tells us.
  describe('what a refund does to the gift points it paid for', () => {
    const purchase = { id: 'gbp-1', userId: 'member-1', paymentIntentId: 'pi_gift', amountCents: 5000, giftPoints: 500, reversedPoints: 0, createdAt: new Date('2026-09-20T00:00:00Z') };
    const refund = (over: Record<string, unknown> = {}, id = 'evt_gift') => ({
      id,
      type: 'charge.refunded',
      data: { object: { id: 'ch_g', payment_intent: 'pi_gift', amount: 5000, amount_refunded: 5000, refunded: true, currency: 'aud', ...over } },
    });

    beforeEach(() => {
      prisma.giftBalancePurchase.findUnique.mockResolvedValue({ ...purchase });
      prisma.giftBalancePurchase.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({ giftBalance: 800 });
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
    });

    it('takes back every point when the top-up is refunded in full', async () => {
      await deliver(refund()).expect(200);

      expect(prisma.giftBalancePurchase.updateMany).toHaveBeenCalledWith({
        where: { id: 'gbp-1', reversedPoints: 0 },
        data: { reversedPoints: 500 },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'member-1', giftBalance: { gte: 500 } },
        data: { giftBalance: { decrement: 500 } },
      });
      expect(notifyAdmins).not.toHaveBeenCalled();
    });

    it('takes back only the points the refunded part bought', async () => {
      await deliver(refund({ amount_refunded: 1000, refunded: false })).expect(200);

      // A$10 of a A$50 top-up bought 100 of its 500 points.
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'member-1', giftBalance: { gte: 100 } },
        data: { giftBalance: { decrement: 100 } },
      });
    });

    it('takes nothing a second time when Stripe tells us again', async () => {
      prisma.giftBalancePurchase.findUnique.mockResolvedValue({ ...purchase, reversedPoints: 500 });

      await deliver(refund()).expect(200);

      expect(prisma.giftBalancePurchase.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('does not take the balance below nothing, and tells the admins about the part that had already been spent', async () => {
      prisma.user.findUnique.mockResolvedValue({ giftBalance: 120 });

      await deliver(refund()).expect(200);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'member-1', giftBalance: { gte: 120 } },
        data: { giftBalance: { decrement: 120 } },
      });
      const notice = (notifyAdmins as any).mock.calls[0][0];
      expect(notice.title).toBe('A refunded gift purchase was already spent');
      expect(notice.message).toMatch(/120 points were taken back, and 380 had already been spent/);
    });

    it('is refused with a 500 when the effects could not be applied, so that Stripe sends it again', async () => {
      prisma.giftBalancePurchase.findUnique.mockRejectedValue(new Error('database went away'));
      prisma.stripeWebhookEvent.delete = jest.fn();

      await deliver(refund()).expect(500);
    });
  });

  // Every dispute event lands on one row, so a replay or a reordering cannot
  // announce a dispute twice or reopen one that has been decided.
  describe('the five dispute events', () => {
    const disputeEvent = (type: string, over: Record<string, unknown> = {}, id = `evt_${type}`) => ({
      id,
      type,
      created: 1_800_000_000,
      data: { object: { id: 'dp_5', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: 'fraudulent', status: 'needs_response', created: 1_799_999_000, ...over } },
    });

    it('records the dispute once however many events arrive for it, and announces its opening once', async () => {
      await deliver(disputeEvent('charge.dispute.created')).expect(200);
      await deliver(disputeEvent('charge.dispute.updated', { status: 'under_review' })).expect(200);
      await deliver(disputeEvent('charge.dispute.updated', { status: 'under_review' }, 'evt_updated_again')).expect(200);
      await deliver(disputeEvent('charge.dispute.funds_withdrawn', { status: 'under_review' })).expect(200);

      expect(prisma.paymentDispute.create).toHaveBeenCalledTimes(1);
      expect(prisma.__disputes.size).toBe(1);
      expect(prisma.__disputes.get('dp_5')).toMatchObject({ amount: 12000, status: 'under_review', outcome: 'OPEN', fundsWithdrawn: true });
      expect(notifyAdmins).toHaveBeenCalledTimes(1);
      expect((notifyAdmins as any).mock.calls[0][0].title).toBe('A card payment has been disputed');
    });

    it('closes it on the closing event, tells the admins how it ended, and keeps it closed after a late update', async () => {
      await deliver(disputeEvent('charge.dispute.created')).expect(200);
      (notifyAdmins as any).mockClear();

      await deliver(disputeEvent('charge.dispute.closed', { status: 'won' })).expect(200);
      expect(prisma.__disputes.get('dp_5')).toMatchObject({ outcome: 'WON', status: 'won' });
      expect((notifyAdmins as any).mock.calls[0][0].title).toBe('A card dispute was won');

      // An update made before the decision, arriving after it.
      await deliver(disputeEvent('charge.dispute.updated', { status: 'under_review' })).expect(200);
      expect(prisma.__disputes.get('dp_5')).toMatchObject({ outcome: 'WON', status: 'won' });
    });

    it('is refused with a 500 when the row cannot be written, so that Stripe sends it again', async () => {
      prisma.paymentDispute.create.mockRejectedValueOnce(new Error('database went away'));

      await deliver(disputeEvent('charge.dispute.created')).expect(500);
    });
  });

  it('a new dispute is emailed to trust and safety; a closed one is only logged', async () => {
    await deliver({
      id: 'evt_d',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_1', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: 'fraudulent', status: 'needs_response', evidence_details: { due_by: 1_800_000_000 } } },
    }).expect(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('safety@example.com');
    expect(mail.subject).toContain('dp_1');
    expect(mail.text).toContain('120.00 AUD');

    await deliver({ id: 'evt_d2', type: 'charge.dispute.closed', data: { object: { id: 'dp_1', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: 'fraudulent', status: 'won' } } }).expect(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('never sends a dispute to a mailbox ATHENA does not own when none is configured', async () => {
    // The fallback used to be trust-safety@athena.com, a domain the venture
    // does not own, so dispute ids and amounts went to a stranger.
    const saved = { ...process.env };
    delete process.env.TRUST_SAFETY_EMAIL;
    delete process.env.CONTACT_DOMAIN;
    delete process.env.NEXT_PUBLIC_CONTACT_DOMAIN;
    try {
      await deliver({
        id: 'evt_d3',
        type: 'charge.dispute.created',
        data: { object: { id: 'dp_2', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: 'fraudulent', status: 'needs_response' } },
      }).expect(200);
      expect(sendEmail).not.toHaveBeenCalled();
    } finally {
      process.env = saved;
    }
  });

  it('falls back to ATHENA\'s own support mailbox, and scales a zero-decimal amount correctly', async () => {
    const saved = { ...process.env };
    delete process.env.TRUST_SAFETY_EMAIL;
    process.env.CONTACT_DOMAIN = 'athena.example';
    try {
      await deliver({
        id: 'evt_d4',
        type: 'charge.dispute.created',
        data: { object: { id: 'dp_3', payment_intent: 'pi_9', amount: 15000, currency: 'jpy', reason: 'fraudulent', status: 'needs_response' } },
      }).expect(200);
      const mail = (sendEmail as any).mock.calls[0][0];
      expect(mail.to).toBe('support@athena.example');
      expect(mail.text).toContain('15000 JPY');
    } finally {
      process.env = saved;
    }
  });

  it('a failed renewal marks the subscription past due and tells the member how to fix it', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1', stripeCustomerId: 'cus_1', user: { email: 'sarah@example.com', firstName: 'Sarah' } });
    prisma.subscription.update.mockResolvedValue({});

    await deliver({ id: 'evt_i', type: 'invoice.payment_failed', data: { object: { id: 'in_1', customer: 'cus_1' } } }).expect(200);

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { status: 'PAST_DUE' } });
    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('sarah@example.com');
    expect(mail.text).toContain('Hi Sarah,');
    expect(mail.text).toContain('https://app.example/dashboard/settings/billing');
  });

  // The email says Stripe will try again, and the plan gates agree with it: she
  // keeps her paid tools until the grace ends, and the email names that day, the
  // one the gates use. Stripe sends this event for every attempt over the week, so
  // it cannot promise a fresh number of days each time.
  describe('what the failed-payment email promises about her plan', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const sayDate = (d: Date) =>
      d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' });
    const failedFor = (currentPeriodStart: Date | null) => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_stripe_1',
        status: 'ACTIVE',
        currentPeriodStart,
        user: { email: 'sarah@example.com', firstName: 'Sarah' },
      });
      prisma.subscription.update.mockResolvedValue({});
    };
    const attempt = (id: string, extra: Record<string, unknown> = {}) =>
      deliver({ id, type: 'invoice.payment_failed', data: { object: { id: `in_${id}`, customer: 'cus_1', ...extra } } }).expect(200);

    it('names the day the grace ends, counted from the period that failed', async () => {
      const began = new Date(Date.now() - 3 * DAY);
      failedFor(began);

      await attempt('evt_i_grace');

      const mail = (sendEmail as any).mock.calls[0][0];
      const until = sayDate(new Date(began.getTime() + PAST_DUE_GRACE_DAYS * DAY));
      expect(mail.text).toContain(`you keep your plan until ${until}`);
      expect(mail.html).toContain(`you keep your plan until ${until}`);
      // Not a fresh run of days: the third attempt of the week is not given seven more.
      expect(mail.text).not.toContain(`for ${PAST_DUE_GRACE_DAYS} days`);
      // And what happens after it, so the pause is not a surprise.
      expect(mail.text).toMatch(/paid tools pause until it does/);
    });

    it('says the paid tools are paused, and promises no plan, once the grace has gone by', async () => {
      failedFor(new Date(Date.now() - (PAST_DUE_GRACE_DAYS + 2) * DAY));

      await attempt('evt_i_late');

      const mail = (sendEmail as any).mock.calls[0][0];
      expect(mail.text).not.toMatch(/you keep your plan/);
      expect(mail.text).toMatch(/paid tools are paused/);
      expect(mail.html).not.toMatch(/you keep your plan/);
    });

    it('promises no grace when the row does not know which period failed, since the plan gates would give none', async () => {
      failedFor(null);

      await attempt('evt_i_unknown');

      const mail = (sendEmail as any).mock.calls[0][0];
      expect(mail.text).not.toMatch(/you keep your plan/);
      expect(mail.text).not.toMatch(/\bdays\b.*while it does/);
      expect(mail.text).toContain('https://app.example/dashboard/settings/billing');
    });

    it('leaves a paid-up membership alone when the failed invoice is for another subscription of the same customer', async () => {
      failedFor(new Date(Date.now() - DAY));

      await attempt('evt_i_other', { subscription: 'sub_stripe_second' });

      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('still marks the membership past due when the invoice is for the subscription the row is on', async () => {
      failedFor(new Date(Date.now() - DAY));

      await attempt('evt_i_same', { subscription: 'sub_stripe_1' });

      expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { status: 'PAST_DUE' } });
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  // Her first name is text she typed, and this is a message from ATHENA's own
  // address: the markup copy of the greeting is escaped, the plain-text part is not.
  it('writes a first name that is markup into the failed-renewal email as text', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: 'cus_1',
      user: { email: 'sarah@example.com', firstName: '<a href="https://evil.example">Sarah</a>' },
    });
    prisma.subscription.update.mockResolvedValue({});

    await deliver({ id: 'evt_i3', type: 'invoice.payment_failed', data: { object: { id: 'in_3', customer: 'cus_1' } } }).expect(200);

    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.html).toContain('Hi &lt;a href=&quot;https://evil.example&quot;&gt;Sarah&lt;/a&gt;,');
    expect(mail.html).not.toContain('<a href="https://evil.example');
    expect(mail.text).toContain('Hi <a href="https://evil.example">Sarah</a>,');
  });

  it('writes Stripe\'s dispute fields into the alert as text', async () => {
    await deliver({
      id: 'evt_d5',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_<b>', payment_intent: 'pi_9', amount: 12000, currency: 'aud', reason: '<img src=x onerror=alert(1)>', status: 'needs_response' } },
    }).expect(200);

    const mail = (sendEmail as any).mock.calls[0][0];
    expect(mail.html).toContain('Reason: &lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toContain('Dispute: dp_&lt;b&gt;');
    expect(mail.html).not.toMatch(/<img\b/);
  });

  it('a failed renewal for a customer we do not know is ignored quietly', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    await deliver({ id: 'evt_i2', type: 'invoice.payment_failed', data: { object: { id: 'in_2', customer: 'cus_unknown' } } }).expect(200);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

/**
 * The reminder before the first charge. A trial starts with a card and ends with
 * that card being charged, and the Terms and the checkout page both say we write
 * to her first. Stripe sends customer.subscription.trial_will_end three days
 * before the end; nothing listened for it, so the first she heard of the charge
 * was the charge.
 */
describe('The trial-ending reminder', () => {
  // Far enough ahead that the trial has not ended whenever the suite runs.
  const trialEnd = Math.floor(Date.UTC(2099, 0, 20, 0, 0, 0) / 1000);

  const trialEvent = (overrides: Record<string, unknown> = {}, id = 'evt_trial') => ({
    id,
    type: 'customer.subscription.trial_will_end',
    data: {
      object: {
        id: 'sub_stripe_1',
        customer: 'cus_1',
        status: 'trialing',
        trial_end: trialEnd,
        cancel_at_period_end: false,
        cancel_at: null,
        items: {
          data: [
            { price: { id: 'price_pro', unit_amount: 2499, currency: 'aud', recurring: { interval: 'month', interval_count: 1 } } },
          ],
        },
        ...overrides,
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.CLIENT_URL = 'https://app.example';
    prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt' });
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: 'cus_1',
      user: { email: 'sarah@example.com', firstName: 'Sarah' },
    });
    (deliverEmail as any).mockResolvedValue({ ok: true, retryable: false, status: 202, reason: null, attempts: 1 });
  });

  it('tells her the day the card is charged, what it is charged, and how to cancel', async () => {
    await deliver(trialEvent()).expect(200);

    expect(deliverEmail).toHaveBeenCalledTimes(1);
    const mail = (deliverEmail as any).mock.calls[0][0];
    expect(mail.to).toBe('sarah@example.com');
    expect(mail.subject).toContain('20 January 2099');
    expect(mail.text).toContain('Hi Sarah,');
    expect(mail.text).toContain('20 January 2099');
    // The amount and how often, from the price on the subscription: the number
    // Stripe is about to charge, not one of ours.
    expect(mail.text).toMatch(/\$24\.99 a month/);
    expect(mail.text).toContain('https://app.example/dashboard/settings/billing');
    expect(mail.text).toMatch(/cancel before then and you will not be charged anything/);
  });

  it('writes one email for one trial: a replay of the event sends none', async () => {
    await deliver(trialEvent()).expect(200);

    const duplicate: any = new Error('Unique constraint failed');
    duplicate.code = 'P2002';
    prisma.stripeWebhookEvent.create.mockRejectedValueOnce(duplicate);
    prisma.stripeWebhookEvent.findUnique.mockResolvedValueOnce({ completedAt: new Date(), claimedAt: new Date() });

    const replay = await deliver(trialEvent()).expect(200);

    expect(replay.body.duplicate).toBe(true);
    expect(deliverEmail).toHaveBeenCalledTimes(1);
  });

  it('says nothing when she has already cancelled, because no charge is coming', async () => {
    await deliver(trialEvent({ cancel_at_period_end: true })).expect(200);

    expect(deliverEmail).not.toHaveBeenCalled();
  });

  it('says nothing when the trial is no longer running', async () => {
    await deliver(trialEvent({ status: 'active' })).expect(200);
    await deliver(trialEvent({ trial_end: Math.floor(Date.UTC(2020, 0, 1) / 1000) }, 'evt_trial_old')).expect(200);

    expect(deliverEmail).not.toHaveBeenCalled();
  });

  it('ignores a customer it does not know', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);

    await deliver(trialEvent()).expect(200);

    expect(deliverEmail).not.toHaveBeenCalled();
  });

  it('asks Stripe to deliver it again when the provider was busy, rather than losing the reminder', async () => {
    (deliverEmail as any).mockResolvedValue({ ok: false, retryable: true, status: 503, reason: 'provider_error', attempts: 3 });
    prisma.stripeWebhookEvent.delete = jest.fn();

    await deliver(trialEvent()).expect(500);

    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt_trial' } });
  });

  it('does not make Stripe retry for three days an address that will refuse it every time', async () => {
    // An address on the suppression list, or one the provider rejects, gives the
    // same answer on every delivery. Throwing would hold the event open and the
    // failure list full for nothing.
    prisma.stripeWebhookEvent.delete = jest.fn();

    (deliverEmail as any).mockResolvedValue({ ok: false, retryable: false, status: null, reason: 'suppressed', attempts: 0 });
    await deliver(trialEvent()).expect(200);

    (deliverEmail as any).mockResolvedValue({ ok: false, retryable: false, status: 400, reason: 'rejected', attempts: 1 });
    await deliver(trialEvent({}, 'evt_trial_2')).expect(200);

    expect(prisma.stripeWebhookEvent.delete).not.toHaveBeenCalled();
  });

  it('puts her own name in markup only after escaping it', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      stripeCustomerId: 'cus_1',
      user: { email: 'sarah@example.com', firstName: '<img src=x onerror=alert(1)>' },
    });

    await deliver(trialEvent()).expect(200);

    const mail = (deliverEmail as any).mock.calls[0][0];
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&#60;img');
  });
});
