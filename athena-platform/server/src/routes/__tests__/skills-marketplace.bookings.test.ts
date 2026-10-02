import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    skillService: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    serviceBooking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    serviceOrder: { findFirst: jest.fn(async () => null) },
    serviceReview: { create: jest.fn(), findFirst: jest.fn(async () => null), aggregate: jest.fn(async () => ({ _avg: { rating: 4.5 }, _count: { rating: 2 } })) },
    notification: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../services/stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(),
  captureEscrowPayment: jest.fn(async () => ({ status: 'captured' })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
  getEscrowClientSecret: jest.fn(async () => 'pi_1_secret'),
  stripeConnectService: {},
}));

jest.mock('../../services/admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));
jest.mock('../../services/admin-audit.service', () => ({
  ...(jest.requireActual('../../services/admin-audit.service') as object),
  auditAfterCommit: jest.fn(async () => undefined),
}));

// The caller's id and role come from headers so one suite can be buyer, provider or staff.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'client', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' };
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
import { ApiError } from '../../middleware/errorHandler';
import { cancelEscrowPayment, captureEscrowPayment, createEscrowPayment } from '../../services/stripe-connect.service';
import { notifyAdmins } from '../../services/admin-notify.service';
import { auditAfterCommit } from '../../services/admin-audit.service';

const prisma: any = prismaTyped;
const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

const service = { id: 's1', title: 'Pitch review', providerId: 'seller', isAvailable: true, status: 'ACTIVE', hourlyRate: 120, minimumHours: 2 };

const HOUR = 60 * 60 * 1000;
/** A start time `hours` from now, as the ISO string the app sends. */
const startingIn = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

// The marketplace fee, 15 per cent of A$240, as the hold works it out.
const hold = { escrowId: 'e1', paymentIntentId: 'pi_1', clientSecret: 'pi_1_secret', amount: 24000, platformFee: 3600 };

const bookingRow = (status: string, escrowStatus: string | null, over: Record<string, unknown> = {}) => ({
  id: 'b1',
  serviceId: 's1',
  clientId: 'client',
  status,
  scheduledAt: new Date(Date.now() - HOUR),
  durationMinutes: 60,
  escrowPaymentId: escrowStatus ? 'e1' : null,
  service: { id: 's1', title: service.title, providerId: 'seller' },
  escrow: escrowStatus ? { id: 'e1', status: escrowStatus, paymentIntentId: 'pi_1' } : null,
  ...over,
});

describe('Booking an hour of someone’s time', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.skillService.findUnique.mockResolvedValue(service);
    prisma.serviceBooking.create.mockImplementation(async ({ data }: any) => ({ id: 'b1', ...data }));
    (createEscrowPayment as any).mockResolvedValue(hold);
  });

  it('holds the money on the buyer’s card, prices it at the hourly rate never under the minimum, and hands back the secret', async () => {
    const res = await request(app)
      .post('/api/skills-marketplace/services/s1/book')
      .set(as('client'))
      .send({ scheduledAt: startingIn(24), durationMinutes: 60, clientNotes: 'Reviewing my pitch deck.' })
      .expect(201);

    // One hour asked for, two-hour minimum, so A$240, held in cents.
    expect((createEscrowPayment as any).mock.calls[0][0]).toMatchObject({
      buyerId: 'client',
      sellerId: 'seller',
      amount: 24000,
      currency: 'aud',
      sessionType: 'service_booking',
    });
    // No fee of its own: a booking costs what any marketplace sale costs.
    expect((createEscrowPayment as any).mock.calls[0][0].platformFeePercent).toBeUndefined();
    expect((createEscrowPayment as any).mock.calls[0][0].platformFeeAmount).toBeUndefined();
    const created = prisma.serviceBooking.create.mock.calls[0][0].data;
    // The fee is the one the hold carries, so the booking and the hold agree.
    expect(created).toMatchObject({ escrowPaymentId: 'e1', stripePaymentIntentId: 'pi_1', totalAmount: 240, platformFee: 36, providerPayout: 204 });
    expect(res.body.data.payment).toMatchObject({ clientSecret: 'pi_1_secret', amount: 24000 });
    expect(res.body.data.clientId).toBe('client');
  });

  it('refuses a time that has passed, and one too far off for a card hold to last, before any money is held', async () => {
    await request(app).post('/api/skills-marketplace/services/s1/book').set(as('client')).send({ scheduledAt: startingIn(-2), durationMinutes: 60 }).expect(400);
    const far = await request(app)
      .post('/api/skills-marketplace/services/s1/book')
      .set(as('client'))
      .send({ scheduledAt: startingIn(24 * 10), durationMinutes: 60 })
      .expect(400);

    expect(far.body.message).toMatch(/within the next 5 days/);
    expect(createEscrowPayment).not.toHaveBeenCalled();
  });

  it('is one booking when the same time is asked for twice, so a double tap does not hold the buyer’s card twice', async () => {
    const at = startingIn(24);
    prisma.serviceBooking.findFirst.mockResolvedValueOnce({ id: 'b-earlier' });

    const res = await request(app).post('/api/skills-marketplace/services/s1/book').set(as('client')).send({ scheduledAt: at, durationMinutes: 60 }).expect(409);

    expect(res.body.message).toMatch(/already asked for that time/);
    expect(createEscrowPayment).not.toHaveBeenCalled();
    // Only a booking that is still live counts: one that was cancelled does not block asking again.
    expect(prisma.serviceBooking.findFirst.mock.calls[0][0].where).toMatchObject({
      serviceId: 's1',
      clientId: 'client',
      scheduledAt: new Date(at),
      status: { in: ['PENDING', 'CONFIRMED'] },
    });
  });

  it('refuses a booking on a listing that is not taking work, and on the buyer’s own listing', async () => {
    prisma.skillService.findUnique.mockResolvedValue({ ...service, isAvailable: false });
    await request(app).post('/api/skills-marketplace/services/s1/book').set(as('client')).send({ scheduledAt: startingIn(24), durationMinutes: 60 }).expect(404);

    prisma.skillService.findUnique.mockResolvedValue(service);
    await request(app).post('/api/skills-marketplace/services/s1/book').set(as('seller')).send({ scheduledAt: startingIn(24), durationMinutes: 60 }).expect(400);
    expect(createEscrowPayment).not.toHaveBeenCalled();
  });

  it('a provider who has not set up payouts cannot be booked yet', async () => {
    (createEscrowPayment as any).mockRejectedValue(new ApiError(400, 'Seller has not set up payment account'));

    const res = await request(app).post('/api/skills-marketplace/services/s1/book').set(as('client')).send({ scheduledAt: startingIn(24), durationMinutes: 60 }).expect(409);

    expect(res.body.message).toMatch(/payouts/i);
    expect(prisma.serviceBooking.create).not.toHaveBeenCalled();
  });

  it('gives the hold back at once when the booking could not be saved', async () => {
    prisma.serviceBooking.create.mockRejectedValue(new Error('database is down'));

    await request(app).post('/api/skills-marketplace/services/s1/book').set(as('client')).send({ scheduledAt: startingIn(24), durationMinutes: 60 }).expect(500);

    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'client', role: 'USER' }, expect.stringMatching(/could not be saved/));
  });

  it('lists a member’s bookings from whichever side the member is on, with whether the money is held', async () => {
    await request(app).get('/api/skills-marketplace/bookings/me?role=provider').set(as('seller')).expect(200);
    expect(prisma.serviceBooking.findMany.mock.calls[0][0].where).toEqual({ service: { providerId: 'seller' } });
    expect(prisma.serviceBooking.findMany.mock.calls[0][0].include.escrow).toBeTruthy();

    await request(app).get('/api/skills-marketplace/bookings/me').set(as('client')).expect(200);
    expect(prisma.serviceBooking.findMany.mock.calls[1][0].where.OR).toEqual([
      { clientId: 'client' },
      { service: { providerId: 'client' } },
    ]);
  });
});

describe('Moving a booking on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.serviceBooking.updateMany.mockResolvedValue({ count: 1 });
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('PENDING', 'AUTHORIZED'));
  });

  const patch = (status: string, who = 'seller', role = 'USER', body: Record<string, unknown> = {}) =>
    request(app).patch('/api/skills-marketplace/bookings/b1').set(as(who, role)).send({ status, ...body });

  it('the provider cannot confirm until the buyer’s card is really held', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('PENDING', 'PENDING'));
    const early = await patch('CONFIRMED').expect(409);
    expect(early.body.message).toMatch(/not completed payment/);
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();

    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('PENDING', 'AUTHORIZED'));
    await patch('CONFIRMED').expect(200);
    // Conditional on the status it read, so two presses move it once.
    expect(prisma.serviceBooking.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'b1', status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'client', title: 'Your booking is confirmed' });
  });

  it('will not confirm a booking made before bookings were paid: there is nothing to pay the provider from', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('PENDING', null));

    const res = await patch('CONFIRMED').expect(409);

    expect(res.body.message).toMatch(/before bookings were paid/);
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('a client cannot mark a booking COMPLETED that nobody has confirmed, and cannot put one back to pending', async () => {
    const res = await patch('COMPLETED', 'client').expect(400);
    expect(res.body.message).toMatch(/pending cannot be completed/);
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();

    await patch('PENDING', 'client').expect(400);
  });

  it('the provider cannot say the session was given, which is the step that takes the buyer’s money', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'AUTHORIZED'));

    await patch('COMPLETED', 'seller').expect(403);

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('keeps a stranger out, and refuses a status that does not exist', async () => {
    await patch('CANCELLED', 'nosy').expect(403);
    await patch('NONSENSE', 'client').expect(400);
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('the buyer saying the session was given takes the money once, and records when it was paid', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValueOnce(bookingRow('CONFIRMED', 'AUTHORIZED'));
    prisma.serviceBooking.findUnique.mockResolvedValueOnce({ id: 'b1', status: 'COMPLETED' });

    await patch('COMPLETED', 'client').expect(200);

    expect(captureEscrowPayment).toHaveBeenCalledTimes(1);
    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'client', role: 'USER' });
    const data = prisma.serviceBooking.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('COMPLETED');
    expect(data.completedAt).toBeInstanceOf(Date);
    expect(data.paidAt).toBeInstanceOf(Date);
  });

  it('does not take the money twice when the sweep or staff already did', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'CAPTURED'));

    await patch('COMPLETED', 'client').expect(200);

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany.mock.calls[0][0].data.status).toBe('COMPLETED');
  });

  it('leaves the booking as it was, and tells the buyer why, when Stripe will not release the money', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'AUTHORIZED'));
    (captureEscrowPayment as any).mockRejectedValueOnce(new ApiError(409, 'The hold has expired'));

    await patch('COMPLETED', 'client').expect(409);

    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('cannot be said to be given before the session has started, or when the hold has ended', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'AUTHORIZED', { scheduledAt: new Date(Date.now() + 5 * HOUR) }));
    const early = await patch('COMPLETED', 'client').expect(400);
    expect(early.body.message).toMatch(/has not started/);

    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'CANCELED'));
    const ended = await patch('COMPLETED', 'client').expect(409);
    expect(ended.body.message).toMatch(/hold on the buyer’s card has ended/);

    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', null));
    await patch('COMPLETED', 'client').expect(409);
    expect(captureEscrowPayment).not.toHaveBeenCalled();
  });

  it('cancelling gives the hold back to the buyer’s card, whoever cancels', async () => {
    await patch('CANCELLED', 'seller', 'USER', { reason: 'Away that week' }).expect(200);

    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'seller', role: 'USER' }, 'Away that week');
    expect(prisma.serviceBooking.updateMany.mock.calls[0][0].data.status).toBe('CANCELLED');
    expect(prisma.notification.create.mock.calls[0][0].data.userId).toBe('client');
  });

  it('cannot cancel a booking that is under way, or whose money has already been released', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('IN_PROGRESS', 'AUTHORIZED'));
    await patch('CANCELLED', 'client').expect(400);

    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'CAPTURED'));
    const res = await patch('CANCELLED', 'client').expect(409);

    expect(res.body.message).toMatch(/already been released/);
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
  });

  it('only the buyer can dispute, and a dispute holds the money and tells the team', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'AUTHORIZED'));
    await patch('DISPUTED', 'seller').expect(403);

    await patch('DISPUTED', 'client', 'USER', { reason: 'The provider did not turn up' }).expect(200);

    const data = prisma.serviceBooking.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('DISPUTED');
    // What the team reads to decide it, and when it was said.
    expect(data.disputeReason).toBe('The provider did not turn up');
    expect(data.disputedAt).toBeInstanceOf(Date);
    // Held, not moved either way.
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    const notice = (notifyAdmins as any).mock.calls[0][0];
    expect(notice.message).toContain('The provider did not turn up');
    // To the list they settle it from, with the booking named.
    expect(notice.link).toBe('/admin/booking-disputes');
    expect(notice.data).toMatchObject({ kind: 'BOOKING_DISPUTED', bookingId: 'b1' });
  });

  it('cannot be disputed before the session has started: the way out of a time not yet come is to cancel', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(
      bookingRow('CONFIRMED', 'AUTHORIZED', { scheduledAt: new Date(Date.now() + 24 * HOUR) })
    );

    const res = await patch('DISPUTED', 'client', 'USER', { reason: 'Changed my mind' }).expect(400);

    expect(res.body.message).toMatch(/not started yet.*cancel/);
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
  });

  it('records no reason, rather than inventing one, when none is given', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'AUTHORIZED'));

    await patch('DISPUTED', 'client').expect(200);

    expect(prisma.serviceBooking.updateMany.mock.calls[0][0].data.disputeReason).toBeNull();
    expect((notifyAdmins as any).mock.calls[0][0].message).toContain('The buyer did not say why');
  });

  it('keeps staff off the parties’ route: a booking in dispute is settled from the staff one, which asks for the second factor', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('DISPUTED', 'AUTHORIZED'));

    await patch('COMPLETED', 'staff-1', 'ADMIN').expect(403);
    await patch('CANCELLED', 'staff-1', 'ADMIN').expect(403);

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('says so, and changes nothing, when the booking changed in the meantime', async () => {
    prisma.serviceBooking.updateMany.mockResolvedValue({ count: 0 });

    const res = await patch('CONFIRMED').expect(409);

    expect(res.body.message).toMatch(/just changed/);
  });
});

describe('Staff settling a booking in dispute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.serviceBooking.updateMany.mockResolvedValue({ count: 1 });
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('DISPUTED', 'AUTHORIZED'));
  });

  const settle = (outcome: string, who = 'staff-1', role = 'ADMIN', body: Record<string, unknown> = {}) =>
    request(app).post('/api/skills-marketplace/admin/bookings/b1/settle').set(as(who, role)).send({ outcome, ...body });

  it('releases the money to the provider, closes the booking, tells both people and writes who decided to the audit log', async () => {
    await settle('release').expect(200);

    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'staff-1', role: 'ADMIN' });
    // Conditional on its still being in dispute, so two decisions are one.
    const moved = prisma.serviceBooking.updateMany.mock.calls[0][0];
    expect(moved.where).toEqual({ id: 'b1', status: 'DISPUTED' });
    expect(moved.data).toMatchObject({ status: 'COMPLETED' });
    expect(moved.data.paidAt).toBeInstanceOf(Date);

    const told = prisma.notification.create.mock.calls.map((c: any[]) => c[0].data);
    expect(told.find((n: any) => n.userId === 'client')?.message).toMatch(/released the payment to the provider/);
    expect(told.find((n: any) => n.userId === 'seller')).toMatchObject({ title: 'You have been paid for a booking' });
    expect((auditAfterCommit as any).mock.calls[0][0]).toMatchObject({
      actorUserId: 'staff-1',
      metadata: { adminAction: 'BOOKING_DISPUTE_SETTLED', resourceId: 'b1', outcome: 'released_to_provider' },
    });
  });

  it('is open to a SUPER_ADMIN too, who reaches the hold as staff rather than being told it does not exist', async () => {
    await settle('release', 'founder', 'SUPER_ADMIN').expect(200);
    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'founder', role: 'ADMIN' });

    jest.clearAllMocks();
    prisma.serviceBooking.updateMany.mockResolvedValue({ count: 1 });
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('DISPUTED', 'AUTHORIZED'));
    await settle('return', 'founder', 'SUPER_ADMIN').expect(200);
    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'founder', role: 'ADMIN' }, expect.any(String));
  });

  it('gives the money back to the buyer’s card with the reason it was given, and tells both people', async () => {
    await settle('return', 'staff-1', 'ADMIN', { note: 'The provider did not turn up' }).expect(200);

    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'staff-1', role: 'ADMIN' }, 'The provider did not turn up');
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany.mock.calls[0][0].data).toEqual({ status: 'CANCELLED' });

    const told = prisma.notification.create.mock.calls.map((c: any[]) => c[0].data);
    expect(told.find((n: any) => n.userId === 'client')?.message).toMatch(/Nothing was taken/);
    expect(told.find((n: any) => n.userId === 'seller')?.message).toMatch(/gave the payment back to the buyer/);
    expect((auditAfterCommit as any).mock.calls[0][0].metadata.outcome).toBe('returned_to_buyer');
  });

  it('is for staff alone: neither the buyer, the provider nor a stranger can settle a booking', async () => {
    for (const who of ['client', 'seller', 'nosy']) {
      await settle('release', who, 'USER').expect(403);
    }

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('settles only a booking that is in dispute, and only with an outcome it knows', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('CONFIRMED', 'AUTHORIZED'));
    await settle('release').expect(409);
    await settle('keep').expect(400);
    prisma.serviceBooking.findUnique.mockResolvedValue(null);
    await settle('release').expect(404);

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
  });

  it('leaves the booking in dispute, and says why, when Stripe will not release the money', async () => {
    (captureEscrowPayment as any).mockRejectedValueOnce(new ApiError(409, 'The hold has expired'));

    const res = await settle('release').expect(409);

    expect(res.body.message).toMatch(/expired/);
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();
    expect(auditAfterCommit).not.toHaveBeenCalled();
  });

  it('will not release a hold that has ended, but can still close the booking by giving it back', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('DISPUTED', 'CANCELED'));

    const release = await settle('release').expect(409);
    expect(release.body.message).toMatch(/hold on the buyer’s card has ended/);
    expect(captureEscrowPayment).not.toHaveBeenCalled();

    await settle('return').expect(200);
    // Nothing is held, so nothing is cancelled at Stripe; the booking is closed.
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany.mock.calls[0][0].data).toEqual({ status: 'CANCELLED' });
  });

  it('does not capture twice for a hold the sweep already took, and will not give back what was released', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue(bookingRow('DISPUTED', 'CAPTURED'));

    const back = await settle('return').expect(409);
    expect(back.body.message).toMatch(/already been released/);
    expect(prisma.serviceBooking.updateMany).not.toHaveBeenCalled();

    await settle('release').expect(200);
    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.serviceBooking.updateMany.mock.calls[0][0].data.status).toBe('COMPLETED');
  });

  it('says so when another member of staff settled it first', async () => {
    prisma.serviceBooking.updateMany.mockResolvedValue({ count: 0 });

    const res = await settle('release').expect(409);

    expect(res.body.message).toMatch(/settled by somebody else/);
    expect(auditAfterCommit).not.toHaveBeenCalled();
  });
});

describe('The list of bookings in dispute', () => {
  const day = 24 * HOUR;
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'b1',
    scheduledAt: new Date(Date.now() - 2 * day),
    durationMinutes: 60,
    totalAmount: 240,
    platformFee: 36,
    providerPayout: 204,
    clientNotes: 'Reviewing my pitch deck.',
    disputedAt: new Date(Date.now() - day),
    disputeReason: 'The provider did not turn up',
    service: { id: 's1', title: 'Pitch review', provider: { id: 'seller', displayName: 'Mei Chen' } },
    client: { id: 'client', displayName: 'Sarah K' },
    escrow: { status: 'AUTHORIZED', createdAt: new Date(Date.now() - 3 * day), metadata: {} },
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is for staff alone', async () => {
    await request(app).get('/api/skills-marketplace/admin/bookings/disputed').set(as('client')).expect(403);

    expect(prisma.serviceBooking.findMany).not.toHaveBeenCalled();
  });

  it('lists only those in dispute, oldest first, with what the buyer said and until when the hold lasts', async () => {
    const held = new Date(Date.now() - 3 * day);
    prisma.serviceBooking.findMany.mockResolvedValue([row({ escrow: { status: 'AUTHORIZED', createdAt: held, metadata: {} } })]);

    const res = await request(app).get('/api/skills-marketplace/admin/bookings/disputed').set(as('staff-1', 'ADMIN')).expect(200);

    const query = prisma.serviceBooking.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: 'DISPUTED' });
    expect(query.orderBy[0]).toEqual({ disputedAt: 'asc' });
    const [booking] = res.body.data;
    expect(booking).toMatchObject({ id: 'b1', disputeReason: 'The provider did not turn up', providerPayout: 204 });
    expect(booking.client.displayName).toBe('Sarah K');
    // Seven days from the hold being made, the assumption when Stripe gave no deadline.
    expect(booking.hold.status).toBe('AUTHORIZED');
    expect(new Date(booking.hold.lapsesAt).getTime()).toBe(held.getTime() + 7 * day);
    // The hold's own notes are not sent.
    expect(JSON.stringify(res.body)).not.toContain('metadata');
  });

  it('says there is no money left to move when the hold has ended', async () => {
    prisma.serviceBooking.findMany.mockResolvedValue([row({ escrow: { status: 'CANCELED', createdAt: new Date(), metadata: {} } }), row({ id: 'b2', escrow: null })]);

    const res = await request(app).get('/api/skills-marketplace/admin/bookings/disputed').set(as('staff-1', 'ADMIN')).expect(200);

    expect(res.body.data[0].hold).toEqual({ status: 'CANCELED', lapsesAt: null });
    expect(res.body.data[1].hold).toBeNull();
  });
});

describe('Paying for a booking whose card step was left', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives the buyer the secret for a hold still waiting, and nobody else anything', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue({
      clientId: 'client',
      totalAmount: 240,
      escrow: { status: 'PENDING', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1' },
    });

    const res = await request(app).get('/api/skills-marketplace/bookings/b1/payment').set(as('client')).expect(200);
    expect(res.body.data).toMatchObject({ status: 'PENDING', clientSecret: 'pi_1_secret', amount: 24000 });

    await request(app).get('/api/skills-marketplace/bookings/b1/payment').set(as('seller')).expect(404);
  });

  it('gives no secret once the hold is past that step', async () => {
    prisma.serviceBooking.findUnique.mockResolvedValue({
      clientId: 'client',
      totalAmount: 240,
      escrow: { status: 'AUTHORIZED', amount: 24000, currency: 'aud', paymentIntentId: 'pi_1' },
    });

    const res = await request(app).get('/api/skills-marketplace/bookings/b1/payment').set(as('client')).expect(200);

    expect(res.body.data).toMatchObject({ status: 'AUTHORIZED', clientSecret: null });
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
