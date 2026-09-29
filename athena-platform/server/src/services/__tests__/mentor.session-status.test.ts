/**
 * Moving a mentor session to COMPLETED or CANCELED, from each side.
 *
 * Two things this pins. A mentee charged when her mentor closes a paid
 * session is told where to go if the hour did not happen, and that place has
 * to exist: the notice linked to /dashboard/support, a route with no page. And
 * the rule that stops a mentee voiding an hour that may have run applies to a
 * confirmed session only — it used to catch requests the mentor never
 * accepted, so a mentee could not withdraw one once its date had passed.
 */

jest.mock('../../utils/prisma', () => {
  const prisma = {
    mentorSession: { findUnique: jest.fn(), update: jest.fn() },
    mentorProfile: { update: jest.fn() },
    escrowPayment: { findUnique: jest.fn() },
    user: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn() },
    $transaction: jest.fn(async (writes: Array<Promise<unknown>>) => Promise.all(writes)),
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

const prisma: any = prismaTyped;
const notify = notificationService.notify as unknown as jest.Mock;

const HOUR = 60 * 60 * 1000;

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

describe('Changing a mentor session’s status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mentorSession.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'sess-1', ...data }));
    prisma.mentorProfile.update.mockResolvedValue({});
    prisma.escrowPayment.findUnique.mockResolvedValue({ id: 'esc-1', status: 'AUTHORIZED', capturedAt: null });
  });

  it('tells a mentee charged by her mentor’s completion where to go, at a page that exists', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session());

    await updateSessionStatus('sess-1', 'mentor-1', 'COMPLETED', 'mentor');

    expect(captureEscrowPayment).toHaveBeenCalledWith('pi_1', { id: 'system', role: 'ADMIN' });
    const notice = notify.mock.calls[0][0];
    expect(notice.userId).toBe('mentee-1');
    expect(notice.title).toBe('Your session was marked complete and paid');
    expect(notice.message).toContain('90.00 AUD');
    expect(notice.link).toBe(MENTEE_SUPPORT_LINK);
    expect(MENTEE_SUPPORT_LINK).toBe('/dashboard/settings/help');
    // The email says the same, rather than only that the session "is now
    // COMPLETED".
    expect(notice.emailTemplate.subject).toBe('Your mentoring session was completed and charged');
    expect(notice.emailTemplate.html).toContain('90.00 AUD was charged to your card');
    expect(notice.emailTemplate.html).toContain('/dashboard/settings/help');
  });

  it('lets a mentee confirm the session herself once its time has passed', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session());

    const updated = await updateSessionStatus('sess-1', 'mentee-1', 'COMPLETED', 'mentee');

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
    expect(prisma.mentorSession.update).not.toHaveBeenCalled();
  });

  it('lets the mentor cancel a confirmed session after it has run, releasing the hold', async () => {
    prisma.mentorSession.findUnique.mockResolvedValue(session());

    const updated = await updateSessionStatus('sess-1', 'mentor-1', 'CANCELED', 'mentor');

    expect(cancelEscrowPayment).toHaveBeenCalled();
    expect(updated).toMatchObject({ status: 'CANCELED', paymentStatus: 'CANCELED' });
  });
});
