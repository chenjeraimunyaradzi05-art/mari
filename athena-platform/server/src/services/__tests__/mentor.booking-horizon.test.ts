/**
 * Booking and moving a paid mentoring session inside the life of its hold.
 *
 * A paid session holds the mentee's card from the moment it is requested, and a
 * card hold lasts about a week with nothing to renew it. requestSession accepted
 * any date, so a session booked three weeks out had its hold lapse in the first
 * week, the capture at completion failed, and the mentor was told a payment
 * "needed attention" for an hour she had given. These pin the limit on booking and
 * on moving, that a session is always charged in the one currency its rate is
 * quoted in, and that a mentor is told of a paid request when it is paid for and
 * not when it is made.
 */

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    mentorProfile: { findUnique: jest.fn() },
    mentorSession: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
    },
    escrowPayment: { findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    user: { findUnique: jest.fn() },
  };
  return { prisma };
});

jest.mock('../notification.service', () => ({
  notificationService: { notify: jest.fn(async () => undefined) },
}));

jest.mock('../stripe-connect.service', () => ({
  PLATFORM_ESCROW_ACTOR: { id: 'system', role: 'ADMIN' },
  captureEscrowPayment: jest.fn(),
  cancelEscrowPayment: jest.fn(),
  createEscrowPayment: jest.fn(async () => ({ escrowId: 'esc-1', paymentIntentId: 'pi_new', clientSecret: 'cs_new' })),
  createConnectedAccount: jest.fn(),
  resolveConnectedAccountId: jest.fn(async () => 'acct_mentor'),
}));

jest.mock('../../utils/stripe', () => ({ getStripe: jest.fn() }));

// Nobody has blocked anybody unless a test says so.
jest.mock('../../utils/safety-store', () => ({ isBlockedRelationship: jest.fn(async () => false) }));

jest.mock('../search.service', () => ({
  hiddenMemberWhere: jest.fn(() => ({})),
  viewerContextFor: jest.fn(async () => ({ blockedIds: [], followingIds: [] })),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { notificationService } from '../notification.service';
import { createEscrowPayment } from '../stripe-connect.service';
import { isBlockedRelationship } from '../../utils/safety-store';
import { MENTOR_BOOKING_HORIZON_DAYS } from '../escrow-deadline';
import { getStripe } from '../../utils/stripe';
import { getSessionPaymentSecret, getUserSessions, mentorAcceptsBookings, requestSession, rescheduleSession } from '../mentor.service';

const prisma: any = prismaTyped;
const notify = notificationService.notify as unknown as jest.Mock;
const holdMock = createEscrowPayment as unknown as jest.Mock;
const blocked = isBlockedRelationship as unknown as jest.Mock;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const mentor = (overrides: Record<string, unknown> = {}) => ({
  id: 'mp-1',
  userId: 'mentor-1',
  hourlyRate: 100,
  isAvailable: true,
  stripeAccountId: 'acct_mentor',
  isMonetized: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.mentorProfile.findUnique.mockResolvedValue(mentor());
  prisma.mentorSession.create.mockImplementation(async ({ data }: any) => ({ id: 'sess-1', note: null, ...data }));
  prisma.mentorSession.update.mockImplementation(async ({ data }: any) => ({ id: 'sess-1', ...data }));
  prisma.mentorSession.findMany.mockResolvedValue([]);
});

describe('requestSession: when a session can be booked for', () => {
  it('refuses a time that has already passed, and creates nothing', async () => {
    await expect(requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() - HOUR) })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('has not passed'),
    });

    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
    expect(holdMock).not.toHaveBeenCalled();
  });

  it('refuses a paid session further out than the hold on her card will last, and holds nothing', async () => {
    const tooFar = new Date(Date.now() + (MENTOR_BOOKING_HORIZON_DAYS + 1) * DAY);

    await expect(requestSession('mentee-1', 'mp-1', { scheduledAt: tooFar })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining(`up to ${MENTOR_BOOKING_HORIZON_DAYS} days ahead`),
    });

    // Nothing was written and no card was touched: the refusal is before either.
    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
    expect(holdMock).not.toHaveBeenCalled();
  });

  it('keeps a day short of the hold’s life, so the mentor can still mark the hour complete', () => {
    // The booking limit is the hold's week less the day she needs after the hour.
    expect(MENTOR_BOOKING_HORIZON_DAYS).toBe(6);
  });

  it('books a paid session inside the limit', async () => {
    const scheduledAt = new Date(Date.now() + (MENTOR_BOOKING_HORIZON_DAYS - 1) * DAY);

    const result = await requestSession('mentee-1', 'mp-1', { scheduledAt });

    expect(result.paymentIntentClientSecret).toBe('cs_new');
    expect(holdMock).toHaveBeenCalledTimes(1);
  });

  it('books a free session as far ahead as asked, because there is no hold to outlast', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(mentor({ hourlyRate: 0 }));

    const result = await requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 40 * DAY) });

    expect(result.paymentIntentClientSecret).toBeNull();
    expect(holdMock).not.toHaveBeenCalled();
    expect(prisma.mentorSession.create).toHaveBeenCalledTimes(1);
  });
});

describe('requestSession: across a block', () => {
  // A mentor who charges nothing has no hold, and the hold is what refuses a
  // payment across a block, so the booking itself has to.
  it.each([
    ['a paid mentor', 100],
    ['a mentor who charges nothing', 0],
  ])('answers %s as a mentor who does not exist, and writes, holds and tells nobody', async (_label, hourlyRate) => {
    prisma.mentorProfile.findUnique.mockResolvedValue(mentor({ hourlyRate }));
    blocked.mockResolvedValueOnce(true);

    await expect(
      requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 2 * DAY) })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Mentor not found' });

    expect(blocked).toHaveBeenCalledWith('mentee-1', 'mentor-1');
    expect(prisma.mentorSession.create).not.toHaveBeenCalled();
    expect(holdMock).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('requestSession: what a mentor is told, and what is charged', () => {
  it('does not tell the mentor of a paid request when it is made: the card is not held yet', async () => {
    await requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 2 * DAY) });

    // She hears of it from the webhook that says the mentee's card is held.
    expect(notify).not.toHaveBeenCalled();
  });

  // The development processor has no card step and sends no webhook, so waiting
  // for one would leave a developer's machine with no Stripe key unable to run the
  // flow: the mentor would never hear of the request, or see it.
  it('treats the development processor’s hold as held at once, outside production, and tells the mentor', async () => {
    holdMock.mockResolvedValueOnce({ escrowId: 'esc-1', paymentIntentId: 'pi_mock_1', clientSecret: 'pi_mock_1_secret_mock' });

    await requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 2 * DAY) });

    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'sess-1', stripePaymentIntentId: 'pi_mock_1' }),
        data: expect.objectContaining({ paymentStatus: 'AUTHORIZED' }),
      })
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({ userId: 'mentor-1', title: 'New Mentorship Request' });
  });

  it('never treats a mock hold as held in production, where none can exist', async () => {
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      holdMock.mockResolvedValueOnce({ escrowId: 'esc-1', paymentIntentId: 'pi_mock_1', clientSecret: 'pi_mock_1_secret_mock' });

      await requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 2 * DAY) });

      expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    } finally {
      env.NODE_ENV = original;
    }
  });

  it('tells the mentor of a free request at once, which has no card step to wait for', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(mentor({ hourlyRate: 0 }));

    await requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 2 * DAY), note: 'Career change' });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({ userId: 'mentor-1', type: 'MENTOR_SESSION', title: 'New Mentorship Request' });
  });

  it('charges in Australian dollars, the currency a mentor’s rate is quoted in, whatever the mentee has chosen to see', async () => {
    // The mentee chose US dollars for her own figures. The rate of 100 is A$100 on
    // every page, so it is A$100 on her card: the session is not read in her currency.
    prisma.user.findUnique.mockResolvedValue({ preferredCurrency: 'USD' });

    await requestSession('mentee-1', 'mp-1', { scheduledAt: new Date(Date.now() + 2 * DAY), durationMinutes: 60 });

    expect(holdMock).toHaveBeenCalledWith(expect.objectContaining({ currency: 'aud', amount: 10000 }));
    expect(prisma.mentorSession.create.mock.calls[0][0].data).toMatchObject({ currency: 'AUD', sessionAmount: 100 });
  });
});

describe('rescheduleSession: moving a session past its hold', () => {
  const heldSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'sess-1',
    menteeId: 'mentee-1',
    mentorProfileId: 'mp-1',
    mentorProfile: { userId: 'mentor-1' },
    status: 'CONFIRMED',
    scheduledAt: new Date(Date.now() + 1 * DAY),
    durationMinutes: 60,
    sessionAmount: 100,
    paymentStatus: 'AUTHORIZED',
    stripePaymentIntentId: 'pi_1',
    createdAt: new Date(Date.now() - 4 * DAY),
    ...overrides,
  });

  beforeEach(() => {
    // The hold was made four days ago, so it runs about three more days.
    prisma.escrowPayment.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 4 * DAY), metadata: null });
  });

  it('refuses a time that has passed', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession());

    await expect(
      rescheduleSession('sess-1', 'mentee-1', { scheduledAt: new Date(Date.now() - HOUR) })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('has not passed') });
    expect(prisma.mentorSession.update).not.toHaveBeenCalled();
  });

  it('refuses to change the length of a paid session, which was priced and held for the length it was booked at', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession({ durationMinutes: 15, sessionAmount: 25 }));

    await expect(
      rescheduleSession('sess-1', 'mentee-1', { scheduledAt: new Date(Date.now() + 1.5 * DAY), durationMinutes: 240 })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('cannot be changed') });
    expect(prisma.mentorSession.update).not.toHaveBeenCalled();
  });

  it('allows a paid session to be moved with its own length restated', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession());

    await rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 1.5 * DAY), durationMinutes: 60 });

    expect(prisma.mentorSession.update).toHaveBeenCalledTimes(1);
    expect(prisma.mentorSession.update.mock.calls[0][0].data).toMatchObject({ durationMinutes: 60 });
  });

  it('lets a session that costs nothing change its length', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(
      heldSession({ sessionAmount: 0, stripePaymentIntentId: null, paymentStatus: 'CAPTURED' })
    );

    await rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 1.5 * DAY), durationMinutes: 90 });

    expect(prisma.mentorSession.update.mock.calls[0][0].data).toMatchObject({ durationMinutes: 90 });
  });

  it('refuses a move past what is left of the hold, and says when it ends', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession());

    // The hold has about three days left, less the day the mentor needs afterwards.
    await expect(
      rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 3 * DAY) })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('cannot be moved later than') });
    expect(prisma.mentorSession.update).not.toHaveBeenCalled();
  });

  it('allows a move inside what is left of the hold', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession());

    await rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 1.5 * DAY) });

    expect(prisma.mentorSession.update).toHaveBeenCalledTimes(1);
  });

  it('measures from the deadline Stripe reported for the hold, when there is one', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession());
    prisma.escrowPayment.findUnique.mockResolvedValue({
      createdAt: new Date(Date.now() - 4 * DAY),
      metadata: { captureBefore: new Date(Date.now() + 10 * DAY).toISOString() },
    });

    await rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 5 * DAY) });

    expect(prisma.mentorSession.update).toHaveBeenCalledTimes(1);
  });

  it('puts no limit on a free session, which has no hold', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(
      heldSession({ sessionAmount: 0, stripePaymentIntentId: null, paymentStatus: 'CAPTURED' })
    );

    await rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 30 * DAY) });

    expect(prisma.escrowPayment.findUnique).not.toHaveBeenCalled();
    expect(prisma.mentorSession.update).toHaveBeenCalledTimes(1);
  });

  it('puts no limit on money that has already been taken, which does not run out', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(heldSession({ paymentStatus: 'CAPTURED' }));

    await rescheduleSession('sess-1', 'mentor-1', { scheduledAt: new Date(Date.now() + 30 * DAY) });

    expect(prisma.mentorSession.update).toHaveBeenCalledTimes(1);
  });
});

describe('who can be booked, and what a mentor sees', () => {
  it('does not offer a mentor whose payout account Stripe has not switched on', () => {
    const base = { hourlyRate: 100 as never, isAvailable: true, stripeAccountId: 'acct_1' };

    // The account is written the moment it is minted, with nothing verified.
    expect(mentorAcceptsBookings({ ...base, isMonetized: false })).toBe(false);
    expect(mentorAcceptsBookings({ ...base, isMonetized: true })).toBe(true);
    expect(mentorAcceptsBookings({ ...base, stripeAccountId: null, isMonetized: true })).toBe(false);
  });

  it('still offers a mentor who charges nothing, whatever her payout account', () => {
    expect(mentorAcceptsBookings({ hourlyRate: 0 as never, isAvailable: true, stripeAccountId: null, isMonetized: false })).toBe(true);
  });

  it('keeps a paid request off the mentor’s list until the mentee’s card is held', async () => {
    await getUserSessions('mentor-1', 'mentor');

    expect(prisma.mentorSession.findMany.mock.calls[0][0].where).toEqual({
      mentorProfile: { userId: 'mentor-1' },
      NOT: { status: 'REQUESTED', paymentStatus: { in: ['PENDING', 'FAILED'] }, sessionAmount: { gt: 0 } },
    });
  });

  it('shows a mentee all of her own requests, paid for or not, so she can finish paying', async () => {
    await getUserSessions('mentee-1', 'mentee');

    expect(prisma.mentorSession.findMany.mock.calls[0][0].where).toEqual({ menteeId: 'mentee-1' });
  });
});

describe('getSessionPaymentSecret: who may finish the card step', () => {
  const retrieve = jest.fn(async () => ({ client_secret: 'cs_again' }));
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'sess-1',
    menteeId: 'mentee-1',
    status: 'REQUESTED',
    paymentStatus: 'PENDING',
    stripePaymentIntentId: 'pi_1',
    sessionAmount: 100,
    currency: 'AUD',
    ...overrides,
  });

  beforeEach(() => {
    (getStripe as unknown as jest.Mock).mockReturnValue({ paymentIntents: { retrieve } });
  });

  it('hands a mentee the card form again while the payment is pending', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(row());

    expect(await getSessionPaymentSecret('sess-1', 'mentee-1')).toMatchObject({ paymentStatus: 'PENDING', clientSecret: 'cs_again' });
  });

  // The request is called off a few hours after it is made if no card is held, so
  // a declined card has to be able to try another.
  it('hands it back after a declined card, while the request is still a request', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(row({ paymentStatus: 'FAILED' }));

    expect(await getSessionPaymentSecret('sess-1', 'mentee-1')).toMatchObject({ paymentStatus: 'FAILED', clientSecret: 'cs_again' });
    expect(retrieve).toHaveBeenCalledWith('pi_1');
  });

  it('does not, for a confirmed session whose capture failed: that is not a card to try again', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(row({ status: 'CONFIRMED', paymentStatus: 'FAILED' }));

    expect(await getSessionPaymentSecret('sess-1', 'mentee-1')).toMatchObject({ clientSecret: null });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('does not once the card is held', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(row({ paymentStatus: 'AUTHORIZED' }));

    expect(await getSessionPaymentSecret('sess-1', 'mentee-1')).toMatchObject({ clientSecret: null });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('answers someone who is not the mentee as a session that does not exist', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(row());

    await expect(getSessionPaymentSecret('sess-1', 'mentor-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(retrieve).not.toHaveBeenCalled();
  });
});
