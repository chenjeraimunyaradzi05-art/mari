import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// The obligation-creating half of mentoring that had no suite: publishing a
// profile, pausing it, the directory's order, the hours a mentor is offered on,
// and what happens to the mentee's money when a cancellation cannot release it.

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    mentorProfile: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    mentorSession: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    escrowPayment: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
    follow: { findMany: jest.fn() },
    dvSafetyProfile: { findUnique: jest.fn() },
    userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  },
}));

jest.mock('../src/services/stripe-connect.service', () => ({
  ...(jest.requireActual('../src/services/stripe-connect.service') as object),
  cancelEscrowPayment: jest.fn(),
  captureEscrowPayment: jest.fn(),
}));

jest.mock('../src/services/notification.service', () => {
  const notify = jest.fn();
  class NotificationService {
    notify = notify;
  }
  return { NotificationService, notificationService: new NotificationService() };
});

jest.mock('../src/middleware/account-gates', () => ({
  ...(jest.requireActual('../src/middleware/account-gates') as object),
  womanGateState: jest.fn(async () => ({})),
  isWomanVerified: jest.fn(() => true),
}));

jest.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.user = { id, role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { prisma as prismaTyped } from '../src/utils/prisma';
import { notificationService } from '../src/services/notification.service';
import * as stripeConnect from '../src/services/stripe-connect.service';
import { getAvailableSlots } from '../src/services/mentor-scheduling.service';

const prisma: any = prismaTyped;
const notify: any = (notificationService as any).notify;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

describe('Publishing a mentor profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mentorProfile.findUnique.mockResolvedValue(null);
    prisma.mentorProfile.upsert.mockImplementation(async ({ create }: any) => ({ id: 'mp-1', ...create }));
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it('makes a plain member a MENTOR', async () => {
    await request(app).post('/api/mentors/me').set(as('member-1')).send({ hourlyRate: 0 }).expect(200);

    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'member-1', role: 'USER' }, data: { role: 'MENTOR' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('never demotes an admin, or anyone else whose role is not USER', async () => {
    // The role change is conditional on USER in the same statement, so for an
    // admin it matches nothing. It used to be an unconditional update that
    // silently turned an admin who mentored into a MENTOR and nothing more.
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await request(app).post('/api/mentors/me').set(as('admin-1', 'ADMIN')).send({ hourlyRate: 0 }).expect(200);

    expect(prisma.user.updateMany.mock.calls[0][0].where).toEqual({ id: 'admin-1', role: 'USER' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('starts a new profile available, and does not re-list a paused one when she edits her rate', async () => {
    await request(app).post('/api/mentors/me').set(as('member-1')).send({ hourlyRate: 80 }).expect(200);
    const args = prisma.mentorProfile.upsert.mock.calls[0][0];
    expect(args.create.isAvailable).toBe(true);
    expect(args.update.isAvailable).toBeUndefined();
  });
});

describe('Turning on payouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('will not open a payout account for someone with no mentor profile', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/mentors/enable').set(as('member-1')).expect(404);
    expect(res.body.message ?? res.body.error).toMatch(/Mentor profile not found/);
  });

  it('will not hand out an onboarding link before there is an account to onboard', async () => {
    prisma.user.findUnique.mockResolvedValue({ stripeConnectAccountId: null, mentorProfile: null, creatorProfile: null });

    const res = await request(app).post('/api/mentors/onboard').set(as('member-1')).expect(400);
    expect(res.body.message ?? res.body.error).toMatch(/Enable monetization first/);
  });

  it('needs a signed-in member for all of it', async () => {
    await request(app).post('/api/mentors/enable').expect(401);
    await request(app).post('/api/mentors/me').send({ hourlyRate: 0 }).expect(401);
    await request(app).patch('/api/mentors/me/availability').send({ isAvailable: false }).expect(401);
  });
});

describe('Pausing new requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('turns isAvailable off on her own profile and answers with it', async () => {
    prisma.mentorProfile.findUnique
      .mockResolvedValueOnce({ id: 'mp-1' })
      .mockResolvedValueOnce({ id: 'mp-1', userId: 'mentor-1', isAvailable: false, hourlyRate: 0, stripeAccountId: null });
    prisma.mentorProfile.update.mockResolvedValue({});

    const res = await request(app).patch('/api/mentors/me/availability').set(as('mentor-1')).send({ isAvailable: false }).expect(200);

    expect(prisma.mentorProfile.update).toHaveBeenCalledWith({ where: { userId: 'mentor-1' }, data: { isAvailable: false } });
    expect(res.body.data.isAvailable).toBe(false);
    expect(res.body.data.acceptsBookings).toBe(false);
    expect(res.body.data.stripeAccountId).toBeUndefined();
  });

  it('does not create a profile for someone who has none', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(null);

    await request(app).patch('/api/mentors/me/availability').set(as('member-1')).send({ isAvailable: false }).expect(404);
    expect(prisma.mentorProfile.update).not.toHaveBeenCalled();
  });

  it('reads her own profile back, or null when she has none', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/mentors/me').set(as('member-1')).expect(200);
    expect(res.body.data).toBeNull();
  });
});

describe('The mentor directory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.mentorProfile.count.mockResolvedValue(0);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('applies the sort the page asks for', async () => {
    await request(app).get('/api/mentors?sortBy=price_low').expect(200);
    expect(prisma.mentorProfile.findMany.mock.calls[0][0].orderBy[0]).toEqual({ hourlyRate: { sort: 'asc', nulls: 'last' } });
  });

  it('refuses a sort it cannot honour rather than pretending to', async () => {
    await request(app).get('/api/mentors?sortBy=rating').expect(400);
    expect(prisma.mentorProfile.findMany).not.toHaveBeenCalled();
  });

  it('serves no rating, because nothing writes one', async () => {
    await request(app).get('/api/mentors').expect(200);
    const select = prisma.mentorProfile.findMany.mock.calls[0][0].select;
    expect(select.rating).toBeUndefined();
    expect(select.reviewCount).toBeUndefined();
  });
});

describe('The hours a mentor is offered on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mentorProfile.findUnique.mockResolvedValue({ id: 'mp-1', isAvailable: true, user: { timezone: 'Australia/Brisbane' } });
    prisma.mentorSession.findMany.mockResolvedValue([]);
  });

  it('offers nothing on a Saturday or a Sunday', async () => {
    // 5 and 6 January 2030 are a Saturday and a Sunday.
    expect(await getAvailableSlots('mp-1', new Date('2030-01-05T02:00:00Z'), 'Australia/Brisbane')).toEqual([]);
    expect(await getAvailableSlots('mp-1', new Date('2030-01-06T02:00:00Z'), 'Australia/Brisbane')).toEqual([]);
  });

  it('offers nine to five on a weekday', async () => {
    const slots = await getAvailableSlots('mp-1', new Date('2030-01-07T02:00:00Z'), 'Australia/Brisbane');
    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      '2030-01-06T23:00:00.000Z',
      '2030-01-07T00:00:00.000Z',
      '2030-01-07T01:00:00.000Z',
      '2030-01-07T02:00:00.000Z',
      '2030-01-07T03:00:00.000Z',
      '2030-01-07T04:00:00.000Z',
      '2030-01-07T05:00:00.000Z',
      '2030-01-07T06:00:00.000Z',
    ]);
  });
});

describe('Cancelling a session whose hold cannot be released', () => {
  const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mentorSession.findUnique.mockResolvedValue({
      id: 's1',
      menteeId: 'mentee-1',
      mentorProfileId: 'mp-1',
      mentorProfile: { userId: 'mentor-1' },
      status: 'CONFIRMED',
      scheduledAt: FUTURE,
      durationMinutes: 60,
      stripePaymentIntentId: 'pi_1',
      paymentStatus: 'AUTHORIZED',
      sessionAmount: 100,
      currency: 'AUD',
    });
    prisma.mentorSession.update.mockImplementation(async ({ data }: any) => ({ id: 's1', ...data }));
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prisma.notification.create.mockResolvedValue({});
    notify.mockResolvedValue(undefined);
  });

  it('still cancels the session, leaves the payment status alone, and tells her and the admins', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'AUTHORIZED' });
    (stripeConnect.cancelEscrowPayment as jest.Mock).mockRejectedValue(new Error('Stripe is down') as never);

    const res = await request(app)
      .patch('/api/mentors/sessions/s1/status')
      .set(as('mentee-1'))
      .send({ status: 'CANCELED' })
      .expect(200);

    const written = prisma.mentorSession.update.mock.calls[0][0].data;
    expect(written.status).toBe('CANCELED');
    // The money has not moved, so the record does not say it has.
    expect(written.paymentStatus).toBeUndefined();
    expect(res.body.status).toBe('CANCELED');

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'mentee-1', title: 'Your session is cancelled, but the card hold is still in place' })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'admin-1', type: 'SYSTEM' }) })
    );
  });

  it('treats a hold that was already given back as released, not as a failure', async () => {
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'CANCELED' });

    await request(app).patch('/api/mentors/sessions/s1/status').set(as('mentee-1')).send({ status: 'CANCELED' }).expect(200);

    expect(stripeConnect.cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.mentorSession.update.mock.calls[0][0].data.paymentStatus).toBe('CANCELED');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('A mentor closing a paid session', () => {
  const PAST = new Date(Date.now() - 3 * 60 * 60 * 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mentorSession.findUnique.mockResolvedValue({
      id: 's2',
      menteeId: 'mentee-1',
      mentorProfileId: 'mp-1',
      mentorProfile: { userId: 'mentor-1' },
      status: 'CONFIRMED',
      scheduledAt: PAST,
      durationMinutes: 60,
      stripePaymentIntentId: 'pi_2',
      paymentStatus: 'AUTHORIZED',
      sessionAmount: 120,
      currency: 'AUD',
    });
    prisma.mentorSession.update.mockImplementation(async ({ data }: any) => ({ id: 's2', ...data }));
    prisma.mentorProfile.update.mockResolvedValue({});
    prisma.escrowPayment.findUnique.mockResolvedValue({ status: 'AUTHORIZED', capturedAt: null });
    (stripeConnect.captureEscrowPayment as jest.Mock).mockResolvedValue({ status: 'succeeded', amountCaptured: 12000 } as never);
    notify.mockResolvedValue(undefined);
  });

  it('tells the mentee what was charged and where to go if the hour did not happen', async () => {
    await request(app).patch('/api/mentors/sessions/s2/status').set(as('mentor-1')).send({ status: 'COMPLETED' }).expect(200);

    const notice: any = notify.mock.calls.find((call: any[]) => call[0].userId === 'mentee-1')?.[0];
    expect(notice.message).toContain('120.00 AUD was charged to your card');
    expect(notice.link).toBe('/dashboard/support');
  });
});
