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

// The caller's id comes from a header so the same suite can be buyer or seller.
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
import {
  cancelEscrowPayment,
  captureEscrowPayment,
  createEscrowPayment,
} from '../../services/stripe-connect.service';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

const service = {
  id: 's1',
  providerId: 'seller',
  title: 'Logo and brand kit',
  isAvailable: true,
  status: 'ACTIVE',
  packages: [{ name: 'Basic', price: 120, deliveryDays: 3 }],
};

const orderRow = (status: string, escrowStatus: string) => ({
  id: 'o1',
  serviceId: 's1',
  clientId: 'buyer',
  status,
  deliveryDays: 3,
  dueAt: null,
  attachments: [],
  totalAmount: 120,
  service: { id: 's1', title: service.title, providerId: 'seller' },
  client: { id: 'buyer', displayName: 'Buyer', avatar: null },
  escrow: { id: 'e1', status: escrowStatus, amount: 12000, currency: 'aud', paymentIntentId: 'pi_1', capturedAt: null, canceledAt: null },
});

describe('Escrow-backed marketplace orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.skillService.findUnique.mockResolvedValue(service);
  });

  it('placing an order holds the money on the card and hands back the client secret', async () => {
    (createEscrowPayment as any).mockResolvedValue({
      escrowId: 'e1',
      paymentIntentId: 'pi_1',
      clientSecret: 'pi_1_secret',
      amount: 12000,
      platformFee: 1800,
    });
    prisma.serviceOrder.create.mockImplementation(async ({ data }: any) => ({ id: 'o1', ...data }));

    const res = await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .set(as('buyer'))
      .send({ packageIndex: 0, requirements: 'Warm, not corporate.' })
      .expect(201);

    expect((createEscrowPayment as any).mock.calls[0][0]).toMatchObject({
      buyerId: 'buyer',
      sellerId: 'seller',
      amount: 12000,
      currency: 'aud',
      sessionType: 'service_order',
    });
    const created = prisma.serviceOrder.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ escrowPaymentId: 'e1', totalAmount: 120, platformFee: 18, providerPayout: 102 });
    expect(res.body.data.payment).toMatchObject({ clientSecret: 'pi_1_secret', amount: 12000 });
  });

  it('a provider who has not set up payouts cannot be ordered from', async () => {
    (createEscrowPayment as any).mockRejectedValue(new ApiError(400, 'Seller has not set up payment account'));

    const res = await request(app).post('/api/skills-marketplace/services/s1/order').set(as('buyer')).send({ packageIndex: 0 }).expect(409);
    expect(res.body.message).toMatch(/payouts/i);
    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('the provider cannot accept until the hold is authorised', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('PENDING', 'PENDING'));
    await request(app).post('/api/skills-marketplace/orders/o1/accept').set(as('seller')).expect(409);
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();

    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('PENDING', 'AUTHORIZED'));
    await request(app).post('/api/skills-marketplace/orders/o1/accept').set(as('seller')).expect(200);
    expect(prisma.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'ACCEPTED' });
  });

  it('approving the delivery releases the hold to the provider', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('DELIVERED', 'AUTHORIZED'));

    await request(app).post('/api/skills-marketplace/orders/o1/complete').set(as('buyer')).expect(200);

    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'buyer', role: 'USER' });
    expect(prisma.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'COMPLETED' });
  });

  it('cancelling returns the hold to the buyer, whoever cancels', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('ACCEPTED', 'AUTHORIZED'));

    await request(app).post('/api/skills-marketplace/orders/o1/cancel').set(as('seller')).send({ reason: 'Too busy this month' }).expect(200);

    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'seller', role: 'USER' }, 'Too busy this month');
    expect(prisma.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED' });
  });

  it('only the buyer can fetch the secret for a hold still pending', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(orderRow('PENDING', 'PENDING'));

    const res = await request(app).get('/api/skills-marketplace/orders/o1/payment').set(as('buyer')).expect(200);
    expect(res.body.data).toMatchObject({ status: 'PENDING', clientSecret: 'pi_1_secret', amount: 12000 });

    await request(app).get('/api/skills-marketplace/orders/o1/payment').set(as('seller')).expect(403);
  });
});
