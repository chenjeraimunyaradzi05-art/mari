/**
 * Escrow holds that are about to lapse.
 *
 * A card authorisation lives about seven days with a live processor. Several
 * flows here hold funds longer than that on purpose: a car purchase gives the
 * buyer a fourteen-day inspection period, and a marketplace order can sit open
 * while work is delivered. Nothing watched the gap, so a hold could quietly
 * expire and the platform would discover at release time that there was no
 * longer any money to capture, with the seller already out of pocket.
 *
 * This sweep finds those holds before they lapse and says so. It does not
 * capture by default. Capturing early takes real money off a member's card
 * sooner than she agreed to, which is a decision for the operator rather than
 * for a background job, so the capture path is behind
 * ESCROW_CAPTURE_BEFORE_EXPIRY and is off unless it is deliberately turned on.
 *
 * With capture off, the person whose action actually releases the money is
 * the buyer, so she is the one asked, while there is still time: once per hold,
 * inside the warning window, with a link to the screen she releases it from.
 * A mentor session is released by the session being completed, so there it is
 * the mentor who is asked. And a hold that has outlived its authorisation is no
 * longer left in PENDING or AUTHORIZED for good. Stripe is asked what became of
 * it and the row is settled to the answer: captured after all (the seller was
 * paid and only the row was behind), or expired, in which case both parties
 * are told and the admins are given the order to decide.
 *
 * Whether capture is on or off, a hold whose order, booking or session has been
 * cancelled is given back to the buyer rather than left on her card, and early
 * capture never takes money for work its own flow does not record as done.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { runExclusively } from '../utils/redis';
import { recordCondition, recordFailure, recordSuccess } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import { isStripeConfigured } from '../utils/stripe';
import * as stripeConnect from './stripe-connect.service';
import { startStripeReconciler, stopStripeReconciler } from './stripe-reconciliation.service';
// A hold that no order, booking or session owns — one made through POST
// /api/connect/escrow — is released by its buyer from GENERIC_HOLDS_SCREEN.
// There was no such screen, so those buyers were never asked and nothing but an
// admin could move the money.
import { FLOW_OWNED_SESSION_TYPES, GENERIC_HOLDS_SCREEN } from './escrow-holds.service';
// Stripe's own deadline for a hold when it was recorded, the seven-day
// assumption when it was not; and the nudge to a buyer whose order's hold is
// about to go, which is the one action that keeps a long job paid for.
import { holdDeadlineOf } from './escrow-deadline';
import { LIVE_ORDER_STATUSES, askBuyerToRenew } from './escrow-renewal.service';
// A mentor session the mentor closed is charged by this sweep once the mentee's
// window to object has ended; see mentor-payment-release.service.
import { releaseDueMentorSessions } from './mentor-payment-release.service';
// A paid mentoring request whose card step was never finished is called off here,
// and one whose card is held but whose webhook never landed is caught up.
import { cancelUnpaidMentorRequests } from './mentor-session-authorisation.service';
import { isPaymentsPausedError } from './feature-flags.service';

/** How long a card authorisation is assumed to last. */
const AUTHORISATION_LIFETIME_DAYS = 7;

/** How long before the lapse to start warning. */
const WARN_WINDOW_DAYS = 2;

/** Statuses where money is still merely held rather than taken or returned. */
const HELD_STATUSES = ['PENDING', 'AUTHORIZED'];

/**
 * How long before the same standing condition is raised with the admins again.
 *
 * The sweep runs every six hours. A hold still inside its authorisation, or one
 * past it that Stripe still reports held or could not be asked about, stays in
 * HELD_STATUSES, so the same holds come back on every run for as long as they
 * go unresolved. A day is long enough that a person who has already been told
 * is not told three more times before they have had a chance to act, and short
 * enough that the reminder still arrives while a hold in the two-day warning
 * window can be saved.
 */
const NOTIFY_AGAIN_AFTER_MS = 24 * 60 * 60 * 1000;

/** Raised while the money can still be collected. */
const EXPIRING_TITLE = 'Escrow holds are about to lapse';
/** Raised once it most likely cannot. */
const LAPSED_TITLE = 'Escrow holds need attention';
/** Raised for each batch of holds Stripe let lapse, which are now marked cancelled. */
const EXPIRED_TITLE = 'Escrow holds expired before release';

/** What the buyer is sent, once per hold, while she can still release it. */
const BUYER_CHASE_TITLE = 'A payment is waiting for you to release it';
const BUYER_EXPIRED_TITLE = 'A payment hold on your card has expired';
const SELLER_EXPIRED_TITLE = 'A payment for you expired before it was released';

/** What a mentor is sent, once per hold, while the session can still be paid for. */
const MENTOR_COMPLETE_TITLE = 'Mark your session complete to be paid';
const MENTOR_RESPOND_TITLE = 'A session request is waiting for your answer';

/** How many legacy mentor sessions are given escrow rows per sweep. */
const ADOPTIONS_PER_SWEEP = 50;

const captureEnabled = (): boolean => process.env.ESCROW_CAPTURE_BEFORE_EXPIRY === 'true';

export interface EscrowExpirySweep {
  checked: number;
  expiringSoon: number;
  captured: number;
  failed: number;
  /** Past its authorisation and, as far as Stripe or this run can tell, still unresolved. */
  alreadyLapsed: number;
  /** Past its authorisation, but Stripe had captured it: the row was behind and is now CAPTURED. */
  repaired: number;
  /** Past its authorisation and cancelled at Stripe: the row is now CANCELED. */
  expired: number;
  /** Past its authorisation with no card ever put behind it, so no money was at stake. */
  neverPaid: number;
  /** Buyers asked to release a hold this run. */
  buyersReminded: number;
  /** Mentors asked to accept or complete the session a hold is waiting on. */
  mentorsReminded: number;
  /**
   * Buyers asked to renew the card hold behind a marketplace order whose work is
   * not finished and whose hold is within two days of running out.
   */
  renewalsRequested: number;
  /**
   * Holds whose order, booking or session had been cancelled, given back to
   * the buyer instead of being left on her card or captured early.
   */
  released: number;
  /** Holds for something cancelled that this run tried to give back and could not. */
  releaseFailed: number;
  /**
   * Holds left uncaptured because what they pay for has not happened: a
   * mentor session never accepted or not yet held, an order not delivered, a
   * job the workshop has not finished, or a car purchase, which is only ever
   * released by its buyer or by ATHENA's team.
   */
  awaitingSession: number;
  /** Legacy mentor sessions given the escrow row they never had, this run. */
  adopted: number;
  /** Legacy mentor sessions this run tried to give a row and could not. */
  adoptFailed: number;
  /** Mentor sessions whose card was charged because the mentee's window to object ended without one. */
  sessionsReleased: number;
  /** Mentor sessions whose window ended and whose card could not be charged. */
  sessionReleaseFailed: number;
  /** Paid mentoring requests called off because the mentee never authorised the payment. */
  unpaidSessionsCancelled: number;
  /** Paid mentoring requests whose card turned out to be held after all, so the mentor has now been told. */
  unpaidSessionsAuthorised: number;
}

type HeldEscrow = {
  id: string;
  paymentIntentId: string | null;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  description: string | null;
  sessionType: string | null;
  metadata: Prisma.JsonValue;
  serviceOrder: { id: string; status?: string } | null;
  serviceBooking?: { id: string; status: string; scheduledAt: Date; durationMinutes: number } | null;
  serviceProposal?: { id: string; status: string } | null;
  vehiclePurchase?: { id: string; status: string } | null;
  vehicleInspection?: { id: string; status: string; listingId: string } | null;
  mechanicBooking?: { id: string; status: string } | null;
};

type MentorSessionState = {
  id: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED' | 'DISPUTED';
  scheduledAt: Date | null;
  durationMinutes: number;
  /** When the mentee's window to object ends, for a session the mentor closed. Null when it has none. */
  paymentReleaseAt?: Date | null;
  mentorProfile: { userId: string } | null;
};

/**
 * What a hold is paying for, read from the record of the flow that made it.
 *
 * The escrow row says that money is held and nothing about why, and every
 * decision the sweep makes about a hold — take it early, give it back, or ask
 * somebody to act — depends on the why. `orphaned` is a hold whose type names a
 * flow but whose record is not there, which nothing should capture and no
 * member can act on; `generic` is one made through the generic Connect route,
 * which no flow owns.
 */
type HoldFlow =
  | { kind: 'service_order'; id: string; status: string | null }
  | { kind: 'service_booking'; id: string; status: string; endsAt: Date }
  | { kind: 'custom_request'; id: string; status: string }
  | { kind: 'vehicle_purchase'; id: string; status: string }
  | { kind: 'vehicle_inspection'; id: string; status: string }
  | { kind: 'car_service'; id: string; status: string }
  | { kind: 'mentor_session'; session: MentorSessionState }
  | { kind: 'orphaned' }
  | { kind: 'generic' };

async function holdFlowFor(escrow: HeldEscrow): Promise<HoldFlow> {
  if (escrow.serviceOrder) {
    return { kind: 'service_order', id: escrow.serviceOrder.id, status: escrow.serviceOrder.status ?? null };
  }
  if (escrow.serviceBooking) {
    const { scheduledAt, durationMinutes } = escrow.serviceBooking;
    return {
      kind: 'service_booking',
      id: escrow.serviceBooking.id,
      status: escrow.serviceBooking.status,
      endsAt: new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000),
    };
  }
  if (escrow.serviceProposal) {
    return { kind: 'custom_request', id: escrow.serviceProposal.id, status: escrow.serviceProposal.status };
  }
  if (escrow.vehiclePurchase) {
    return { kind: 'vehicle_purchase', id: escrow.vehiclePurchase.id, status: escrow.vehiclePurchase.status };
  }
  if (escrow.vehicleInspection) {
    return { kind: 'vehicle_inspection', id: escrow.vehicleInspection.id, status: escrow.vehicleInspection.status };
  }
  if (escrow.mechanicBooking) {
    return { kind: 'car_service', id: escrow.mechanicBooking.id, status: escrow.mechanicBooking.status };
  }

  // Looked up by the intent for every hold no other flow claims, not only for
  // the ones typed as sessions, because a session is linked to its hold by the
  // intent id and nothing else.
  if (escrow.paymentIntentId) {
    const session = await prisma.mentorSession.findUnique({
      where: { stripePaymentIntentId: escrow.paymentIntentId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        durationMinutes: true,
        paymentReleaseAt: true,
        mentorProfile: { select: { userId: true } },
      },
    });
    if (session) return { kind: 'mentor_session', session };
  }

  return escrow.sessionType && FLOW_OWNED_SESSION_TYPES.includes(escrow.sessionType)
    ? { kind: 'orphaned' }
    : { kind: 'generic' };
}

/** A hold's amount as a member would read it: A$250.00, not 25000. */
function formatHoldAmount(escrow: Pick<HeldEscrow, 'amount' | 'currency'>): string {
  const major = escrow.amount / stripeConnect.minorUnitScale(escrow.currency);
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: escrow.currency.toUpperCase(),
    }).format(major);
  } catch {
    return `${major} ${escrow.currency.toUpperCase()}`;
  }
}

/** The day a hold's authorisation runs out, in Queensland time. */
function formatLapseDate(lapses: Date): string {
  return lapses.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function metadataString(metadata: Prisma.JsonValue, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

/**
 * The screen a buyer releases this hold from, or null when she does not
 * release it herself.
 *
 * Only the flows where the buyer's confirmation is what moves the money are
 * listed. A mentor session is released when the session is completed, not by
 * the buyer, and a car purchase has its own release timer and reminders
 * (automotive-reminders.service). A hold made through the generic Connect route
 * had no release screen at all, so its buyer was never asked; she now releases
 * or cancels it from GENERIC_HOLDS_SCREEN.
 */
function releaseScreenFor(escrow: HeldEscrow): string | null {
  switch (escrow.sessionType) {
    case 'service_order':
      return escrow.serviceOrder ? `/skills-marketplace/orders/${escrow.serviceOrder.id}` : null;
    case 'service_booking':
      return escrow.serviceBooking ? '/skills-marketplace/bookings' : null;
    case 'custom_request':
      // No page for a brief exists in the web app yet; the marketplace is where
      // she finds her way back to it.
      return escrow.serviceProposal ? '/skills-marketplace' : null;
    case 'car_service':
      return '/dashboard/cars/bookings';
    case 'vehicle_inspection': {
      const listingId = escrow.vehicleInspection?.listingId ?? metadataString(escrow.metadata, 'listingId');
      return listingId ? `/cars/preloved/${listingId}` : null;
    }
    case 'mentor_session':
    case 'vehicle_purchase':
      return null;
    default:
      return GENERIC_HOLDS_SCREEN;
  }
}

/** Whether a mentor session's booked hour is over, by the test mentor.service applies before it lets anyone complete one. */
function sessionHasEnded(session: MentorSessionState, now: Date): boolean {
  // A session with no date has not been scheduled, so nothing about it has
  // happened yet.
  return (
    session.scheduledAt !== null &&
    session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000 <= now.getTime()
  );
}

/**
 * What the flow behind a hold says about taking the money early.
 *
 * The early capture used to look only at the escrow row, which says that money
 * is held and nothing about why. A mentor session whose cancellation could not
 * release the hold keeps its row AUTHORIZED on purpose — mentor.service leaves
 * the payment status alone and tells the admins, because the money has not
 * moved — so the sweep found it, saw a hold about to lapse, and captured it:
 * the mentee was charged for a session that had been called off. The same row
 * for a session booked a fortnight out was captured before the hour had
 * happened, which is the charge mentor.service refuses to make when a mentor
 * tries to complete a session early. And it was not only sessions: a
 * marketplace order nobody had delivered, a workshop job not yet done and a car
 * purchase still inside the buyer's fourteen-day inspection period were all
 * captured the same way, paying the seller for work that had not happened and,
 * for the car, doing the one thing purchase-escrow.service promises never to do.
 *
 * - `capture`: the work is recorded as done — a session whose hour is over, an
 *   order delivered or completed, a report in, a job finished — or the hold is
 *   a generic one with no flow to ask, which is what turning capture on
 *   decides for those.
 * - `release`: what the hold pays for was cancelled, so it goes back to the
 *   buyer.
 * - `wait`: it has not happened yet, or it is a car purchase. REQUESTED is
 *   never captured, even after its date, because a mentor who never accepted it
 *   cannot have held it. The hold is left to lapse with a warning, which costs
 *   the buyer nothing.
 */
type CaptureVerdict =
  | { action: 'capture'; sessionId: string | null }
  | { action: 'release'; sessionId: string | null; reason: string }
  | { action: 'wait'; sessionId: string | null; reason: string };

function captureVerdictFor(flow: HoldFlow, now: Date): CaptureVerdict {
  switch (flow.kind) {
    case 'generic':
      return { action: 'capture', sessionId: null };
    case 'orphaned':
      return { action: 'wait', sessionId: null, reason: 'no order, booking or session is attached to this hold' };
    case 'vehicle_purchase':
      return {
        action: 'wait',
        sessionId: null,
        reason: 'a car purchase is released by its buyer or by ATHENA’s team, never early',
      };
    case 'service_order':
      // A delivery the buyer says was not what she paid for is held for ATHENA's
      // team to decide, never taken early.
      if (flow.status === 'DISPUTED') return { action: 'wait', sessionId: null, reason: 'the order is in dispute' };
      if (flow.status === 'DELIVERED' || flow.status === 'COMPLETED') return { action: 'capture', sessionId: null };
      if (flow.status === 'CANCELLED') return { action: 'release', sessionId: null, reason: 'Order cancelled' };
      return { action: 'wait', sessionId: null, reason: 'the work has not been delivered' };
    case 'service_booking':
      // The same rule as a mentor session: the hour has to have been given. A
      // booking the provider confirmed whose time is over is, and one still
      // waiting on her, or in dispute, is not.
      if (flow.status === 'COMPLETED') return { action: 'capture', sessionId: null };
      if (flow.status === 'CANCELLED') return { action: 'release', sessionId: null, reason: 'Booking cancelled' };
      if (flow.status === 'DISPUTED') return { action: 'wait', sessionId: null, reason: 'the booking is in dispute' };
      if ((flow.status === 'CONFIRMED' || flow.status === 'IN_PROGRESS') && flow.endsAt <= now) {
        return { action: 'capture', sessionId: null };
      }
      return { action: 'wait', sessionId: null, reason: 'the booked time has not been given' };
    case 'custom_request':
      // A brief has no delivery step: the buyer says the work is done by
      // releasing the hold, so it is never taken early.
      if (flow.status === 'DECLINED' || flow.status === 'WITHDRAWN') {
        return { action: 'release', sessionId: null, reason: 'Proposal no longer accepted' };
      }
      return { action: 'wait', sessionId: null, reason: 'only the buyer releases money for a brief' };
    case 'vehicle_inspection':
      if (flow.status === 'COMPLETED') return { action: 'capture', sessionId: null };
      if (flow.status === 'CANCELLED') return { action: 'release', sessionId: null, reason: 'Inspection cancelled' };
      return { action: 'wait', sessionId: null, reason: 'the inspection report is not in' };
    case 'car_service':
      if (flow.status === 'COMPLETED') return { action: 'capture', sessionId: null };
      if (flow.status === 'CANCELLED' || flow.status === 'DECLINED') {
        return { action: 'release', sessionId: null, reason: 'Booking cancelled' };
      }
      return { action: 'wait', sessionId: null, reason: 'the workshop has not finished the job' };
    case 'mentor_session': {
      const { session } = flow;
      switch (session.status) {
        case 'CANCELED':
          return { action: 'release', sessionId: session.id, reason: 'Session canceled' };
        case 'COMPLETED':
          // The mentor closed it and the mentee still has time to say it did not
          // happen; the money is taken when that window ends, by the release
          // step at the top of the sweep, not early because the hold is short.
          if (session.paymentReleaseAt && session.paymentReleaseAt > now) {
            return { action: 'wait', sessionId: session.id, reason: 'the mentee still has time to say the session did not take place' };
          }
          return { action: 'capture', sessionId: session.id };
        case 'DISPUTED':
          return { action: 'wait', sessionId: session.id, reason: 'the session is in dispute' };
        case 'REQUESTED':
          return { action: 'wait', sessionId: session.id, reason: 'the mentor has not accepted the session' };
        case 'CONFIRMED':
          return sessionHasEnded(session, now)
            ? { action: 'capture', sessionId: session.id }
            : { action: 'wait', sessionId: session.id, reason: 'the session has not happened yet' };
      }
    }
  }
}

/**
 * Sends one notification about one hold, once. The sweep runs every six hours,
 * and the check is on the hold's id in the notification's data rather than on
 * a time window, so the person is asked once and not nagged. Returns whether a
 * notification was written.
 */
async function notifyOncePerHold(
  label: string,
  userId: string,
  title: string,
  message: string,
  link: string,
  data: { kind: string; escrowId: string } & Record<string, string>
): Promise<boolean> {
  return bestEffort(
    label,
    async () => {
      const already = await prisma.notification.findFirst({
        where: {
          userId,
          title,
          data: { path: ['escrowId'], equals: data.escrowId },
        },
        select: { id: true },
      });
      if (already) return false;

      await prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title,
          message,
          link,
          data: data as Prisma.InputJsonValue,
        },
      });
      return true;
    },
    false
  );
}

/** Asks the buyer to release a hold before it lapses. */
async function chaseBuyer(escrow: HeldEscrow, link: string): Promise<boolean> {
  return notifyOncePerHold(
    'notification.escrow-expiry-buyer',
    escrow.buyerId,
    BUYER_CHASE_TITLE,
    `You paid ${formatHoldAmount(escrow)} for "${escrow.description ?? 'your order'}" and ATHENA is holding it until you confirm. ` +
      `If you have received what you paid for, please release it by ${formatLapseDate(holdDeadlineOf(escrow))}. ` +
      'After that the hold on your card expires, the payment can no longer be released, and the seller is not paid.',
    link,
    { kind: 'ESCROW_RELEASE_REMINDER', escrowId: escrow.id }
  );
}

/**
 * Asks the mentor to do the one thing that gets her paid before the hold on
 * the mentee's card runs out.
 *
 * A mentor session is released by the session being completed, not by the
 * buyer, so asking the mentee to "release" it would be asking for something
 * she has no button for — which is why these holds used to go unchased. The
 * mentor is the one who loses the money, and either she has a request she has
 * not answered or a finished session she has not marked complete. A session
 * confirmed for a time after the hold lapses is not chased: nothing the mentor
 * can do now keeps that hold alive, and the admins are told about it with the
 * other holds close to lapsing.
 */
async function chaseMentor(
  escrow: HeldEscrow,
  session: MentorSessionState,
  now: Date
): Promise<boolean> {
  const mentorUserId = session.mentorProfile?.userId ?? escrow.sellerId;
  const link = `/dashboard/mentors/sessions?session=${session.id}`;
  const amount = formatHoldAmount(escrow);
  const lapses = formatLapseDate(holdDeadlineOf(escrow));

  if (session.status === 'REQUESTED') {
    return notifyOncePerHold(
      'notification.escrow-expiry-mentor',
      mentorUserId,
      MENTOR_RESPOND_TITLE,
      `A mentee has asked for a session with you and ${amount} is held on her card for it. ` +
        `Please accept or decline it by ${lapses}. After that the hold on her card expires, and the session could not be paid for without her paying again.`,
      link,
      { kind: 'ESCROW_SESSION_REMINDER', escrowId: escrow.id, sessionId: session.id }
    );
  }

  if (session.status === 'CONFIRMED' && sessionHasEnded(session, now)) {
    return notifyOncePerHold(
      'notification.escrow-expiry-mentor',
      mentorUserId,
      MENTOR_COMPLETE_TITLE,
      `Your session has finished and ${amount} for it is held on the mentee's card. ` +
        `Mark the session complete by ${lapses} to have it released to you. After that the hold on her card expires and the payment can no longer be collected.`,
      link,
      { kind: 'ESCROW_SESSION_REMINDER', escrowId: escrow.id, sessionId: session.id }
    );
  }

  return false;
}

/**
 * Tells both parties that a hold expired at Stripe. Each is written once,
 * because it is sent only from the sweep that moved the row out of the held
 * statuses, and that move happens once.
 */
async function tellPartiesHoldExpired(escrow: HeldEscrow): Promise<void> {
  const amount = formatHoldAmount(escrow);
  const what = escrow.description ?? 'an order';
  // An order that is still being worked on has a way forward: the buyer renews
  // the hold from the order page. Saying "ATHENA's team has been told" and
  // nothing else left both people waiting on a person for something she can do
  // in a minute.
  const renewable = Boolean(escrow.serviceOrder && LIVE_ORDER_STATUSES.includes(escrow.serviceOrder.status ?? ''));
  const buyerNext = renewable
    ? 'Please renew it from the order page so the provider can be paid when the work is done; nothing is taken until you approve it.'
    : "ATHENA's team has been told about the order.";
  const sellerNext = renewable
    ? 'We have asked the buyer to renew it. Please wait for that before you hand the work over, so you are sure to be paid.'
    : "ATHENA's team has been told about the order.";

  await Promise.all([
    bestEffort(
      'notification.escrow-expired-buyer',
      () =>
        prisma.notification.create({
          data: {
            userId: escrow.buyerId,
            type: 'SYSTEM',
            title: BUYER_EXPIRED_TITLE,
            message: `The hold of ${amount} on your card for "${what}" expired before it was released, so you have not been charged for it. ${buyerNext}`,
            link: releaseScreenFor(escrow),
            data: { kind: 'ESCROW_EXPIRED', escrowId: escrow.id } as Prisma.InputJsonValue,
          },
        }),
      null
    ),
    bestEffort(
      'notification.escrow-expired-seller',
      () =>
        prisma.notification.create({
          data: {
            userId: escrow.sellerId,
            type: 'SYSTEM',
            title: SELLER_EXPIRED_TITLE,
            message: `The buyer's card hold of ${amount} for "${what}" expired before it was released, so this payment has not reached you. ${sellerNext}`,
            data: { kind: 'ESCROW_EXPIRED', escrowId: escrow.id } as Prisma.InputJsonValue,
          },
        }),
      null
    ),
  ]);
}

/**
 * Tells the admins that holds need a human. Nothing in here may take the sweep
 * down with it: by the time this runs the sweep has already counted and logged
 * everything it found, and losing those counts to a failed notification would
 * throw away the one useful thing the run produced.
 *
 * Neither failure below is recorded through ops-metrics, and that is a choice
 * rather than an oversight. recordFailure writes into a twenty-deep ring that
 * also decides whether /health/detailed reads degraded, and a database that
 * cannot write notifications fails the lookup plus up to five rows on every
 * sweep — which would evict exactly the escrow_expiry.capture failures an
 * operator opened that endpoint to read. Both facts this message carries are
 * already in the snapshot without it: the lapsed holds as the
 * escrow_expiry.lapsed gauge and the failed captures as escrow_expiry.capture,
 * both written above whether or not the notification lands. So the log is the
 * right home for these two, and the health endpoint loses nothing.
 */
async function noteAdmins(
  title: string,
  message: string,
  data: Record<string, unknown>,
  now: Date,
  { standing = true }: { standing?: boolean } = {}
): Promise<void> {
  // An empty list on failure, exactly as the `.catch(() => [])` this replaces:
  // there is nobody to notify if we cannot find out who the admins are, and the
  // sweep still has to return. The bug was that the two situations looked
  // identical from outside — a lookup that failed and a platform with no admins
  // both produced silence — so a sweep could find lapsed holds, tell nobody,
  // and leave nothing behind saying it had tried.
  const admins = await bestEffort(
    'escrow-expiry.admin-lookup',
    () => prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }),
    []
  );

  const repeatsAfter = new Date(now.getTime() - NOTIFY_AGAIN_AFTER_MS);

  // Wrapped per admin rather than around the Promise.all, which is what the old
  // per-row `.catch(() => null)` did too: one admin's row failing must not stop
  // the other four being written. The null fallback is kept as it was and
  // nothing reads it. This was the worst of the swallowed catches here, because
  // this notification is how a person first learns that money is about to stop
  // being collectable, and when it failed there was no record anywhere that it
  // had even been attempted.
  await Promise.all(
    admins.map(a =>
      bestEffort(
        'notification.escrow-expiry-admins',
        async () => {
          // A hold that is only close to lapsing, or still unresolved past it,
          // stays in HELD_STATUSES, so the sweep finds the same ones every six
          // hours. Without this check a single lapsed
          // hold sent every admin four identical notifications a day until
          // somebody dealt with it by hand — which is how a channel that only
          // ever carries "money is about to stop being collectable" becomes a
          // channel nobody reads. Matched on the title, because that is what
          // distinguishes the two conditions this sweep raises and it is a
          // literal on our side rather than anything a member can set.
          //
          // A one-off event (`standing: false`) skips the check: holds that
          // expired are moved out of HELD_STATUSES by the run that reports
          // them, so they are never found again, and suppressing the notice
          // would lose them rather than merely not repeat them.
          if (standing) {
            const recent = await prisma.notification.findFirst({
              where: { userId: a.id, type: 'SYSTEM', title, createdAt: { gte: repeatsAfter } },
              select: { id: true },
            });

            if (recent) return null;
          }

          return prisma.notification.create({
            data: {
              userId: a.id,
              type: 'SYSTEM',
              title,
              message,
              link: '/admin',
              data: data as Prisma.InputJsonValue,
            },
          });
        },
        null
      )
    )
  );
}

/**
 * Gives back a hold whose order, booking or session was cancelled.
 *
 * For a mentor session this is the release mentor.service tried when the
 * session was cancelled and could not complete; it left the payment status at
 * AUTHORIZED and told the admins to release it by hand "before the expiry
 * sweep captures it". The marketplace and the car flows cancel their own holds
 * the same way, and a failure there left the buyer's card held for something
 * called off until the authorisation ran out. The sweep now does that release
 * itself, whether or not early capture is on: giving a buyer back money for a
 * cancelled order takes nothing from anybody. Handles its own failure rather
 * than throwing, because a release that fails is not a capture that failed and
 * must not be reported as one.
 */
async function releaseCancelledHold(
  escrow: HeldEscrow,
  paymentIntentId: string,
  verdict: Extract<CaptureVerdict, { action: 'release' }>,
  result: EscrowExpirySweep
): Promise<void> {
  try {
    await stripeConnect.cancelEscrowPayment(
      paymentIntentId,
      stripeConnect.PLATFORM_ESCROW_ACTOR,
      verdict.reason
    );
  } catch (error) {
    result.releaseFailed += 1;
    recordFailure('escrow_expiry.release', error);
    logger.error('Could not release the hold on something that was cancelled', {
      escrowId: escrow.id,
      sessionId: verdict.sessionId,
      reason: verdict.reason,
      error: (error as Error).message,
    });
    return;
  }

  result.released += 1;
  logger.info('Released the hold on something that was cancelled instead of leaving it on the card', {
    escrowId: escrow.id,
    sessionId: verdict.sessionId,
    reason: verdict.reason,
    amount: escrow.amount,
    currency: escrow.currency,
  });

  // The money is back on her card whatever happens next, so a failure to
  // record it on the session is logged rather than counted as a failed release.
  const sessionId = verdict.sessionId;
  if (sessionId) {
    await bestEffort(
      'escrow-expiry.session-release-record',
      () =>
        prisma.mentorSession.update({
          where: { id: sessionId },
          data: { paymentStatus: 'CANCELED', paymentCanceledAt: new Date() },
        }),
      null
    );
  }
}

type UnledgeredSessionRow = {
  id: string;
  menteeId: string;
  mentorProfileId: string;
  stripePaymentIntentId: string | null;
  sessionAmount: Prisma.Decimal | number;
  currency: string;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  paymentCapturedAt: Date | null;
  paymentCanceledAt: Date | null;
  mentorProfile: { userId: string } | null;
};

/**
 * Gives legacy mentor sessions the escrow row they never had, so that they go
 * through the same path as every hold booked since.
 *
 * Those sessions hold real money against a PaymentIntent with no EscrowPayment
 * row behind it. The sweep could warn about them and nothing more: capturing
 * one early would have moved money with no ledger row to record it, and a
 * cancelled one could not be released through the escrow path at all. Each is
 * adopted from Stripe's own record of its intent (see
 * adoptUnledgeredMentorSessionHold); the query below then finds it with the
 * rest.
 *
 * Newest first and a bounded number per run, because the ones that matter are
 * the ones whose authorisation is still alive, and each costs a Stripe call.
 * The sessions not adopted — Stripe could not be asked, or this run's quota was
 * spent — are handed back and are warned about exactly as before.
 */
async function adoptUnledgeredSessions(
  warnFrom: Date,
  result: EscrowExpirySweep
): Promise<UnledgeredSessionRow[]> {
  const candidates: UnledgeredSessionRow[] = await prisma.mentorSession.findMany({
    where: {
      // FAILED as well: mentor.service writes it when the capture at completion
      // failed, and the money may still be held.
      paymentStatus: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] },
      stripePaymentIntentId: { not: null },
      createdAt: { lte: warnFrom },
    },
    select: {
      id: true,
      menteeId: true,
      mentorProfileId: true,
      stripePaymentIntentId: true,
      sessionAmount: true,
      currency: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentCapturedAt: true,
      paymentCanceledAt: true,
      mentorProfile: { select: { userId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (candidates.length === 0) return [];

  const intentIds = candidates
    .map(s => s.stripePaymentIntentId)
    .filter((id): id is string => Boolean(id));
  const ledgered = new Set(
    (
      await prisma.escrowPayment.findMany({
        where: { paymentIntentId: { in: intentIds } },
        select: { paymentIntentId: true },
      })
    )
      .map(row => row.paymentIntentId)
      .filter((id): id is string => Boolean(id))
  );

  const unledgered = candidates.filter(s => s.stripePaymentIntentId && !ledgered.has(s.stripePaymentIntentId));
  if (unledgered.length === 0) return [];

  // No Stripe to ask means no truthful row to write, so everything stays on
  // the warning path rather than being adopted from the session's own figures.
  if (!isStripeConfigured()) return unledgered;

  const remaining: UnledgeredSessionRow[] = [];
  let attempted = 0;

  for (const session of unledgered) {
    const intentId = session.stripePaymentIntentId!;
    const mentorUserId = session.mentorProfile?.userId;

    if (attempted >= ADOPTIONS_PER_SWEEP || !mentorUserId || intentId.startsWith('pi_mock_')) {
      remaining.push(session);
      continue;
    }

    attempted += 1;
    try {
      const wrote = await stripeConnect.adoptUnledgeredMentorSessionHold({
        id: session.id,
        menteeId: session.menteeId,
        mentorUserId,
        mentorProfileId: session.mentorProfileId,
        stripePaymentIntentId: intentId,
        paymentCapturedAt: session.paymentCapturedAt,
        paymentCanceledAt: session.paymentCanceledAt,
      });
      // False means another run wrote the same row first; either way the
      // session is ledgered now and the query below finds it.
      if (wrote) result.adopted += 1;
    } catch (error) {
      // Counted into a gauge after the loop rather than recorded as a failure
      // here: a session that cannot be adopted is found again on every sweep,
      // and a failure per session per run would climb for ever and evict the
      // capture failures an operator opens /health/detailed to read.
      result.adoptFailed += 1;
      logger.warn('Could not give a legacy mentor session its escrow row', {
        sessionId: session.id,
        error: (error as Error).message,
      });
      remaining.push(session);
    }
  }

  return remaining;
}

export async function runEscrowExpirySweep(now = new Date()): Promise<EscrowExpirySweep> {
  const lapsesAt = new Date(now.getTime() - AUTHORISATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  const warnFrom = new Date(lapsesAt.getTime() + WARN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const warnUntil = new Date(now.getTime() + WARN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const result: EscrowExpirySweep = {
    checked: 0,
    expiringSoon: 0,
    captured: 0,
    failed: 0,
    alreadyLapsed: 0,
    repaired: 0,
    expired: 0,
    neverPaid: 0,
    buyersReminded: 0,
    mentorsReminded: 0,
    renewalsRequested: 0,
    released: 0,
    releaseFailed: 0,
    awaitingSession: 0,
    adopted: 0,
    adoptFailed: 0,
    sessionsReleased: 0,
    sessionReleaseFailed: 0,
    unpaidSessionsCancelled: 0,
    unpaidSessionsAuthorised: 0,
  };

  // A session its mentor closed is charged once the mentee's window to object has
  // ended. Done first, so that the hold is already captured when the loop below
  // reads the held rows and nothing here asks a buyer to release it. Not allowed
  // to stop the rest of the sweep: the holds below are on a clock too.
  try {
    const released = await releaseDueMentorSessions(now);
    result.sessionsReleased = released.released;
    result.sessionReleaseFailed = released.failed;
  } catch (error) {
    recordFailure('escrow_expiry.session_release', error);
    logger.error('Could not look for mentor sessions whose confirmation window has ended', {
      error: (error as Error).message,
    });
  }

  // A paid request whose card step was never finished is called off, so it does
  // not hold a mentor's hour for good; one whose card is held but whose webhook
  // never landed is caught up and its mentor told. Done before the holds are read
  // so a request just called off is not warned about below. Not allowed to stop
  // the rest of the sweep.
  try {
    const unpaid = await cancelUnpaidMentorRequests(now);
    result.unpaidSessionsCancelled = unpaid.cancelled;
    result.unpaidSessionsAuthorised = unpaid.authorised;
  } catch (error) {
    recordFailure('escrow_expiry.unpaid_requests', error);
    logger.error('Could not look for mentoring requests whose payment was never authorised', {
      error: (error as Error).message,
    });
  }

  // Mentor sessions booked before mentoring moved onto the shared escrow path
  // hold real money against a PaymentIntent with no EscrowPayment row behind
  // it. They are given their rows first, so that the query below finds them
  // and they are captured, released or settled like any other hold.
  const stillUnledgered = await adoptUnledgeredSessions(warnFrom, result);

  const held: HeldEscrow[] = await prisma.escrowPayment.findMany({
    // Not only holds old enough for the seven-day assumption to put them in the
    // warning window: a hold whose real deadline Stripe reported as shorter is
    // found too, and sorted out by its own deadline below. No authorisation
    // lasts less than a day, so nothing younger than that can be close.
    where: { status: { in: HELD_STATUSES }, createdAt: { lte: oneDayAgo } },
    select: {
      id: true,
      paymentIntentId: true,
      buyerId: true,
      sellerId: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      description: true,
      sessionType: true,
      metadata: true,
      serviceOrder: { select: { id: true, status: true } },
      serviceBooking: { select: { id: true, status: true, scheduledAt: true, durationMinutes: true } },
      serviceProposal: { select: { id: true, status: true } },
      vehiclePurchase: { select: { id: true, status: true } },
      vehicleInspection: { select: { id: true, status: true, listingId: true } },
      mechanicBooking: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // The sessions that could not be adopted this run: warned about exactly as
  // before. Anything whose intent is already in `held` is skipped rather than
  // counted twice, and a session that is over or whose capture already failed
  // has nothing left for a warning to save.
  const heldIntentIds = new Set(held.map(h => h.paymentIntentId).filter((id): id is string => Boolean(id)));
  const unledgeredSessions = stillUnledgered.filter(
    session =>
      !heldIntentIds.has(session.stripePaymentIntentId!) &&
      session.status !== 'CANCELED' &&
      session.status !== 'COMPLETED' &&
      session.paymentStatus !== 'FAILED'
  );

  result.checked = held.length + unledgeredSessions.length;

  const newlyExpired: HeldEscrow[] = [];
  const expiringIntentIds: string[] = [];
  const capturing = captureEnabled();

  for (const escrow of held) {
    // Stripe's own deadline for this authorisation when it was recorded, the
    // seven-day assumption otherwise.
    const deadline = holdDeadlineOf(escrow);
    const lapsed = deadline <= now;

    // Not close enough yet. The query above lets in everything a day old so that
    // a hold with a short real deadline is found; this is where the rest wait.
    if (!lapsed && deadline > warnUntil) {
      result.checked -= 1;
      continue;
    }

    if (lapsed) {
      // Asked at Stripe first, because "lapsed" is a guess from the row's age
      // and Stripe knows. A failure to ask falls through to the old report, so
      // an outage costs nothing but a repeat of it on the next sweep.
      const paymentIntentId = escrow.paymentIntentId;
      const outcome = paymentIntentId
        ? await bestEffort(
            'escrow-expiry.resolve-lapsed',
            () => stripeConnect.resolveLapsedEscrowHold(paymentIntentId),
            null
          )
        : null;

      if (outcome?.state === 'captured') {
        // The seller was paid. This used to reach the admins as a hold whose
        // "funds may no longer be collectable", which was the opposite of true.
        result.repaired += 1;
        continue;
      }

      if (outcome?.state === 'expired') {
        result.expired += 1;
        if (outcome.changed) {
          newlyExpired.push(escrow);
          await tellPartiesHoldExpired(escrow);
        }
        logger.error('Escrow hold expired at Stripe before it was released', {
          escrowId: escrow.id,
          heldSince: escrow.createdAt,
          amount: escrow.amount,
          currency: escrow.currency,
        });
        continue;
      }

      if (outcome?.state === 'unpaid') {
        // No card was ever put behind it, so no money was held and none can
        // have been lost. Kept out of the lapsed count so that count means
        // what the admins are told it means.
        result.neverPaid += 1;
        logger.info('Escrow hold was never paid for', { escrowId: escrow.id, heldSince: escrow.createdAt });
        continue;
      }

      result.alreadyLapsed += 1;
      // Counted after the loop as a condition rather than here as a failure.
      // A hold that reaches this line is still in HELD_STATUSES, so the query
      // above finds it again on every sweep; recording a failure per hold
      // per sweep meant the count climbed by the same holds every six hours and
      // /health/detailed could never go back to healthy after a single lapse.
      // An error rather than a warning: by this point the money is most likely
      // not collectable and somebody has to decide what happens to the order.
      logger.error('Escrow hold has outlived its authorisation', {
        escrowId: escrow.id,
        heldSince: escrow.createdAt,
        amount: escrow.amount,
        currency: escrow.currency,
      });
      continue;
    }

    result.expiringSoon += 1;
    if (escrow.paymentIntentId) expiringIntentIds.push(escrow.paymentIntentId);

    // What the hold is paying for, asked once and used for every decision
    // below. When capturing, a lookup that fails stops the capture and is
    // counted as one that did not happen: guessing "no session" on a failed
    // read would put back the very charge the verdict exists to stop.
    let flow: HoldFlow | null = null;
    try {
      flow = await holdFlowFor(escrow);
    } catch (error) {
      if (capturing && escrow.paymentIntentId) {
        result.failed += 1;
        recordFailure('escrow_expiry.capture', error);
        logger.error('Could not capture an escrow hold before expiry', {
          escrowId: escrow.id,
          error: (error as Error).message,
        });
        continue;
      }
      logger.warn('Could not read what an escrow hold is paying for', {
        escrowId: escrow.id,
        error: (error as Error).message,
      });
    }

    const verdict = flow ? captureVerdictFor(flow, now) : null;

    // Something cancelled is given back whether or not capture is on. Before,
    // only a cancelled mentor session was, and only with capture switched on,
    // so by default the buyer's card stayed held for a cancelled order until
    // the authorisation ran out on its own.
    if (verdict?.action === 'release' && escrow.paymentIntentId) {
      await releaseCancelledHold(escrow, escrow.paymentIntentId, verdict, result);
      continue;
    }

    // A marketplace order whose work is not finished and whose hold is about to
    // run out: the buyer is asked to renew it, whatever the capture setting.
    // Early capture never takes money for work that has not been delivered, so
    // for a long job this is the only thing that keeps the provider paid; she is
    // told what it does and does not do, and that nothing is taken by it.
    if (flow?.kind === 'service_order' && escrow.status === 'AUTHORIZED' && verdict?.action === 'wait') {
      const asked = await askBuyerToRenew(
        {
          id: flow.id,
          clientId: escrow.buyerId,
          packageName: null,
          service: { title: escrow.description ?? 'your order' },
        },
        'lapsing',
        deadline
      );
      if (asked) result.renewalsRequested += 1;
    }

    // A mentor who has not answered a request is asked whatever the capture
    // setting, because early capture never takes a session nobody accepted.
    if (
      flow?.kind === 'mentor_session' &&
      flow.session.status === 'REQUESTED' &&
      escrow.status === 'AUTHORIZED' &&
      (await chaseMentor(escrow, flow.session, now))
    ) {
      result.mentorsReminded += 1;
    }

    if (!capturing) {
      // Only a hold with a card behind it: asking somebody to release a
      // payment the buyer never completed would be asking for the impossible.
      if (escrow.status === 'AUTHORIZED' && flow) {
        if (flow.kind === 'mentor_session') {
          if (flow.session.status === 'CONFIRMED' && (await chaseMentor(escrow, flow.session, now))) {
            result.mentorsReminded += 1;
          }
        } else if (
          flow.kind !== 'orphaned' &&
          flow.kind !== 'vehicle_purchase' &&
          // An order not yet delivered is asked to renew, above, not to "release"
          // money for work she has not received.
          !(flow.kind === 'service_order' && verdict?.action === 'wait')
        ) {
          const releaseScreen = releaseScreenFor(escrow);
          if (releaseScreen && (await chaseBuyer(escrow, releaseScreen))) {
            result.buyersReminded += 1;
          }
        }
      }

      logger.warn('Escrow hold is close to expiring', {
        escrowId: escrow.id,
        heldSince: escrow.createdAt,
        amount: escrow.amount,
        currency: escrow.currency,
        capturingEarly: false,
      });
      continue;
    }

    if (!escrow.paymentIntentId || !verdict) {
      logger.warn('Escrow hold is close to expiring', {
        escrowId: escrow.id,
        heldSince: escrow.createdAt,
        amount: escrow.amount,
        currency: escrow.currency,
        capturingEarly: false,
      });
      continue;
    }

    const paymentIntentId = escrow.paymentIntentId;

    if (verdict.action === 'wait') {
      result.awaitingSession += 1;
      logger.warn(
        flow?.kind === 'mentor_session'
          ? 'Escrow hold is close to expiring but its mentor session has not happened'
          : 'Escrow hold is close to expiring but what it pays for has not happened',
        {
          escrowId: escrow.id,
          sessionId: verdict.sessionId,
          reason: verdict.reason,
          heldSince: escrow.createdAt,
          amount: escrow.amount,
          currency: escrow.currency,
          capturingEarly: false,
        }
      );
      continue;
    }

    try {
      // Captured as the platform rather than as either party, because neither
      // has asked for this: it is being taken early only so the hold is not lost.
      await stripeConnect.captureEscrowPayment(paymentIntentId, stripeConnect.PLATFORM_ESCROW_ACTOR);
      result.captured += 1;
      recordSuccess('escrow_expiry.capture');
      logger.info('Captured an escrow hold before its authorisation lapsed', {
        escrowId: escrow.id,
        amount: escrow.amount,
        currency: escrow.currency,
      });

      // The session is brought along with the money, so a mentor whose own
      // completion failed to capture — which leaves the session FAILED — is not
      // told she was never paid after the sweep has paid her. Best effort,
      // because the capture has happened and reporting it as a failure now
      // would be false.
      const capturedSessionId = verdict.sessionId;
      if (capturedSessionId) {
        await bestEffort(
          'escrow-expiry.session-capture-record',
          () =>
            prisma.mentorSession.update({
              where: { id: capturedSessionId },
              data: { paymentStatus: 'CAPTURED', paymentCapturedAt: new Date() },
            }),
          null
        );
      }
    } catch (error) {
      if (isPaymentsPausedError(error)) {
        // A pause is a decision, not a capture that failed: it is not counted as
        // a failure, which would raise the alarm on a deliberate state. The hold
        // is left as it is, and is looked at again on the next sweep. A pause
        // that outlasts the hold is the operator's to weigh, and the hold then
        // lapses and is reported as one that has.
        logger.warn('An escrow hold was left uncaptured because payments are paused', {
          escrowId: escrow.id,
          amount: escrow.amount,
          currency: escrow.currency,
        });
        continue;
      }
      result.failed += 1;
      // The hold will lapse in under two days and this was the last chance to
      // save it, so the reason Stripe gave is worth keeping where an operator
      // will actually look.
      recordFailure('escrow_expiry.capture', error);
      logger.error('Could not capture an escrow hold before expiry', {
        escrowId: escrow.id,
        error: (error as Error).message,
      });
    }
  }

  for (const session of unledgeredSessions) {
    if (session.createdAt <= lapsesAt) {
      result.alreadyLapsed += 1;
      logger.error('Mentor session hold has outlived its authorisation', {
        sessionId: session.id,
        heldSince: session.createdAt,
        amount: Number(session.sessionAmount),
        currency: session.currency,
      });
      continue;
    }

    result.expiringSoon += 1;
    // Warned about, never captured early, even when ESCROW_CAPTURE_BEFORE_EXPIRY
    // is on. These are the sessions this run could not give a row — Stripe
    // could not be asked, or the run's quota was spent — and capturing one
    // would mean calling Stripe directly against a hold the platform has no
    // ledger row for, so nothing would record that the money had been taken.
    logger.warn('Mentor session hold is close to expiring', {
      sessionId: session.id,
      heldSince: session.createdAt,
      amount: Number(session.sessionAmount),
      currency: session.currency,
      capturingEarly: false,
    });
  }

  // The legacy sessions that could not be given a row. A gauge rather than a
  // failure per session, because the same ones come back on every sweep until
  // somebody looks at why.
  recordCondition(
    'escrow_expiry.adopt_failed',
    result.adoptFailed,
    result.adoptFailed > 0
      ? 'Legacy mentor sessions could not be given the escrow row they need to be captured or released; the log names each session and the reason.'
      : null
  );

  // A gauge, written on every sweep including the sweeps that find none, so the
  // number falls back to zero once an operator has dealt with them. A lapsed
  // hold is a standing condition that needs a human, not an event that happened
  // again just because the sweep looked again.
  recordCondition(
    'escrow_expiry.lapsed',
    result.alreadyLapsed,
    result.alreadyLapsed > 0
      ? 'Holds have outlived their card authorisation. The money is most likely no longer collectable and somebody has to decide what happens to each order.'
      : null
  );

  // A gauge for the holds that can still be saved, written on every sweep for
  // the same reason as the one above: it is a standing condition an operator
  // clears by acting on it, not an event.
  recordCondition(
    'escrow_expiry.expiring_soon',
    result.expiringSoon,
    result.expiringSoon > 0
      ? 'Holds are within two days of their card authorisation lapsing. Each one still needs a release or a cancellation while the money is collectable.'
      : null
  );

  if (result.alreadyLapsed || result.failed || result.releaseFailed) {
    // A cancelled order, booking or session whose hold could not be given back
    // is a different problem from money that cannot be collected — the buyer's
    // card is still held for something that was called off — so it is named
    // separately rather than folded into the capture count.
    const releaseNote = result.releaseFailed
      ? ` ${result.releaseFailed} hold(s) for cancelled orders, bookings or mentor sessions could not be released and are still held on the buyer's card; cancel each one in the Stripe dashboard.`
      : '';
    await noteAdmins(
      LAPSED_TITLE,
      `${result.alreadyLapsed} hold(s) have outlived their card authorisation and ${result.failed} could not be captured. Funds may no longer be collectable.${releaseNote}`,
      {
        kind: 'ESCROW_EXPIRY',
        lapsed: result.alreadyLapsed,
        failed: result.failed,
        releaseFailed: result.releaseFailed,
      },
      now
    );
  }

  // Holds that Stripe let lapse, now marked cancelled. Both parties have been
  // told; what happens to each order - a new payment, or closing it - is a
  // decision for a person, so the ids go with the notice. Sent every time
  // there are new ones rather than once a day, because these rows will not be
  // found again.
  if (newlyExpired.length) {
    await noteAdmins(
      EXPIRED_TITLE,
      `${newlyExpired.length} hold(s) expired at Stripe before they were released and are now marked cancelled. The buyers were not charged and the sellers were not paid; each order needs a decision.`,
      { kind: 'ESCROW_EXPIRED', escrowIds: newlyExpired.map(e => e.id) },
      now,
      { standing: false }
    );
  }

  // Raised while there is still something to be done about it.
  //
  // The only escalation this sweep had fired once a hold had already lapsed —
  // that is, once the seller had most likely lost the money for work she had
  // already delivered and the decision left to make was about compensation
  // rather than collection. The warning window exists precisely so somebody can
  // act inside it. The buyers and mentors whose action releases a hold have
  // been asked above; this tells the people who can release any hold, with the
  // intent ids to find each one by. Capturing or cancelling it in the Stripe
  // dashboard is enough: the payment_intent webhooks bring the rows along.
  if (result.expiringSoon) {
    await noteAdmins(
      EXPIRING_TITLE,
      `${result.expiringSoon} hold(s) are within ${WARN_WINDOW_DAYS} days of their card authorisation lapsing. Release or cancel each one in the Stripe dashboard while the money can still be collected; the payment intent ids are attached to this notice.`,
      {
        kind: 'ESCROW_EXPIRING',
        expiringSoon: result.expiringSoon,
        paymentIntentIds: expiringIntentIds.slice(0, 50),
      },
      now
    );
  }

  return result;
}

let timer: NodeJS.Timeout | null = null;

export function startEscrowExpirySweeper(intervalMs = 6 * 60 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;

  const run = () =>
    runExclusively('escrow-expiry', () => runEscrowExpirySweep())
      .then(r => {
        // runExclusively hands back null when another instance holds the lock,
        // which is not a run of ours and so is neither a success nor a failure.
        if (r) recordSuccess('escrow_expiry.sweep');
        if (
          r &&
          (r.expiringSoon ||
            r.alreadyLapsed ||
            r.captured ||
            r.failed ||
            r.released ||
            r.releaseFailed ||
            r.adopted ||
            r.adoptFailed ||
            r.sessionsReleased ||
            r.sessionReleaseFailed ||
            r.unpaidSessionsCancelled ||
            r.unpaidSessionsAuthorised)
        ) {
          logger.info('Escrow expiry sweep', r);
        }
      })
      .catch(err => {
        // A sweep that never ran leaves every hold unwatched, which is the
        // original silent failure this service exists to end.
        recordFailure('escrow_expiry.sweep', err);
        logger.warn('Escrow expiry sweep failed', { error: (err as Error).message });
      });

  setTimeout(run, 180_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();

  // The Stripe reconciliation is the other half of watching the money, and it
  // is started with this sweep so that the one call index.ts already makes at
  // boot brings up both. It has its own lock, schedule and failure counters;
  // see stripe-reconciliation.service.ts.
  startStripeReconciler();
}

export function stopEscrowExpirySweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
  stopStripeReconciler();
}
