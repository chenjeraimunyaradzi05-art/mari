import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    skillService: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    serviceBooking: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []), update: jest.fn(async () => ({})) },
    serviceOrder: { findFirst: jest.fn(async () => null) },
    serviceReview: { create: jest.fn(), findFirst: jest.fn(async () => null), aggregate: jest.fn(async () => ({ _avg: { rating: 4.5 }, _count: { rating: 2 } })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'client', role: 'USER', email: 'x@athena.com' };
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

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

const service = { id: 's1', providerId: 'seller', isAvailable: true, status: 'ACTIVE', hourlyRate: 120, minimumHours: 2 };

describe('Booking an hour of someone’s time', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.skillService.findUnique.mockResolvedValue(service);
    prisma.serviceBooking.create.mockImplementation(async ({ data }: any) => ({ id: 'b1', ...data }));
  });

  it('prices the booking at the hourly rate and never under the minimum', async () => {
    const res = await request(app)
      .post('/api/skills-marketplace/services/s1/book')
      .set(as('client'))
      .send({ scheduledAt: '2026-10-01T09:00:00.000Z', durationMinutes: 60, clientNotes: 'Reviewing my pitch deck.' })
      .expect(201);

    // One hour asked for, two-hour minimum, so 240 at 20% platform fee.
    expect(res.body.data.totalAmount).toBe(240);
    expect(res.body.data.platformFee).toBe(48);
    expect(res.body.data.providerPayout).toBe(192);
    expect(res.body.data.clientId).toBe('client');
  });

  it('refuses a booking on a listing that is not taking work', async () => {
    prisma.skillService.findUnique.mockResolvedValue({ ...service, isAvailable: false });
    await request(app).post('/api/skills-marketplace/services/s1/book').set(as('client')).send({ scheduledAt: '2026-10-01T09:00:00.000Z', durationMinutes: 60 }).expect(404);
  });

  it('lets either side move the booking on, and keeps a stranger out', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue({ id: 'b1', clientId: 'client', serviceId: 's1', service });
    prisma.serviceBooking.update.mockImplementation(async ({ data }: any) => ({ id: 'b1', ...data }));

    await request(app).patch('/api/skills-marketplace/bookings/b1').set(as('seller')).send({ status: 'CONFIRMED' }).expect(200);
    const completed = await request(app).patch('/api/skills-marketplace/bookings/b1').set(as('client')).send({ status: 'COMPLETED' }).expect(200);
    expect(completed.body.data.completedAt).toBeTruthy();

    await request(app).patch('/api/skills-marketplace/bookings/b1').set(as('nosy')).send({ status: 'CANCELLED' }).expect(403);
    await request(app).patch('/api/skills-marketplace/bookings/b1').set(as('client')).send({ status: 'NONSENSE' }).expect(400);
  });

  it('lists a member’s bookings from whichever side she is on', async () => {
    await request(app).get('/api/skills-marketplace/bookings/me?role=provider').set(as('seller')).expect(200);
    expect(prisma.serviceBooking.findMany.mock.calls[0][0].where).toEqual({ service: { providerId: 'seller' } });

    await request(app).get('/api/skills-marketplace/bookings/me').set(as('client')).expect(200);
    expect(prisma.serviceBooking.findMany.mock.calls[1][0].where.OR).toEqual([
      { clientId: 'client' },
      { service: { providerId: 'client' } },
    ]);
  });
});

describe('Reviewing a service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.skillService.findUnique.mockResolvedValue(service);
    prisma.serviceReview.create.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
  });

  it('refuses a review from someone who never bought the work', async () => {
    const res = await request(app).post('/api/skills-marketplace/services/s1/reviews').set(as('stranger')).send({ rating: 1, content: 'Terrible.' }).expect(403);
    expect(res.body.message ?? res.body.error).toMatch(/completed a booking or an order/i);
    expect(prisma.serviceReview.create).not.toHaveBeenCalled();
  });

  it('accepts one from a client whose order completed, and recomputes the rating', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'COMPLETED' });
    await request(app).post('/api/skills-marketplace/services/s1/reviews').set(as('client')).send({ rating: 5, content: 'Worth it.' }).expect(201);
    expect(prisma.skillService.update.mock.calls[0][0].data).toMatchObject({ rating: 4.5, reviewCount: 2 });
  });

  it('accepts one against a completed booking of the reviewer’s own', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue({ id: 'b1', serviceId: 's1', clientId: 'client', status: 'COMPLETED' });
    const res = await request(app).post('/api/skills-marketplace/services/s1/reviews').set(as('client')).send({ rating: 4, bookingId: 'b1' }).expect(201);
    expect(res.body.data.bookingId).toBe('b1');
  });

  it('refuses a booking that is not finished, and one that belongs to someone else', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue({ id: 'b1', serviceId: 's1', clientId: 'client', status: 'CONFIRMED' });
    await request(app).post('/api/skills-marketplace/services/s1/reviews').set(as('client')).send({ rating: 4, bookingId: 'b1' }).expect(403);

    prisma.serviceBooking.findUnique.mockResolvedValue({ id: 'b1', serviceId: 's1', clientId: 'someone-else', status: 'COMPLETED' });
    await request(app).post('/api/skills-marketplace/services/s1/reviews').set(as('client')).send({ rating: 4, bookingId: 'b1' }).expect(404);
  });

  it('will not take a second review for the same work', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'COMPLETED' });
    prisma.serviceReview.findFirst.mockResolvedValue({ id: 'r-existing' });
    await request(app).post('/api/skills-marketplace/services/s1/reviews').set(as('client')).send({ rating: 5 }).expect(409);
  });
});
