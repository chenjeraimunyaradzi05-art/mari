/**
 * Taking the money for a mentoring session, after the mentee has had her say.
 *
 * A mentor closing a paid session used to charge the mentee's card that minute.
 * The mentee was told afterwards, and the notice sent her to Help and Support if
 * the hour had not happened, because MentorSession had nowhere to record an
 * objection and nothing held the money while anyone looked. Now the mentor's
 * word starts a short window (SESSION_CONFIRMATION_HOURS). The card stays held
 * through it, the mentee can say the session did not take place, and the
 * expiry sweep takes the money once the window is over unless she has. A session
 * the mentee confirms herself, and one whose card hold is too close to lapsing to
 * wait, are still charged at once.
 *
 * Kept apart from mentor.service so the sweep can call it without loading the
 * mentor directory, and from the sweep so mentor.service can ask it when the
 * window ends. It imports only the database, Stripe and the escrow service: it
 * must stay loadable from a test of either.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { getStripe } from '../utils/stripe';
import { bestEffort } from '../utils/best-effort';
import { recordFailure } from '../utils/ops-metrics';
import { ApiError } from '../middleware/errorHandler';
import { DISPUTE_WINDOW_DAYS, SESSION_CONFIRMATION_HOURS } from '../config/price-book';
import { holdDeadlineOf } from './escrow-deadline';
import { cancelEscrowPayment, captureEscrowPayment, PLATFORM_ESCROW_ACTOR } from './stripe-connect.service';
import { assertPaymentsOpen, getPaymentsPause, isPaymentsPausedError } from './feature-flags.service';

const HOUR = 60 * 60 * 1000;

/**
 * How far before the card hold runs out the money has to be taken at the latest.
 * The sweep that takes it runs every six hours, so a release planned for the last
 * moment could miss the hold altogether by one skipped run.
 */
const LAPSE_MARGIN_HOURS = 12;

/** A window shorter than this is not a window: the hold has too little life left to wait on. */
const SHORTEST_WINDOW_HOURS = 1;

type HoldForWindow = { status: string; createdAt?: Date; metadata?: unknown } | null;

/**
 * When a mentee's card is to be charged for a session her mentor has just closed,
 * or null when it is to be charged now.
 *
 * The window is SESSION_CONFIRMATION_HOURS, cut short so that it ends at least
 * LAPSE_MARGIN_HOURS before the card hold stops being collectable. A hold with
 * no room for a window (a session finished days after it was booked), one that
 * is not authorised, or one with no row at all (a session booked before mentoring
 * wrote escrow rows) gets none, and the money is taken as it always was.
 */
export function paymentReleaseTimeFor(now: Date, hold: HoldForWindow): Date | null {
  if (!hold || hold.status !== 'AUTHORIZED' || !(hold.createdAt instanceof Date)) return null;

  const wanted = now.getTime() + SESSION_CONFIRMATION_HOURS * HOUR;
  const latest = holdDeadlineOf({ createdAt: hold.createdAt, metadata: hold.metadata }).getTime() - LAPSE_MARGIN_HOURS * HOUR;
  const releaseAt = Math.min(wanted, latest);

  return releaseAt - now.getTime() >= SHORTEST_WINDOW_HOURS * HOUR ? new Date(releaseAt) : null;
}

/**
 * Takes the money a finished session has been holding.
 *
 * Bookings made since mentoring moved onto the shared escrow path have an
 * EscrowPayment row and go through the service, so the ledger row moves with the
 * session. Bookings made before it have a PaymentIntent and no row, and their
 * money is just as real, so they are captured directly. That branch can be
 * dropped once no unfinished session predates the change.
 */
export async function captureSessionHold(paymentIntentId: string): Promise<{ capturedAt: Date }> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { status: true, capturedAt: true },
  });

  if (!escrow) {
    // This branch takes the money from Stripe directly, past the escrow service
    // that asks about the pause for everything else, so it asks for itself.
    await assertPaymentsOpen();
    const captured = await getStripe().paymentIntents.capture(paymentIntentId);
    if (captured.status !== 'succeeded' && captured.status !== 'processing') {
      throw new ApiError(502, `Stripe left the session payment in ${captured.status}`);
    }
    return { capturedAt: new Date() };
  }

  if (escrow.status === 'CAPTURED') {
    // The expiry sweeper takes a hold early when it is about to lapse, so the
    // money can already be collected by the time the session is marked done.
    // That is a paid session, not a failed capture.
    return { capturedAt: escrow.capturedAt ?? new Date() };
  }

  await captureEscrowPayment(paymentIntentId, PLATFORM_ESCROW_ACTOR);
  return { capturedAt: new Date() };
}

/** Releases a cancelled session's hold, on either side of the escrow change. */
export async function cancelSessionHold(paymentIntentId: string, reason = 'Session canceled'): Promise<void> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { id: true, status: true },
  });

  if (!escrow) {
    await getStripe().paymentIntents.cancel(paymentIntentId);
    return;
  }

  // Already given back: by the expiry sweep, the webhook, or an earlier attempt
  // at this same cancellation whose session write failed. The escrow service
  // refuses a second release with a 400, which used to land in the caller's catch
  // and be reported as a hold that could not be released, when the money was
  // already back on her card.
  if (escrow.status === 'CANCELED' || escrow.status === 'REFUNDED') {
    return;
  }

  await cancelEscrowPayment(paymentIntentId, PLATFORM_ESCROW_ACTOR, reason);
}

function sessionDay(scheduledAt: Date | null): string {
  return scheduledAt
    ? scheduledAt.toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'long' })
    : 'its booked date';
}

export interface MentorReleaseResult {
  /** Sessions whose card was charged this run. */
  released: number;
  /** Sessions whose card could not be charged; each is marked FAILED and the people who can act are told. */
  failed: number;
}

/**
 * Charges every session whose window has ended without the mentee objecting.
 *
 * Called by the expiry sweep, which is the only scheduler there is. Safe to run
 * twice: a session is picked only while it is COMPLETED, still AUTHORIZED and
 * undisputed, and it is read again straight before the card is touched, so an
 * objection made while the list was being worked through stops the money. The
 * remaining gap, an objection in the instant between that read and the capture,
 * costs nothing that cannot be undone: a dispute can be opened on a charged
 * session, and the team can refund it.
 */
export async function releaseDueMentorSessions(now = new Date(), limit = 50): Promise<MentorReleaseResult> {
  const result: MentorReleaseResult = { released: 0, failed: 0 };

  // While payments are paused nothing is taken, and nothing is marked FAILED
  // either: a capture refused for a pause is not a card that could not be
  // charged, and telling each mentor a payment "needs attention" for it would
  // be false. The sessions stay AUTHORIZED and due, and the first sweep after
  // payments reopen takes the money.
  if ((await getPaymentsPause()).paused) {
    logger.warn('Mentor session payments were left uncollected because payments are paused');
    return result;
  }

  const due = await prisma.mentorSession.findMany({
    where: {
      status: 'COMPLETED',
      paymentStatus: 'AUTHORIZED',
      disputedAt: null,
      paymentReleaseAt: { lte: now },
      stripePaymentIntentId: { not: null },
    },
    orderBy: { paymentReleaseAt: 'asc' },
    take: limit,
    select: {
      id: true,
      menteeId: true,
      currency: true,
      sessionAmount: true,
      scheduledAt: true,
      stripePaymentIntentId: true,
      mentorProfile: { select: { userId: true } },
    },
  });

  for (const session of due) {
    const paymentIntentId = session.stripePaymentIntentId;
    if (!paymentIntentId) continue;

    const fresh = await prisma.mentorSession.findUnique({
      where: { id: session.id },
      select: { status: true, paymentStatus: true, disputedAt: true },
    });
    if (!fresh || fresh.status !== 'COMPLETED' || fresh.paymentStatus !== 'AUTHORIZED' || fresh.disputedAt) continue;

    const amount = `${Number(session.sessionAmount).toFixed(2)} ${session.currency}`;
    const link = `/dashboard/mentors/sessions?session=${session.id}`;
    const mentorUserId = session.mentorProfile?.userId ?? null;

    try {
      const { capturedAt } = await captureSessionHold(paymentIntentId);
      // Not conditional on the status: if the mentee disputed in the instant
      // since the read above, the money has still moved and the row has to say
      // so, and the status is not this write's to change.
      await prisma.mentorSession.updateMany({
        where: { id: session.id },
        data: { paymentStatus: 'CAPTURED', paymentCapturedAt: capturedAt },
      });
      result.released += 1;
      logger.info('Charged a mentor session after its confirmation window', { sessionId: session.id });

      await bestEffort('notification.mentor-release-mentee', () =>
        prisma.notification.create({
          data: {
            userId: session.menteeId,
            type: 'SYSTEM',
            title: 'Your mentoring session has been paid for',
            message: `${amount} was charged to your card for your session on ${sessionDay(session.scheduledAt)}, as your mentor marked it complete and no problem was reported. If it did not take place you can still tell us from your sessions page for ${DISPUTE_WINDOW_DAYS} days.`,
            link,
          },
        })
      );
      if (mentorUserId) {
        await bestEffort('notification.mentor-release-mentor', () =>
          prisma.notification.create({
            data: {
              userId: mentorUserId,
              type: 'SYSTEM',
              title: 'You have been paid for a session',
              message: `The ${amount} for your session on ${sessionDay(session.scheduledAt)} has been released to you.`,
              link,
            },
          })
        );
      }
    } catch (error) {
      // A pause switched on part-way through this run, after the check at the top.
      // The capture was refused for the pause, not because the card could not be
      // charged, so this session is left AUTHORIZED and due, with nobody told it
      // failed, and the run stops: every session after it would be refused the
      // same way. The first sweep after payments reopen takes the money.
      if (isPaymentsPausedError(error)) {
        logger.warn('Mentor session payments were left uncollected because payments were paused part-way through a run', {
          sessionId: session.id,
        });
        break;
      }
      result.failed += 1;
      recordFailure('mentor.session.release', error);
      logger.error('Could not charge a mentor session after its confirmation window; the mentor has not been paid', {
        sessionId: session.id,
        paymentIntentId,
        error: (error as Error).message,
      });
      await bestEffort('mentor-release.mark-failed', () =>
        prisma.mentorSession.updateMany({
          where: { id: session.id, paymentStatus: 'AUTHORIZED' },
          data: { paymentStatus: 'FAILED', paymentFailedAt: new Date() },
        })
      );
      await tellAboutUncollectedSession(mentorUserId, session.id);
    }
  }

  return result;
}

/**
 * Tells the mentor, and the people who can do something about it, that a
 * session's money could not be collected when its window ended. In-app only,
 * and each write is best effort: the status change above is the real work.
 */
async function tellAboutUncollectedSession(mentorUserId: string | null, sessionId: string): Promise<void> {
  if (mentorUserId) {
    await bestEffort('notification.mentor-release-failed', () =>
      prisma.notification.create({
        data: {
          userId: mentorUserId,
          type: 'SYSTEM',
          title: 'A session payment needs attention',
          message: 'Your session is complete, but the payment could not be collected. Our team has been notified and will follow it up with you.',
          link: `/dashboard/mentors/sessions?session=${sessionId}`,
        },
      })
    );
  }

  const admins = await bestEffort(
    'mentor-release-failed.admin-lookup',
    () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }),
    []
  );
  await Promise.all(
    admins.map((admin) =>
      bestEffort('notification.mentor-release-failed-admins', () =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'SYSTEM',
            title: 'A mentor session payment could not be collected',
            message: `Session ${sessionId} was complete and its confirmation window ended, but the authorisation could not be captured. The mentor is owed money the platform did not take.`,
            link: '/admin',
          },
        })
      )
    )
  );
}
