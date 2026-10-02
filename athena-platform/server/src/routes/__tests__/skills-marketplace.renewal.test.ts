/**
 * An order whose hold on the buyer's card has run out must not leave the
 * provider delivering for nothing.
 *
 * A card hold lasts about a week and a package can promise longer. These are the
 * order routes' half of that: the provider cannot hand work over against a hold
 * that is not there (and the buyer is asked, there and then, to renew it), the
 * buyer who approves a delivery after the hold has gone is told how to put it
 * right instead of being handed a payment error, and the buyer has a route to
 * start a fresh hold. The renewal itself is tested in
 * services/__tests__/escrow-renewal.service.test.ts.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    skillService: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    serviceOrder: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock('../../services/stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(),
  captureEscrowPayment: jest.fn(async () => ({ status: 'captured', amountCaptured: 12000 })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
  getEscrowClientSecret: jest.fn(async () => 'pi_1_secret'),
  stripeConnectService: {},
}));

jest.mock('../../services/escrow-renewal.service', () => {
  const actual: any = jest.requireActual('../../services/escrow-renewal.service');
  return { ...actual, startOrderReauthorisation: jest.fn(), askBuyerToRenew: jest.fn(async () => true) };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'buyer', role: 'USER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { ApiError } from '../../middleware/errorHandler';
import { resetMemoryRateLimits } from '../../middleware/rateLimiter';
import { captureEscrowPayment } from '../../services/stripe-connect.service';
import { askBuyerToRenew, startOrderReauthorisation } from '../../services/escrow-renewal.service';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });
const DAY = 24 * 60 * 60 * 1000;

const orderRow = (status: string, escrowStatus: string, escrow: Record<string, unknown> = {}) => ({
  id: 'o1',
  serviceId: 's1',
  clientId: 'buyer',
  status,
  packageName: 'Standard',
  deliveryDays: 14,
  dueAt: null,
  attachments: [],
  totalAmount: 120,
  service: { id: 's1', title: 'Logo and brand kit', providerId: 'seller' },
  client: { id: 'buyer', displayName: 'Buyer', avatar: null },
  escrow: {
    id: 'e1',
    status: escrowStatus,
    amount: 12000,
    currency: 'aud',
    paymentIntentId: 'pi_1',
    capturedAt: null,
    canceledAt: null,
    createdAt: new Date(Date.now() - 3 * DAY),
    metadata: { serviceId: 's1', captureBefore: new Date(Date.now() + 4 * DAY).toISOString() },
    ...escrow,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  resetMemoryRateLimits();
});

describe('The provider cannot deliver against a hold that has ended', () => {
  it.each(['CANCELED', 'FAILED'])('refuses, and asks the buyer to renew, when the hold is %s', async (escrowStatus) => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('ACCEPTED', escrowStatus));

    const res = await request(app).post('/api/skills-marketplace/orders/o1/deliver').set(as('seller')).send({ message: 'Done' }).expect(409);

    expect(res.body.message).toMatch(/hold on the buyer.s card has ended/i);
    expect(res.body.message).toMatch(/asked the buyer to renew/i);
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
    // The sentence is true because the buyer is asked now.
    expect(askBuyerToRenew).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1', clientId: 'buyer' }), 'provider_waiting');
  });

  it('lets her deliver while the hold stands', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('ACCEPTED', 'AUTHORIZED'));

    await request(app).post('/api/skills-marketplace/orders/o1/deliver').set(as('seller')).send({ message: 'Done' }).expect(200);

    expect(prisma.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'DELIVERED' });
    expect(askBuyerToRenew).not.toHaveBeenCalled();
  });

  it('delivers a revision against a live hold the same way', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('REVISION_REQUESTED', 'AUTHORIZED'));

    await request(app).post('/api/skills-marketplace/orders/o1/deliver').set(as('seller')).send({}).expect(200);
  });
});

describe('The buyer approving a delivery after the hold has gone', () => {
  it('is told to renew it, and nothing is captured or marked complete', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED', 'CANCELED'));

    const res = await request(app).post('/api/skills-marketplace/orders/o1/complete').set(as('buyer')).expect(409);

    expect(res.body.message).toMatch(/renew it from this page/i);
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('still releases a hold that stands', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED', 'AUTHORIZED'));

    await request(app).post('/api/skills-marketplace/orders/o1/complete').set(as('buyer')).expect(200);

    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'buyer', role: 'USER' });
  });
});

describe('POST /orders/:id/payment/renew', () => {
  it('starts a fresh hold for the buyer and hands back the card step, with nothing taken', async () => {
    (startOrderReauthorisation as any).mockResolvedValue({
      escrowId: 'e2',
      paymentIntentId: 'pi_2',
      clientSecret: 'pi_2_secret',
      amount: 12000,
      platformFee: 1800,
      currency: 'AUD',
      resumed: false,
    });

    const res = await request(app).post('/api/skills-marketplace/orders/o1/payment/renew').set(as('buyer')).expect(201);

    expect(startOrderReauthorisation).toHaveBeenCalledWith('o1', 'buyer');
    expect(res.body.data).toMatchObject({ status: 'PENDING', clientSecret: 'pi_2_secret', amount: 12000, resumed: false });
  });

  it('answers 200, not 201, when it hands back a card step already begun', async () => {
    (startOrderReauthorisation as any).mockResolvedValue({
      escrowId: 'e2',
      paymentIntentId: 'pi_2',
      clientSecret: 'pi_2_secret',
      amount: 12000,
      platformFee: 1800,
      currency: 'AUD',
      resumed: true,
    });

    await request(app).post('/api/skills-marketplace/orders/o1/payment/renew').set(as('buyer')).expect(200);
  });

  it('passes on what the service says about why it cannot', async () => {
    (startOrderReauthorisation as any).mockRejectedValue(new ApiError(409, 'The hold on your card is still good until Friday.'));

    const res = await request(app).post('/api/skills-marketplace/orders/o1/payment/renew').set(as('buyer')).expect(409);

    expect(res.body.message).toMatch(/still good until Friday/);
  });

  it('is behind the same ceiling as any other route that starts a payment', async () => {
    (startOrderReauthorisation as any).mockResolvedValue({
      escrowId: 'e2', paymentIntentId: 'pi_2', clientSecret: 's', amount: 1, platformFee: 0, currency: 'AUD', resumed: false,
    });
    let last = 0;
    for (let i = 0; i < 13; i += 1) {
      last = (await request(app).post('/api/skills-marketplace/orders/o1/payment/renew').set(as('buyer'))).status;
    }

    expect(last).toBe(429);
  });

  it('turns a stranger away with the same answer an unknown order gets', async () => {
    (startOrderReauthorisation as any).mockRejectedValue(new ApiError(404, 'Order not found'));

    await request(app).post('/api/skills-marketplace/orders/o1/payment/renew').set(as('stranger')).expect(404);
  });
});

describe('What the buyer is shown about the hold', () => {
  it('GET /orders/:id carries the hold’s deadline and whether it can be renewed, and not its metadata', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(
      orderRow('ACCEPTED', 'AUTHORIZED', { createdAt: new Date(Date.now() - 6 * DAY), metadata: { serviceId: 's1' } })
    );

    const res = await request(app).get('/api/skills-marketplace/orders/o1').set(as('buyer')).expect(200);

    expect(res.body.data.hold).toMatchObject({ canRenew: true, lapsed: false });
    expect(typeof res.body.data.hold.lapsesAt).toBe('string');
    expect(res.body.data.escrow.metadata).toBeUndefined();
    expect(res.body.data.escrow.status).toBe('AUTHORIZED');
  });

  it('says a hold with days left cannot be renewed yet', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(
      orderRow('ACCEPTED', 'AUTHORIZED', { createdAt: new Date(Date.now() - 1 * DAY), metadata: {} })
    );

    const res = await request(app).get('/api/skills-marketplace/orders/o1').set(as('buyer')).expect(200);

    expect(res.body.data.hold.canRenew).toBe(false);
  });

  it('calls a hold that ran out under a live order lapsed', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED', 'CANCELED'));

    const res = await request(app).get('/api/skills-marketplace/orders/o1').set(as('seller')).expect(200);

    expect(res.body.data.hold).toEqual({ lapsesAt: null, canRenew: true, lapsed: true });
  });

  it('GET /orders/:id/payment carries the same answer for the buyer', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('ACCEPTED', 'CANCELED'));

    const res = await request(app).get('/api/skills-marketplace/orders/o1/payment').set(as('buyer')).expect(200);

    expect(res.body.data).toMatchObject({ status: 'CANCELED', clientSecret: null, canRenew: true, lapsed: true });
  });
});
