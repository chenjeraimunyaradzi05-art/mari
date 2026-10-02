jest.mock('../../utils/prisma', () => ({
  prisma: {
    escrowPayment: {
      findMany: jest.fn(),
    },
    mentorSession: {
      findMany: jest.fn(async () => []),
      // No session behind the hold unless a test says otherwise, which is the
      // path every hold that is not a mentor session takes.
      findUnique: jest.fn(async () => null),
      update: jest.fn(async () => ({})),
    },
    user: {
      findMany: jest.fn(async () => []),
    },
    notification: {
      // The sweep checks for a notification it has already sent before sending
      // another, so this has to answer as well as create. Null is "nothing sent
      // recently", which is the state every test below wants unless it says
      // otherwise.
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../../utils/redis', () => ({
  runExclusively: jest.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../stripe-connect.service', () => ({
  captureEscrowPayment: jest.fn(async () => ({ status: 'succeeded', amountCaptured: 1000 })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
  PLATFORM_ESCROW_ACTOR: { id: 'system', role: 'ADMIN' },
  // Stripe still holding it is the answer that leaves the old behaviour in
  // place, so it is the default; the tests about resolution say otherwise.
  resolveLapsedEscrowHold: jest.fn(async () => ({ state: 'still_held' })),
  adoptUnledgeredMentorSessionHold: jest.fn(async () => true),
  minorUnitScale: () => 100,
}));

// No Stripe key unless a test says otherwise, which keeps legacy sessions on
// the warning path the older tests describe.
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: jest.fn(() => false),
}));

// What it does is tested in mentor-session-authorisation.service.test.ts; here
// only that the sweep runs it, reports it, and survives its failing.
jest.mock('../mentor-session-authorisation.service', () => ({
  cancelUnpaidMentorRequests: jest.fn(async () => ({ authorised: 0, cancelled: 0, deferred: 0 })),
}));

// Started alongside the sweep; nothing here is about it.
jest.mock('../stripe-reconciliation.service', () => ({
  startStripeReconciler: jest.fn(),
  stopStripeReconciler: jest.fn(),
}));

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/errorHandler';
import { isStripeConfigured } from '../../utils/stripe';
import * as stripeConnect from '../stripe-connect.service';
import { cancelUnpaidMentorRequests } from '../mentor-session-authorisation.service';
import { runEscrowExpirySweep } from '../escrow-expiry.service';

const prismaAny: any = prisma;
const captureMock = stripeConnect.captureEscrowPayment as jest.Mock;
const cancelMock = stripeConnect.cancelEscrowPayment as jest.Mock;
const resolveMock = stripeConnect.resolveLapsedEscrowHold as jest.Mock;
const adoptMock = stripeConnect.adoptUnledgeredMentorSessionHold as jest.Mock;
const stripeConfiguredMock = isStripeConfigured as jest.Mock;
const errorMock = logger.error as jest.Mock;
const warnMock = logger.warn as jest.Mock;

const NOW = new Date('2026-09-17T00:00:00.000Z');

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const hold = (overrides: Record<string, unknown> = {}) => ({
  id: 'escrow-1',
  paymentIntentId: 'pi_1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  amount: 25000,
  currency: 'AUD',
  createdAt: daysAgo(6),
  description: 'Car inspection',
  status: 'AUTHORIZED',
  sessionType: null,
  metadata: null,
  serviceOrder: null,
  ...overrides,
});

describe('Escrow holds approaching the end of their authorisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
  });

  it('warns about a hold that is close to lapsing without taking the money', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.expiringSoon).toBe(1);
    expect(result.captured).toBe(0);
    expect(captureMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
  });

  it('reports a hold that has already outlived its authorisation as an error', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.alreadyLapsed).toBe(1);
    expect(result.expiringSoon).toBe(0);
    expect(errorMock).toHaveBeenCalled();
  });

  it('captures early only when that has been switched on deliberately', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.captured).toBe(1);
    expect(captureMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
  });

  it('counts a failed capture rather than letting it pass silently', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
    captureMock.mockRejectedValueOnce(new Error('card declined'));

    const result = await runEscrowExpirySweep(NOW);

    expect(result.failed).toBe(1);
    expect(result.captured).toBe(0);
    expect(errorMock).toHaveBeenCalled();
  });

  it('does not count a capture refused because payments are paused as a failure, and leaves the hold for the next sweep', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
    captureMock.mockRejectedValueOnce(new ApiError(503, 'Payments are paused.', { code: 'PAYMENTS_PAUSED' }));

    const result = await runEscrowExpirySweep(NOW);

    // A pause is a decision an admin made, not a card that was declined: raising
    // the failure alarm for it would be false, and would go on being false every
    // sweep until the pause was lifted.
    expect(result.failed).toBe(0);
    expect(result.captured).toBe(0);
    expect(errorMock).not.toHaveBeenCalledWith('Could not capture an escrow hold before expiry', expect.anything());
    expect(warnMock).toHaveBeenCalledWith(
      'An escrow hold was left uncaptured because payments are paused',
      expect.objectContaining({ escrowId: 'escrow-1' })
    );
  });

  it('does not try to capture a hold with no payment intent behind it', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ paymentIntentId: null })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(result.expiringSoon).toBe(1);
  });

  // Mentor sessions booked before mentoring moved onto the shared escrow path
  // hold real money with no EscrowPayment row behind them. They were invisible
  // to this sweep, so a session booked a fortnight out lost its authorisation
  // in silence and the mentor was never paid.
  describe('mentor sessions with no escrow row', () => {
    const session = (overrides: Record<string, unknown> = {}) => ({
      id: 'session-1',
      stripePaymentIntentId: 'pi_session_1',
      sessionAmount: 180,
      currency: 'AUD',
      createdAt: daysAgo(6),
      ...overrides,
    });

    it('warns about one whose authorisation is about to lapse', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session()]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.checked).toBe(1);
      expect(result.expiringSoon).toBe(1);
      expect(warnMock).toHaveBeenCalled();
    });

    it('reports one that has already lapsed as an error', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session({ createdAt: daysAgo(9) })]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.alreadyLapsed).toBe(1);
      expect(errorMock).toHaveBeenCalled();
    });

    it('never captures one early, because nothing would record that the money moved', async () => {
      process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
      prismaAny.escrowPayment.findMany.mockResolvedValue([]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session()]);

      const result = await runEscrowExpirySweep(NOW);

      expect(captureMock).not.toHaveBeenCalled();
      expect(result.captured).toBe(0);
    });

    it('counts a session that does have an escrow row only once', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ paymentIntentId: 'pi_session_1' })]);
      prismaAny.mentorSession.findMany.mockResolvedValue([session()]);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.checked).toBe(1);
      expect(result.expiringSoon).toBe(1);
    });
  });

  it('tells administrators when holds have been lost', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);
    prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

    await runEscrowExpirySweep(NOW);

    expect(prismaAny.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'admin-1', type: 'SYSTEM' }),
      })
    );
  });

  // The escalation used to fire only once a hold had already outlived its
  // authorisation — that is, once the seller had most likely lost the money for
  // work she had already delivered. These two cover the warning that arrives
  // while somebody can still do something about it.
  describe('escalating while the money can still be collected', () => {
    it('tells administrators about a hold that is about to lapse, not only one that has', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
      prismaAny.mentorSession.findMany.mockResolvedValue([]);
      prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      prismaAny.notification.findFirst.mockResolvedValue(null);

      const result = await runEscrowExpirySweep(NOW);

      expect(result.expiringSoon).toBe(1);
      expect(result.alreadyLapsed).toBe(0);
      expect(prismaAny.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            title: 'Escrow holds are about to lapse',
          }),
        })
      );
    });

    it('does not raise the same condition again the same day', async () => {
      prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);
      prismaAny.mentorSession.findMany.mockResolvedValue([]);
      prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      // The sweep runs every six hours and nothing in it resolves a hold, so
      // without this check one hold would notify every admin four times a day
      // until a human dealt with it.
      prismaAny.notification.findFirst.mockResolvedValue({ id: 'notif-1' });

      await runEscrowExpirySweep(NOW);

      expect(prismaAny.notification.create).not.toHaveBeenCalled();
    });
  });
});

// A lapsed hold used to stay PENDING or AUTHORIZED for good, and every one was
// reported as money that "may no longer be collectable" — including the ones
// whose capture had succeeded and only the row update had failed, so the
// seller had been paid and the admins were told she might not have been.
describe('Holds that have outlived their authorisation are settled to what Stripe says', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  const titlesSent = () =>
    prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data.title);

  it('counts a hold Stripe had in fact captured as repaired, and does not report the seller as unpaid', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);
    resolveMock.mockResolvedValueOnce({ state: 'captured', changed: true });

    const result = await runEscrowExpirySweep(NOW);

    expect(resolveMock).toHaveBeenCalledWith('pi_1');
    expect(result.repaired).toBe(1);
    expect(result.alreadyLapsed).toBe(0);
    expect(titlesSent()).not.toContain('Escrow holds need attention');
  });

  it('tells the buyer, the seller and the admins when Stripe let a hold expire', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([
      hold({ createdAt: daysAgo(9), sessionType: 'car_service' }),
    ]);
    resolveMock.mockResolvedValueOnce({ state: 'expired', changed: true });
    // A standing notice was sent within the day; a one-off expiry must still go.
    prismaAny.notification.findFirst.mockResolvedValue({ id: 'notif-earlier' });

    const result = await runEscrowExpirySweep(NOW);

    expect(result.expired).toBe(1);
    expect(result.alreadyLapsed).toBe(0);

    const created = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data);
    const buyer = created.find((d: any) => d.userId === 'buyer-1');
    const seller = created.find((d: any) => d.userId === 'seller-1');
    const admin = created.find((d: any) => d.userId === 'admin-1');

    expect(buyer.message).toMatch(/not been charged/);
    expect(buyer.message).toContain('$250.00');
    expect(buyer.link).toBe('/dashboard/cars/bookings');
    expect(seller.message).toMatch(/has not reached you/);
    expect(admin.title).toBe('Escrow holds expired before release');
    expect(admin.data.escrowIds).toEqual(['escrow-1']);
  });

  it('tells nobody again about a hold another process had already settled', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);
    resolveMock.mockResolvedValueOnce({ state: 'expired', changed: false });

    const result = await runEscrowExpirySweep(NOW);

    expect(result.expired).toBe(1);
    expect(prismaAny.notification.create).not.toHaveBeenCalled();
  });

  it('does not count a hold nobody ever paid for as lost money', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9), status: 'PENDING' })]);
    resolveMock.mockResolvedValueOnce({ state: 'unpaid' });

    const result = await runEscrowExpirySweep(NOW);

    expect(result.neverPaid).toBe(1);
    expect(result.alreadyLapsed).toBe(0);
    expect(titlesSent()).not.toContain('Escrow holds need attention');
  });

  it('falls back to reporting the hold as lapsed when Stripe cannot be asked', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ createdAt: daysAgo(9) })]);
    resolveMock.mockRejectedValueOnce(new Error('stripe is down'));

    const result = await runEscrowExpirySweep(NOW);

    expect(result.alreadyLapsed).toBe(1);
    expect(titlesSent()).toContain('Escrow holds need attention');
  });
});

// The buyer is the one whose confirmation releases most holds, and nothing
// used to ask her. Only admins were told, and only in a log line until lately.
describe('Asking the buyer to release a hold before it lapses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.user.findMany.mockResolvedValue([]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  const buyerNotices = () =>
    prismaAny.notification.create.mock.calls
      .map((call: any[]) => call[0].data)
      .filter((d: any) => d.userId === 'buyer-1');

  it('asks her once, with a link to the order she releases it from and the day it expires', async () => {
    // Delivered: the work is in her hands, so what she is asked to do is release it.
    prismaAny.escrowPayment.findMany.mockResolvedValue([
      hold({ sessionType: 'service_order', serviceOrder: { id: 'order-7', status: 'DELIVERED' } }),
    ]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.buyersReminded).toBe(1);
    const [notice] = buyerNotices();
    expect(notice.title).toBe('A payment is waiting for you to release it');
    expect(notice.link).toBe('/skills-marketplace/orders/order-7');
    expect(notice.data).toEqual({ kind: 'ESCROW_RELEASE_REMINDER', escrowId: 'escrow-1' });
    // Created six days before 17 September, so it lapses on the 18th.
    expect(notice.message).toMatch(/18 September/);
    expect(notice.message).toContain('$250.00');
  });

  it('does not ask her twice about the same hold', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ sessionType: 'car_service' })]);
    prismaAny.notification.findFirst.mockResolvedValue({ id: 'already-asked' });

    const result = await runEscrowExpirySweep(NOW);

    expect(result.buyersReminded).toBe(0);
    expect(buyerNotices()).toHaveLength(0);
  });

  it('does not ask about a payment she never completed', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([
      hold({ sessionType: 'car_service', status: 'PENDING' }),
    ]);

    await runEscrowExpirySweep(NOW);
    expect(buyerNotices()).toHaveLength(0);
  });

  it('does not ask a buyer who has no screen to release it from', async () => {
    // A mentor session is released when the session is completed, not by her.
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ sessionType: 'mentor_session' })]);

    await runEscrowExpirySweep(NOW);
    expect(buyerNotices()).toHaveLength(0);
  });

  it('does not ask her when the platform is capturing early instead', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ sessionType: 'car_service' })]);

    await runEscrowExpirySweep(NOW);
    expect(buyerNotices()).toHaveLength(0);
  });
});

// A cancelled session whose release failed keeps its hold AUTHORIZED on
// purpose, and the early capture looked only at the escrow row — so it charged
// the mentee for a session that had been called off. A session booked a
// fortnight out was captured before its hour had happened.
describe('Early capture of a mentor session hold', () => {
  const mentorHold = () => hold({ sessionType: 'mentor_session', description: 'Mentor session' });

  const sessionRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-9',
    status: 'CONFIRMED',
    scheduledAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
    durationMinutes: 60,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.escrowPayment.findMany.mockResolvedValue([mentorHold()]);
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  afterAll(() => {
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
  });

  it('gives the hold back instead of capturing it when the session was cancelled', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(sessionRow({ status: 'CANCELED' }));

    const result = await runEscrowExpirySweep(NOW);

    expect(prismaAny.mentorSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripePaymentIntentId: 'pi_1' } })
    );
    expect(captureMock).not.toHaveBeenCalled();
    expect(cancelMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' }, 'Session canceled');
    expect(result.released).toBe(1);
    expect(result.captured).toBe(0);
    expect(prismaAny.mentorSession.update).toHaveBeenCalledWith({
      where: { id: 'session-9' },
      data: expect.objectContaining({ paymentStatus: 'CANCELED' }),
    });
  });

  it('tells the admins, and still does not capture, when that release fails', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(sessionRow({ status: 'CANCELED' }));
    cancelMock.mockRejectedValueOnce(new Error('stripe is down'));

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(result.releaseFailed).toBe(1);
    expect(result.failed).toBe(0);
    expect(prismaAny.mentorSession.update).not.toHaveBeenCalled();
    const admin = prismaAny.notification.create.mock.calls
      .map((call: any[]) => call[0].data)
      .find((d: any) => d.title === 'Escrow holds need attention');
    expect(admin.message).toMatch(/cancelled orders, bookings or mentor sessions could not be released/);
  });

  it('does not capture a confirmed session whose hour has not come yet', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(
      sessionRow({ scheduledAt: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000) })
    );

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(result.awaitingSession).toBe(1);
    expect(warnMock).toHaveBeenCalledWith(
      'Escrow hold is close to expiring but its mentor session has not happened',
      expect.objectContaining({ sessionId: 'session-9' })
    );
  });

  it('never captures a session the mentor did not accept, even after its date', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(sessionRow({ status: 'REQUESTED' }));

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(result.awaitingSession).toBe(1);
  });

  it('captures a confirmed session whose hour is over, and marks the session paid', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(sessionRow());

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
    expect(result.captured).toBe(1);
    expect(prismaAny.mentorSession.update).toHaveBeenCalledWith({
      where: { id: 'session-9' },
      data: expect.objectContaining({ paymentStatus: 'CAPTURED' }),
    });
  });

  it('does not capture when the session cannot be looked up', async () => {
    prismaAny.mentorSession.findUnique.mockRejectedValueOnce(new Error('database is down'));

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });
});

// Early capture looked at the escrow row alone, so turning it on would have
// paid sellers for orders nobody had delivered, jobs the workshop had not
// finished, and car purchases still inside the buyer's inspection period.
describe('Early capture asks the flow behind every hold, not only mentor sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.mentorSession.findUnique.mockResolvedValue(null);
    prismaAny.user.findMany.mockResolvedValue([]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  afterAll(() => {
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
  });

  const sweepOne = async (overrides: Record<string, unknown>) => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold(overrides)]);
    return runEscrowExpirySweep(NOW);
  };

  it('does not capture a marketplace order that has not been delivered', async () => {
    const result = await sweepOne({ sessionType: 'service_order', serviceOrder: { id: 'order-1', status: 'ACCEPTED' } });
    expect(captureMock).not.toHaveBeenCalled();
    expect(result.awaitingSession).toBe(1);
  });

  it('captures a marketplace order the seller has delivered', async () => {
    const result = await sweepOne({ sessionType: 'service_order', serviceOrder: { id: 'order-1', status: 'DELIVERED' } });
    expect(captureMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
    expect(result.captured).toBe(1);
  });

  it('never captures a car purchase early, whatever state it is in', async () => {
    for (const status of ['PAID_HELD', 'HANDED_OVER']) {
      captureMock.mockClear();
      const result = await sweepOne({ sessionType: 'vehicle_purchase', vehiclePurchase: { id: 'purchase-1', status } });
      expect(captureMock).not.toHaveBeenCalled();
      expect(result.awaitingSession).toBe(1);
    }
  });

  it('captures a workshop job only once the workshop has finished it', async () => {
    let result = await sweepOne({ sessionType: 'car_service', mechanicBooking: { id: 'booking-1', status: 'IN_PROGRESS' } });
    expect(captureMock).not.toHaveBeenCalled();
    expect(result.awaitingSession).toBe(1);

    result = await sweepOne({ sessionType: 'car_service', mechanicBooking: { id: 'booking-1', status: 'COMPLETED' } });
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(result.captured).toBe(1);
  });

  it('does not capture an inspection whose report is not in', async () => {
    const result = await sweepOne({
      sessionType: 'vehicle_inspection',
      vehicleInspection: { id: 'insp-1', status: 'SCHEDULED', listingId: 'listing-1' },
    });
    expect(captureMock).not.toHaveBeenCalled();
    expect(result.awaitingSession).toBe(1);
  });

  it('does not capture a hold whose order or session no longer exists', async () => {
    const result = await sweepOne({ sessionType: 'service_order', serviceOrder: null });
    expect(captureMock).not.toHaveBeenCalled();
    expect(result.awaitingSession).toBe(1);
  });
});

// Only a cancelled mentor session was given back, and only with early capture
// on. By default a buyer's card stayed held for a cancelled order until the
// authorisation ran out.
describe('Holds for something cancelled are given back, whether or not capture is on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.mentorSession.findUnique.mockResolvedValue(null);
    prismaAny.user.findMany.mockResolvedValue([]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  it('releases a cancelled marketplace order with capture off, and does not ask the buyer to release it', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([
      hold({ sessionType: 'service_order', serviceOrder: { id: 'order-1', status: 'CANCELLED' } }),
    ]);

    const result = await runEscrowExpirySweep(NOW);

    expect(cancelMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' }, 'Order cancelled');
    expect(result.released).toBe(1);
    expect(result.buyersReminded).toBe(0);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('releases a cancelled mentor session with capture off and records it on the session', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ sessionType: 'mentor_session' })]);
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce({
      id: 'session-3',
      status: 'CANCELED',
      scheduledAt: null,
      durationMinutes: 60,
      mentorProfile: { userId: 'seller-1' },
    });

    const result = await runEscrowExpirySweep(NOW);

    expect(cancelMock).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' }, 'Session canceled');
    expect(result.released).toBe(1);
    expect(prismaAny.mentorSession.update).toHaveBeenCalledWith({
      where: { id: 'session-3' },
      data: expect.objectContaining({ paymentStatus: 'CANCELED' }),
    });
  });
});

// A mentor session is released by being completed, so the buyer was the wrong
// person to ask and nobody was asked at all.
describe('Asking the mentor, not the mentee, before a session hold lapses', () => {
  const session = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-5',
    status: 'CONFIRMED',
    scheduledAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
    durationMinutes: 60,
    mentorProfile: { userId: 'mentor-user-5' },
    ...overrides,
  });

  const noticesTo = (userId: string) =>
    prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data).filter((d: any) => d.userId === userId);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ sessionType: 'mentor_session' })]);
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.user.findMany.mockResolvedValue([]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  afterAll(() => {
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
  });

  it('asks her to mark a finished session complete, with a link to it and the day the hold lapses', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(session());

    const result = await runEscrowExpirySweep(NOW);

    expect(result.mentorsReminded).toBe(1);
    const [notice] = noticesTo('mentor-user-5');
    expect(notice.title).toBe('Mark your session complete to be paid');
    expect(notice.link).toBe('/dashboard/mentors/sessions?session=session-5');
    expect(notice.message).toMatch(/18 September/);
    expect(notice.data).toEqual({ kind: 'ESCROW_SESSION_REMINDER', escrowId: 'escrow-1', sessionId: 'session-5' });
    expect(noticesTo('buyer-1')).toHaveLength(0);
  });

  it('asks her to answer a request she has not accepted, even when capture is on', async () => {
    process.env.ESCROW_CAPTURE_BEFORE_EXPIRY = 'true';
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(session({ status: 'REQUESTED' }));

    const result = await runEscrowExpirySweep(NOW);

    expect(captureMock).not.toHaveBeenCalled();
    expect(result.mentorsReminded).toBe(1);
    expect(noticesTo('mentor-user-5')[0].title).toBe('A session request is waiting for your answer');
  });

  it('does not ask about a session booked for after the hold lapses, which nothing she does can save', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(
      session({ scheduledAt: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000) })
    );

    const result = await runEscrowExpirySweep(NOW);

    expect(result.mentorsReminded).toBe(0);
    expect(noticesTo('mentor-user-5')).toHaveLength(0);
  });

  it('asks her only once about the same hold', async () => {
    prismaAny.mentorSession.findUnique.mockResolvedValueOnce(session());
    prismaAny.notification.findFirst.mockResolvedValue({ id: 'already-asked' });

    const result = await runEscrowExpirySweep(NOW);

    expect(result.mentorsReminded).toBe(0);
  });
});

describe('A hold no order, booking or session owns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
    prismaAny.mentorSession.findUnique.mockResolvedValue(null);
    prismaAny.user.findMany.mockResolvedValue([]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  it('sends its buyer to the holds screen she can now release it from', async () => {
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold({ sessionType: 'course_purchase', description: 'Pottery course' })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.buyersReminded).toBe(1);
    const notice = prismaAny.notification.create.mock.calls
      .map((call: any[]) => call[0].data)
      .find((d: any) => d.userId === 'buyer-1');
    expect(notice.link).toBe('/dashboard/finance/holds');
    expect(notice.message).toContain('Pottery course');
  });
});

// Legacy mentor sessions held money with no escrow row, so the sweep could
// only warn about them.
describe('Legacy mentor sessions are given their escrow rows', () => {
  const legacy = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-legacy',
    menteeId: 'mentee-1',
    mentorProfileId: 'mentor-profile-1',
    stripePaymentIntentId: 'pi_legacy',
    sessionAmount: 180,
    currency: 'AUD',
    createdAt: daysAgo(6),
    status: 'CONFIRMED',
    paymentStatus: 'AUTHORIZED',
    paymentCapturedAt: null,
    paymentCanceledAt: null,
    mentorProfile: { userId: 'mentor-user-1' },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    stripeConfiguredMock.mockReturnValue(true);
    prismaAny.mentorSession.findUnique.mockResolvedValue(null);
    prismaAny.user.findMany.mockResolvedValue([]);
    prismaAny.notification.findFirst.mockResolvedValue(null);
  });

  afterAll(() => {
    stripeConfiguredMock.mockReturnValue(false);
  });

  it('adopts one from Stripe and then treats it like any other hold', async () => {
    prismaAny.mentorSession.findMany.mockResolvedValue([legacy()]);
    prismaAny.escrowPayment.findMany
      .mockResolvedValueOnce([]) // which of them already have rows: none
      .mockResolvedValueOnce([hold({ paymentIntentId: 'pi_legacy', sessionType: 'mentor_session' })]);

    const result = await runEscrowExpirySweep(NOW);

    expect(adoptMock).toHaveBeenCalledWith({
      id: 'session-legacy',
      menteeId: 'mentee-1',
      mentorUserId: 'mentor-user-1',
      mentorProfileId: 'mentor-profile-1',
      stripePaymentIntentId: 'pi_legacy',
      paymentCapturedAt: null,
      paymentCanceledAt: null,
    });
    expect(result.adopted).toBe(1);
    // Counted once, as the escrow row it now has.
    expect(result.checked).toBe(1);
    expect(warnMock).not.toHaveBeenCalledWith('Mentor session hold is close to expiring', expect.anything());
  });

  it('keeps warning about one it could not adopt, and counts the failure', async () => {
    prismaAny.mentorSession.findMany.mockResolvedValue([legacy()]);
    prismaAny.escrowPayment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    adoptMock.mockRejectedValueOnce(new Error('stripe is down'));

    const result = await runEscrowExpirySweep(NOW);

    expect(result.adoptFailed).toBe(1);
    expect(result.expiringSoon).toBe(1);
    expect(warnMock).toHaveBeenCalledWith('Mentor session hold is close to expiring', expect.anything());
  });

  it('does not try without a Stripe key, because there would be nothing true to write', async () => {
    stripeConfiguredMock.mockReturnValue(false);
    prismaAny.mentorSession.findMany.mockResolvedValue([legacy()]);
    prismaAny.escrowPayment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await runEscrowExpirySweep(NOW);

    expect(adoptMock).not.toHaveBeenCalled();
  });
});

describe('Paid mentoring requests whose card step was never finished', () => {
  const unpaidMock = cancelUnpaidMentorRequests as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ESCROW_CAPTURE_BEFORE_EXPIRY;
    prismaAny.escrowPayment.findMany.mockResolvedValue([]);
    // An earlier describe leaves legacy sessions behind, which the sweep would warn about.
    prismaAny.mentorSession.findMany.mockResolvedValue([]);
  });

  it('is called off by the sweep, and the count is reported', async () => {
    unpaidMock.mockResolvedValueOnce({ authorised: 1, cancelled: 2, deferred: 0 });

    const result = await runEscrowExpirySweep(NOW);

    expect(unpaidMock).toHaveBeenCalledWith(NOW);
    expect(result.unpaidSessionsCancelled).toBe(2);
    expect(result.unpaidSessionsAuthorised).toBe(1);
  });

  it('does not stop the rest of the sweep when it fails: the holds are on a clock too', async () => {
    unpaidMock.mockRejectedValueOnce(new Error('the database blinked'));
    prismaAny.escrowPayment.findMany.mockResolvedValue([hold()]);

    const result = await runEscrowExpirySweep(NOW);

    expect(result.unpaidSessionsCancelled).toBe(0);
    expect(errorMock).toHaveBeenCalledWith(
      'Could not look for mentoring requests whose payment was never authorised',
      expect.objectContaining({ error: 'the database blinked' })
    );
    // The hold close to lapsing was still looked at.
    expect(result.expiringSoon).toBe(1);
  });
});
