import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    serviceRequest: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    serviceProposal: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
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
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (ops: any[]) => ops);
    (prisma.serviceProposal.update as any).mockResolvedValue({ id: 'p1', status: 'ACCEPTED' });
    (prisma.serviceProposal.updateMany as any).mockResolvedValue({ count: 2 });
    (prisma.serviceRequest.update as any).mockResolvedValue({});
  });

  it('accepts one proposal, declines the rest and closes the brief', async () => {
    mockRequest();
    (prisma.serviceProposal.findUnique as any).mockResolvedValue({ id: 'p1', requestId: 'r1' });

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposals/p1/accept')
      .set(as(BUYER))
      .expect(200);

    expect((prisma.serviceProposal.update as any).mock.calls[0][0].data).toEqual({
      status: 'ACCEPTED',
    });
    expect((prisma.serviceProposal.updateMany as any).mock.calls[0][0]).toEqual({
      where: { requestId: 'r1', id: { not: 'p1' }, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
    expect((prisma.serviceRequest.update as any).mock.calls[0][0].data.status).toBe('AWARDED');
  });

  it('only the buyer may award', async () => {
    mockRequest();

    await request(app)
      .post('/api/skills-marketplace/requests/r1/proposals/p1/accept')
      .set(as(SELLER))
      .expect(403);

    expect(prisma.$transaction).not.toHaveBeenCalled();
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
