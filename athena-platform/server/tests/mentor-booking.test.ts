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

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import Stripe from 'stripe';
import { app } from '../src/index';
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

function bookingBody(overrides: Record<string, unknown> = {}) {
  return {
    scheduledAt: '2026-02-15T02:00:00.000Z',
    durationMinutes: 60,
    note: 'Looking forward to discussing career options',
    ...overrides,
  };
}

describe('Booking a mentor session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('honours a supported preferred currency', async () => {
    mockMentorProfile();
    mockUser({ preferredCurrency: 'gbp' });

    await request(app)
      .post(`/api/mentors/${MENTOR_PROFILE}/book`)
      .set(as(MENTEE))
      .send(bookingBody())
      .expect(201);

    expect(stripe.paymentIntents.create.mock.calls[0][0].currency).toBe('gbp');
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

  it('notifies the mentor that a request is waiting', async () => {
    mockMentorProfile();

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
