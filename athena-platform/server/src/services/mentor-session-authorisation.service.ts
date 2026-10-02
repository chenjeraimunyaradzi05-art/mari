/**
 * When a paid mentoring session becomes a request a mentor can act on.
 *
 * A paid session used to reach the mentor the moment its hold was created, which
 * is before the mentee had seen a card field. The mentor was told about a request
 * nobody had paid for, could accept it, and was then left with a confirmed hour
 * and no money behind it; the unpaid request also sat on her calendar for as long
 * as it lived, because nothing ever called it off. The rule now is the one the
 * marketplace already keeps for a booking (see escrowHeld in
 * skills-marketplace.routes): a paid request is the mentor's to answer once the
 * card is really held, and not before.
 *
 *   - The mentor is told when the hold is authorised, from the Stripe webhook that
 *     says so (payment_intent.amount_capturable_updated), and not when the intent
 *     is created. A free session has no card step and is told at once.
 *   - Accepting is refused until the hold is real. Stripe is asked when the
 *     webhook is behind, so a hold that is real is never turned away on a stale
 *     row, and one that is not is never accepted on one.
 *   - A request whose card step is still unfinished after UNPAID_REQUEST_HOURS is
 *     called off by the expiry sweep, and the mentee is told. Without that, one
 *     member could ask for every hour a mentor has, never pay, and keep her
 *     calendar full of requests she could not even see.
 *
 * Kept apart from mentor.service so the webhook and the sweep can use it without
 * loading the mentor directory. Its imports are light on purpose, and the
 * notification service is loaded only when a notice is actually sent.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { getStripe } from '../utils/stripe';
import { bestEffort } from '../utils/best-effort';
import { recordFailure } from '../utils/ops-metrics';
import { escapeHtml } from '../utils/escape-html';
import { cancelSessionHold } from './mentor-payment-release.service';

/**
 * How long a paid request may wait for its card step before it is called off.
 *
 * Long enough for a mentee who closed the form to find her card and come back
 * from her sessions list, which hands the card form out again. Short enough that
 * an unpaid request does not hold a mentor's hour for a day. The sweep that acts
 * on it runs every six hours, so in practice a request is called off between this
 * and this plus six hours after it was made.
 */
export const UNPAID_REQUEST_HOURS = 2;

/** How many unpaid requests one sweep deals with; the rest are picked up by the next. */
const UNPAID_REQUESTS_PER_SWEEP = 50;

/** The statuses a payment is moved out of by an authorisation, which is where an unpaid request is. */
const UNAUTHORISED = ['PENDING', 'FAILED'] as const;

/**
 * What Stripe says about the card behind a session's hold.
 *
 * `held`      the money is authorised on her card, or has already been taken.
 * `not_held`  nothing is authorised: the card step was never finished, was
 *             declined, or the intent was cancelled.
 * `unknown`   Stripe could not be asked, or has not decided yet. Never read as
 *             either of the others, so a wobble cannot accept an unpaid session
 *             or call off a paid one.
 */
export type CardHold = 'held' | 'not_held' | 'unknown';

/**
 * Whether a hold is the development processor's, which has no card step and sends
 * no webhook, so it is as held as it will ever be the moment it is made.
 *
 * Production never makes one (createEscrowPayment refuses with a 503 rather than
 * mocking), so a mock id seen there is not money and is not read as money.
 */
export function isDevelopmentHold(paymentIntentId: string): boolean {
  return paymentIntentId.startsWith('pi_mock_') && process.env.NODE_ENV !== 'production';
}

/** Asks Stripe, rather than this database's copy of the answer, whether a session's card is held. */
export async function readCardHold(paymentIntentId: string): Promise<CardHold> {
  if (paymentIntentId.startsWith('pi_mock_')) {
    return isDevelopmentHold(paymentIntentId) ? 'held' : 'not_held';
  }

  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (intent.status === 'requires_capture' || intent.status === 'succeeded') return 'held';
    if (intent.status === 'processing') return 'unknown';
    return 'not_held';
  } catch (error) {
    logger.warn('Could not ask Stripe whether a mentoring session’s card is held', {
      paymentIntentId,
      error: (error as Error).message,
    });
    return 'unknown';
  }
}

/**
 * Writes that a session's card is held, on the session and on the hold's own row,
 * for the callers that learned it from Stripe rather than from its webhook.
 *
 * The webhook does the same thing when it lands, from the same statuses, so
 * whichever of the two gets there second finds nothing left to move. Answers
 * whether this call was the one that moved the session, which is what a caller
 * that tells somebody about it hangs the telling on.
 */
export async function recordSessionAuthorised(
  session: { id: string; stripePaymentIntentId: string },
  now = new Date()
): Promise<boolean> {
  const moved = await prisma.mentorSession.updateMany({
    where: {
      id: session.id,
      stripePaymentIntentId: session.stripePaymentIntentId,
      paymentStatus: { in: [...UNAUTHORISED] },
    },
    data: { paymentStatus: 'AUTHORIZED', paymentAuthorizedAt: now },
  });

  await prisma.escrowPayment.updateMany({
    where: { paymentIntentId: session.stripePaymentIntentId, status: { in: [...UNAUTHORISED] } },
    data: { status: 'AUTHORIZED' },
  });

  return moved.count > 0;
}

/** The notice a mentor gets of a request, with the mentee's note (escaped: it is her words, in our email). */
export async function notifyMentorOfRequest(
  session: { id: string; scheduledAt: Date | null; note: string | null },
  mentorUserId: string
): Promise<void> {
  const { notificationService } = await import('./notification.service');
  const when = session.scheduledAt;
  const link = `/dashboard/mentors/sessions?session=${session.id}`;

  await notificationService.notify({
    userId: mentorUserId,
    type: 'MENTOR_SESSION',
    title: 'New Mentorship Request',
    message: `You have a new mentorship session request for ${when ? when.toLocaleDateString() : 'a time to be agreed'}`,
    link,
    channels: ['in-app', 'email', 'push'],
    emailTemplate: {
      subject: 'New Mentorship Request',
      html: `
        <h2>New Mentorship Request</h2>
        <p>You have a new session request for ${when ? when.toLocaleString() : 'a time to be agreed'}.</p>
        <p><strong>Note from mentee:</strong> ${session.note ? escapeHtml(session.note) : 'No note provided'}</p>
        <div style="margin: 20px 0;">
          <a href="${process.env.CLIENT_URL}${link}" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Request</a>
        </div>
      `,
    },
  });
}

/**
 * The same notice, for a caller that knows the session and not its mentor: the
 * Stripe webhook, and the sweep. Nothing is sent for a session that is not still
 * a request, which a mentee's withdrawal in the meantime makes it.
 */
export async function notifyMentorOfRequestById(sessionId: string): Promise<void> {
  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, scheduledAt: true, note: true, mentorProfile: { select: { userId: true } } },
  });
  if (!session || session.status !== 'REQUESTED' || !session.mentorProfile) return;

  await notifyMentorOfRequest(session, session.mentorProfile.userId);
}

export interface UnpaidRequestSweep {
  /** Requests whose card turned out to be held after all (the webhook was behind); the mentor has now been told. */
  authorised: number;
  /** Requests called off because the card step was never finished. */
  cancelled: number;
  /** Requests left for the next run: Stripe could not be asked, or the hold could not be released. */
  deferred: number;
}

/**
 * Calls off the paid requests whose card step was never finished, and catches up
 * the ones whose card is held but whose webhook never landed.
 *
 * Stripe is asked about each one before anything is done to it. A mentee who
 * authorised a minute ago, or whose webhook is simply late (or was never
 * configured), has a real hold, and calling that request off would release her
 * card and tell her she had not paid. Such a request is moved to AUTHORIZED and
 * the mentor told, which is what the webhook would have done.
 *
 * Safe to run twice and from two instances: every write is conditional on the
 * session still being an unpaid request, so the second run finds nothing to do.
 */
export async function cancelUnpaidMentorRequests(now = new Date(), limit = UNPAID_REQUESTS_PER_SWEEP): Promise<UnpaidRequestSweep> {
  const result: UnpaidRequestSweep = { authorised: 0, cancelled: 0, deferred: 0 };
  const cutoff = new Date(now.getTime() - UNPAID_REQUEST_HOURS * 60 * 60 * 1000);

  const stale = await prisma.mentorSession.findMany({
    where: {
      status: 'REQUESTED',
      paymentStatus: { in: [...UNAUTHORISED] },
      sessionAmount: { gt: 0 },
      stripePaymentIntentId: { not: null },
      createdAt: { lte: cutoff },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      menteeId: true,
      scheduledAt: true,
      stripePaymentIntentId: true,
      mentorProfile: { select: { userId: true, user: { select: { displayName: true } } } },
    },
  });

  for (const session of stale) {
    const paymentIntentId = session.stripePaymentIntentId;
    if (!paymentIntentId) continue;

    const hold = await readCardHold(paymentIntentId);
    if (hold === 'unknown') {
      result.deferred += 1;
      continue;
    }

    if (hold === 'held') {
      if (await recordSessionAuthorised({ id: session.id, stripePaymentIntentId: paymentIntentId }, now)) {
        result.authorised += 1;
        await bestEffort('notification.mentor-request-late-authorisation', () => notifyMentorOfRequestById(session.id));
      }
      continue;
    }

    try {
      // The hold first, then the session: a hold that cannot be released leaves
      // the session as it was for the next run, rather than a cancelled session
      // whose card is still held.
      await cancelSessionHold(paymentIntentId, 'The card step was not completed');
    } catch (error) {
      result.deferred += 1;
      recordFailure('mentor.session.unpaid-release', error);
      logger.error('Could not release the hold behind an unpaid mentoring request', {
        sessionId: session.id,
        paymentIntentId,
        error: (error as Error).message,
      });
      continue;
    }

    const called = await prisma.mentorSession.updateMany({
      where: { id: session.id, status: 'REQUESTED', paymentStatus: { in: [...UNAUTHORISED] } },
      data: { status: 'CANCELED', paymentStatus: 'CANCELED', paymentCanceledAt: now },
    });
    if (called.count === 0) continue;

    result.cancelled += 1;
    const mentorName = session.mentorProfile?.user?.displayName ?? 'your mentor';
    await bestEffort('notification.mentor-request-unpaid-cancelled', () =>
      prisma.notification.create({
        data: {
          userId: session.menteeId,
          type: 'SYSTEM',
          title: 'Your session request was cancelled',
          message: `The payment for your session request to ${mentorName} was not authorised within ${UNPAID_REQUEST_HOURS} hours, so the request has been cancelled and nothing has been charged. You are welcome to request it again.`,
          link: '/dashboard/mentors',
        },
      })
    );
  }

  return result;
}
