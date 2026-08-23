import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    skillService: { findUnique: jest.fn() },
    serviceOrder: { create: jest.fn(), findMany: jest.fn() },
    serviceFavorite: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    apprenticeship: { findUnique: jest.fn(), findMany: jest.fn() },
    apprenticeshipBookmark: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const PACKAGES = [
  { name: 'Basic', price: 100, deliveryDays: 3, features: [] },
  { name: 'Pro', price: 250, deliveryDays: 7, features: [] },
];

function mockService(overrides: Record<string, unknown> = {}) {
  (prisma.skillService.findUnique as any).mockResolvedValue({
    id: 's1',
    providerId: 'provider-1',
    isAvailable: true,
    status: 'ACTIVE',
    hourlyRate: 50,
    minimumHours: 1,
    packages: PACKAGES,
    ...overrides,
  });
}

describe('POST /api/skills-marketplace/services/:id/order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceOrder.create as any).mockResolvedValue({ id: 'o1' });
  });

  it('creates an order priced from the selected package', async () => {
    mockService();

    await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .send({ packageIndex: 1, requirements: 'Please include source files' })
      .expect(201);

    const data = (prisma.serviceOrder.create as any).mock.calls[0][0].data;
    expect(data.packageIndex).toBe(1);
    expect(data.packageName).toBe('Pro');
    expect(data.totalAmount).toBe(250);
    expect(data.platformFee).toBe(50);
    expect(data.providerPayout).toBe(200);
    expect(data.deliveryDays).toBe(7);
    expect(data.dueAt).toBeInstanceOf(Date);
    expect(data.requirements).toBe('Please include source files');
  });

  it('refuses an index that is not in the package list', async () => {
    mockService();

    await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .send({ packageIndex: 9 })
      .expect(400);

    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('refuses when the service sells by the hour and has no packages', async () => {
    mockService({ packages: null });

    await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .send({ packageIndex: 0 })
      .expect(400);

    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('refuses to let a provider order their own service', async () => {
    mockService({ providerId: 'user-123' });

    await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .send({ packageIndex: 0 })
      .expect(400);

    expect(prisma.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('404s for an unavailable service', async () => {
    mockService({ isAvailable: false });

    await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .send({ packageIndex: 0 })
      .expect(404);
  });

  it('rejects a negative package index before touching the database', async () => {
    await request(app)
      .post('/api/skills-marketplace/services/s1/order')
      .send({ packageIndex: -1 })
      .expect(400);

    expect(prisma.skillService.findUnique).not.toHaveBeenCalled();
  });
});

describe('Skill service favourites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.serviceFavorite.upsert as any).mockResolvedValue({});
    (prisma.serviceFavorite.deleteMany as any).mockResolvedValue({ count: 1 });
  });

  it('upserts so favouriting twice is not an error', async () => {
    mockService();

    await request(app).post('/api/skills-marketplace/services/s1/favorite').expect(201);

    const call = (prisma.serviceFavorite.upsert as any).mock.calls[0][0];
    expect(call.where).toEqual({ serviceId_userId: { serviceId: 's1', userId: 'user-123' } });
    expect(call.update).toEqual({});
  });

  it('404s when favouriting a service that does not exist', async () => {
    (prisma.skillService.findUnique as any).mockResolvedValue(null);

    await request(app).post('/api/skills-marketplace/services/s1/favorite').expect(404);
    expect(prisma.serviceFavorite.upsert).not.toHaveBeenCalled();
  });

  it('removes a favourite scoped to the requesting user', async () => {
    await request(app).delete('/api/skills-marketplace/services/s1/favorite').expect(200);

    expect((prisma.serviceFavorite.deleteMany as any).mock.calls[0][0].where).toEqual({
      serviceId: 's1',
      userId: 'user-123',
    });
  });
});

describe('Apprenticeship featured and bookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.apprenticeshipBookmark.upsert as any).mockResolvedValue({});
    (prisma.apprenticeshipBookmark.deleteMany as any).mockResolvedValue({ count: 1 });
  });

  it('GET /featured resolves to the featured handler, not the :id handler', async () => {
    (prisma.apprenticeship.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/apprenticeships/featured').expect(200);

    // If Express had bound this to '/:id', findUnique would have run instead.
    expect(prisma.apprenticeship.findMany).toHaveBeenCalled();
    expect(prisma.apprenticeship.findUnique).not.toHaveBeenCalled();
    expect((prisma.apprenticeship.findMany as any).mock.calls[0][0].where).toEqual({
      isFeatured: true,
      status: 'OPEN',
    });
  });

  it('GET /bookmarked returns the apprenticeships, not the join rows', async () => {
    (prisma.apprenticeshipBookmark.findMany as any).mockResolvedValue([
      { apprenticeship: { id: 'a1', title: 'Carpentry' } },
    ]);

    const res = await request(app).get('/api/apprenticeships/bookmarked').expect(200);

    expect(res.body.data).toEqual([{ id: 'a1', title: 'Carpentry' }]);
  });

  it('bookmarking is idempotent via upsert', async () => {
    (prisma.apprenticeship.findUnique as any).mockResolvedValue({ id: 'a1' });

    await request(app).post('/api/apprenticeships/a1/bookmark').expect(201);

    const call = (prisma.apprenticeshipBookmark.upsert as any).mock.calls[0][0];
    expect(call.where).toEqual({
      apprenticeshipId_userId: { apprenticeshipId: 'a1', userId: 'user-123' },
    });
    expect(call.update).toEqual({});
  });

  it('404s when bookmarking an apprenticeship that does not exist', async () => {
    (prisma.apprenticeship.findUnique as any).mockResolvedValue(null);

    await request(app).post('/api/apprenticeships/a1/bookmark').expect(404);
    expect(prisma.apprenticeshipBookmark.upsert).not.toHaveBeenCalled();
  });

  it('removing a bookmark is scoped to the requesting user', async () => {
    await request(app).delete('/api/apprenticeships/a1/bookmark').expect(200);

    expect((prisma.apprenticeshipBookmark.deleteMany as any).mock.calls[0][0].where).toEqual({
      apprenticeshipId: 'a1',
      userId: 'user-123',
    });
  });
});
