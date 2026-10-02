/**
 * Moving a mentor session to COMPLETED or CANCELED, from each side.
 *
 * What this pins. A mentor closing a paid session no longer charges the mentee's
 * card that minute: the card stays held for a window in which the mentee can say
 * the session did not happen, and the expiry sweep takes the money after that. The
 * mentee confirming it herself, a hold too close to lapsing to wait, and a session
 * booked before escrow rows existed are still charged at once. A session in
 * dispute is neither person's to move. A mentee charged at once is told where to
 * go if the hour did not happen, and that place has to exist: the notice linked to
 * /dashboard/support, a route with no page. And the rule that stops a mentee voiding
 * an hour that may have run applies to a confirmed session only, so a mentee can
 * still withdraw a request the mentor never accepted.
 *
 * Accepting is covered at the end: a mentor can accept a paid request only once the
 * mentee's card is held (asked of Stripe when the webhook is behind), and only for
 * an hour the hold will outlast.
 */

jest.mock('../../utils/prisma', () => {
  const prisma: any = {
    mentorSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    mentorProfile: { update: jest.fn() },
    escrowPayment: { findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    user: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn() },
    // The interactive form: the callback is handed the same client.
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };
  return { prisma };
});

jest.mock('../notification.service', () => ({
  notificationService: { notify: jest.fn(async () => undefined) },
}));

jest.mock('../stripe-connect.service', () => ({
  PLATFORM_ESCROW_ACTOR: { id: 'system', role: 'ADMIN' },
  captureEscrowPayment: jest.fn(async () => ({ status: 'captured' })),
  cancelEscrowPayment: jest.fn(async () => ({ status: 'canceled' })),
  createEscrowPayment: jest.fn(),
  createConnectedAccount: jest.fn(),
  resolveConnectedAccountId: jest.fn(),
}));

jest.mock('../../utils/stripe', () => ({ getStripe: jest.fn() }));

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
import { captureEscrowPayment, cancelEscrowPayment } from '../stripe-connect.service';
import { MENTEE_SUPPORT_LINK, updateSessionStatus } from '../mentor.service';
import { SESSION_CONFIRMATION_HOURS } from '../../config/price-book';

const prisma: any = prismaTyped;
const notify = notificationService.notify as unknown as jest.Mock;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    mentorProfileId: 'mp-1',
    menteeId: 'mentee-1',
    // Booked for yesterday, so its hour is over.
    scheduledAt: new Date(Date.now() - 24 * HOUR),
    durationMinutes: 60,
    status: 'CONFIRMED',
    sessionAmount: 90,
    currency: 'AUD',
    stripePaymentIntentId: 'pi_1',
    paymentStatus: 'AUTHORIZED',
    mentorProfile: { id: 'mp-1', userId: 'mentor-1' },
    ...overrides,
  };
}

/** A hold made a day ago: plenty of life left, so a window fits. */
const freshHold = () => ({ id: 'esc-1', status: 'AUTHORIZED', capturedAt: null, createdAt: new Date(Date.now() - DAY), metadata: null });

/** A hold made six and a half days ago: the card lets go within hours, so there is no room to wait. */
const nearlyLapsedHold = () => ({
  id: 'esc-1',
  status: 'AUTHORIZED',
  capturedAt: null,
  createdAt: new Date(Date.now() - 6.5 * DAY),
  metadata: null,
});

/** What the session row was last written with, as the update returns it. */
let written: Record<string, unknown> = {};

describe('Changing a mentor session’s status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    written = {};
    prisma.mentorSession.updateMany.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      written = data;
      return { count: 1 };
    });
    prisma.mentorSession.findUniqueOrThrow.mockImplementation(async () => ({ id: 'sess-1', ...written }));
    prisma.mentorProfile.update.mockResolvedValue({});
    prisma.escrowPayment.findUnique.mockResolvedValue(freshHold());
  });

  describe('when the mentor closes a paid session', () => {
    it('holds the card for the mentee’s window instead of charging it that minute', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(session());
      const before = Date.now();

      const updated = await updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor');

      expect(captureEscrowPayment).not.toHaveBeenCalled();
      expect(updated).toMatchObject({ status: 'COMPLETED' });
      // Nothing about the payment is touched: it stays AUTHORIZED for the sweep.
      expect(written).not.toHaveProperty('paymentStatus');
      expect(written.completedAt).toBeInstanceOf(Date);
      const releaseAt = (written.paymentReleaseAt as Date).getTime();
      expect(releaseAt).toBeGreaterThanOrEqual(before + SESSION_CONFIRMATION_HOURS * HOUR - 1000);
      expect(releaseAt).toBeLessThanOrEqual(Date.now() + SESSION_CONFIRMATION_HOURS * HOUR + 1000);
      // The finished hour is still counted, once.
      expect(prisma.mentorProfile.update).toHaveBeenCalledWith({
        where: { id: 'mp-1' },
        data: { sessionCount: { increment: 1 } },
      });
    });

    it('tells the mentee what happens to her card, and how to object before it is charged', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(session());

      await updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor');

      const notice = notify.mock.calls[0][0];
      expect(notice.userId).toBe('mentee-1');
      expect(notice.title).toBe('Your mentor marked your session complete');
      expect(notice.message).toContain('90.00 AUD is held on your card');
      expect(notice.message).toContain('did not take place');
      expect(notice.message).not.toContain('was charged');
      expect(notice.link).toBe('/dashboard/mentors/sessions?session=sess-1');
      expect(notice.emailTemplate.html).toContain('is held on your card');
    });

    it('charges at once, and says so, when the hold is too close to lapsing to wait a day', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(session());
      prisma.escrowPayment.findUnique.mockResolvedValue(nearlyLapsedHold());

      const updated = await updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor');

      expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
      expect(updated).toMatchObject({ status: 'COMPLETED', paymentStatus: 'CAPTURED' });
      expect(written.paymentReleaseAt).toBeNull();
      const notice = notify.mock.calls[0][0];
      expect(notice.userId).toBe('mentee-1');
      expect(notice.title).toBe('Your session was marked complete and paid');
      expect(notice.message).toContain('90.00 AUD');
      expect(notice.link).toBe(MENTEE_SUPPORT_LINK);
      expect(MENTEE_SUPPORT_LINK).toBe('/dashboard/settings/help');
      expect(notice.emailTemplate.subject).toBe('Your mentoring session was completed and charged');
      expect(notice.emailTemplate.html).toContain('90.00 AUD was charged to your card');
      expect(notice.emailTemplate.html).toContain('/dashboard/settings/help');
    });

    it('charges at once a session booked before mentoring wrote escrow rows, which has no hold to read a deadline from', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(session());
      prisma.escrowPayment.findUnique.mockResolvedValue(null);
      const { getStripe } = jest.requireMock('../../utils/stripe');
      getStripe.mockReturnValue({ paymentIntents: { capture: jest.fn(async () => ({ status: 'succeeded' })) } });

      const updated = await updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor');

      expect(updated).toMatchObject({ status: 'COMPLETED', paymentStatus: 'CAPTURED' });
      expect(written.paymentReleaseAt).toBeNull();
    });

    it('has no window to give for a free session, and charges nobody', async () => {
      prisma.mentorSession.findUnique.mockResolvedValue(session({ sessionAmount: 0, stripePaymentIntentId: null, paymentStatus: 'CAPTURED' }));

      const updated = await updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor');

      expect(captureEscrowPayment).not.toHaveBeenCalled();
      expect(updated).toMatchObject({ status: 'COMPLETED' });
      expect(notify.mock.calls[0][0].title).toBe('Session Updated');
    });
  });

  it('lets a mentee confirm the session herself once its time has passed, charging at once', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session());

    const updated = await updateSessionStatus('sess-1', 'mentee-1', 'COMPLETED', 'mentee');

    // She has said it happened, so there is nothing to wait for.
    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
    expect(updated).toMatchObject({ status: 'COMPLETED', paymentStatus: 'CAPTURED' });
    // The mentor is told; the mentee is not sent a "you were charged" notice
    // for a charge she made herself.
    expect(notify.mock.calls[0][0].userId).toBe('mentor-1');
    expect(notify.mock.calls[0][0].title).toBe('Session Updated');
  });

  it('refuses to complete a session whose time has not come', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session({ scheduledAt: new Date(Date.now() + 24 * HOUR) }));

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor')).rejects.toMatchObject({ statusCode: 400 });
    expect(captureEscrowPayment).not.toHaveBeenCalled();
  });

  it('will not move a session that is in dispute, for either person', async () => {
    // The money is held and ATHENA's team decides: a mentor completing it would
    // overwrite the dispute, and a mentee cancelling it would release the hold.
    prisma.mentorSession.findUnique.mockResolvedValue(session({ status: 'DISPUTED' }));

    for (const [userId, status, by] of [
      ['mentor-1', 'COMPLETED', 'mentor'],
      ['mentor-1', 'CANCELED', 'mentor'],
      ['mentee-1', 'CANCELED', 'mentee'],
      ['mentee-1', 'COMPLETED', 'mentee'],
    ] as const) {
      await expect(updateSessionStatus('sess-1', userId, status, by)).rejects.toMatchObject({ statusCode: 409 });
    }

    expect(captureEscrowPayment).not.toHaveBeenCalled();
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not write over a dispute that landed while the move was being worked out', async () => {
    // The mentee disputed between the read and the write: the conditional update
    // finds the session no longer where it was read, and the finished hour is not
    // counted for a session that is now in dispute.
    prisma.mentorSession.findUnique.mockResolvedValue(session());
    prisma.mentorSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor')).rejects.toMatchObject({ statusCode: 409 });

    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sess-1', status: 'CONFIRMED' } })
    );
    expect(prisma.mentorProfile.update).not.toHaveBeenCalled();
  });

  it('lets a mentee withdraw a request the mentor never accepted, even after its date', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session({ status: 'REQUESTED' }));

    const updated = await updateSessionStatus('sess-1', 'mentee-1', 'CANCELED', 'mentee');

    expect(cancelEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' }, 'Session canceled');
    expect(updated).toMatchObject({ status: 'CANCELED', paymentStatus: 'CANCELED' });
  });

  it('still refuses a mentee cancelling a confirmed session after it has run', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session());

    await expect(updateSessionStatus('sess-1', 'mentee-1', 'CANCELED', 'mentee')).rejects.toMatchObject({ statusCode: 400 });
    expect(cancelEscrowPayment).not.toHaveBeenCalled();
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('lets the mentor cancel a confirmed session after it has run, releasing the hold', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session());

    const updated = await updateSessionStatus('sess-1', 'mentor-1', 'CANCELED', 'mentor');

    expect(cancelEscrowPayment).toHaveBeenCalled();
    expect(updated).toMatchObject({ status: 'CANCELED', paymentStatus: 'CANCELED' });
  });
});

/**
 * Accepting a paid request.
 *
 * The transition table checked who was asking and what state the session was in,
 * and nothing about the money, so a mentor could accept a session whose card had
 * never been authorised and be left with a confirmed hour and nothing behind it.
 */
describe('Accepting a paid mentor request', () => {
  const retrieve = jest.fn();

  /** A request two days out, which the mentee has not paid for yet. */
  const request = (overrides: Record<string, unknown> = {}) =>
    session({
      status: 'REQUESTED',
      scheduledAt: new Date(Date.now() + 2 * DAY),
      paymentStatus: 'PENDING',
      createdAt: new Date(Date.now() - HOUR),
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    written = {};
    const { getStripe } = jest.requireMock('../../utils/stripe');
    getStripe.mockReturnValue({ paymentIntents: { retrieve } });
    retrieve.mockResolvedValue({ status: 'requires_payment_method' });
    prisma.mentorSession.updateMany.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.status) written = data;
      return { count: 1 };
    });
    prisma.mentorSession.findUniqueOrThrow.mockImplementation(async () => ({ id: 'sess-1', ...written }));
    prisma.escrowPayment.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - HOUR), metadata: null });
  });

  it('refuses while the mentee has not authorised payment, after asking Stripe and not only the row', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request());

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('not authorised payment yet'),
    });

    expect(retrieve).toHaveBeenCalledWith('pi_1');
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('refuses when the mentee’s card was declined, which is not a held card either', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request({ paymentStatus: 'FAILED' }));

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('accepts when the row is behind but Stripe says the card is held, and brings the row into line', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request());
    retrieve.mockResolvedValue({ status: 'requires_capture' });

    const updated = await updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor');

    expect(updated).toMatchObject({ status: 'CONFIRMED' });
    // The session and the hold's own row both move to AUTHORIZED, from the unpaid
    // statuses only, so a late webhook finds nothing left to move.
    expect(prisma.mentorSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'sess-1', stripePaymentIntentId: 'pi_1', paymentStatus: { in: ['PENDING', 'FAILED'] } },
      data: { paymentStatus: 'AUTHORIZED', paymentAuthorizedAt: expect.any(Date) },
    });
    expect(prisma.escrowPayment.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: 'pi_1', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'AUTHORIZED' },
    });
  });

  it('says to try again, rather than that she has not paid, when Stripe cannot be asked', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request());
    retrieve.mockRejectedValue(new Error('network down'));

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor')).rejects.toMatchObject({ statusCode: 503 });
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('does not ask Stripe about a session the webhook has already told us is authorised', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request({ paymentStatus: 'AUTHORIZED' }));

    const updated = await updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor');

    expect(updated).toMatchObject({ status: 'CONFIRMED' });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('refuses once the hold has ended, and says the mentee can book again', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request({ paymentStatus: 'CANCELED' }));

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('book again'),
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('refuses an hour that starts after the hold behind it will have run out', async () => {
    // A hold made six and a half days ago has half a day left; the session is in two days.
    prisma.mentorSession.findUnique.mockResolvedValue(request({ paymentStatus: 'AUTHORIZED' }));
    prisma.escrowPayment.findUnique.mockResolvedValue({ createdAt: new Date(Date.now() - 6.5 * DAY), metadata: null });

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('will run out before this session'),
    });
    expect(prisma.mentorSession.updateMany).not.toHaveBeenCalled();
  });

  it('uses the deadline Stripe reported for the hold when one was recorded', async () => {
    // Stripe said this hold lasts a fortnight, so a session in ten days fits.
    prisma.mentorSession.findUnique.mockResolvedValue(
      request({ paymentStatus: 'AUTHORIZED', scheduledAt: new Date(Date.now() + 10 * DAY) })
    );
    prisma.escrowPayment.findUnique.mockResolvedValue({
      createdAt: new Date(Date.now() - HOUR),
      metadata: { captureBefore: new Date(Date.now() + 14 * DAY).toISOString() },
    });

    await expect(updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor')).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('accepts a free session without looking at any payment', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(
      request({ sessionAmount: 0, stripePaymentIntentId: null, paymentStatus: 'CAPTURED' })
    );

    const updated = await updateSessionStatus('sess-1', 'mentor-1', 'CONFIRMED', 'mentor');

    expect(updated).toMatchObject({ status: 'CONFIRMED' });
    expect(retrieve).not.toHaveBeenCalled();
    expect(prisma.escrowPayment.findUnique).not.toHaveBeenCalled();
  });

  it('does not ask a mentee to wait on a payment: only the mentor accepts', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(request());

    await expect(updateSessionStatus('sess-1', 'mentee-1', 'CONFIRMED', 'mentee')).rejects.toMatchObject({ statusCode: 403 });
    expect(retrieve).not.toHaveBeenCalled();
  });
});
