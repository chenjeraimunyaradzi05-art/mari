/**
 * A mentor session closed while payments are paused.
 *
 * Closing a paid session takes the mentee's card. When the capture failed, the
 * session was written FAILED and the mentor was told the payment needed
 * attention, which is right for a card that could not be charged. A pause an
 * admin chose is not that: the session is completed, the money stays held, the
 * payment stays AUTHORIZED, and the session is marked due now so the sweep that
 * collects due sessions takes it when payments reopen. Nobody is told something
 * false.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mentorSession = {
  findUnique: jest.fn(async (..._args: any[]): Promise<any> => null),
  findUniqueOrThrow: jest.fn(async (): Promise<any> => ({ id: 'session-1' })),
  updateMany: jest.fn(async (..._args: any[]): Promise<any> => ({ count: 1 })),
};
const mentorProfile = { update: jest.fn(async (..._args: any[]): Promise<any> => ({})) };
const notification = { create: jest.fn(async (..._args: any[]): Promise<any> => ({})) };
const prismaMock: any = {
  mentorSession,
  mentorProfile,
  notification,
  escrowPayment: { findUnique: jest.fn(async (): Promise<any> => null) },
  user: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};
jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../notification.service', () => {
  const notify = jest.fn(async () => undefined);
  return { notificationService: { notify }, NotificationService: class {} };
});

// The pause. Off unless a test turns it on; both the legacy capture branch and the
// service's own check read it.
let paymentsPaused = false;
jest.mock('../feature-flags.service', () => {
  const { ApiError } = jest.requireActual('../../middleware/errorHandler') as any;
  return {
    getPaymentsPause: jest.fn(async () => ({ paused: paymentsPaused, message: 'Payments are paused.' })),
    assertPaymentsOpen: jest.fn(async () => {
      if (paymentsPaused) throw new ApiError(503, 'Payments are paused.', { code: 'PAYMENTS_PAUSED' });
    }),
    isPaymentsPausedError: (error: any) => error?.details?.code === 'PAYMENTS_PAUSED',
  };
});

const stripe = { paymentIntents: { capture: jest.fn(async (..._args: any[]): Promise<any> => ({ status: 'succeeded' })), cancel: jest.fn() } };
jest.mock('../../utils/stripe', () => ({
  getStripe: () => stripe,
  isStripeConfigured: () => true,
  STRIPE_API_VERSION: '2023-10-16',
}));

jest.mock('../stripe-connect.service', () => ({
  ...(jest.requireActual('../stripe-connect.service') as object),
  captureEscrowPayment: jest.fn(),
  cancelEscrowPayment: jest.fn(),
}));

import { updateSessionStatus } from '../mentor.service';
import { notificationService } from '../notification.service';

const notify = (notificationService as any).notify as jest.Mock;

const finishedSession = () => ({
  id: 'session-1',
  status: 'CONFIRMED',
  menteeId: 'mentee-1',
  mentorProfileId: 'mp-1',
  mentorProfile: { id: 'mp-1', userId: 'mentor-1' },
  // A session with no escrow row behind it: the legacy branch takes the money from Stripe directly.
  stripePaymentIntentId: 'pi_legacy',
  sessionAmount: 120,
  currency: 'AUD',
  scheduledAt: new Date('2026-09-01T00:00:00Z'),
  durationMinutes: 60,
});

const writtenToSession = () => mentorSession.updateMany.mock.calls[0][0].data;

beforeEach(() => {
  jest.clearAllMocks();
  paymentsPaused = false;
  mentorSession.findUnique.mockResolvedValue(finishedSession());
  prismaMock.escrowPayment.findUnique.mockResolvedValue(null);
});

describe('a mentee confirming a finished session', () => {
  it('is charged at once when payments are open, which is the control for the case below', async () => {
    await updateSessionStatus('session-1', 'mentee-1', 'COMPLETED', 'mentee');

    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_legacy');
    expect(writtenToSession()).toMatchObject({ status: 'COMPLETED', paymentStatus: 'CAPTURED' });
  });

  it('completes the session, takes nothing, and does not call a pause a failed payment', async () => {
    paymentsPaused = true;

    await updateSessionStatus('session-1', 'mentee-1', 'COMPLETED', 'mentee');

    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    const written = writtenToSession();
    expect(written.status).toBe('COMPLETED');
    // Not FAILED, and not CAPTURED: the payment is left where it was.
    expect(written.paymentStatus).toBeUndefined();
    expect(written.paymentFailedAt).toBeUndefined();
    // Due now, so the sweep that collects due sessions picks it up the moment
    // payments reopen. Without this it would be left AUTHORIZED with no date.
    expect(written.paymentReleaseAt).toBeInstanceOf(Date);
  });

  it('does not tell the mentor a payment needs attention, since it does not', async () => {
    paymentsPaused = true;

    await updateSessionStatus('session-1', 'mentee-1', 'COMPLETED', 'mentee');

    const titles = notify.mock.calls.map((call: any[]) => call[0].title);
    expect(titles).not.toContain('A session payment needs attention');
    expect(notification.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'A session payment needs attention' }) })
    );
  });

  it('still marks a real failure FAILED, so the pause did not hide the old case', async () => {
    stripe.paymentIntents.capture.mockRejectedValueOnce(new Error('card declined'));

    await updateSessionStatus('session-1', 'mentee-1', 'COMPLETED', 'mentee');

    expect(writtenToSession()).toMatchObject({ status: 'COMPLETED', paymentStatus: 'FAILED' });
  });
});
