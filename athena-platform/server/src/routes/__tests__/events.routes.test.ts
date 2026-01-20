import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    eventRegistration: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    eventSave: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('Events routes (Prisma-backed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/events returns events with computed attendees', async () => {
    (prisma.event.findMany as any).mockResolvedValue([
      {
        id: 'e1',
        title: 'Panel',
        description: 'Desc',
        type: 'WEBINAR',
        format: 'VIRTUAL',
        date: new Date('2026-01-20T00:00:00.000Z'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        location: null,
        link: 'https://x',
        image: 'https://img',
        hostName: 'Host',
        hostTitle: 'Title',
        hostAvatar: 'https://ava',
        baseAttendees: 10,
        maxAttendees: 100,
        price: 0,
        tags: ['Tech'],
        _count: { registrations: 3 },
      },
    ]);

    const res = await request(app).get('/api/events?type=all').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('webinar');
    expect(res.body.data[0].format).toBe('virtual');
    expect(res.body.data[0].attendees).toBe(13);
    expect(res.body.data[0].isRegistered).toBe(false);
    expect(res.body.data[0].isSaved).toBe(false);
  });

  it('POST /api/events/:id/register upserts registration and returns isRegistered=true', async () => {
    // First getEventView (ensure exists)
    (prisma.event.findUnique as any)
      .mockResolvedValueOnce({
        id: 'e1',
        title: 'Panel',
        description: 'Desc',
        type: 'WEBINAR',
        format: 'VIRTUAL',
        date: new Date('2026-01-20T00:00:00.000Z'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        image: 'https://img',
        hostName: 'Host',
        hostTitle: 'Title',
        hostAvatar: 'https://ava',
        baseAttendees: 0,
        price: 0,
        tags: [],
        _count: { registrations: 0 },
      })
      // Second getEventView (after upsert, user-scoped include)
      .mockResolvedValueOnce({
        id: 'e1',
        title: 'Panel',
        description: 'Desc',
        type: 'WEBINAR',
        format: 'VIRTUAL',
        date: new Date('2026-01-20T00:00:00.000Z'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        image: 'https://img',
        hostName: 'Host',
        hostTitle: 'Title',
        hostAvatar: 'https://ava',
        baseAttendees: 0,
        price: 0,
        tags: [],
        _count: { registrations: 1 },
        registrations: [{ id: 'er_1' }],
        saves: [],
      });

    (prisma.eventRegistration.upsert as any).mockResolvedValue({ id: 'er_1' });

    const res = await request(app)
      .post('/api/events/e1/register')
      .set('x-test-auth', '1')
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isRegistered).toBe(true);
    expect(prisma.eventRegistration.upsert).toHaveBeenCalled();
  });

  it('POST /api/events/:id/save upserts save and returns isSaved=true', async () => {
    (prisma.event.findUnique as any)
      .mockResolvedValueOnce({
        id: 'e1',
        title: 'Panel',
        description: 'Desc',
        type: 'WEBINAR',
        format: 'VIRTUAL',
        date: new Date('2026-01-20T00:00:00.000Z'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        image: 'https://img',
        hostName: 'Host',
        hostTitle: 'Title',
        hostAvatar: 'https://ava',
        baseAttendees: 0,
        price: 0,
        tags: [],
        _count: { registrations: 0 },
      })
      .mockResolvedValueOnce({
        id: 'e1',
        title: 'Panel',
        description: 'Desc',
        type: 'WEBINAR',
        format: 'VIRTUAL',
        date: new Date('2026-01-20T00:00:00.000Z'),
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        image: 'https://img',
        hostName: 'Host',
        hostTitle: 'Title',
        hostAvatar: 'https://ava',
        baseAttendees: 0,
        price: 0,
        tags: [],
        _count: { registrations: 0 },
        registrations: [],
        saves: [{ id: 'es_1' }],
      });

    (prisma.eventSave.upsert as any).mockResolvedValue({ id: 'es_1' });

    const res = await request(app)
      .post('/api/events/e1/save')
      .set('x-test-auth', '1')
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isSaved).toBe(true);
    expect(prisma.eventSave.upsert).toHaveBeenCalled();
  });
});
