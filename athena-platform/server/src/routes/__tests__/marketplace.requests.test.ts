import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    serviceRequest: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    serviceProposal: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    notification: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(),
  },
}));

// Accepting a proposal holds its price on the buyer's card through the same
// escrow a package order uses.
jest.mock('../../services/stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(),
  captureEscrowPayment: jest.fn(async () => ({ status: 'captured' })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
  getEscrowClientSecret: jest.fn(async () => 'pi_1_secret'),
  stripeConnectService: {},
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'buyer-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { ApiError } from '../../middleware/errorHandler';
import { cancelEscrowPayment, captureEscrowPayment, createEscrowPayment } from '../../services/stripe-connect.service';

const prisma: any = prismaTyped;

const BUYER = 'buyer-1';
const SELLER = 'seller-1';

const as = (userId: string) => ({ 'x-test-user': userId });

function mockRequest(overrides: Record<string, unknown> = {}) {
  (prisma.serviceRequest.findUnique as any).mockResolvedValue({
    id: 'r1',
    clientId: BUYER,
    status: 'OPEN',
    ...overrides,
  });
}

const validBrief = {
  title: 'Need a brand refresh',
  description: 'Logo, palette and a one-page style guide.',
  category: 'CREATIVE',
  budget: { min: 500, max: 1500 },
  deliveryDays: 14,
};

describe('Creating a custom request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceRequest.create as any).mockImplementation(async (args: any) => ({
      id: 'r1',
      ...args.data,
    }));
  });

  it('stores the brief against the buyer', async () => {
    await request(app)
      .post('/api/skills-marketplace/requests')
      .set(as(BUYER))
      .send(validBrief)
      .expect(201);

    expect((prisma.serviceRequest.create as any).mock.calls[0][0].data).toMatchObject({
      clientId: BUYER,
      title: 'Need a brand refresh',
      category: 'CREATIVE',
      budgetMin: 500,
      budgetMax: 1500,
      deliveryDays: 14,
    });
  });

  it('rejects a budget whose ceiling is below its floor', async () => {
    await request(app)
      .post('/api/skills-marketplace/requests')
      .set(as(BUYER))
      .send({ ...validBrief, budget: { min: 900, max: 100 } })
      .expect(400);

    expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a category outside the enum', async () => {
    await request(app)
      .post('/api/skills-marketplace/requests')
      .set(as(BUYER))
      .send({ ...validBrief, category: 'PLUMBING' })
      .expect(400);
  });

  it('requires a title', async () => {
    await request(app)
      .post('/api/skills-marketplace/requests')
      .set(as(BUYER))
      .send({ ...validBrief, title: '   ' })
      .expect(400);
  });
});

describe('Browsing requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceRequest.count as any).mockResolvedValue(0);
  });

  it('hides the seller\'s own briefs and reports whether they already pitched', async () => {
    (prisma.serviceRequest.findMany as any).mockResolvedValue([
      { id: 'r1', title: 'A', proposals: [{ id: 'p1', status: 'PENDING' }] },
      { id: 'r2', title: 'B', proposals: [] },
    ]);

    const res = await request(app)
      .get('/api/skills-marketplace/requests')
      .set(as(SELLER))
      .expect(200);

    const where = (prisma.serviceRequest.findMany as any).mock.calls[0][0].where;
    expect(where.status).toBe('OPEN');
    expect(where.clientId).toEqual({ not: SELLER });

    expect(res.body.data[0].myProposal).toEqual({ id: 'p1', status: 'PENDING' });
    expect(res.body.data[1].myProposal).toBeNull();
    // The raw join array is not leaked to the client.
    expect(res.body.data[0].proposals).toBeUndefined();
  });

  it('/requests/me is not read as a request id', async () => {
    (prisma.serviceRequest.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/skills-marketplace/requests/me').set(as(BUYER)).expect(200);

    expect(prisma.serviceRequest.findUnique).not.toHaveBeenCalled();
    expect((prisma.serviceRequest.findMany as any).mock.calls[0][0].where).toEqual({
      clientId: BUYER,
    });
  });

  it('the buyer sees every proposal on their brief', async () => {
    mockRequest();
    (prisma.serviceProposal.findMany as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/skills-marketplace/requests/r1')
      .set(as(BUYER))
      .expect(200);

    expect(res.body.data.isOwner).toBe(true);
    expect((prisma.serviceProposal.findMany as any).mock.calls[0][0].where).toEqual({
      requestId: 'r1',
    });
  });

  it('a provider sees only their own pitch, not the competition', async () => {
    mockRequest();
    (prisma.serviceProposal.findMany as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/skills-marketplace/requests/r1')
      .set(as(SELLER))
      .expect(200);

    expect(res.body.data.isOwner).toBe(false);
    expect((prisma.serviceProposal.findMany as any).mock.calls[0][0].where).toEqual({
      requestId: 'r1',
      providerId: SELLER,
    });
  });
});

describe('Proposals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceProposal.upsert as any).mockResolvedValue({ id: 'p1' });
  });

  const pitch = { message: 'I can do this', price: 900, deliveryDays: 10 };

  it('a provider pitches and re-pitching revises rather than failing', async () => {
    mockRequest();

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposal')
      .set(as(SELLER))
      .send(pitch)
      .expect(201);

    const call = (prisma.serviceProposal.upsert as any).mock.calls[0][0];
    expect(call.where).toEqual({ requestId_providerId: { requestId: 'r1', providerId: SELLER } });
    // A revised pitch goes back into the running.
    expect(call.update.status).toBe('PENDING');
    expect(call.create).toMatchObject({ requestId: 'r1', providerId: SELLER, price: 900 });
  });

  it('the buyer cannot pitch for their own brief', async () => {
    mockRequest();

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposal')
      .set(as(BUYER))
      .send(pitch)
      .expect(400);

    expect(prisma.serviceProposal.upsert).not.toHaveBeenCalled();
  });

  it('a settled brief takes no more pitches', async () => {
    mockRequest({ status: 'AWARDED' });

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposal')
      .set(as(SELLER))
      .send(pitch)
      .expect(400);
  });

  it('404s for a brief that does not exist', async () => {
    (prisma.serviceRequest.findUnique as any).mockResolvedValue(null);

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposal')
      .set(as(SELLER))
      .send(pitch)
      .expect(404);
  });
});

describe('Awarding a request', () => {
  const hold = { escrowId: 'e1', paymentIntentId: 'pi_1', clientSecret: 'pi_1_secret', amount: 90000, platformFee: 13500 };
  const proposal = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    requestId: 'r1',
    providerId: SELLER,
    status: 'PENDING',
    price: 900,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Both the array form (closing a brief) and the interactive form (awarding it).
    (prisma.$transaction as any).mockImplementation(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : arg));
    (prisma.serviceProposal.update as any).mockResolvedValue({ id: 'p1', status: 'ACCEPTED', escrowPaymentId: 'e1' });
    (prisma.serviceProposal.updateMany as any).mockResolvedValue({ count: 2 });
    (prisma.serviceRequest.update as any).mockResolvedValue({});
    (prisma.serviceRequest.updateMany as any).mockResolvedValue({ count: 1 });
    (createEscrowPayment as any).mockResolvedValue(hold);
  });

  it('holds the price on the buyer’s card, accepts the one proposal, declines the rest and awards the brief', async () => {
    mockRequest({ title: 'Need a brand refresh' });
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal());

    const res = await request(app)
      .post('/api/skills-marketplace/requests/r1/proposals/p1/accept')
      .set(as(BUYER))
      .expect(200);

    expect((createEscrowPayment as any).mock.calls[0][0]).toMatchObject({
      buyerId: BUYER,
      sellerId: SELLER,
      amount: 90000,
      currency: 'aud',
      sessionType: 'custom_request',
      metadata: { requestId: 'r1', proposalId: 'p1' },
      // The proposal's own key, so a double tap is one hold.
      idempotencyKey: `custom-request-hold-p1-${new Date('2026-10-01T00:00:00.000Z').getTime()}`,
    });
    // Awarded only while it is still open, so two accepts award it once.
    expect((prisma.serviceRequest.updateMany as any).mock.calls[0][0]).toMatchObject({
      where: { id: 'r1', status: 'OPEN' },
      data: { status: 'AWARDED' },
    });
    expect((prisma.serviceProposal.update as any).mock.calls[0][0].data).toEqual({
      status: 'ACCEPTED',
      escrowPaymentId: 'e1',
    });
    expect((prisma.serviceProposal.updateMany as any).mock.calls[0][0]).toEqual({
      where: { requestId: 'r1', id: { not: 'p1' }, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
    expect(res.body.data.payment).toMatchObject({ clientSecret: 'pi_1_secret', amount: 90000 });
  });

  it('accepting a proposal never awards work with no money behind it', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal({ price: 0 }));

    await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(400);

    expect(createEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a proposal that is no longer open to accept, or the buyer’s own', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal({ status: 'WITHDRAWN' }));
    await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(400);

    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal({ providerId: BUYER }));
    await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(400);

    expect(createEscrowPayment).not.toHaveBeenCalled();
  });

  it('a provider who has not set up payouts cannot be awarded the brief yet', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal());
    (createEscrowPayment as any).mockRejectedValue(new ApiError(400, 'Seller has not set up payment account'));

    const res = await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(409);

    expect(res.body.message).toMatch(/payouts/i);
    expect(prisma.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it('gives the hold back when another accept awarded the brief first', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal());
    (prisma.serviceRequest.updateMany as any).mockResolvedValue({ count: 0 });

    await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(409);

    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: BUYER, role: 'USER' }, expect.any(String));
    expect(prisma.serviceProposal.update).not.toHaveBeenCalled();
  });

  it('a proposal that was cancelled and is accepted again gets a new hold, not the cancelled one back from Stripe', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal());
    await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(200);

    // Cancelled (the proposal's row moved) and pitched again, then accepted.
    (prisma.serviceProposal.findUnique as any).mockResolvedValue(proposal({ updatedAt: new Date('2026-10-02T00:00:00.000Z') }));
    await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(200);

    const [first, second] = (createEscrowPayment as any).mock.calls.map((c: any[]) => c[0].idempotencyKey);
    expect(first).not.toBe(second);
  });

  it('does not give back the buyer’s own hold when a double tap finds the proposal already accepted with it', async () => {
    mockRequest();
    // The brief was awarded a moment ago by the first tap, whose hold Stripe has
    // handed to this one too: the proposal already carries it.
    (prisma.serviceProposal.findUnique as any)
      .mockResolvedValueOnce(proposal())
      .mockResolvedValueOnce({ id: 'p1', status: 'ACCEPTED', escrowPaymentId: 'e1' });
    (prisma.serviceRequest.updateMany as any).mockResolvedValue({ count: 0 });

    const res = await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/accept').set(as(BUYER)).expect(200);

    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(res.body.data).toMatchObject({ id: 'p1', status: 'ACCEPTED', payment: { clientSecret: 'pi_1_secret' } });
  });

  it('only the buyer may award', async () => {
    mockRequest();

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposals/p1/accept')
      .set(as(SELLER))
      .expect(403);

    expect(createEscrowPayment).not.toHaveBeenCalled();
  });

  it('a proposal from another brief cannot be awarded here', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue({ id: 'p1', requestId: 'other' });

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposals/p1/accept')
      .set(as(BUYER))
      .expect(404);
  });

  it('an already settled brief cannot be awarded again', async () => {
    mockRequest({ status: 'AWARDED' });

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposals/p1/accept')
      .set(as(BUYER))
      .expect(400);

    expect(createEscrowPayment).not.toHaveBeenCalled();
  });

  describe('once a proposal is accepted', () => {
    const accepted = (escrowStatus: string | null, over: Record<string, unknown> = {}) => ({
      id: 'p1',
      requestId: 'r1',
      providerId: SELLER,
      status: 'ACCEPTED',
      price: 900,
      request: { id: 'r1', clientId: BUYER, title: 'Need a brand refresh', status: 'AWARDED' },
      escrow: escrowStatus ? { id: 'e1', status: escrowStatus, paymentIntentId: 'pi_1', amount: 90000, currency: 'aud' } : null,
      ...over,
    });

    it('the buyer releasing the payment takes the money, and the provider cannot', async () => {
      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('AUTHORIZED'));

      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as(SELLER)).expect(403);
      expect(captureEscrowPayment).not.toHaveBeenCalled();

      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as(BUYER)).expect(200);
      expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: BUYER, role: 'USER' });
      expect((prisma.notification.create as any).mock.calls[0][0].data.userId).toBe(SELLER);
    });

    it('will not release a payment that is not held yet, has ended, or was already released', async () => {
      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('PENDING'));
      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as(BUYER)).expect(409);

      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('CANCELED'));
      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as(BUYER)).expect(409);

      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted(null));
      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as(BUYER)).expect(409);

      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('CAPTURED'));
      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as(BUYER)).expect(200);

      expect(captureEscrowPayment).not.toHaveBeenCalled();
    });

    it('a stranger is told the proposal does not exist', async () => {
      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('AUTHORIZED'));

      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/release').set(as('nosy')).expect(404);
      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/cancel').set(as('nosy')).expect(404);
    });

    it('either side can back out before the money is released: the hold goes back and the brief is open again', async () => {
      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('AUTHORIZED'));

      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/cancel').set(as(SELLER)).expect(200);

      expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: SELLER, role: 'USER' }, expect.any(String));
      expect((prisma.serviceProposal.update as any).mock.calls[0][0].data).toEqual({ status: 'WITHDRAWN' });
      expect((prisma.serviceRequest.update as any).mock.calls[0][0].data).toEqual({ status: 'OPEN', closedAt: null });

      jest.clearAllMocks();
      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/cancel').set(as(BUYER)).expect(200);
      expect((prisma.serviceProposal.update as any).mock.calls[0][0].data).toEqual({ status: 'DECLINED' });
    });

    it('cannot be cancelled once the payment has been released', async () => {
      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('CAPTURED'));

      await request(app).post('/api/skills-marketplace/requests/r1/proposals/p1/cancel').set(as(BUYER)).expect(409);

      expect(cancelEscrowPayment).not.toHaveBeenCalled();
      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });

    it('only the buyer sees the payment, with the secret while the hold needs authorising', async () => {
      (prisma.serviceProposal.findUnique as any).mockResolvedValue(accepted('PENDING'));

      const res = await request(app).get('/api/skills-marketplace/requests/r1/proposals/p1/payment').set(as(BUYER)).expect(200);
      expect(res.body.data).toMatchObject({ status: 'PENDING', clientSecret: 'pi_1_secret', amount: 90000 });

      await request(app).get('/api/skills-marketplace/requests/r1/proposals/p1/payment').set(as(SELLER)).expect(403);
    });
  });

  it('closing a brief declines the outstanding pitches', async () => {
    mockRequest();
    (prisma.serviceRequest.update as any).mockResolvedValue({ id: 'r1', status: 'CLOSED' });

    await request(app)
      .post('/api/skills-marketplace/requests/r1/close')
      .set(as(BUYER))
      .expect(200);

    expect((prisma.serviceProposal.updateMany as any).mock.calls[0][0].data).toEqual({
      status: 'DECLINED',
    });
  });

  it('closing an already closed brief is a no-op', async () => {
    mockRequest({ status: 'CLOSED' });

    await request(app)
      .post('/api/skills-marketplace/requests/r1/close')
      .set(as(BUYER))
      .expect(200);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
