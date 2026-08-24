import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    skillService: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    serviceOrder: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    serviceReview: { findFirst: jest.fn(), create: jest.fn(), aggregate: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'client-1', role: 'USER', email: 'u@athena.com' };
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

const CLIENT = 'client-1';
const PROVIDER = 'provider-1';
const STRANGER = 'stranger-1';

function mockOrder(overrides: Record<string, unknown> = {}) {
  (prisma.serviceOrder.findUnique as any).mockResolvedValue({
    id: 'o1',
    serviceId: 's1',
    clientId: CLIENT,
    status: 'PENDING',
    deliveryDays: 3,
    dueAt: null,
    attachments: [],
    service: { id: 's1', title: 'Logo design', providerId: PROVIDER },
    client: { id: CLIENT, displayName: 'Client', avatar: null },
    ...overrides,
  });
}

const as = (userId: string) => ({ 'x-test-user': userId });

describe('Service order lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceOrder.update as any).mockImplementation(async (args: any) => ({
      id: 'o1',
      ...args.data,
    }));
    (prisma.$transaction as any).mockImplementation(async (ops: any[]) => ops);
  });

  it('hides an order from someone who is neither buyer nor provider', async () => {
    mockOrder();
    await request(app).get('/api/skills-marketplace/orders/o1').set(as(STRANGER)).expect(404);
  });

  it('tells the viewer which side of the order they are on', async () => {
    mockOrder();
    const res = await request(app)
      .get('/api/skills-marketplace/orders/o1')
      .set(as(PROVIDER))
      .expect(200);

    expect(res.body.data.viewerRole).toBe('provider');
  });

  it('lets the provider accept a pending order and starts the clock then', async () => {
    mockOrder({ status: 'PENDING', deliveryDays: 3 });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/accept')
      .set(as(PROVIDER))
      .expect(200);

    const data = (prisma.serviceOrder.update as any).mock.calls[0][0].data;
    expect(data.status).toBe('ACCEPTED');
    // dueAt is set from acceptance, not from when the order was placed.
    expect(data.dueAt).toBeInstanceOf(Date);
    expect(data.dueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuses to let the buyer accept their own order', async () => {
    mockOrder({ status: 'PENDING' });

    const res = await request(app)
      .post('/api/skills-marketplace/orders/o1/accept')
      .set(as(CLIENT))
      .expect(403);

    expect(res.body.message).toMatch(/only the provider/i);
    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('refuses to accept an order that is already accepted', async () => {
    mockOrder({ status: 'ACCEPTED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/accept')
      .set(as(PROVIDER))
      .expect(400);

    expect(prisma.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('lets the provider deliver an accepted order and appends attachments', async () => {
    mockOrder({ status: 'ACCEPTED', attachments: ['brief.pdf'] });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/deliver')
      .set(as(PROVIDER))
      .send({ message: 'Here it is', attachments: ['final.zip'] })
      .expect(200);

    const data = (prisma.serviceOrder.update as any).mock.calls[0][0].data;
    expect(data.status).toBe('DELIVERED');
    expect(data.deliveredAt).toBeInstanceOf(Date);
    // The original brief is kept, not replaced by the delivery.
    expect(data.attachments).toEqual({ set: ['brief.pdf', 'final.zip'] });
    // The note is stored, not accepted and dropped.
    expect(data.deliveryMessage).toBe('Here it is');
  });

  it('a delivery with no note stores null rather than undefined', async () => {
    mockOrder({ status: 'ACCEPTED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/deliver')
      .set(as(PROVIDER))
      .send({})
      .expect(200);

    expect((prisma.serviceOrder.update as any).mock.calls[0][0].data.deliveryMessage).toBeNull();
  });

  it('allows delivery again after a revision request', async () => {
    mockOrder({ status: 'REVISION_REQUESTED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/deliver')
      .set(as(PROVIDER))
      .send({})
      .expect(200);
  });

  it('lets the buyer send a delivered order back for revision', async () => {
    mockOrder({ status: 'DELIVERED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/revision')
      .set(as(CLIENT))
      .send({ reason: 'Wrong colours' })
      .expect(200);

    const data = (prisma.serviceOrder.update as any).mock.calls[0][0].data;
    expect(data.status).toBe('REVISION_REQUESTED');
    expect(data.deliveredAt).toBeNull();
    // Kept for dispute resolution rather than discarded after validation.
    expect(data.revisionReason).toBe('Wrong colours');
  });

  it('requires a reason for a revision', async () => {
    mockOrder({ status: 'DELIVERED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/revision')
      .set(as(CLIENT))
      .send({})
      .expect(400);
  });

  it('refuses to let the provider request a revision of their own work', async () => {
    mockOrder({ status: 'DELIVERED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/revision')
      .set(as(PROVIDER))
      .send({ reason: 'nope' })
      .expect(403);
  });

  it('completes a delivered order and counts it on the service', async () => {
    mockOrder({ status: 'DELIVERED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/complete')
      .set(as(CLIENT))
      .expect(200);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.skillService.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { completedCount: { increment: 1 } },
    });
  });

  it('will not complete an order that was never delivered', async () => {
    mockOrder({ status: 'ACCEPTED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/complete')
      .set(as(CLIENT))
      .expect(400);
  });

  it('lets either side cancel while the work has not been delivered', async () => {
    mockOrder({ status: 'ACCEPTED' });
    await request(app)
      .post('/api/skills-marketplace/orders/o1/cancel')
      .set(as(PROVIDER))
      .send({ reason: 'Overbooked' })
      .expect(200);

    expect((prisma.serviceOrder.update as any).mock.calls[0][0].data.cancellationReason).toBe(
      'Overbooked'
    );

    jest.clearAllMocks();
    (prisma.serviceOrder.update as any).mockResolvedValue({});
    mockOrder({ status: 'PENDING' });
    await request(app)
      .post('/api/skills-marketplace/orders/o1/cancel')
      .set(as(CLIENT))
      .send({})
      .expect(200);
  });

  it('will not cancel an order that is already completed', async () => {
    mockOrder({ status: 'COMPLETED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/cancel')
      .set(as(CLIENT))
      .send({})
      .expect(400);
  });
});

describe('Order reviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceReview.create as any).mockResolvedValue({ id: 'r1' });
    (prisma.serviceReview.findFirst as any).mockResolvedValue(null);
    (prisma.serviceReview.aggregate as any).mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    (prisma.skillService.update as any).mockResolvedValue({});
  });

  it('records the review against the order and refreshes the service rating', async () => {
    mockOrder({ status: 'COMPLETED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/review')
      .set(as(CLIENT))
      .send({ rating: 5, review: 'Great work' })
      .expect(201);

    expect((prisma.serviceReview.create as any).mock.calls[0][0].data).toMatchObject({
      serviceId: 's1',
      clientId: CLIENT,
      bookingId: 'o1',
      rating: 5,
      content: 'Great work',
    });
    expect((prisma.skillService.update as any).mock.calls[0][0].data).toEqual({
      rating: 4.5,
      reviewCount: 2,
    });
  });

  it('only the buyer may review', async () => {
    mockOrder({ status: 'COMPLETED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/review')
      .set(as(PROVIDER))
      .send({ rating: 5 })
      .expect(403);
  });

  it('an unfinished order cannot be reviewed', async () => {
    mockOrder({ status: 'DELIVERED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/review')
      .set(as(CLIENT))
      .send({ rating: 5 })
      .expect(400);
  });

  it('refuses a second review of the same order', async () => {
    mockOrder({ status: 'COMPLETED' });
    (prisma.serviceReview.findFirst as any).mockResolvedValue({ id: 'existing' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/review')
      .set(as(CLIENT))
      .send({ rating: 5 })
      .expect(400);

    expect(prisma.serviceReview.create).not.toHaveBeenCalled();
  });

  it('rejects a rating outside 1-5', async () => {
    mockOrder({ status: 'COMPLETED' });

    await request(app)
      .post('/api/skills-marketplace/orders/o1/review')
      .set(as(CLIENT))
      .send({ rating: 9 })
      .expect(400);
  });
});

describe('Marketplace literal paths are not swallowed by /:id routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /services/me lists the caller\'s own listings, including paused ones', async () => {
    (prisma.skillService.findMany as any).mockResolvedValue([{ id: 's1', status: 'PAUSED' }]);

    const res = await request(app)
      .get('/api/skills-marketplace/services/me')
      .set(as(PROVIDER))
      .expect(200);

    expect(res.body.data).toEqual([{ id: 's1', status: 'PAUSED' }]);
    // Not treated as a service id lookup.
    expect(prisma.skillService.findUnique).not.toHaveBeenCalled();
    expect((prisma.skillService.findMany as any).mock.calls[0][0].where).toEqual({
      providerId: PROVIDER,
    });
  });

  it('GET /orders/received scopes to orders on the caller\'s services', async () => {
    (prisma.serviceOrder.findMany as any).mockResolvedValue([]);

    await request(app)
      .get('/api/skills-marketplace/orders/received')
      .set(as(PROVIDER))
      .expect(200);

    expect(prisma.serviceOrder.findUnique).not.toHaveBeenCalled();
    expect((prisma.serviceOrder.findMany as any).mock.calls[0][0].where).toEqual({
      service: { providerId: PROVIDER },
    });
  });

  it('GET /categories returns every category with a count, not just the used ones', async () => {
    (prisma.skillService.groupBy as any).mockResolvedValue([
      { category: 'TECHNICAL', _count: { _all: 3 } },
    ]);

    const res = await request(app).get('/api/skills-marketplace/categories').expect(200);

    expect(res.body.data).toHaveLength(5);
    expect(res.body.data).toContainEqual({ category: 'TECHNICAL', count: 3 });
    expect(res.body.data).toContainEqual({ category: 'CREATIVE', count: 0 });
  });
});

describe('Service reviews listing and archiving', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /services/:id/reviews returns reviews with the rating summary', async () => {
    (prisma.skillService.findUnique as any).mockResolvedValue({
      id: 's1',
      rating: 4.8,
      reviewCount: 12,
    });
    (prisma.serviceReview.findMany as any).mockResolvedValue([{ id: 'r1', rating: 5 }]);
    (prisma.serviceReview.count as any).mockResolvedValue(12);

    const res = await request(app).get('/api/skills-marketplace/services/s1/reviews').expect(200);

    expect(res.body.summary).toEqual({ rating: 4.8, reviewCount: 12 });
    expect((prisma.serviceReview.findMany as any).mock.calls[0][0].where).toEqual({
      serviceId: 's1',
      isHidden: false,
    });
  });

  it('DELETE /services/:id archives instead of destroying trading history', async () => {
    (prisma.skillService.findUnique as any).mockResolvedValue({ id: 's1', providerId: PROVIDER });
    (prisma.skillService.update as any).mockResolvedValue({ id: 's1', status: 'ARCHIVED' });

    await request(app)
      .delete('/api/skills-marketplace/services/s1')
      .set(as(PROVIDER))
      .expect(200);

    expect((prisma.skillService.update as any).mock.calls[0][0].data).toEqual({
      status: 'ARCHIVED',
      isAvailable: false,
    });
  });

  it('refuses to archive someone else\'s listing', async () => {
    (prisma.skillService.findUnique as any).mockResolvedValue({ id: 's1', providerId: PROVIDER });

    await request(app)
      .delete('/api/skills-marketplace/services/s1')
      .set(as(STRANGER))
      .expect(403);

    expect(prisma.skillService.update).not.toHaveBeenCalled();
  });
});
