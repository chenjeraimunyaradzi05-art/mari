import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    payment: { findUnique: jest.fn() },
    subscription: { findUnique: jest.fn() },
    invoice: {
      findFirst: jest.fn(),
      count: jest.fn(async () => 0),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    // Filing runs inside a transaction that first takes an advisory lock on
    // what the invoice is for. The transaction hands back the same client, so
    // the assertions below on invoice.findFirst and invoice.create still see
    // every call.
    $executeRaw: jest.fn(async () => 1),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { prisma };
});

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
  redactSensitive: (value: unknown) => value,
}));

// `sendEmail: true` used to reach a single log line reading "Invoice email
// queued" and send nothing at all, so the transport is mocked here rather than
// the service: what these tests need to prove is that something was handed to
// it, and that a transport which refuses is reported to the admin instead of
// being swallowed.
const sendEmailMock = jest.fn(async (..._args: any[]): Promise<boolean> => true);
jest.mock('../../utils/email', () => {
  const actual: any = jest.requireActual('../../utils/email');
  return { ...actual, sendEmail: (...args: any[]) => sendEmailMock(...args) };
});

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
    sendEmailMock.mockResolvedValue(true);
    answerCreate();
  });

  it('sends the member an email when one is asked for, and says it went', async () => {
    stubPayment();

    const res = await request(app)
      .post('/api/invoices/payment/pay-1')
      .send({ sendEmail: true })
      .expect(200);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sent: any = sendEmailMock.mock.calls[0][0];
    expect(sent.to).toBe('mei@example.com');
    expect(sent.subject).toContain('INV-');
    // The PDF is not attached. It is her name, her city and what she paid, and
    // the transport has no attachment support to send it safely through; the
    // link goes to the page behind her login, which re-renders it on demand.
    expect(sent.html).toContain('/dashboard/finance/invoices');
    expect(res.body.data.emailed).toBe('sent');
  });

  it('still issues the invoice when the email cannot be sent, and says it failed', async () => {
    stubPayment();
    sendEmailMock.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/invoices/payment/pay-1')
      .send({ sendEmail: true })
      .expect(200);

    // A mail server having a bad morning must not un-file a correctly issued
    // invoice — but the admin who ticked the box has to be told it did not go.
    expect(prisma.invoice.create).toHaveBeenCalled();
    expect(res.body.data.emailed).toBe('failed');
  });

  it('emails on a re-issue too, which is what a re-issue is for', async () => {
    stubPayment();
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-existing',
      invoiceNumber: 'INV-202609-00001',
      status: 'PAID',
    });

    const res = await request(app)
      .post('/api/invoices/payment/pay-1')
      .send({ sendEmail: true })
      .expect(200);

    // The send used to sit past the early return for an invoice already filed,
    // so an admin re-sending to a member who said she had not received it got a
    // 200 and the member got nothing.
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(res.body.data).toMatchObject({ alreadyIssued: true, emailed: 'sent' });
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
    expect(res.body.data).toEqual({
      invoiceId: 'inv-existing',
      invoiceNumber: 'INV-202609-00001',
      alreadyIssued: true,
      // No email was asked for, and the response says that rather than leaving
      // it to be inferred. `sendEmail: true` used to reach a log line reading
      // "Invoice email queued" and send nothing, so what the caller is told
      // about the email is now part of the contract.
      emailed: 'not_requested',
    });
  });

  it('looks for an invoice already filed only while holding the lock for that payment', async () => {
    // Invoice.paymentId has no unique index, so the webhook and an admin
    // re-issue arriving together could each find nothing and each file one:
    // two tax invoices, each showing GST, for one payment.
    stubPayment();
    const order: string[] = [];
    prisma.$executeRaw.mockImplementationOnce(async () => {
      order.push('lock');
      return 1;
    });
    prisma.invoice.findFirst.mockImplementationOnce(async () => {
      order.push('look');
      return null;
    });

    await request(app).post('/api/invoices/payment/pay-1').send({}).expect(200);

    expect(order).toEqual(['lock', 'look']);
    const [, key] = prisma.$executeRaw.mock.calls[0];
    expect(key).toBe('invoice:payment:pay-1');
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
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
