import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * A member-hosted event used to publish the instant it was written, with no
 * owner on the row and its joining link served to anonymous callers. For a
 * platform whose members include women in hiding, that is an address anyone
 * can find and nobody can trace back.
 *
 * These tests hold the three parts of the fix: the row carries `hostUserId`,
 * it is held for review rather than published, and the link is withheld until
 * the viewer has said she is coming.
 */

const memberEvent = {
  id: 'ev-member',
  title: 'Coffee and code',
  description: 'A morning of pairing.',
  type: 'MEETUP',
  format: 'VIRTUAL',
  date: new Date('2026-11-02T00:00:00.000Z'),
  startTime: '10:00',
  endTime: '11:30',
  location: null,
  link: 'https://meet.example.com/coffee-and-code',
  image: '/icon.svg',
  hostName: 'Ana S.',
  hostTitle: 'Community host',
  hostAvatar: '',
  hostUserId: 'user-123',
  isHidden: false,
  baseAttendees: 0,
  maxAttendees: 20,
  price: 0,
  tags: ['tech'],
  _count: { registrations: 2 },
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    eventRegistration: { upsert: jest.fn(), delete: jest.fn() },
    eventSave: { upsert: jest.fn(), delete: jest.fn() },
    user: {
      findUnique: jest.fn(async () => ({
        displayName: 'Ana S.',
        firstName: 'Ana',
        lastName: 'Silva',
        headline: 'Engineer',
        avatar: '',
      })),
      findMany: jest.fn(async () => [{ id: 'admin-1' }]),
    },
    notification: { createMany: jest.fn(async () => ({ count: 1 })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'ana@example.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'ana@example.com' };
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

describe('Member-hosted events are attributable, held and not advertised with their join link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records the host and holds the listing when a member creates one', async () => {
    prisma.event.create.mockResolvedValue({ ...memberEvent, isHidden: true, _count: { registrations: 0 } });

    const res = await request(app)
      .post('/api/events')
      .send({
        title: 'Coffee and code',
        description: 'A morning of pairing.',
        type: 'meetup',
        format: 'virtual',
        date: '2099-11-02',
        startTime: '10:00',
        endTime: '11:30',
        link: 'https://meet.example.com/coffee-and-code',
      })
      .expect(201);

    const created = prisma.event.create.mock.calls[0][0].data;
    expect(created.hostUserId).toBe('user-123');
    expect(created.isHidden).toBe(true);

    // She is told it is held, and she keeps her own link.
    expect(res.body.data.pendingReview).toBe(true);
    expect(res.body.data.isHost).toBe(true);
    expect(res.body.data.link).toBe('https://meet.example.com/coffee-and-code');

    // And the moderators are told there is something to read.
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it('withholds the joining link from a signed-out visitor', async () => {
    prisma.event.findMany.mockResolvedValue([memberEvent]);

    const res = await request(app).get('/api/events?type=all').expect(200);

    expect(res.body.data[0].link).toBeNull();
    expect(res.body.data[0].linkRequiresRegistration).toBe(true);
    // A stranger is not told whose event it is either.
    expect(res.body.data[0].hostUserId).toBeUndefined();

    const where = prisma.event.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ isHidden: false });
  });

  it('gives the link to a member once she has registered', async () => {
    prisma.event.findMany.mockResolvedValue([
      { ...memberEvent, hostUserId: 'someone-else', registrations: [{ id: 'reg-1' }], saves: [] },
    ]);

    const res = await request(app).get('/api/events?type=all').set('x-test-auth', '1').expect(200);

    expect(res.body.data[0].link).toBe('https://meet.example.com/coffee-and-code');
    expect(res.body.data[0].linkRequiresRegistration).toBe(false);
  });

  it('still publishes a curated listing’s booking link, because staff checked it', async () => {
    prisma.event.findMany.mockResolvedValue([{ ...memberEvent, hostUserId: null }]);

    const res = await request(app).get('/api/events?type=all').expect(200);

    expect(res.body.data[0].link).toBe('https://meet.example.com/coffee-and-code');
    expect(res.body.data[0].linkRequiresRegistration).toBe(false);
  });

  it('shows a member her own held listing and hides it from everyone else', async () => {
    prisma.event.findUnique.mockResolvedValue({ ...memberEvent, isHidden: true, registrations: [], saves: [] });

    const mine = await request(app).get('/api/events/ev-member').set('x-test-auth', '1').expect(200);
    expect(mine.body.data.pendingReview).toBe(true);

    prisma.event.findUnique.mockResolvedValue({ ...memberEvent, isHidden: true });
    await request(app).get('/api/events/ev-member').expect(404);
  });
});
