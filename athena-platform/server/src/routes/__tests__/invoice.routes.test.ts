import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    payment: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn() },
    invoice: {
      findFirst: jest.fn(),
      count: jest.fn(async () => 0),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Only authenticate is replaced, so requireRole really refuses a member.
let currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

const stripeClient = { invoices: { list: jest.fn(async (..._args: any[]): Promise<any> => ({ data: [] })) } };
jest.mock('../../utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => stripeClient,
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const decimal = (value: number) => ({ toNumber: () => value });

function stubPayment() {
  prisma.payment.findUnique.mockResolvedValue({
    id: 'pay-1',
    userId: 'member-1',
    amount: decimal(120),
    currency: 'AUD',
    status: 'COMPLETED',
    method: 'card',
    type: 'MENTOR_SESSION',
    stripePaymentIntentId: 'pi_1',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    user: { displayName: 'Mei Chen', email: 'mei@example.com', city: 'Brisbane', state: 'QLD', country: 'Australia' },
  });
}

/** The row prisma.invoice.create answers with, echoing what was written. */
function answerCreate() {
  prisma.invoice.create.mockImplementation(async ({ data }: any) => ({ id: 'inv-row-1', ...data }));
}

describe('POST /api/invoices/payment/:paymentId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.findFirst.mockResolvedValue(null);
    answerCreate();
  });

  it('issues one invoice for a payment, numbered and paid', async () => {
    stubPayment();

    const res = await request(app).post('/api/invoices/payment/pay-1').send({}).expect(200);

    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    const written = prisma.invoice.create.mock.calls[0][0].data;
    expect(written).toMatchObject({ userId: 'member-1', paymentId: 'pay-1', currency: 'AUD', status: 'PAID' });
    expect(written.invoiceNumber).toMatch(/^INV-\d{6}-\d{5}$/);
    expect(res.body.data).toMatchObject({ invoiceId: 'inv-row-1', invoiceNumber: written.invoiceNumber, alreadyIssued: false });
  });

  it('is idempotent: a second issue returns the invoice already filed', async () => {
    stubPayment();
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-existing', invoiceNumber: 'INV-202609-00001', status: 'PAID' });

    const res = await request(app).post('/api/invoices/payment/pay-1').send({}).expect(200);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({ where: { paymentId: 'pay-1' } });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(res.body.data).toEqual({ invoiceId: 'inv-existing', invoiceNumber: 'INV-202609-00001', alreadyIssued: true });
  });

  it('says so when the payment does not exist', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    await request(app).post('/api/invoices/payment/pay-missing').send({}).expect(404);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('refuses a member', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member@example.com', twoFactorEnabled: false };
    stubPayment();

    await request(app).post('/api/invoices/payment/pay-1').send({}).expect(403);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/invoices/subscription/:subscriptionId', () => {
  const paidStripeInvoice = {
    id: 'in_1',
    amount_paid: 2900,
    currency: 'aud',
    created: 1_760_000_000,
    status: 'paid',
    status_transitions: { paid_at: 1_760_000_100 },
    lines: { data: [{ period: { start: 1_760_000_000, end: 1_762_592_000 } }] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.findFirst.mockResolvedValue(null);
    answerCreate();
    prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-db-1',
      userId: 'member-1',
      tier: 'PREMIUM_CAREER',
      stripeSubscriptionId: 'sub_1',
      user: { displayName: 'Mei Chen', email: 'mei@example.com' },
    });
  });

  it('files the latest paid Stripe invoice with the amount Stripe took', async () => {
    stripeClient.invoices.list.mockResolvedValue({ data: [paidStripeInvoice] });

    const res = await request(app).post('/api/invoices/subscription/sub-db-1').send({}).expect(200);

    expect(stripeClient.invoices.list).toHaveBeenCalledWith({ subscription: 'sub_1', status: 'paid', limit: 1 });
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.create.mock.calls[0][0].data).toMatchObject({
      userId: 'member-1',
      subscriptionId: 'sub-db-1',
      amount: 29,
      currency: 'AUD',
      status: 'PAID',
      paidAt: new Date(1_760_000_100 * 1000),
    });
    expect(res.body.data.alreadyIssued).toBe(false);
  });

  it('returns the invoice already filed for that Stripe invoice', async () => {
    stripeClient.invoices.list.mockResolvedValue({ data: [paidStripeInvoice] });
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-existing', invoiceNumber: 'INV-202609-00002', status: 'PAID' });

    const res = await request(app).post('/api/invoices/subscription/sub-db-1').send({}).expect(200);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-db-1', paidAt: new Date(1_760_000_100 * 1000) },
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(res.body.data).toMatchObject({ invoiceNumber: 'INV-202609-00002', alreadyIssued: true });
  });

  it('a membership staff granted has nothing to invoice', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub-db-2', userId: 'member-2', tier: 'PRO', stripeSubscriptionId: null });

    const res = await request(app).post('/api/invoices/subscription/sub-db-2').send({}).expect(409);

    expect(res.body.message).toMatch(/granted by staff/);
    expect(stripeClient.invoices.list).not.toHaveBeenCalled();
  });

  it('refuses a member', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'member@example.com', twoFactorEnabled: false };
    await request(app).post('/api/invoices/subscription/sub-db-1').send({}).expect(403);
  });
});
