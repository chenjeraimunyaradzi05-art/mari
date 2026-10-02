import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Booking a mentor is the platform's first money-moving flow, so this suite
// covers who may book, what is charged and what gets written down.
//
// It replaces a hand-run ts-node script that needed a live database and an API
// listening on port 5000, so it never ran in CI and quietly rotted: it still
// posted the old `{ date, time, duration }` body and addressed a mentor by user
// id rather than by mentor-profile id. Jest collected it, found no `it()` and
// reported the suite as failing.

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    mentorProfile: { findUnique: jest.fn() },
    mentorSession: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    // Mentor holds run through the shared escrow path now, so the booking
    // writes an EscrowPayment row the expiry sweeper can see. Before this the
    // hold was a bare PaymentIntent invisible to the sweeper, and a session
    // booked more than seven days out lapsed with the mentor never paid.
    escrowPayment: { create: jest.fn(async (args: any) => ({ id: 'esc-1', ...args.data })), update: jest.fn(), findUnique: jest.fn() },
  },
}));

jest.mock('stripe', () => {
  const stripeClient = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      capture: jest.fn(),
      cancel: jest.fn(),
    },
    accounts: { create: jest.fn(), createLoginLink: jest.fn() },
    accountLinks: { create: jest.fn() },
    transfers: { create: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  };

  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;

  return { __esModule: true, default: StripeMock };
});

// Other services construct their own NotificationService, so the class has to
// survive the mock alongside the shared singleton.
jest.mock('../src/services/notification.service', () => {
  const notify = jest.fn();
  class NotificationService {
    notify = notify;
  }
  return { NotificationService, notificationService: new NotificationService() };
});

// Unauthenticated requests still have to be rejected, so this mock honours the
// header rather than signing everybody in.
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.user = { id, role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

// Nobody has blocked anybody in these tests: a payment is refused across a block.
jest.mock('../src/utils/safety-store', () => ({ isBlockedRelationship: jest.fn(async () => false) }));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import { app } from '../src/index';
import { resetMemoryRateLimits } from '../src/middleware/rateLimiter';
import { prisma as prismaTyped } from '../src/utils/prisma';
import { notificationService } from '../src/services/notification.service';

const prisma: any = prismaTyped;
const stripe: any = (Stripe as any).__client;

const MENTEE = 'mentee-1';
const MENTOR_USER = 'mentor-user-1';
const MENTOR_PROFILE = 'mentor-profile-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

function mockMentorProfile(overrides: Record<string, unknown> = {}) {
  (prisma.mentorProfile.findUnique as any).mockResolvedValue({
    id: MENTOR_PROFILE,
    userId: MENTOR_USER,
    hourlyRate: 100,
    isAvailable: true,
    stripeAccountId: 'acct_mentor',
    ...overrides,
  });
}

/**
 * prisma.user.findUnique answers two questions in this flow: the mentee's
 * preferred currency, and — since the Stripe Connect identity was unified onto
 * User.stripeConnectAccountId — which connected account the mentor is paid
 * through. One default serves both, and the not-connected test clears it.
 */
function mockUser(overrides: Record<string, unknown> = {}) {
  (prisma.user.findUnique as any).mockResolvedValue({
    preferredCurrency: 'AUD',
    stripeConnectAccountId: 'acct_mentor',
    // Escrow refuses a seller Stripe has not finished verifying.
    stripeConnectStatus: 'ACTIVE',
    mentorProfile: { stripeAccountId: 'acct_mentor' },
    creatorProfile: null,
    ...overrides,
  });
}

const DAY = 24 * 60 * 60 * 1000;

// Relative to now, because a time that has passed cannot be booked and a paid
// session cannot be booked further out than its card hold lasts.
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function bookingBody(overrides: Record<string, unknown> = {}) {
  return {
    scheduledAt: inDays(3),
    durationMinutes: 60,
    note: 'Looking forward to discussing career options',
    ...overrides,
  };
}

describe('Booking a mentor session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Every test books as the same member, and a member may start only so many
    // payments an hour (middleware/moneyLimits.ts), so the window starts empty.
    resetMemoryRateLimits();
    // The hold is created through the shared escrow service now, and that
    // service falls back to a fabricated intent when no key is configured. This
    // suite is about the real authorisation — the amount, the currency, the
    // platform fee and the manual capture — so it configures one.
    process.env.STRIPE_SECRET_KEY = 'sk_test_mentor_booking';
    mockUser();
    (prisma.mentorSession.create as any).mockImplementation(async (args: any) => ({
      id: 'sess-1',
      ...args.data,
    }));
    (prisma.mentorSession.update as any).mockImplementation(async (args: any) => ({
      id: 'sess-1',
      ...args.data,
    }));
    stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret' });
    (notificationService.notify as any).mockResolvedValue(undefined);
  });

  it('requires authentication', async () => {
    await request(app).post(`/api/mentors/${MENTOR_PROFILE}/book`).send(bookingBody()).expect(401);

    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
  });

  it('creates a REQUESTED session and returns the payment intent secret', async () => {
    mockMentorProfile();

    const res = await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect(res.body.paymentIntentClientSecret).toBe('pi_1_secret');

    expect((prisma.mentorSession.create as any).mock.calls[0][0].data).toMatchObject({
      mentorProfileId: MENTOR_PROFILE,
      menteeId: MENTEE,
      durationMinutes: 60,
      status: 'REQUESTED',
      paymentStatus: 'PENDING',
    });
  });

  it('addresses the mentor by profile id, not by user id', async () => {
    (prisma.mentorProfile.findUnique as any).mockResolvedValue(null);

    await request(app)
      .post(`/api/mentors/${MENTOR_USER}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(404);
  });

  it('charges the hourly rate pro rata and keeps a 20% platform fee', async () => {
    mockMentorProfile({ hourlyRate: 120 });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ durationMinutes: 30 }))
      .expect(201);

    const created = (prisma.mentorSession.create as any).mock.calls[0][0].data;
    expect(created.sessionAmount).toBeCloseTo(60);
    expect(created.platformFee).toBeCloseTo(12);
    expect(created.mentorPayout).toBeCloseTo(48);
  });

  // A 45-minute session at 33.33 an hour was charged as 25.00 with a 5.00 fee and
  // recorded as 24.9975, 4.9995 and 19.998: the rows, the card and Stripe did not
  // agree by a fraction of a cent, and the earnings statement added the fractions.
  // The amount and the fee are rounded to a cent once, in cents, and the same
  // cents go to Stripe and to the rows.
  it('records, to the cent, exactly what the card is charged and Stripe is sent as the fee (45 minutes at 33.33)', async () => {
    mockMentorProfile({ hourlyRate: 33.33 });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ durationMinutes: 45 }))
      .expect(201);

    const intent = stripe.paymentIntents.create.mock.calls[0][0];
    expect(intent.amount).toBe(2500);
    expect(intent.application_fee_amount).toBe(500);

    const created = (prisma.mentorSession.create as any).mock.calls[0][0].data;
    expect(created.sessionAmount).toBe(25);
    expect(created.platformFee).toBe(5);
    expect(created.mentorPayout).toBe(20);
    // Two decimals at most, and the three add up to the charge.
    expect(Math.round(created.sessionAmount * 100)).toBe(intent.amount);
    expect(Math.round(created.platformFee * 100)).toBe(intent.application_fee_amount);
    expect(Math.round(created.mentorPayout * 100)).toBe(intent.amount - intent.application_fee_amount);
  });

  it.each([
    [29.99, 20],
    [77.77, 50],
    [45.5, 75],
    [100, 15],
  ])('splits a session at %d an hour for %d minutes so that fee and payout always add up to the charge', async (rate, minutes) => {
    mockMentorProfile({ hourlyRate: rate });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ durationMinutes: minutes }))
      .expect(201);

    const intent = stripe.paymentIntents.create.mock.calls[0][0];
    const created = (prisma.mentorSession.create as any).mock.calls[0][0].data;
    expect(Number.isInteger(intent.amount)).toBe(true);
    expect(Number.isInteger(intent.application_fee_amount)).toBe(true);
    expect(Math.round(created.sessionAmount * 100)).toBe(intent.amount);
    expect(Math.round(created.platformFee * 100)).toBe(intent.application_fee_amount);
    expect(Math.round(created.mentorPayout * 100) + Math.round(created.platformFee * 100)).toBe(intent.amount);
  });

  it('defaults to AUD and authorises the charge without capturing it', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect(stripe.paymentIntents.create.mock.calls[0][0]).toMatchObject({
      amount: 10000,
      currency: 'aud',
      // The mentee is not charged until the mentor accepts.
      capture_method: 'manual',
      application_fee_amount: 2000,
      transfer_data: { destination: 'acct_mentor' },
    });
  });

  // A mentor's hourlyRate is a bare number that every page shows as Australian
  // dollars. It used to be charged in whatever currency the mentee had chosen,
  // so 100 was A$100 to one mentee and 100 dong to another, and the mentor was
  // paid out of the smaller charge. Whatever she has chosen, the session is
  // charged in AUD at the amount the page quoted.
  it.each(['gbp', 'VND', 'PHP', 'xyz'])(
    'charges in AUD, at the quoted amount, whatever currency the mentee prefers (%s)',
    async (preferredCurrency) => {
      mockMentorProfile({ hourlyRate: 100 });
      mockUser({ preferredCurrency });

      await request(app)
        .post(`/api/mentors/${MENTOR_PROFILE}/book`)
        .set(as(MENTEE))
        .send(bookingBody())
        .expect(201);

      const intent = stripe.paymentIntents.create.mock.calls[0][0];
      expect(intent.currency).toBe('aud');
      expect(intent.amount).toBe(10000);
      expect((prisma.mentorSession.create as any).mock.calls[0][0].data.currency).toBe('AUD');
    }
  );

  it('asks Stripe for one hold per booking, so a repeated request cannot make two', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect(stripe.paymentIntents.create.mock.calls[0][1]).toEqual({ idempotencyKey: 'mentor-hold-sess-1' });
  });

  it('stores the payment intent id against the session', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect((prisma.mentorSession.update as any).mock.calls[0][0]).toMatchObject({
      where: { id: 'sess-1' },
      data: { stripePaymentIntentId: 'pi_1' },
    });
  });

  // A paid request is the mentor's to answer once the mentee's card is held, so
  // she is told by the webhook that says so, not when the intent is created.
  it('does not tell the mentor of a paid request until the card is authorised', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  // A free session has no card step, so there is nothing to wait for.
  it('notifies the mentor at once that a free request is waiting', async () => {
    mockMentorProfile({ hourlyRate: 0 });
    mockUser({ stripeConnectAccountId: null, mentorProfile: { stripeAccountId: null } });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect((notificationService.notify as any).mock.calls[0][0]).toMatchObject({
      userId: MENTOR_USER,
      type: 'MENTOR_SESSION',
    });
  });

  it('refuses a time that has passed, and holds nothing', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ scheduledAt: inDays(-1) }))
      .expect(400);

    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  // The hold on a card lasts about a week and nothing renews it. Booked three
  // weeks out, it ran out in the first, the capture failed, and the mentor was
  // never paid for the hour.
  it('refuses a paid session further out than its card hold will last, and holds nothing', async () => {
    mockMentorProfile();

    const res = await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ scheduledAt: inDays(21) }))
      .expect(400);

    expect(res.body.message ?? res.body.error).toMatch(/up to 6 days ahead/);
    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('books a free session a month ahead, which has no hold to run out', async () => {
    mockMentorProfile({ hourlyRate: 0 });
    mockUser({ stripeConnectAccountId: null, mentorProfile: { stripeAccountId: null } });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ scheduledAt: inDays(30) }))
      .expect(201);

    expect(prisma.mentorSession.create).toHaveBeenCalledTimes(1);
  });

  // The note is the mentee's own words, and the mentor reads it in an email from
  // ATHENA's address, so it is shown as text. A free request is the one the mentor
  // is told of at booking; a paid one is told of by the webhook, with the same
  // notice.
  it('puts a mentee\'s note into the mentor\'s email as text, never as markup', async () => {
    mockMentorProfile({ hourlyRate: 0 });
    mockUser({ stripeConnectAccountId: null, mentorProfile: { stripeAccountId: null } });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ note: '<a href="https://evil.example/login">Confirm your payout</a>' }))
      .expect(201);

    const html: string = (notificationService.notify as any).mock.calls[0][0].emailTemplate.html;
    expect(html).toContain('&lt;a href=&quot;https://evil.example/login&quot;&gt;Confirm your payout&lt;/a&gt;');
    expect(html).not.toContain('<a href="https://evil.example');
  });

  it('refuses a session with yourself', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTOR_USER))
      .send(bookingBody())
      .expect(400);

    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
  });

  it('refuses a mentor who has not set an hourly rate', async () => {
    // null, not 0. A null rate means she has not said what she charges and there
    // is no amount to authorise; zero means she has said, and the answer is
    // nothing. Conflating them made a woman offering to mentor for free
    // unbookable while still being published as a mentor.
    mockMentorProfile({ hourlyRate: null });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(400);

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  // The other half of that distinction, and the reason it matters. A mentor who
  // charges nothing needs no Stripe account either: requiring one before a free
  // session could be booked would make "I will do this for nothing" the single
  // thing this marketplace could not arrange.
  it('books a mentor who charges nothing, and authorises no card for it', async () => {
    mockMentorProfile({ hourlyRate: 0 });
    mockUser({ stripeConnectAccountId: null, mentorProfile: { stripeAccountId: null } });

    const res = await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect((prisma.mentorSession.create as any).mock.calls[0][0].data).toMatchObject({
      sessionAmount: 0,
      platformFee: 0,
      mentorPayout: 0,
    });
    expect(res.body.paymentIntentClientSecret ?? null).toBeNull();
  });

  it('refuses a mentor who is not connected to payments', async () => {
    mockMentorProfile({ stripeAccountId: null });
    // No connected account anywhere: not on the profile, and not the unified
    // identity the resolver prefers.
    mockUser({ stripeConnectAccountId: null, mentorProfile: { stripeAccountId: null } });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(400);

    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
  });

  it('rejects a booking with no scheduled time', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send({ durationMinutes: 60 })
      .expect(400);

    expect(prisma.mentorProfile.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a duration outside the bookable range', async () => {
    mockMentorProfile();

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody({ durationMinutes: 600 }))
      .expect(400);
  });
});
