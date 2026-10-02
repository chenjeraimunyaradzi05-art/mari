/**
 * The Connect routes a buyer and a seller use besides the withdrawal: the
 * generic escrow route, the holds screen behind it, and the earnings statement,
 * CSV and date range that replaced three controls on the earnings screen that
 * did nothing.
 *
 * The generic escrow route passed its body straight through: `sessionType`
 * could name any flow, and `metadata` went into the Stripe intent where the
 * webhook reads `type` and `sessionId` as the truth about what was paid for. Its
 * capture and cancel routes would move any hold, including one an order or a
 * car purchase owned. These tests pin the doors shut.
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    escrowPayment: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
    },
    mentorSession: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
  },
}));

let currentUser = { id: 'buyer-1', role: 'USER', email: 'bea@example.com', twoFactorEnabled: false };
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

jest.mock('../../services/stripe-connect.service', () => {
  const actual: any = jest.requireActual('../../services/stripe-connect.service');
  return {
    ...actual,
    stripeConnectService: {
      ...actual.stripeConnectService,
      createEscrowPayment: jest.fn(async () => ({ escrowId: 'escrow-9', paymentIntentId: 'pi_9', clientSecret: 's', amount: 5000, platformFee: 750 })),
      captureEscrowPayment: jest.fn(async () => ({ status: 'succeeded', amountCaptured: 5000 })),
      cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import connectRoutes from '../connect.routes';
import { prisma as prismaTyped } from '../../utils/prisma';
import { stripeConnectService } from '../../services/stripe-connect.service';

const prisma: any = prismaTyped;
const service: any = stripeConnectService;

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/connect', connectRoutes);
  server.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message });
  });
  return server;
}

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = { id: 'buyer-1', role: 'USER', email: 'bea@example.com', twoFactorEnabled: false };
  prisma.escrowPayment.findMany.mockResolvedValue([]);
  prisma.escrowPayment.findFirst.mockResolvedValue(null);
  prisma.mentorSession.findUnique.mockResolvedValue(null);
  prisma.mentorSession.findMany.mockResolvedValue([]);
});

describe('POST /api/connect/escrow', () => {
  const valid = { recipientId: 'seller-1', amount: 5000, description: 'Pottery course', sessionType: 'course_purchase' };

  it('makes a generic hold and carries a reference, and nothing else, into the intent', async () => {
    const res = await request(app())
      .post('/api/connect/escrow')
      .send({ ...valid, reference: 'Term 3', metadata: { type: 'business_formation', registrationId: 'reg-1' } });

    expect(res.status).toBe(200);
    const [input] = service.createEscrowPayment.mock.calls[0];
    expect(input).toMatchObject({ buyerId: 'buyer-1', sellerId: 'seller-1', amount: 5000, currency: 'aud' });
    // The webhook reads `type` and `registrationId` as what was paid for, so a
    // body that could set them could mark somebody's registration as paid.
    expect(input.metadata).toEqual({ reference: 'Term 3' });
  });

  it('refuses to make a hold that claims to be a mentor session, an order or a car payment, or names nothing', async () => {
    for (const sessionType of ['mentor_session', 'service_order', 'vehicle_purchase', undefined]) {
      const res = await request(app()).post('/api/connect/escrow').send({ ...valid, sessionType });
      expect(res.status).toBe(400);
    }
    expect(service.createEscrowPayment).not.toHaveBeenCalled();
  });

  it('refuses an amount that is not a whole number of cents, and a payment to herself', async () => {
    for (const body of [
      { ...valid, amount: 50.5 },
      { ...valid, amount: '5000' },
      { ...valid, amount: -1 },
      { ...valid, recipientId: 'buyer-1' },
    ]) {
      const res = await request(app()).post('/api/connect/escrow').send(body);
      expect(res.status).toBe(400);
    }
    expect(service.createEscrowPayment).not.toHaveBeenCalled();
  });
});

describe('Moving a hold through the generic routes', () => {
  const heldRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'escrow-1',
    paymentIntentId: 'pi_1',
    sessionType: 'course_purchase',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    serviceOrder: null,
    vehiclePurchase: null,
    vehicleInspection: null,
    mechanicBooking: null,
    ...overrides,
  });

  it('lets the buyer release a hold no flow owns', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(heldRow());

    const res = await request(app()).post('/api/connect/escrow/pi_1/capture');

    expect(res.status).toBe(200);
    expect(service.captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'buyer-1', role: 'USER' });
  });

  it('sends a member to the order or purchase a hold belongs to instead of moving it here', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(
      heldRow({ sessionType: 'vehicle_purchase', vehiclePurchase: { id: 'purchase-1' } })
    );

    const release = await request(app()).post('/api/connect/escrow/pi_1/capture');
    const cancel = await request(app()).post('/api/connect/escrow/pi_1/cancel');

    expect(release.status).toBe(409);
    expect(cancel.status).toBe(409);
    expect(service.captureEscrowPayment).not.toHaveBeenCalled();
    expect(service.cancelEscrowPayment).not.toHaveBeenCalled();
  });

  it('treats a mentor session found by its intent as the session’s to move', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(heldRow({ sessionType: null }));
    prisma.mentorSession.findUnique.mockResolvedValue({ id: 'session-1' });

    const res = await request(app()).post('/api/connect/escrow/pi_1/cancel');

    expect(res.status).toBe(409);
  });

  it('lets an orphaned hold be given back to the buyer but never released to anyone', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(heldRow({ sessionType: 'service_order' }));

    const release = await request(app()).post('/api/connect/escrow/pi_1/capture');
    const cancel = await request(app()).post('/api/connect/escrow/pi_1/cancel');

    expect(release.status).toBe(409);
    expect(cancel.status).toBe(200);
  });

  it('gives a stranger the same 404 as an unknown hold', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue(heldRow({ buyerId: 'someone', sellerId: 'else' }));

    const res = await request(app()).post('/api/connect/escrow/pi_1/cancel');

    expect(res.status).toBe(404);
  });

  it('lets an admin move any hold', async () => {
    currentUser = { id: 'admin-1', role: 'ADMIN', email: 'ops@example.com', twoFactorEnabled: true };
    prisma.escrowPayment.findUnique.mockResolvedValue(heldRow({ vehiclePurchase: { id: 'purchase-1' } }));

    const res = await request(app()).post('/api/connect/escrow/pi_1/capture');

    expect(res.status).toBe(200);
  });
});

describe('GET /api/connect/holds', () => {
  it('lists her holds with where each is released from', async () => {
    const created = new Date('2026-09-15T00:00:00.000Z');
    prisma.escrowPayment.findMany.mockResolvedValue([
      {
        id: 'escrow-generic',
        paymentIntentId: 'pi_g',
        sessionType: 'course_purchase',
        serviceOrder: null,
        vehiclePurchase: null,
        vehicleInspection: null,
        mechanicBooking: null,
        amount: 5000,
        currency: 'aud',
        status: 'AUTHORIZED',
        description: 'Pottery course',
        createdAt: created,
        seller: { displayName: null, firstName: 'Rosa', lastName: 'Nguyen' },
      },
      {
        id: 'escrow-order',
        paymentIntentId: 'pi_o',
        sessionType: 'service_order',
        serviceOrder: { id: 'order-7' },
        vehiclePurchase: null,
        vehicleInspection: null,
        mechanicBooking: null,
        amount: 12000,
        currency: 'aud',
        status: 'AUTHORIZED',
        description: 'Logo design',
        createdAt: created,
        seller: { displayName: 'Studio June', firstName: 'June', lastName: 'Ali' },
      },
    ]);

    const res = await request(app()).get('/api/connect/holds');

    expect(res.status).toBe(200);
    const [generic, order] = res.body.data;
    expect(generic).toMatchObject({
      payee: 'Rosa N.',
      owner: { kind: 'generic' },
      canRelease: true,
      canCancel: true,
      lapsesAt: '2026-09-22T00:00:00.000Z',
    });
    expect(order).toMatchObject({
      payee: 'Studio June',
      owner: { kind: 'flow', href: '/skills-marketplace/orders/order-7' },
      canRelease: false,
      canCancel: false,
    });
  });
});

describe('The earnings statement', () => {
  // 30 June 2026 11pm Queensland time is 13:00 UTC: still the 2025-26 year.
  const lateJune = new Date('2026-06-30T13:00:00.000Z');

  beforeEach(() => {
    currentUser = { id: 'seller-1', role: 'USER', email: 'sel@example.com', twoFactorEnabled: false };
    prisma.escrowPayment.findFirst.mockResolvedValue({ capturedAt: new Date('2025-08-01T00:00:00.000Z') });
    prisma.escrowPayment.findMany.mockResolvedValue([
      {
        id: 'escrow-a',
        amount: 20000,
        platformFee: 3000,
        currency: 'aud',
        status: 'CAPTURED',
        description: '=HYPERLINK("http://evil.example")',
        sessionType: 'service_order',
        capturedAt: lateJune,
      },
      {
        id: 'escrow-b',
        amount: 10000,
        platformFee: 1500,
        currency: 'aud',
        status: 'REFUNDED',
        description: 'Mentor session s-1',
        sessionType: 'mentor_session',
        capturedAt: lateJune,
      },
    ]);
  });

  it('counts the year on Queensland time and keeps refunds out of the totals', async () => {
    const res = await request(app()).get('/api/connect/earnings/statement?fy=2026');

    expect(res.status).toBe(200);
    const where = prisma.escrowPayment.findMany.mock.calls[0][0].where;
    expect(where.sellerId).toBe('seller-1');
    // Midnight on 1 July 2025 in Brisbane, to midnight on 1 July 2026.
    expect(where.capturedAt).toEqual({
      gte: new Date('2025-06-30T14:00:00.000Z'),
      lt: new Date('2026-06-30T14:00:00.000Z'),
    });
    // Not registered for GST in this environment, so no GST is inside the fee
    // and the statement says so, rather than leaving the figure out.
    expect(res.body.data.totals).toEqual([
      { currency: 'AUD', count: 1, gross: 20000, fee: 3000, feeGst: 0, net: 17000, refundedCount: 1, refundedNet: 8500 },
    ]);
    expect(res.body.data.gstRegistered).toBe(false);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  describe('once ATHENA is registered for GST', () => {
    const saved = { abn: process.env.ATHENA_ABN, from: process.env.ATHENA_GST_REGISTERED_FROM };
    const setRegistration = (from: string | undefined) => {
      process.env.ATHENA_ABN = '51824753556';
      if (from === undefined) delete process.env.ATHENA_GST_REGISTERED_FROM;
      else process.env.ATHENA_GST_REGISTERED_FROM = from;
    };

    afterEach(() => {
      if (saved.abn === undefined) delete process.env.ATHENA_ABN;
      else process.env.ATHENA_ABN = saved.abn;
      if (saved.from === undefined) delete process.env.ATHENA_GST_REGISTERED_FROM;
      else process.env.ATHENA_GST_REGISTERED_FROM = saved.from;
    });

    it('shows the GST inside the fee as one eleventh of it, on each line and in the totals, and gives the CSV a column for it', async () => {
      setRegistration('2020-01-01');

      const json = await request(app()).get('/api/connect/earnings/statement?fy=2026');
      expect(json.status).toBe(200);
      expect(json.body.data.gstRegistered).toBe(true);
      // A$30.00 fee: one eleventh is A$2.73, in cents, rounded to the cent.
      expect(json.body.data.lines[0]).toMatchObject({ fee: 3000, feeGst: 273, net: 17000 });
      // The refunded line carries its own figure but is not in the totals.
      expect(json.body.data.lines[1]).toMatchObject({ status: 'REFUNDED', feeGst: 136 });
      expect(json.body.data.totals).toEqual([
        { currency: 'AUD', count: 1, gross: 20000, fee: 3000, feeGst: 273, net: 17000, refundedCount: 1, refundedNet: 8500 },
      ]);

      const csv = await request(app()).get('/api/connect/earnings/statement?fy=2026&format=csv');
      expect(csv.text).toContain('ATHENA fee,GST in ATHENA fee,Paid to you');
      expect(csv.text).toContain('200.00,30.00,2.73,170.00,Released');
      expect(csv.text).toMatch(/one eleventh of the fee/);
    });

    it('puts no GST in the fee of a payment released before the registration took effect', async () => {
      // Registered from the day after these payments were released.
      setRegistration('2026-07-01');

      const json = await request(app()).get('/api/connect/earnings/statement?fy=2026');
      expect(json.status).toBe(200);
      expect(json.body.data.lines[0]).toMatchObject({ fee: 3000, feeGst: 0 });
      expect(json.body.data.totals[0]).toMatchObject({ feeGst: 0 });

      const csv = await request(app()).get('/api/connect/earnings/statement?fy=2026&format=csv');
      expect(csv.text).toContain('200.00,30.00,0.00,170.00,Released');
    });
  });

  it('downloads as a CSV a spreadsheet cannot be made to run', async () => {
    const res = await request(app()).get('/api/connect/earnings/statement?fy=2026&format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('athena-earnings-FY2025-26.csv');
    expect(res.text).toContain('Date released (Queensland),Reference,Type,Description');
    // Neutralised with a leading apostrophe, then quoted for its own quotes.
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    expect(res.text).toContain('2026-06-30,escrow-a,Marketplace order');
    expect(res.text).toContain('200.00,30.00,170.00,Released');
    expect(res.text).toMatch(/not a tax invoice and not tax advice/);
  });

  it('says when a released sale was refunded in part, instead of reading as a sale that stood or one that was lost', async () => {
    prisma.escrowPayment.findMany.mockResolvedValue([
      {
        id: 'escrow-p',
        amount: 24000,
        platformFee: 3600,
        currency: 'aud',
        status: 'CAPTURED',
        description: 'Pitch review (120 minute booking)',
        sessionType: 'service_booking',
        capturedAt: lateJune,
        // A$10 of the A$240, as Stripe reports it.
        refundedAmount: 1000,
      },
    ]);

    const json = await request(app()).get('/api/connect/earnings/statement?fy=2026');
    expect(json.body.data.lines[0]).toMatchObject({ kind: 'Marketplace booking', status: 'RELEASED', gross: 24000, refunded: 1000 });
    // Still a released sale: it is in the totals, and the line is what says part came back.
    expect(json.body.data.totals[0]).toMatchObject({ count: 1, gross: 24000, refundedCount: 0 });

    const csv = await request(app()).get('/api/connect/earnings/statement?fy=2026&format=csv');
    expect(csv.text).toContain('Released; 10.00 of it refunded to the buyer');
    expect(csv.text).toContain('1 payment(s) released and not refunded in full');
  });

  it('labels a proposal a buyer accepted on a brief as a marketplace request', async () => {
    prisma.escrowPayment.findMany.mockResolvedValue([
      {
        id: 'escrow-q',
        amount: 90000,
        platformFee: 13500,
        currency: 'aud',
        status: 'CAPTURED',
        description: null,
        sessionType: 'custom_request',
        capturedAt: lateJune,
        refundedAmount: 0,
      },
    ]);

    const res = await request(app()).get('/api/connect/earnings/statement?fy=2026');

    expect(res.body.data.lines[0]).toMatchObject({ kind: 'Marketplace request', description: 'Marketplace request', refunded: 0 });
  });

  it('refuses a year that has not started', async () => {
    const res = await request(app()).get('/api/connect/earnings/statement?fy=2099');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/connect/earnings/transactions', () => {
  it('reads a range of Queensland days, both ends included', async () => {
    currentUser = { id: 'seller-1', role: 'USER', email: 'sel@example.com', twoFactorEnabled: false };

    const res = await request(app()).get('/api/connect/earnings/transactions?from=2026-07-01&to=2026-07-31');

    expect(res.status).toBe(200);
    const args = prisma.escrowPayment.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      sellerId: 'seller-1',
      createdAt: { gte: new Date('2026-06-30T14:00:00.000Z'), lt: new Date('2026-07-31T14:00:00.000Z') },
    });
    expect(res.body.data).toEqual({ transactions: [], nextCursor: null });
  });

  it('refuses a date that is not one', async () => {
    for (const query of ['from=2026-02-30', 'from=yesterday', 'from=2026-08-01&to=2026-07-01']) {
      const res = await request(app()).get(`/api/connect/earnings/transactions?${query}`);
      expect(res.status).toBe(400);
    }
  });
});
