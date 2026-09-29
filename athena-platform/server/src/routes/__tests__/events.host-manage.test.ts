import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * A member who hosted an event could write it and nothing more: she could not
 * see who was coming, change a venue, or call it off, and registering sent the
 * registrant nothing. These tests hold the routes that fixed that, and the
 * privacy line drawn through the host's list — a woman with Safe Mode on, a
 * private profile, or a block either way with the host is counted but not
 * named, because a list of who will be in a room at a given hour is exactly
 * what someone looking for her would want.
 */

const upcoming = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

const hostedEvent = {
  id: 'ev1',
  title: 'Coffee and code',
  description: 'A morning of pairing.',
  type: 'MEETUP',
  format: 'IN_PERSON',
  date: upcoming,
  startTime: '10:00',
  endTime: '11:30',
  location: 'Library meeting room 2',
  link: null,
  image: '/icon.svg',
  hostName: 'Ana S.',
  hostTitle: 'Community host',
  hostAvatar: '',
  hostUserId: 'host-1',
  isHidden: false,
  baseAttendees: 0,
  maxAttendees: 20,
  price: 0,
  tags: ['tech'],
  _count: { registrations: 3 },
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
      delete: jest.fn(async () => ({})),
    },
    eventRegistration: { findMany: jest.fn(async () => []), upsert: jest.fn(async () => ({})), delete: jest.fn() },
    eventSave: { upsert: jest.fn(), delete: jest.fn() },
    contentReport: { findMany: jest.fn(async () => []), update: jest.fn(async () => ({})) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => [{ id: 'admin-1' }]) },
    notification: { createMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

// The class is exported too: other modules construct their own instance at
// import time, and a mock without it fails before any test runs.
jest.mock('../../services/notification.service', () => {
  const notify = jest.fn(async () => undefined);
  return { notificationService: { notify }, NotificationService: jest.fn().mockImplementation(() => ({ notify })) };
});

jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) =>
    req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' } : null;
  return {
    authenticate: (req: any, res: any, next: any) => {
      const user = userFrom(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = userFrom(req);
      if (user) req.user = user;
      next();
    },
    requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
    requirePremium: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { notificationService as notificationTyped } from '../../services/notification.service';

const prisma: any = prismaTyped;
const notificationService: any = notificationTyped;
const as = (userId: string, role?: string) => ({ 'x-test-user': userId, ...(role ? { 'x-test-role': role } : {}) });

const registrant = (id: string, over: Record<string, unknown> = {}) => ({
  id: `reg-${id}`,
  createdAt: new Date('2026-09-20T00:00:00.000Z'),
  user: {
    id,
    firstName: `First-${id}`,
    lastName: `Last-${id}`,
    displayName: null,
    safetySettings: null,
    dvSafetyProfile: null,
    profile: null,
    ...over,
  },
});

describe('An event’s host: who is coming, changing it, calling it off', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue(hostedEvent);
    prisma.eventRegistration.findMany.mockResolvedValue([
      registrant('u1'),
      registrant('u2', { dvSafetyProfile: { isSafeMode: true, hideFromSearch: false } }),
      registrant('u3', { safetySettings: { profileVisibility: 'private' } }),
      registrant('u4', { profile: { isSafeMode: true } }),
      registrant('u5', { displayName: 'Rae' }),
    ]);
  });

  describe('the list of who is coming', () => {
    it('is not there for anyone but the host and staff', async () => {
      await request(app).get('/api/events/ev1/registrations').set(as('someone-else')).expect(404);
      await request(app).get('/api/events/ev1/registrations').expect(401);
    });

    it('gives the host a shown name and no surname, and withholds names behind Safe Mode, a private profile or a block', async () => {
      // u5 has blocked the host.
      prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'u5' }]);

      const res = await request(app).get('/api/events/ev1/registrations').set(as('host-1')).expect(200);
      const rows = res.body.data.registrations;
      expect(rows).toHaveLength(5);
      expect(rows[0]).toMatchObject({ name: 'First-u1', nameWithheld: false });
      expect(JSON.stringify(rows)).not.toContain('Last-');
      expect(rows.filter((r: any) => r.nameWithheld).map((r: any) => r.name)).toEqual([null, null, null, null]);
      expect(res.body.data.withheld).toBe(4);
      expect(rows[0].userId).toBeUndefined();
    });

    it('gives staff the full names, because they act on reports', async () => {
      const res = await request(app).get('/api/events/ev1/registrations').set(as('staff', 'ADMIN')).expect(200);
      expect(res.body.data.registrations[1]).toMatchObject({ name: 'First-u2 Last-u2', nameWithheld: false, userId: 'u2' });
    });
  });

  describe('changing a listing', () => {
    it('only the host or staff may change it', async () => {
      await request(app).patch('/api/events/ev1').set(as('someone-else')).send({ startTime: '11:00' }).expect(404);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('a new time stays published, and everyone registered is told', async () => {
      prisma.eventRegistration.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ startTime: '10:30' }).expect(200);

      const data = prisma.event.update.mock.calls[0][0].data;
      expect(data).toEqual({ startTime: '10:30' });
      expect(notificationService.notify.mock.calls.map((c: any) => c[0].userId)).toEqual(['u1', 'u2']);
      // In the app only: never an email naming the room and the hour.
      for (const call of notificationService.notify.mock.calls) expect(call[0].channels).toBeUndefined();
    });

    it('a new place puts a published member listing back in front of a moderator, and keeps what was reported', async () => {
      prisma.contentReport.findMany.mockResolvedValue([{ id: 'rep1', evidence: null }]);
      prisma.eventRegistration.findMany.mockResolvedValue([{ userId: 'u1' }]);

      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ location: '14 Private Street' }).expect(200);

      expect(prisma.event.update.mock.calls[0][0].data).toMatchObject({ location: '14 Private Street', isHidden: true });
      // The listing as it stood is written into the report before it changes.
      const evidence = prisma.contentReport.update.mock.calls[0][0].data.evidence;
      expect(evidence.eventSnapshots[0]).toMatchObject({ because: 'EDITED', location: 'Library meeting room 2' });
      // The moderators are told there is something to read again.
      expect(prisma.notification.createMany).toHaveBeenCalled();
      expect(notificationService.notify.mock.calls[0][0].message).toMatch(/checking the change/);
    });

    it('checks the edit the way the create is checked', async () => {
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ startTime: '9am' }).expect(400);
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ endTime: '09:00' }).expect(400);
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ location: '' }).expect(400);
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ link: 'javascript:alert(1)' }).expect(400);
      // Three are registered, so the cap cannot drop to two.
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ maxAttendees: 2 }).expect(400);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('leaves an event that has already happened as it was', async () => {
      prisma.event.findUnique.mockResolvedValue({ ...hostedEvent, date: new Date('2020-01-01T00:00:00.000Z') });
      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ startTime: '10:30' }).expect(400);
    });
  });

  describe('calling it off', () => {
    it('marks it cancelled rather than deleting it, tells everyone registered why, and keeps the listing for any report', async () => {
      prisma.eventRegistration.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
      prisma.contentReport.findMany.mockResolvedValue([{ id: 'rep1', evidence: { note: 'kept' } }]);

      const res = await request(app)
        .post('/api/events/ev1/cancel')
        .set(as('host-1'))
        .send({ reason: 'VENUE_UNAVAILABLE' })
        .expect(200);

      expect(res.body.data.registrantsTold).toBe(2);
      // The row and its registrations stay: nothing is deleted.
      expect(prisma.event.delete).not.toHaveBeenCalled();
      const data = prisma.event.updateMany.mock.calls[0][0].data;
      expect(data.cancelledAt).toBeInstanceOf(Date);
      expect(data.cancelledReason).toBe('The venue is no longer available.');
      expect(notificationService.notify.mock.calls.map((c: any) => c[0].title)).toEqual([
        'An event you registered for is cancelled',
        'An event you registered for is cancelled',
      ]);
      expect(notificationService.notify.mock.calls[0][0].message).toMatch(/cancelled by its host.*The venue is no longer available\./);
      // In the app only.
      for (const call of notificationService.notify.mock.calls) expect(call[0].channels).toBeUndefined();
      expect(prisma.contentReport.update.mock.calls[0][0].data.evidence).toMatchObject({
        note: 'kept',
        eventSnapshots: [expect.objectContaining({ because: 'CANCELLED', title: 'Coffee and code' })],
      });
    });

    it('takes a host’s reason only from the list, so it cannot carry a new address past review', async () => {
      await request(app)
        .post('/api/events/ev1/cancel')
        .set(as('host-1'))
        .send({ reason: 'Cancelled — come to 14 Private Street instead' })
        .expect(400);
      await request(app).post('/api/events/ev1/cancel').set(as('host-1')).send({}).expect(400);
      expect(prisma.event.updateMany).not.toHaveBeenCalled();
      expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('lets staff give their own reason, tells the host, and records who did it', async () => {
      prisma.eventRegistration.findMany.mockResolvedValue([{ userId: 'u1' }]);

      await request(app)
        .post('/api/events/ev1/cancel')
        .set(as('staff', 'ADMIN'))
        .send({ reason: 'The venue has told us it cannot host this group.' })
        .expect(200);

      expect(prisma.event.updateMany.mock.calls[0][0].data.cancelledReason).toBe('The venue has told us it cannot host this group.');
      const told = notificationService.notify.mock.calls.map((c: any) => c[0]);
      expect(told.map((n: any) => n.userId)).toEqual(['u1', 'host-1']);
      expect(told[0].message).toMatch(/cancelled by ATHENA/);
      expect(told[1].title).toBe('Your event has been cancelled');
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'ADMIN_EVENT_UPDATE',
        actorUserId: 'staff',
        metadata: expect.objectContaining({ eventId: 'ev1', change: 'CANCELLED' }),
      });
    });

    it('is the host’s and staff’s alone, and happens once', async () => {
      await request(app).post('/api/events/ev1/cancel').set(as('someone-else')).send({ reason: 'OTHER' }).expect(404);
      expect(prisma.event.updateMany).not.toHaveBeenCalled();

      prisma.event.findUnique.mockResolvedValue({ ...hostedEvent, cancelledAt: new Date(), cancelledReason: 'x' });
      await request(app).post('/api/events/ev1/cancel').set(as('host-1')).send({ reason: 'OTHER' }).expect(409);
      expect(prisma.event.updateMany).not.toHaveBeenCalled();
    });

    it('tells registrants once when two cancellations arrive together', async () => {
      prisma.eventRegistration.findMany.mockResolvedValue([{ userId: 'u1' }]);
      // Both read the row before either wrote it; the second write finds it
      // already marked.
      prisma.event.updateMany.mockResolvedValueOnce({ count: 0 });
      await request(app).post('/api/events/ev1/cancel').set(as('host-1')).send({ reason: 'OTHER' }).expect(409);
      expect(notificationService.notify).not.toHaveBeenCalled();
      expect(prisma.event.updateMany.mock.calls[0][0].where).toEqual({ id: 'ev1', cancelledAt: null });
    });

    it('is no longer a delete', async () => {
      await request(app).delete('/api/events/ev1').set(as('host-1')).expect(404);
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });
  });

  describe('a cancelled event', () => {
    const cancelled = {
      ...hostedEvent,
      format: 'VIRTUAL',
      link: 'https://meet.example.org/room',
      cancelledAt: new Date('2026-09-25T00:00:00.000Z'),
      cancelledReason: 'The host is no longer able to run it.',
    };

    it('stays on the page, marked, with the reason for the women who had a place and not for strangers', async () => {
      prisma.event.findUnique.mockResolvedValue({ ...cancelled, registrations: [{ id: 'r' }], saves: [] });
      const mine = await request(app).get('/api/events/ev1').set(as('u1')).expect(200);
      expect(mine.body.data).toMatchObject({
        isCancelled: true,
        cancelledReason: 'The host is no longer able to run it.',
        // Nothing to join.
        link: null,
        linkRequiresRegistration: false,
      });

      prisma.event.findUnique.mockResolvedValue({ ...cancelled, registrations: [], saves: [] });
      const stranger = await request(app).get('/api/events/ev1').set(as('u9')).expect(200);
      expect(stranger.body.data).toMatchObject({ isCancelled: true, cancelledReason: null, link: null });
    });

    it('takes no new registrations and no further changes', async () => {
      prisma.event.findUnique.mockResolvedValue({ ...cancelled, registrations: [], saves: [] });
      await request(app).post('/api/events/ev1/register').set(as('u9')).expect(409);
      expect(prisma.eventRegistration.upsert).not.toHaveBeenCalled();

      await request(app).patch('/api/events/ev1').set(as('host-1')).send({ startTime: '10:30' }).expect(409);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('sorts after everything still going ahead in the public list', async () => {
      await request(app).get('/api/events').expect(200);
      expect(prisma.event.findMany.mock.calls[0][0].orderBy[0]).toEqual({ cancelledAt: { sort: 'desc', nulls: 'first' } });
    });
  });

  describe('registering', () => {
    it('confirms a new place in the app, once', async () => {
      prisma.event.findUnique
        .mockResolvedValueOnce({ ...hostedEvent, registrations: [], saves: [] })
        .mockResolvedValueOnce({ ...hostedEvent, registrations: [{ id: 'r' }], saves: [] });
      await request(app).post('/api/events/ev1/register').set(as('u9')).expect(200);
      expect(notificationService.notify).toHaveBeenCalledTimes(1);
      expect(notificationService.notify.mock.calls[0][0]).toMatchObject({ userId: 'u9', title: 'You are registered' });

      notificationService.notify.mockClear();
      prisma.event.findUnique.mockResolvedValue({ ...hostedEvent, registrations: [{ id: 'r' }], saves: [] });
      await request(app).post('/api/events/ev1/register').set(as('u9')).expect(200);
      expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('counts the people who registered here, and takes an organiser’s own headcount off the places instead', async () => {
      prisma.event.findUnique.mockResolvedValue({ ...hostedEvent, hostUserId: null, baseAttendees: 400, maxAttendees: 500, _count: { registrations: 3 } });
      const res = await request(app).get('/api/events/ev1').expect(200);
      expect(res.body.data.attendees).toBe(3);
      expect(res.body.data.maxAttendees).toBe(100);
    });
  });

  describe('her own events', () => {
    it('lists what she hosts and what she is going to, and is not taken for an event id', async () => {
      prisma.event.findMany
        .mockResolvedValueOnce([{ ...hostedEvent, registrations: [], saves: [] }])
        .mockResolvedValueOnce([]);
      const res = await request(app).get('/api/events/mine').set(as('host-1')).expect(200);
      expect(res.body.data.hosting).toHaveLength(1);
      expect(res.body.data.hosting[0]).toMatchObject({ id: 'ev1', isHost: true });
      expect(res.body.data.attending).toEqual([]);
      expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({ hostUserId: 'host-1' });
    });
  });
});
