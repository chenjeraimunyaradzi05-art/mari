import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Registering for an event used to be the last thing that happened: nothing
 * put it in her calendar and nothing reminded her it was coming. These tests
 * hold the calendar file and the day-before reminder, and the lines drawn
 * through both for the members this platform is for — the discreet file that
 * names nothing, the file only for someone with a place, and an email that is
 * never sent without her yes and says nothing about where she will be.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    eventRegistration: { findMany: jest.fn(async () => []), upsert: jest.fn(async () => ({})), delete: jest.fn() },
    eventSave: { upsert: jest.fn(), delete: jest.fn() },
    contentReport: { findMany: jest.fn(async () => []), update: jest.fn(async () => ({})) },
    // The host's block lists, in both stores: nobody is blocked unless a test says so.
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    notification: { findMany: jest.fn(async () => []), create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../services/notification.service', () => {
  const notify = jest.fn(async () => undefined);
  return { notificationService: { notify }, NotificationService: jest.fn().mockImplementation(() => ({ notify })) };
});

jest.mock('../../utils/email', () => {
  const actual = jest.requireActual('../../utils/email') as Record<string, unknown>;
  return { ...actual, sendEmail: jest.fn(async () => true) };
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
import { sendEmail as sendEmailTyped } from '../../utils/email';
import { buildEventCalendar, brisbaneDay, runEventReminderSweep } from '../event.routes';

const prisma: any = prismaTyped;
const notificationService: any = notificationTyped;
const sendEmail: any = sendEmailTyped;
const as = (userId: string, role?: string) => ({ 'x-test-user': userId, ...(role ? { 'x-test-role': role } : {}) });

// Thursday 1 October 2026 in Brisbane, written the way a bare date is stored.
const eventDay = new Date('2026-10-01T00:00:00.000Z');

const baseEvent = {
  id: 'ev1',
  title: 'Book club, autumn picks',
  description: 'Bring the book; tea is provided.',
  type: 'MEETUP',
  format: 'IN_PERSON',
  date: eventDay,
  startTime: '18:30',
  endTime: '20:00',
  location: '14 Such Street, Paddington',
  link: null as string | null,
  image: '/icon.svg',
  hostName: 'Ana S.',
  hostTitle: 'Community host',
  hostAvatar: '',
  hostUserId: 'host-1',
  isHidden: false,
  cancelledAt: null as Date | null,
  cancelledReason: null,
  baseAttendees: 0,
  maxAttendees: 20,
  price: 0,
  tags: [],
  updatedAt: new Date('2026-09-20T02:00:00.000Z'),
  registrations: [{ id: 'reg-u1' }],
};

describe('The calendar file', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue(baseEvent);
    prisma.user.findUnique.mockResolvedValue(null);
  });

  it('gives a registered member the event, at the times the organiser published', async () => {
    const res = await request(app).get('/api/events/ev1/calendar.ics?discreet=0').set(as('u1'));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.headers['content-disposition']).toContain('event.ics');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('SUMMARY:Book club\\, autumn picks');
    expect(res.text).toContain('DTSTART:20261001T183000');
    expect(res.text).toContain('DTEND:20261001T200000');
    expect(res.text).toContain('LOCATION:14 Such Street\\, Paddington');
    expect(res.text).toContain('\r\n');
  });

  it('writes the discreet file with nothing in it that names the event, the place or ATHENA', async () => {
    const res = await request(app).get('/api/events/ev1/calendar.ics?discreet=1').set(as('u1'));

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('appointment.ics');
    expect(res.text).toContain('SUMMARY:Appointment');
    expect(res.text).toContain('DTSTART:20261001T183000');
    expect(res.text).not.toMatch(/Book club|Such Street|Paddington|DESCRIPTION|LOCATION|athena/i);
  });

  it('makes the discreet file the default for a member with Safe Mode on', async () => {
    prisma.user.findUnique.mockResolvedValue({ dvSafetyProfile: { isSafeMode: true }, profile: null });

    const res = await request(app).get('/api/events/ev1/calendar.ics').set(as('u1'));

    expect(res.status).toBe(200);
    expect(res.text).toContain('SUMMARY:Appointment');
    expect(res.text).not.toContain('Such Street');
  });

  it('refuses a member who has not registered, and hides a held listing from her entirely', async () => {
    prisma.event.findUnique.mockResolvedValue({ ...baseEvent, registrations: [] });
    const notRegistered = await request(app).get('/api/events/ev1/calendar.ics').set(as('u9'));
    expect(notRegistered.status).toBe(403);

    prisma.event.findUnique.mockResolvedValue({ ...baseEvent, isHidden: true, registrations: [] });
    const held = await request(app).get('/api/events/ev1/calendar.ics').set(as('u9'));
    expect(held.status).toBe(404);
  });

  it('lets the host have her own event, held or not', async () => {
    prisma.event.findUnique.mockResolvedValue({ ...baseEvent, isHidden: true, registrations: [] });

    const res = await request(app).get('/api/events/ev1/calendar.ics?discreet=0').set(as('host-1'));

    expect(res.status).toBe(200);
    expect(res.text).toContain('SUMMARY:Book club');
  });

  it('will not put a cancelled event back in her week', async () => {
    prisma.event.findUnique.mockResolvedValue({ ...baseEvent, cancelledAt: new Date('2026-09-25T00:00:00.000Z') });

    const res = await request(app).get('/api/events/ev1/calendar.ics').set(as('u1'));

    expect(res.status).toBe(409);
  });

  it('asks for sign-in', async () => {
    const res = await request(app).get('/api/events/ev1/calendar.ics');
    expect(res.status).toBe(401);
  });
});

describe('buildEventCalendar', () => {
  it('folds long lines at 75 bytes without splitting a character', () => {
    const body = buildEventCalendar(
      { ...baseEvent, format: 'IN_PERSON', title: `Café ${'é'.repeat(80)} catch-up` },
      { discreet: false, now: new Date('2026-09-26T00:00:00.000Z') }
    );
    for (const line of body.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    const unfolded = body.replace(/\r\n /g, '');
    expect(unfolded).toContain(`SUMMARY:Café ${'é'.repeat(80)} catch-up`);
  });

  it('writes an all-day entry rather than a guessed hour when the times are not HH:MM', () => {
    const body = buildEventCalendar({ ...baseEvent, format: 'IN_PERSON', startTime: '9am', endTime: 'late' }, { discreet: false });
    expect(body).toContain('DTSTART;VALUE=DATE:20261001');
    expect(body).toContain('DTEND;VALUE=DATE:20261002');
  });

  it('puts a virtual event’s joining link where the calendar will offer it', () => {
    const body = buildEventCalendar(
      { ...baseEvent, format: 'VIRTUAL', location: null, link: 'https://meet.example.com/abc' },
      { discreet: false, siteUrl: 'https://athena.example/' }
    );
    expect(body).toContain('LOCATION:https://meet.example.com/abc');
    expect(body).toContain('URL:https://meet.example.com/abc');
    expect(body.replace(/\r\n /g, '')).toContain('https://athena.example/dashboard/events');
  });

  it('names the day in Brisbane whichever way the date was stored', () => {
    expect(brisbaneDay(new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-10-01');
    // Midnight in Brisbane, written with its offset: the afternoon before in UTC.
    expect(brisbaneDay(new Date('2026-09-30T14:00:00.000Z'))).toBe('2026-10-01');
  });
});

describe('The day-before reminder', () => {
  // 10am on Wednesday 30 September in Brisbane.
  const morningBefore = new Date('2026-09-30T00:00:00.000Z');

  const tomorrowsEvent = {
    id: 'ev1',
    title: 'Book club, autumn picks',
    date: eventDay,
    startTime: '18:30',
    endTime: '20:00',
    hostUserId: 'host-1',
    registrations: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findMany.mockResolvedValue([tomorrowsEvent]);
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'u1@example.com', notificationPreferences: null },
      { id: 'u2', email: 'u2@example.com', notificationPreferences: { email: { eventReminders: true } } },
      { id: 'u3', email: 'u3@example.com', notificationPreferences: { inApp: { all: false } } },
      { id: 'host-1', email: 'host@example.com', notificationPreferences: null },
    ]);
  });

  it('reminds each woman registered once, in the app, and tells the host how many are coming', async () => {
    const result = await runEventReminderSweep(morningBefore);

    expect(result).toEqual({ events: 1, reminded: 2, hostsReminded: 1, emailed: 1 });
    const written = prisma.notification.create.mock.calls.map((call: any[]) => call[0].data);
    const toU1 = written.find((n: any) => n.userId === 'u1');
    expect(toU1).toMatchObject({ type: 'SYSTEM', title: 'Tomorrow', isRead: false, link: '/dashboard/events' });
    expect(toU1.message).toContain('18:30 to 20:00');
    expect(toU1.data).toEqual({ kind: 'EVENT_REMINDER', eventId: 'ev1', role: 'registrant' });

    const toHost = written.find((n: any) => n.userId === 'host-1');
    expect(toHost.title).toBe('Your event is tomorrow');
    expect(toHost.message).toContain('3 people have registered');
  });

  it('sends nothing at all to a member who turned in-app notices off and email reminders are not on', async () => {
    await runEventReminderSweep(morningBefore);
    const written = prisma.notification.create.mock.calls.map((call: any[]) => call[0].data);
    expect(written.find((n: any) => n.userId === 'u3')).toBeUndefined();
  });

  it('emails only the member who said yes, and the email names nothing about the event', async () => {
    await runEventReminderSweep(morningBefore);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe('u2@example.com');
    const everything = `${email.subject} ${email.text} ${email.html}`;
    expect(everything).not.toMatch(/Book club|18:30|Such Street|Paddington|autumn/i);
  });

  it('does not repeat a reminder already sent for the same event', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { userId: 'u1', data: { kind: 'EVENT_REMINDER', eventId: 'ev1' } },
      { userId: 'host-1', data: { kind: 'EVENT_REMINDER', eventId: 'ev1' } },
    ]);

    const result = await runEventReminderSweep(morningBefore);

    expect(result.reminded).toBe(1);
    expect(result.hostsReminded).toBe(0);
    const recipients = prisma.notification.create.mock.calls.map((call: any[]) => call[0].data.userId);
    expect(recipients).toEqual(['u2']);
  });

  it('stays quiet at night, and about events that are not tomorrow', async () => {
    // 2am in Brisbane.
    const night = await runEventReminderSweep(new Date('2026-09-29T16:00:00.000Z'));
    expect(night.events).toBe(0);
    expect(prisma.event.findMany).not.toHaveBeenCalled();

    prisma.event.findMany.mockResolvedValue([{ ...tomorrowsEvent, date: new Date('2026-10-02T00:00:00.000Z') }]);
    const dayAfter = await runEventReminderSweep(morningBefore);
    expect(dayAfter.events).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('asks only for published events that have not been called off', async () => {
    await runEventReminderSweep(morningBefore);
    const where = prisma.event.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ cancelledAt: null, isHidden: false });
  });
});

describe('Registering for a priced event', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('says in the confirmation that ATHENA took no payment', async () => {
    const priced = { ...baseEvent, price: 25, _count: { registrations: 2 } };
    prisma.event.findUnique
      .mockResolvedValueOnce({ ...priced, registrations: [], saves: [] })
      .mockResolvedValue({ ...priced, registrations: [{ id: 'reg-u5' }], saves: [] });

    const res = await request(app).post('/api/events/ev1/register').set(as('u5'));

    expect(res.status).toBe(200);
    const notice = notificationService.notify.mock.calls[0][0];
    expect(notice.message).toContain('ATHENA has not taken any payment');
    expect(notice.message).toContain('$25');
  });
});
