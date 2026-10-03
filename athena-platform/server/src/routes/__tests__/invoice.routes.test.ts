import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

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
import { invoiceService } from '../../services/invoice.service';

const prisma: any = prismaTyped;

const decimal = (value: number) => ({ toNumber: () => value });

// Who ATHENA is on a document. None of the four has a default, and an invoice is
// emailed or downloaded only when all four are set, so the tests that need a
// document set them and the ones about their absence clear them.
const BILLING_KEYS = ['ATHENA_LEGAL_NAME', 'ATHENA_ABN', 'ATHENA_BILLING_ADDRESS', 'ATHENA_BILLING_EMAIL'] as const;
const savedBilling = Object.fromEntries(BILLING_KEYS.map((key) => [key, process.env[key]]));

function setBilling(configured: boolean) {
  const values: Record<string, string> = {
    ATHENA_LEGAL_NAME: 'Example Trading Pty Ltd',
    ATHENA_ABN: '51824753556',
    ATHENA_BILLING_ADDRESS: 'Level 3, 100 Queen St|Brisbane QLD 4000',
    ATHENA_BILLING_EMAIL: 'billing@mail.example-trading.org',
  };
  for (const key of BILLING_KEYS) {
    if (configured) process.env[key] = values[key];
    else delete process.env[key];
  }
}

afterAll(() => {
  for (const key of BILLING_KEYS) {
    const saved = savedBilling[key];
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
  }
});

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
    setBilling(true);
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

describe('GET /api/invoices/:invoiceId', () => {
  const stored = {
    id: 'inv-row-1',
    invoiceNumber: 'INV-202609-00001',
    userId: 'member-1',
    amount: decimal(120),
    currency: 'AUD',
    status: 'PAID',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.invoice.findUnique.mockImplementation(async ({ where }: any) => (where.id === 'inv-row-1' ? stored : null));
  });

  it('hands a member her own invoice', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
    const res = await request(app).get('/api/invoices/inv-row-1').expect(200);
    expect(res.body.data.invoiceNumber).toBe('INV-202609-00001');
  });

  it('answers another member exactly as it answers an invoice that does not exist', async () => {
    currentUser = { id: 'member-2', role: 'USER', email: 'bea@example.com', twoFactorEnabled: false };

    const stranger = await request(app).get('/api/invoices/inv-row-1').expect(404);
    const missing = await request(app).get('/api/invoices/inv-nobody').expect(404);

    // A 403 here confirmed that the number was real.
    expect(stranger.body.message).toBe(missing.body.message);
    expect(JSON.stringify(stranger.body)).not.toContain('INV-202609-00001');
  });

  it('will not render someone else’s invoice as a PDF either', async () => {
    currentUser = { id: 'member-2', role: 'USER', email: 'bea@example.com', twoFactorEnabled: false };
    const res = await request(app).get('/api/invoices/inv-row-1/pdf').expect(404);
    expect(res.headers['content-type']).not.toMatch(/pdf/);
    // The invoice is read to be judged, never to be rendered for a stranger.
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  // A refunded sale kept a PAID tax invoice: nothing updated one. What went back is
  // recorded on the invoice, and the document that is downloaded has to say so.
  describe('the PDF of a sale that was refunded', () => {
    const render = jest.spyOn(invoiceService, 'generateInvoicePDF');

    beforeEach(() => {
      currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
      render.mockResolvedValue(Buffer.from('%PDF'));
    });

    it('carries what was credited back, and when, onto the document', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...stored,
        amount: '120',
        status: 'PAID',
        creditedAmount: '30',
        creditedAt: new Date('2026-09-10T00:00:00Z'),
        issuedAt: new Date('2026-09-01T00:00:00Z'),
      });

      await request(app).get('/api/invoices/inv-row-1/pdf').expect(200);

      const printed: any = render.mock.calls[0][0];
      expect(printed.credit).toEqual({ amount: 30, creditedAt: new Date('2026-09-10T00:00:00Z') });
      // The sale stands as it was made: the total is not reduced.
      expect(printed.total).toBe(120);
    });

    it('prints no credit for a sale nothing went back on', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...stored, amount: '120', creditedAmount: '0', issuedAt: new Date('2026-09-01T00:00:00Z') });

      await request(app).get('/api/invoices/inv-row-1/pdf').expect(200);

      expect((render.mock.calls[0][0] as any).credit).toBeUndefined();
    });
  });

  it('lets an administrator with a second factor read any member’s invoice', async () => {
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
    await request(app).get('/api/invoices/inv-row-1').expect(200);
  });

  it('refuses an administrator who has not set up a second factor, and says how to fix it', async () => {
    const previous = process.env.STAFF_TWO_FACTOR_REQUIRED;
    process.env.STAFF_TWO_FACTOR_REQUIRED = 'true';
    try {
      currentUser = { id: 'admin-2', role: 'ADMIN', email: 'admin2@athena.com', twoFactorEnabled: false };
      const res = await request(app).get('/api/invoices/inv-row-1').expect(403);
      expect(res.body.code).toBe('TWO_FACTOR_REQUIRED');
    } finally {
      if (previous === undefined) delete process.env.STAFF_TWO_FACTOR_REQUIRED;
      else process.env.STAFF_TWO_FACTOR_REQUIRED = previous;
    }
  });
});

// The invoice rows are filed as sales happen, whatever the environment holds. What
// is held back until ATHENA says who it is, is the document: a download, and an
// email that points at one. It used to print a placeholder company, address and
// mailbox instead.
describe('when ATHENA has not said who it is', () => {
  const stored = {
    id: 'inv-row-1',
    invoiceNumber: 'INV-202609-00001',
    userId: 'member-1',
    paymentId: null,
    subscriptionId: 'sub-db-1',
    subscription: { tier: 'PREMIUM_CAREER' },
    amount: '29',
    currency: 'AUD',
    status: 'PAID',
    issuedAt: new Date('2026-09-01T00:00:00Z'),
    paidAt: new Date('2026-09-01T00:00:00Z'),
    user: { displayName: 'Mei Chen', email: 'mei@example.com' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setBilling(false);
    currentUser = { id: 'member-1', role: 'USER', email: 'mei@example.com', twoFactorEnabled: false };
    prisma.invoice.findUnique.mockResolvedValue(stored);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.invoice.findFirst.mockResolvedValue(null);
    answerCreate();
    // Earlier cases in this file stub the renderer; this one needs the real one.
    const actual: any = jest.requireActual('../../services/invoice.service');
    jest.spyOn(invoiceService, 'generateInvoicePDF').mockImplementation(actual.generateInvoicePDF);
  });

  it('answers a download with a 503 and the code, and no PDF', async () => {
    const res = await request(app).get('/api/invoices/inv-row-1/pdf').expect(503);

    expect(res.headers['content-type']).not.toMatch(/pdf/);
    expect(res.body.code).toBe('BILLING_IDENTITY_NOT_CONFIGURED');
    expect(JSON.stringify(res.body)).not.toMatch(/athena.app|Platform Pty Ltd|Final billing address/);
  });

  it('downloads the same invoice as a PDF once the identity is set', async () => {
    setBilling(true);

    const res = await request(app).get('/api/invoices/inv-row-1/pdf').buffer(true).expect(200);

    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  it('says on the list whether a document can be produced yet', async () => {
    prisma.invoice.findMany.mockResolvedValue([stored]);

    const before = await request(app).get('/api/invoices').expect(200);
    setBilling(true);
    const after = await request(app).get('/api/invoices').expect(200);

    expect(before.body.documentsReady).toBe(false);
    expect(before.body.data).toHaveLength(1);
    expect(after.body.documentsReady).toBe(true);
  });

  it('files the invoice for a payment when staff re-issue it without an email', async () => {
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
    stubPayment();

    const res = await request(app).post('/api/invoices/payment/pay-1').send({}).expect(200);

    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(res.body.data).toMatchObject({ alreadyIssued: false, emailed: 'not_requested' });
  });

  it('refuses a re-issue with an email, since the link would lead to a refusal, and sends and files nothing', async () => {
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.com', twoFactorEnabled: true };
    stubPayment();

    const res = await request(app).post('/api/invoices/payment/pay-1').send({ sendEmail: true }).expect(503);

    expect(res.body.code).toBe('BILLING_IDENTITY_NOT_CONFIGURED');
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});
