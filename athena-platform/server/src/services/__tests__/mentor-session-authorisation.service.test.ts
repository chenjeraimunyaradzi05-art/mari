/**
 * A paid mentoring request that nobody has paid for.
 *
 * It used to reach the mentor the moment the hold was created, could be accepted,
 * and sat on her calendar for as long as it lived because nothing ever called it
 * off. These pin the three things that replace that: Stripe, not our copy of its
 * answer, decides whether a card is held; a request whose card step is never
 * finished is called off, with the hold released first and the mentee told; and a
 * request whose card is held but whose webhook never landed is caught up and its
 * mentor told, rather than being called off over a payment that was made.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    mentorSession: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    escrowPayment: { updateMany: jest.fn(async () => ({ count: 1 })) },
    notification: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

const retrieve = jest.fn();
jest.mock('../../utils/stripe', () => ({ getStripe: () => ({ paymentIntents: { retrieve } }) }));

const cancelSessionHold = jest.fn();
jest.mock('../mentor-payment-release.service', () => ({
  cancelSessionHold: (...args: unknown[]) => cancelSessionHold(...args),
}));

const notify = jest.fn(async () => undefined);
jest.mock('../notification.service', () => ({ notificationService: { notify: (...args: unknown[]) => notify(...(args as [])) } }));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  UNPAID_REQUEST_HOURS,
  cancelUnpaidMentorRequests,
  isDevelopmentHold,
  notifyMentorOfRequestById,
  readCardHold,
  recordSessionAuthorised,
} from '../mentor-session-authorisation.service';

const prisma: any = prismaTyped;

const NOW = new Date('2026-10-02T01:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const unpaid = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess-1',
  menteeId: 'mentee-1',
  scheduledAt: new Date(NOW.getTime() + 2 * 24 * HOUR),
  stripePaymentIntentId: 'pi_1',
  mentorProfile: { userId: 'mentor-1', user: { displayName: 'Aroha' } },
  ...overrides,
});

const originalEnv = process.env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
  retrieve.mockResolvedValue({ status: 'requires_payment_method' });
  cancelSessionHold.mockResolvedValue(undefined);
  prisma.mentorSession.findMany.mockResolvedValue([unpaid()]);
  prisma.mentorSession.updateMany.mockResolvedValue({ count: 1 });
  prisma.mentorSession.findUnique.mockResolvedValue({
    id: 'sess-1',
    status: 'REQUESTED',
    scheduledAt: new Date(NOW.getTime() + 24 * HOUR),
    note: 'Moving into product',
    mentorProfile: { userId: 'mentor-1' },
  });
});

afterEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
});

describe('readCardHold', () => {
  it('says held for an authorised card, and for one already charged', async () => {
    retrieve.mockResolvedValueOnce({ status: 'requires_capture' });
    expect(await readCardHold('pi_1')).toBe('held');
    retrieve.mockResolvedValueOnce({ status: 'succeeded' });
    expect(await readCardHold('pi_1')).toBe('held');
  });

  it('says not held while the card step is unfinished, declined or cancelled', async () => {
    for (const status of ['requires_payment_method', 'requires_confirmation', 'requires_action', 'canceled']) {
      retrieve.mockResolvedValueOnce({ status });
      expect(await readCardHold('pi_1')).toBe('not_held');
    }
  });

  it('says unknown, never held or not held, when Stripe cannot be asked or has not decided', async () => {
    retrieve.mockRejectedValueOnce(new Error('network down'));
    expect(await readCardHold('pi_1')).toBe('unknown');
    retrieve.mockResolvedValueOnce({ status: 'processing' });
    expect(await readCardHold('pi_1')).toBe('unknown');
  });

  it('counts the development processor’s hold as held outside production, because it has no card step', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    expect(await readCardHold('pi_mock_123')).toBe('held');
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('never counts a mock hold as money in production, where none can exist', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(await readCardHold('pi_mock_123')).toBe('not_held');
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe('isDevelopmentHold', () => {
  it('is true for a mock hold outside production, and never for a real one', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    expect(isDevelopmentHold('pi_mock_1')).toBe(true);
    expect(isDevelopmentHold('pi_3Nabc')).toBe(false);
  });

  it('is false in production, where a mock hold is not money', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(isDevelopmentHold('pi_mock_1')).toBe(false);
  });
});

describe('recordSessionAuthorised', () => {
  it('moves the session and the hold’s row from the unpaid statuses only, and says it did the moving', async () => {
    const moved = await recordSessionAuthorised({ id: 'sess-1', stripePaymentIntentId: 'pi_1' }, NOW);

    expect(moved).toBe(true);
    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'sess-1', stripePaymentIntentId: 'pi_1', paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { paymentStatus: 'AUTHORIZED', paymentAuthorizedAt: NOW },
    });
    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_1', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'AUTHORIZED' },
    });
  });

  it('says it did not when the webhook got there first, so nobody is told twice', async () => {
    prisma.mentorSession.updateMany.mockResolvedValue({ count: 0 });

    expect(await recordSessionAuthorised({ id: 'sess-1', stripePaymentIntentId: 'pi_1' }, NOW)).toBe(false);
  });
});

describe('notifyMentorOfRequestById', () => {
  it('tells the mentor, with the mentee’s note escaped in the email', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'REQUESTED',
      scheduledAt: new Date(NOW.getTime() + 24 * HOUR),
      note: '<script>alert(1)</script>',
      mentorProfile: { userId: 'mentor-1' },
    });

    await notifyMentorOfRequestById('sess-1');

    expect(notify).toHaveBeenCalledTimes(1);
    const notice = (notify.mock.calls[0] as unknown[])[0] as any;
    expect(notice).toMatchObject({
      userId: 'mentor-1',
      type: 'MENTOR_SESSION',
      title: 'New Mentorship Request',
      link: '/dashboard/mentors/sessions?session=sess-1',
    });
    expect(notice.emailTemplate.html).not.toContain('<script>');
    expect(notice.emailTemplate.html).toContain('&lt;script&gt;');
  });

  it('says nothing about a session that is no longer a request, which a withdrawal makes it', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'CANCELED',
      scheduledAt: new Date(),
      note: null,
      mentorProfile: { userId: 'mentor-1' },
    });

    await notifyMentorOfRequestById('sess-1');

    expect(notify).not.toHaveBeenCalled();
  });
});

describe('cancelUnpaidMentorRequests', () => {
  it('looks only at paid requests whose card step has had its time', async () => {
    await cancelUnpaidMentorRequests(NOW);

    const where = prisma.mentorSession.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      status: 'REQUESTED',
      paymentStatus: { in: ['PENDING', 'FAILED'] },
      sessionAmount: { gt: 0 },
      stripePaymentIntentId: { not: null },
    });
    expect(where.createdAt.lte).toEqual(new Date(NOW.getTime() - UNPAID_REQUEST_HOURS * HOUR));
  });

  it('releases the hold, then calls the request off, and tells the mentee nothing was charged', async () => {
    const result = await cancelUnpaidMentorRequests(NOW);

    expect(result).toEqual({ authorised: 0, cancelled: 1, deferred: 0 });
    expect(retrieve).toHaveBeenCalledWith('pi_1');
    expect(cancelSessionHold).toHaveBeenCalledWith('pi_1', 'The card step was not completed');
    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'sess-1', status: 'REQUESTED', paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'CANCELED', paymentStatus: 'CANCELED', paymentCanceledAt: NOW },
    });
    // The hold is released before the session is written, never the other way round.
    expect(cancelSessionHold.mock.invocationCallOrder[0]).toBeLessThan(prisma.mentorSession.updateMany.mock.invocationCallOrder[0]);

    const notice = prisma.notification.create.mock.calls[0][0].data;
    expect(notice).toMatchObject({ userId: 'mentee-1', title: 'Your session request was cancelled' });
    expect(notice.message).toContain('nothing has been charged');
    expect(notice.message).toContain('Aroha');
    // The mentor was never told of it, so is not told of its cancellation either.
    expect(notify).not.toHaveBeenCalled();
  });

  it('catches up, rather than cancels, a request whose card is held but whose webhook never landed', async () => {
    retrieve.mockResolvedValue({ status: 'requires_capture' });

    const result = await cancelUnpaidMentorRequests(NOW);

    expect(result).toEqual({ authorised: 1, cancelled: 0, deferred: 0 });
    expect(cancelSessionHold).not.toHaveBeenCalled();
    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentStatus: 'AUTHORIZED', paymentAuthorizedAt: NOW } })
    );
    // And the mentor hears of it now, which is the notice the webhook would have sent.
    expect(notify).toHaveBeenCalledTimes(1);
    expect(((notify.mock.calls[0] as unknown[])[0] as any).userId).toBe('mentor-1');
  });

  it('leaves a request alone when Stripe cannot be asked: not paid is not the same as not known', async () => {
    retrieve.mockRejectedValue(new Error('network down'));

    const result = await cancelUnpaidMentorRequests(NOW);

    expect(result).toEqual({ authorised: 0, cancelled: 0, deferred: 1 });
    expect(cancelSessionHold).not.toHaveBeenCalled();
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('leaves the session as it was when the hold cannot be released, so a card is never left held for a cancelled request', async () => {
    cancelSessionHold.mockRejectedValue(new Error('Stripe is down'));

    const result = await cancelUnpaidMentorRequests(NOW);

    expect(result).toEqual({ authorised: 0, cancelled: 0, deferred: 1 });
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('does not tell the mentee a request was cancelled when the write found it already moved', async () => {
    // Authorised, or withdrawn, between the read and the write.
    prisma.mentorSession.updateMany.mockResolvedValue({ count: 0 });

    const result = await cancelUnpaidMentorRequests(NOW);

    expect(result.cancelled).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('goes on to the next request after one it could not settle', async () => {
    prisma.mentorSession.findMany.mockResolvedValue([
      unpaid({ id: 'sess-a', stripePaymentIntentId: 'pi_a' }),
      unpaid({ id: 'sess-b', stripePaymentIntentId: 'pi_b' }),
    ]);
    cancelSessionHold.mockRejectedValueOnce(new Error('Stripe is down'));

    const result = await cancelUnpaidMentorRequests(NOW);

    expect(result).toEqual({ authorised: 0, cancelled: 1, deferred: 1 });
    expect(cancelSessionHold).toHaveBeenCalledTimes(2);
  });
});
