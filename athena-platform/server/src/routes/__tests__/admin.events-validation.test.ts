/**
 * What the admin event and list routes accept.
 *
 * POST and PATCH /admin/events passed baseAttendees, maxAttendees, price and
 * the times through as they arrived, so a string became a Prisma 500 and a
 * negative price or an event ending before it started was published to
 * members. The admin lists passed ?sortBy and ?sortOrder straight into
 * orderBy, so a bad link was a 500 too. Each is a 400 now, before the database
 * is asked anything.
 *
 * The admin router is mounted on its own so these tests answer for it alone.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    auditLog: { create: jest.fn() },
    event: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    group: { findMany: jest.fn(), count: jest.fn() },
    post: { findMany: jest.fn(), count: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.test' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import adminRoutes from '../admin.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { prisma as prismaTyped } from '../../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

const prisma: any = prismaTyped;

const validEvent = {
  title: 'Founders breakfast',
  description: 'Coffee and introductions',
  type: 'networking',
  format: 'in-person',
  date: '2026-11-02',
  startTime: '08:00',
  endTime: '09:30',
  image: 'https://example.org/breakfast.jpg',
  hostName: 'Aroha',
  hostTitle: 'Host',
  hostAvatar: 'https://example.org/aroha.jpg',
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  prisma.event.create.mockImplementation(async ({ data }: any) => ({ id: 'event-1', ...data }));
  prisma.event.findUnique.mockResolvedValue({ id: 'event-1', startTime: '08:00', endTime: '09:30' });
  prisma.event.update.mockImplementation(async ({ data }: any) => ({ id: 'event-1', ...data }));
  prisma.event.findMany.mockResolvedValue([]);
  prisma.event.count.mockResolvedValue(0);
  prisma.group.findMany.mockResolvedValue([]);
  prisma.group.count.mockResolvedValue(0);
  prisma.post.findMany.mockResolvedValue([]);
  prisma.post.count.mockResolvedValue(0);
});

describe('POST /api/admin/events', () => {
  it.each([
    ['a price written as a word', { price: 'free' }],
    ['a negative price', { price: -5 }],
    ['a capacity of nobody', { maxAttendees: 0 }],
    ['a capacity past the ceiling', { maxAttendees: 1_000_000 }],
    ['a fractional attendee count', { baseAttendees: 2.5 }],
    ['a time that is not HH:MM', { startTime: '8am' }],
    ['an event that ends before it starts', { startTime: '10:00', endTime: '09:00' }],
    ['a date that is not a date', { date: 'next tuesday' }],
  ])('refuses %s with a 400', async (_label, override) => {
    const res = await request(app).post('/api/admin/events').send({ ...validEvent, ...override });

    expect(res.status).toBe(400);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it('creates an event whose numbers and times are in range', async () => {
    const res = await request(app)
      .post('/api/admin/events')
      .send({ ...validEvent, price: 0, maxAttendees: 40, baseAttendees: 0 });

    expect(res.status).toBe(201);
    expect(prisma.event.create.mock.calls[0][0].data).toMatchObject({ price: 0, maxAttendees: 40, startTime: '08:00', endTime: '09:30' });
  });

  it('keeps an open-ended capacity as no limit', async () => {
    const res = await request(app).post('/api/admin/events').send({ ...validEvent, maxAttendees: null });

    expect(res.status).toBe(201);
    expect(prisma.event.create.mock.calls[0][0].data.maxAttendees).toBeNull();
  });
});

describe('PATCH /api/admin/events/:id', () => {
  it('refuses moving the start past the finish that is already set', async () => {
    const res = await request(app).patch('/api/admin/events/event-1').send({ startTime: '10:00' });

    expect(res.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('refuses a negative base attendance', async () => {
    const res = await request(app).patch('/api/admin/events/event-1').send({ baseAttendees: -1 });

    expect(res.status).toBe(400);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('refuses a null date rather than moving the event to 1970', async () => {
    const res = await request(app).patch('/api/admin/events/event-1').send({ date: null });

    expect(res.status).toBe(400);
  });

  it('applies a change that stays in range', async () => {
    const res = await request(app).patch('/api/admin/events/event-1').send({ endTime: '10:00', price: 25 });

    expect(res.status).toBe(200);
    expect(prisma.event.update.mock.calls[0][0].data).toMatchObject({ endTime: '10:00', price: 25 });
  });
});

describe('Sorting the admin lists', () => {
  it.each([
    ['/api/admin/events?sortBy=hostAvatar'],
    ['/api/admin/events?sortOrder=up'],
    ['/api/admin/groups?sortBy=createdById'],
    ['/api/admin/content/posts?sortBy=content'],
    ['/api/admin/events?limit=abc'],
  ])('refuses %s with a 400 instead of passing it to Prisma', async (url) => {
    const res = await request(app).get(url);

    expect(res.status).toBe(400);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
    expect(prisma.group.findMany).not.toHaveBeenCalled();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('sorts by a column the list names', async () => {
    const res = await request(app).get('/api/admin/content/posts?sortBy=reportCount&sortOrder=desc&reported=true');

    expect(res.status).toBe(200);
    expect(prisma.post.findMany.mock.calls[0][0].orderBy).toEqual({ reportCount: 'desc' });
  });
});
