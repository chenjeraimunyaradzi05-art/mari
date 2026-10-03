/**
 * Staff ending a membership, and giving a payment back, at Stripe.
 *
 * The admin screen used to edit ATHENA's own Subscription row and nothing else.
 * Setting a membership to CANCELED there left the Stripe subscription running:
 * the next customer.subscription.updated event overwrote the staff member's
 * change and the member went on being billed. And the thirty-day refund the
 * pricing page and the Terms promise had no path at all. What is asserted here
 * is what reaches Stripe, how many times, and what is written down.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    invoice: { findFirst: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin-1@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const stripeClient = {
  subscriptions: {
    update: jest.fn(async (_id: string, _params: any): Promise<any> => ({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: Math.floor(Date.UTC(2026, 10, 12) / 1000),
    })),
    cancel: jest.fn(async (_id: string, _params?: any): Promise<any> => ({ status: 'canceled' })),
  },
  invoices: {
    list: jest.fn(async (_params: any): Promise<any> => ({
      data: [
        {
          id: 'in_latest',
          amount_paid: 2900,
          currency: 'aud',
          created: 1_760_000_000,
          payment_intent: 'pi_membership',
          status_transitions: { paid_at: 1_760_000_100 },
        },
      ],
    })),
  },
  refunds: { create: jest.fn(async (_params: any, _options?: any): Promise<any> => ({ id: 're_1', amount: 2900 })) },
};
let stripeConfigured = true;
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => stripeConfigured,
  getStripe: () => stripeClient,
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/audit', () => ({
  logAudit: jest.fn(async () => undefined),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { logAudit } from '../../utils/audit';

const prisma: any = prismaTyped;
const audit = logAudit as unknown as jest.Mock;

const stripeBacked = {
  id: 'sub-1',
  userId: 'member-1',
  tier: 'PREMIUM_CAREER',
  status: 'ACTIVE',
  currency: 'AUD',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_stripe_1',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date('2026-10-12T00:00:00.000Z'),
};

const grantedByStaff = { ...stripeBacked, stripeCustomerId: null, stripeSubscriptionId: null };

beforeEach(() => {
  jest.clearAllMocks();
  stripeConfigured = true;
  prisma.subscription.findUnique.mockResolvedValue(stripeBacked);
  prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-202610-00001' });
  prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
});

describe('PATCH /api/admin/subscriptions/:id no longer pretends to cancel billing', () => {
  it('refuses to mark a Stripe-billed membership CANCELED, and points at the way to do it', async () => {
    const res = await request(app).patch('/api/admin/subscriptions/sub-1').send({ status: 'CANCELED' });

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toMatch(/Cancel at Stripe/);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('refuses to drop a Stripe-billed membership to FREE the same way', async () => {
    const res = await request(app).patch('/api/admin/subscriptions/sub-1').send({ tier: 'FREE' });

    expect(res.status).toBe(409);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('still ends a membership staff granted, which has no Stripe subscription to cancel', async () => {
    prisma.subscription.findUnique.mockResolvedValue(grantedByStaff);

    const res = await request(app).patch('/api/admin/subscriptions/sub-1').send({ status: 'CANCELED' });

    expect(res.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { status: 'CANCELED' } });
  });

  it('still lets staff move a Stripe-billed membership between paid tiers or extend it', async () => {
    const res = await request(app)
      .patch('/api/admin/subscriptions/sub-1')
      .send({ tier: 'PREMIUM_PROFESSIONAL', periodEnd: '2027-01-01T00:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/subscriptions/:id/cancel', () => {
  it('cancels at the end of the period by default, at Stripe, and records the date and who did it', async () => {
    const res = await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({ reason: 'Asked by email' });

    expect(res.status).toBe(200);
    expect(stripeClient.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(stripeClient.subscriptions.update).toHaveBeenCalledWith('sub_stripe_1', { cancel_at_period_end: true });
    expect(stripeClient.subscriptions.cancel).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { cancelAtPeriodEnd: true, currentPeriodEnd: new Date('2026-11-12T00:00:00.000Z') },
    });
    expect(res.body.data).toMatchObject({ mode: 'period_end', endsAt: '2026-11-12T00:00:00.000Z', alreadyEnded: false });

    expect(audit).toHaveBeenCalledTimes(1);
    const entry = audit.mock.calls[0][0] as any;
    expect(entry).toMatchObject({ actorUserId: 'admin-1', targetUserId: 'member-1' });
    expect(entry.metadata).toMatchObject({
      adminAction: 'SUBSCRIPTION_CANCELLED_AT_STRIPE',
      subscriptionId: 'sub-1',
      mode: 'period_end',
      reason: 'Asked by email',
    });
  });

  it('ends it now only when staff say so and say why, with no final invoice and no proration', async () => {
    const res = await request(app)
      .post('/api/admin/subscriptions/sub-1/cancel')
      .send({ mode: 'now', reason: 'Refunded under the guarantee' });

    expect(res.status).toBe(200);
    expect(stripeClient.subscriptions.cancel).toHaveBeenCalledWith('sub_stripe_1', { invoice_now: false, prorate: false });
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
    // The row says what the webhook would say when Stripe confirms.
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ tier: 'FREE', status: 'CANCELED', stripeSubscriptionId: null, cancelAtPeriodEnd: false }),
    });
  });

  it('refuses to end it now without a reason', async () => {
    const res = await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({ mode: 'now' });

    expect(res.status).toBe(400);
    expect(stripeClient.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it('refuses a mode that is not one of the two, and keys it did not ask for', async () => {
    expect((await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({ mode: 'whenever' })).status).toBe(400);
    expect((await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({ tier: 'FREE' })).status).toBe(400);
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('is the same request each time: pressing it twice asks Stripe for the same thing twice and breaks nothing', async () => {
    await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({}).expect(200);
    await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({}).expect(200);

    for (const call of stripeClient.subscriptions.update.mock.calls) {
      expect(call).toEqual(['sub_stripe_1', { cancel_at_period_end: true }]);
    }
  });

  it('brings the row into line when Stripe has no live subscription left, instead of failing for ever', async () => {
    stripeClient.subscriptions.update.mockRejectedValueOnce(Object.assign(new Error('No such subscription'), { code: 'resource_missing' }));

    const res = await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({});

    expect(res.status).toBe(200);
    expect(res.body.data.alreadyEnded).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ tier: 'FREE', status: 'CANCELED' }),
    });
  });

  it('changes nothing on ATHENA’s side when Stripe refuses, and says so', async () => {
    stripeClient.subscriptions.update.mockRejectedValueOnce(new Error('stripe is down'));

    const res = await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({});

    expect(res.status).toBe(502);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('says so, and calls Stripe for nothing, when staff granted the membership', async () => {
    prisma.subscription.findUnique.mockResolvedValue(grantedByStaff);

    const res = await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({});

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toMatch(/not billed through Stripe/);
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });

  it('is a 404 for a subscription that does not exist, and a 503 when Stripe is not configured here', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    expect((await request(app).post('/api/admin/subscriptions/nope/cancel').send({})).status).toBe(404);

    prisma.subscription.findUnique.mockResolvedValue(stripeBacked);
    stripeConfigured = false;
    expect((await request(app).post('/api/admin/subscriptions/sub-1/cancel').send({})).status).toBe(503);
  });
});

describe('POST /api/admin/subscriptions/:id/refund', () => {
  it('refunds the latest paid invoice in full, once, and credits the ATHENA invoice for it', async () => {
    const res = await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' });

    expect(res.status).toBe(200);
    expect(stripeClient.invoices.list).toHaveBeenCalledWith({ subscription: 'sub_stripe_1', status: 'paid', limit: 1 });
    expect(stripeClient.refunds.create).toHaveBeenCalledTimes(1);
    const [params, options] = stripeClient.refunds.create.mock.calls[0] as any[];
    expect(params).toMatchObject({ payment_intent: 'pi_membership', reason: 'requested_by_customer' });
    expect(params.metadata).toMatchObject({ athenaSubscriptionId: 'sub-1', athenaReason: 'Inside the 30 days' });
    // Derived from the invoice, so a second press is the same refund.
    expect(options).toEqual({ idempotencyKey: 'membership-refund-in_latest' });

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-1', paidAt: new Date(1_760_000_100 * 1000) },
      select: { id: true, invoiceNumber: true },
    });
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', status: 'PAID', creditedAmount: 0 },
      data: expect.objectContaining({ status: 'CANCELLED', creditedAmount: 29 }),
    });
    expect(res.body.data).toMatchObject({ status: 'refunded', amount: 29, currency: 'AUD', refundId: 're_1', invoiceNumber: 'INV-202610-00001' });
  });

  it('writes the refund to the audit log with the amount, the invoice and the reason', async () => {
    await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' }).expect(200);

    const entry = audit.mock.calls[0][0] as any;
    expect(entry).toMatchObject({ actorUserId: 'admin-1', targetUserId: 'member-1' });
    expect(entry.metadata).toMatchObject({
      adminAction: 'SUBSCRIPTION_PAYMENT_REFUNDED',
      stripeInvoiceId: 'in_latest',
      refundId: 're_1',
      amount: 29,
      outcome: 'refunded',
      reason: 'Inside the 30 days',
    });
  });

  it('treats a charge Stripe says was already refunded as done, and still brings the invoice into line', async () => {
    stripeClient.refunds.create.mockRejectedValueOnce(Object.assign(new Error('already refunded'), { code: 'charge_already_refunded' }));

    const res = await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Retry after a failed write' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'already_refunded', refundId: null });
    expect(prisma.invoice.updateMany).toHaveBeenCalled();
  });

  it('does not credit an invoice that is already credited, such as one the refund webhook got to first', async () => {
    prisma.invoice.updateMany.mockResolvedValueOnce({ count: 0 });

    await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' }).expect(200);

    // The guard is in the write itself: only a PAID invoice with nothing credited yet.
    expect(prisma.invoice.updateMany.mock.calls[0][0].where).toEqual({ id: 'inv-1', status: 'PAID', creditedAmount: 0 });
  });

  it('needs a reason, and nothing else', async () => {
    expect((await request(app).post('/api/admin/subscriptions/sub-1/refund').send({})).status).toBe(400);
    expect((await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days', amount: 1 })).status).toBe(400);
    expect(stripeClient.refunds.create).not.toHaveBeenCalled();
  });

  it('refuses when nothing has been paid, as in a trial, and refunds nothing', async () => {
    stripeClient.invoices.list.mockResolvedValueOnce({ data: [] });
    const none = await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' });
    expect(none.status).toBe(409);

    stripeClient.invoices.list.mockResolvedValueOnce({ data: [{ id: 'in_trial', amount_paid: 0, currency: 'aud', created: 1 }] });
    const free = await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' });
    expect(free.status).toBe(409);

    expect(stripeClient.refunds.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('changes nothing and records nothing when Stripe refuses for any other reason', async () => {
    stripeClient.refunds.create.mockRejectedValueOnce(new Error('insufficient funds'));

    const res = await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' });

    expect(res.status).toBe(502);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('finds the invoice by customer when the subscription has already ended', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ ...stripeBacked, stripeSubscriptionId: null });

    await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' }).expect(200);

    expect(stripeClient.invoices.list).toHaveBeenCalledWith({ customer: 'cus_1', status: 'paid', limit: 1 });
  });

  it('refuses a membership that was never billed through Stripe', async () => {
    prisma.subscription.findUnique.mockResolvedValue(grantedByStaff);

    const res = await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' });

    expect(res.status).toBe(409);
    expect(stripeClient.invoices.list).not.toHaveBeenCalled();
  });

  it('does not end the membership: a refund is not always the member leaving', async () => {
    await request(app).post('/api/admin/subscriptions/sub-1/refund').send({ reason: 'Inside the 30 days' }).expect(200);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(stripeClient.subscriptions.cancel).not.toHaveBeenCalled();
    expect(stripeClient.subscriptions.update).not.toHaveBeenCalled();
  });
});
