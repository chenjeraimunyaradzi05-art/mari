/**
 * When something paid for through ATHENA was not delivered: a mentoring session
 * that did not happen, a marketplace order whose delivery was not what was
 * agreed.
 *
 * Until this, only a car purchase and an hourly booking had a way to say so. A
 * mentor closing a session took the mentee's card at once, a buyer who thought a
 * delivery was wrong could ask for a revision or let the hold lapse, and the
 * card networks' own chargeback was a log line. The shape here is the one the car
 * purchase and the booking already use: the buyer says what went wrong, the money
 * stays held, the provider may answer once, and a member of staff decides, either
 * releasing the payment to the provider or giving it back to the buyer. Nothing
 * is captured while a dispute is open; the expiry sweep, the order's own buttons
 * and the session's both refuse a DISPUTED row.
 *
 * Every state change is a write conditional on the state just read, so a buyer
 * and a provider, or two members of staff, acting at once move a dispute one way
 * and not both. Money moves before the row does, and each step is safe to repeat,
 * so a decision whose row write failed is made again by pressing the button
 * again and does not take or return the money twice.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { DISPUTE_WINDOW_DAYS } from '../config/price-book';
import { notifyAdmins } from './admin-notify.service';
import { holdDeadlineOf } from './escrow-deadline';
import { cancelEscrowPayment, captureEscrowPayment, openCardDisputeOn } from './stripe-connect.service';
import { cancelSessionHold, captureSessionHold } from './mentor-payment-release.service';

const DAY = 24 * 60 * 60 * 1000;

/** Where the team lands from a notice about a session or an order in dispute. */
export const SERVICE_DISPUTES_LINK = '/admin/service-disputes';

export type ServiceDisputeKind = 'session' | 'order';
export type ServiceDisputeOutcome = 'release' | 'refund';

/** Who is deciding: always staff, always as the platform, whatever staff role they hold. */
export interface DisputeActor {
  id: string;
}

// The escrow service only recognises the literal 'ADMIN' as staff, and requireRole
// lets a SUPER_ADMIN through too, so the decision is made as ADMIN whoever pressed it.
const staffActor = (actor: DisputeActor) => ({ id: actor.id, role: 'ADMIN' as const });

/**
 * A session or order as the two people in it may see it. Who on the team decided a
 * dispute is the team's business, not a column to hand to a buyer or a provider.
 */
export function forMember<T extends { disputeResolvedById?: unknown }>(row: T): Omit<T, 'disputeResolvedById'> {
  const { disputeResolvedById: _staff, ...rest } = row;
  return rest;
}

const clean = (text: unknown): string => (typeof text === 'string' ? text.trim() : '');

/** Tells somebody. Never fails the move that raised it: the dispute has moved, and a notice that did not write is not a reason to say it did not. */
async function tell(userId: string, title: string, message: string, link: string): Promise<void> {
  await bestEffort('notification.service-dispute', () =>
    prisma.notification.create({ data: { userId, type: 'SYSTEM', title, message, link } })
  );
}

const HELD = ['PENDING', 'AUTHORIZED'];
const ENDED = ['CANCELED', 'FAILED', 'REFUNDED'];

function holdIsReal(escrow: { status: string; paymentIntentId: string | null } | null | undefined): boolean {
  if (!escrow) return false;
  if (escrow.status === 'AUTHORIZED') return true;
  // The development mock never gets a webhook, so its holds count as soon as made.
  return escrow.status === 'PENDING' && Boolean(escrow.paymentIntentId?.startsWith('pi_mock_'));
}

const money = (amount: number, currency: string) => `${amount.toFixed(2)} ${currency}`;

// ---------------------------------------------------------------------------
// A mentoring session
// ---------------------------------------------------------------------------

/**
 * The mentee says a paid session was not given.
 *
 * Open to her once the booked hour is over, while the money is still held
 * (including after her mentor has said it was given, which is the window she was
 * promised) and for DISPUTE_WINDOW_DAYS after it was charged. The card stays
 * held, or the charge stands but is not paid on, while the team decides.
 */
export async function openSessionDispute(sessionId: string, menteeId: string, reason: string, now = new Date()) {
  const text = clean(reason);
  if (!text) throw new ApiError(400, 'Tell us what went wrong so the team and your mentor can look at it.');

  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      menteeId: true,
      status: true,
      scheduledAt: true,
      durationMinutes: true,
      sessionAmount: true,
      currency: true,
      paymentStatus: true,
      paymentCapturedAt: true,
      stripePaymentIntentId: true,
      disputedAt: true,
      disputeResolution: true,
      mentorProfile: { select: { userId: true } },
    },
  });
  // The same answer for a session that is not hers as for one that does not exist.
  if (!session || session.menteeId !== menteeId) throw new ApiError(404, 'Session not found');

  if (session.status === 'DISPUTED') {
    throw new ApiError(409, 'You have already told us about this session. ATHENA’s team is looking at it and will write to you.');
  }
  // A session the team has already decided is not reopened from here: the
  // decision stands, and the row keeps its first dispute, so it is said plainly
  // rather than refused by the conditional write below as "just changed".
  if (session.disputedAt || session.disputeResolution) {
    throw new ApiError(
      409,
      session.disputeResolution === 'REFUNDED'
        ? 'ATHENA’s team has already looked at this session and gave the payment back to you. If something is still wrong, please contact support.'
        : 'ATHENA’s team has already looked at this session and decided it. If you disagree with the decision, please contact support and the team will go through it with you.'
    );
  }
  if (!session.stripePaymentIntentId || Number(session.sessionAmount) <= 0) {
    throw new ApiError(
      400,
      'Nothing was paid for this session, so there is no payment to hold or give back. If something went wrong, you can report your mentor from their profile.'
    );
  }

  const endsAt = session.scheduledAt ? session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000 : null;
  if (session.status === 'REQUESTED') {
    throw new ApiError(400, 'Your mentor has not accepted this session. Withdraw it instead and the hold on your card is released.');
  }
  if (session.status !== 'CONFIRMED' && session.status !== 'COMPLETED') {
    throw new ApiError(400, 'This session was cancelled, so nothing was taken from your card.');
  }
  if (session.status === 'CONFIRMED' && (endsAt === null || endsAt > now.getTime())) {
    throw new ApiError(
      400,
      'This session has not happened yet. If you no longer want it, cancel it and the hold on your card is released.'
    );
  }

  // The hour is over, whether or not anyone has marked it complete. The money
  // has to be somewhere ATHENA can hold or give back: still held on her card, or
  // taken (by her mentor's word, or by the sweep when a hold was about to lapse)
  // within the window. A hold that lapsed, was declined or was released is
  // nothing to decide about.
  if (session.paymentStatus === 'CAPTURED') {
    const takenAt = session.paymentCapturedAt ?? null;
    if (takenAt && now.getTime() - takenAt.getTime() > DISPUTE_WINDOW_DAYS * DAY) {
      throw new ApiError(
        400,
        `It is more than ${DISPUTE_WINDOW_DAYS} days since this session was paid for, so it cannot be reported from here. Please contact support and the team will look at it with you.`
      );
    }
  } else if (session.paymentStatus !== 'AUTHORIZED') {
    throw new ApiError(400, 'Nothing was taken from your card for this session, so there is nothing to give back.');
  }

  // Conditional on the status just read and on nothing having been said yet, so
  // a double tap, or the mentor closing the session at the same moment, moves it
  // one way and not both.
  const moved = await prisma.mentorSession.updateMany({
    where: { id: sessionId, status: session.status, disputedAt: null },
    data: { status: 'DISPUTED', disputedAt: now, disputeReason: text },
  });
  if (moved.count !== 1) throw new ApiError(409, 'This session has just changed. Reload it and try again.');

  const amount = money(Number(session.sessionAmount), session.currency);
  const link = `/dashboard/mentors/sessions?session=${sessionId}`;
  await tell(
    session.mentorProfile.userId,
    'A session is in dispute',
    `Your mentee says the session did not take place as booked. The ${amount} stays held while ATHENA’s team looks at it. You can tell your side from your sessions page.`,
    link
  );
  await notifyAdmins({
    title: 'A mentoring session is in dispute',
    message: `A mentee says a paid session (${amount}) did not take place. The payment is held. ${text.slice(0, 200)}`,
    link: SERVICE_DISPUTES_LINK,
    data: { kind: 'SESSION_DISPUTED', sessionId },
  });

  return prisma.mentorSession.findUniqueOrThrow({ where: { id: sessionId } });
}

/** The mentor's one answer to a session in dispute, kept for the team to read. */
export async function answerSessionDispute(sessionId: string, mentorUserId: string, response: string, now = new Date()) {
  const text = clean(response);
  if (!text) throw new ApiError(400, 'Write your answer so the team can read it.');

  const session = await prisma.mentorSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, disputeResponse: true, mentorProfile: { select: { userId: true } } },
  });
  if (!session || session.mentorProfile.userId !== mentorUserId) throw new ApiError(404, 'Session not found');
  if (session.status !== 'DISPUTED') throw new ApiError(409, 'This session is not in dispute.');
  if (session.disputeResponse) throw new ApiError(409, 'You have already answered. ATHENA’s team has what you wrote.');

  const moved = await prisma.mentorSession.updateMany({
    where: { id: sessionId, status: 'DISPUTED', disputeResponse: null },
    data: { disputeResponse: text, disputeRespondedAt: now },
  });
  if (moved.count !== 1) throw new ApiError(409, 'This session has just been decided or answered. Reload it.');

  await notifyAdmins({
    title: 'A mentor answered a session dispute',
    message: `The mentor has told their side: ${text.slice(0, 200)}`,
    link: SERVICE_DISPUTES_LINK,
    data: { kind: 'SESSION_DISPUTE_ANSWERED', sessionId },
  });

  return prisma.mentorSession.findUniqueOrThrow({ where: { id: sessionId } });
}

// ---------------------------------------------------------------------------
// A marketplace order
// ---------------------------------------------------------------------------

/**
 * The buyer says an order's delivery was not what was agreed, or that nothing
 * came by its due date. The hold stays on her card, and the order's own buttons
 * (approve, revision, cancel, deliver) are closed until the team decides.
 */
export async function openOrderDispute(orderId: string, buyerId: string, reason: string, now = new Date()) {
  const text = clean(reason);
  if (!text) throw new ApiError(400, 'Tell us what went wrong so the team and the provider can look at it.');

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      status: true,
      dueAt: true,
      totalAmount: true,
      packageName: true,
      disputeResolution: true,
      service: { select: { title: true, providerId: true } },
      escrow: { select: { status: true, paymentIntentId: true } },
    },
  });
  if (!order || order.clientId !== buyerId) throw new ApiError(404, 'Order not found');

  if (order.status === 'DISPUTED') {
    throw new ApiError(409, 'You have already told us about this order. ATHENA’s team is looking at it and will write to you.');
  }
  // Decided once. A completed or cancelled order that got there by the team's
  // decision is told that, not that she approved it or that nothing was taken.
  if (order.disputeResolution) {
    throw new ApiError(
      409,
      order.disputeResolution === 'REFUNDED'
        ? 'ATHENA’s team has already looked at this order and gave the payment back to you. If something is still wrong, please contact support.'
        : 'ATHENA’s team has already looked at this order and released the payment to the provider. If you disagree with the decision, please contact support and the team will go through it with you.'
    );
  }
  if (!order.escrow) {
    throw new ApiError(
      409,
      'This order was made before payments were held by ATHENA, so there is no payment to hold. Please contact support and the team will look at it with you.'
    );
  }

  const overdue = order.dueAt !== null && order.dueAt.getTime() <= now.getTime();
  switch (order.status) {
    case 'DELIVERED':
      break;
    case 'ACCEPTED':
    case 'REVISION_REQUESTED':
      if (!overdue) {
        throw new ApiError(
          400,
          'The work is not due yet. If you no longer want it, cancel the order and the hold on your card is released.'
        );
      }
      break;
    case 'PENDING':
      throw new ApiError(400, 'The provider has not accepted this order yet. Cancel it instead and the hold on your card is released.');
    case 'COMPLETED':
      throw new ApiError(
        400,
        'You approved this order, so the payment has been released. If something is wrong, please contact support and the team will look at it with you.'
      );
    default:
      throw new ApiError(400, 'This order was cancelled, so nothing was taken from your card.');
  }

  if (!holdIsReal(order.escrow)) {
    throw new ApiError(
      409,
      'The hold on your card has ended, so there is no payment for the team to hold. Renew it from the order page first, and then tell us what went wrong.'
    );
  }

  const moved = await prisma.serviceOrder.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: 'DISPUTED', disputedAt: now, disputeReason: text },
  });
  if (moved.count !== 1) throw new ApiError(409, 'This order has just changed. Reload it and try again.');

  const title = order.service.title;
  await tell(
    order.service.providerId,
    'An order is in dispute',
    `${title}: the buyer says it was not delivered as agreed. The payment stays held while ATHENA’s team looks at it. You can tell your side from the order page.`,
    `/skills-marketplace/orders/${orderId}`
  );
  await notifyAdmins({
    title: 'A marketplace order is in dispute',
    message: `${title}: a buyer says an order (A$${order.totalAmount}) was not delivered as agreed. The payment is held. ${text.slice(0, 200)}`,
    link: SERVICE_DISPUTES_LINK,
    data: { kind: 'ORDER_DISPUTED', orderId },
  });

  return prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } });
}

/** The provider's one answer to an order in dispute, kept for the team to read. */
export async function answerOrderDispute(orderId: string, providerUserId: string, response: string, now = new Date()) {
  const text = clean(response);
  if (!text) throw new ApiError(400, 'Write your answer so the team can read it.');

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, disputeResponse: true, service: { select: { providerId: true, title: true } } },
  });
  if (!order || order.service.providerId !== providerUserId) throw new ApiError(404, 'Order not found');
  if (order.status !== 'DISPUTED') throw new ApiError(409, 'This order is not in dispute.');
  if (order.disputeResponse) throw new ApiError(409, 'You have already answered. ATHENA’s team has what you wrote.');

  const moved = await prisma.serviceOrder.updateMany({
    where: { id: orderId, status: 'DISPUTED', disputeResponse: null },
    data: { disputeResponse: text, disputeRespondedAt: now },
  });
  if (moved.count !== 1) throw new ApiError(409, 'This order has just been decided or answered. Reload it.');

  await notifyAdmins({
    title: 'A provider answered an order dispute',
    message: `${order.service.title}: the provider has told their side: ${text.slice(0, 200)}`,
    link: SERVICE_DISPUTES_LINK,
    data: { kind: 'ORDER_DISPUTE_ANSWERED', orderId },
  });

  return prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } });
}

// ---------------------------------------------------------------------------
// The team's side
// ---------------------------------------------------------------------------

export interface AdminServiceDispute {
  kind: ServiceDisputeKind;
  id: string;
  title: string;
  buyer: { id: string; name: string };
  provider: { id: string; name: string };
  /** In the currency's major units: whole dollars for an order, dollars and cents for a session. */
  amount: number;
  currency: string;
  /** What the provider is paid if the team releases it. */
  providerPayout: number;
  /** When a session was booked for. Null for an order. */
  scheduledAt: string | null;
  disputedAt: string | null;
  reason: string | null;
  response: string | null;
  respondedAt: string | null;
  /** Whether there is still money to move, and until when. Null when nothing was ever held. */
  hold: { status: string; lapsesAt: string | null } | null;
  /** The buyer's bank has also disputed the payment: it cannot be refunded here while that is open. */
  cardDispute: { stripeDisputeId: string; evidenceDueBy: string | null } | null;
}

const nameOf = (user: { displayName: string | null } | null | undefined, fallback: string) =>
  user?.displayName?.trim() || fallback;

type HoldRow = { status: string; createdAt: Date; metadata: unknown; paymentIntentId: string | null } | null;

function holdView(escrow: HoldRow): AdminServiceDispute['hold'] {
  if (!escrow) return null;
  return {
    status: escrow.status,
    lapsesAt: HELD.includes(escrow.status) ? holdDeadlineOf(escrow).toISOString() : null,
  };
}

/**
 * Every session and order waiting on a decision, oldest first: a hold on a card
 * lasts about a week, and the one that has waited longest is the one nearest to
 * lapsing. Decided disputes leave the list; their outcome is on the row and in
 * the audit log.
 */
export async function listServiceDisputes(): Promise<AdminServiceDispute[]> {
  const [sessions, orders] = await Promise.all([
    prisma.mentorSession.findMany({
      where: { status: 'DISPUTED' },
      orderBy: [{ disputedAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        sessionAmount: true,
        mentorPayout: true,
        currency: true,
        stripePaymentIntentId: true,
        disputedAt: true,
        disputeReason: true,
        disputeResponse: true,
        disputeRespondedAt: true,
        mentee: { select: { id: true, displayName: true } },
        mentorProfile: { select: { user: { select: { id: true, displayName: true } } } },
      },
    }),
    prisma.serviceOrder.findMany({
      where: { status: 'DISPUTED' },
      orderBy: [{ disputedAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
      select: {
        id: true,
        packageName: true,
        totalAmount: true,
        providerPayout: true,
        disputedAt: true,
        disputeReason: true,
        disputeResponse: true,
        disputeRespondedAt: true,
        client: { select: { id: true, displayName: true } },
        service: { select: { title: true, provider: { select: { id: true, displayName: true } } } },
        escrow: { select: { status: true, createdAt: true, metadata: true, paymentIntentId: true } },
      },
    }),
  ]);

  // A session's hold is found by its intent, since nothing else links them.
  const intents = sessions.map((s) => s.stripePaymentIntentId).filter((id): id is string => Boolean(id));
  const sessionHolds = intents.length
    ? await prisma.escrowPayment.findMany({
        where: { paymentIntentId: { in: intents } },
        select: { status: true, createdAt: true, metadata: true, paymentIntentId: true },
      })
    : [];
  const holdByIntent = new Map(sessionHolds.map((h) => [h.paymentIntentId, h]));

  const allIntents = [...intents, ...orders.map((o) => o.escrow?.paymentIntentId).filter((id): id is string => Boolean(id))];
  const cardDisputes = allIntents.length
    ? await prisma.paymentDispute.findMany({
        where: { paymentIntentId: { in: allIntents }, outcome: 'OPEN' },
        select: { paymentIntentId: true, stripeDisputeId: true, evidenceDueBy: true },
      })
    : [];
  const cardDisputeByIntent = new Map(cardDisputes.map((d) => [d.paymentIntentId, d]));
  const cardDisputeOf = (intent: string | null | undefined): AdminServiceDispute['cardDispute'] => {
    const found = intent ? cardDisputeByIntent.get(intent) : undefined;
    return found ? { stripeDisputeId: found.stripeDisputeId, evidenceDueBy: found.evidenceDueBy?.toISOString() ?? null } : null;
  };

  const rows: AdminServiceDispute[] = [
    ...sessions.map((s): AdminServiceDispute => ({
      kind: 'session',
      id: s.id,
      title: 'Mentoring session',
      buyer: { id: s.mentee.id, name: nameOf(s.mentee, 'The mentee') },
      provider: { id: s.mentorProfile.user.id, name: nameOf(s.mentorProfile.user, 'The mentor') },
      amount: Number(s.sessionAmount),
      currency: s.currency,
      providerPayout: Number(s.mentorPayout),
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      disputedAt: s.disputedAt?.toISOString() ?? null,
      reason: s.disputeReason,
      response: s.disputeResponse,
      respondedAt: s.disputeRespondedAt?.toISOString() ?? null,
      hold: holdView(s.stripePaymentIntentId ? (holdByIntent.get(s.stripePaymentIntentId) ?? null) : null),
      cardDispute: cardDisputeOf(s.stripePaymentIntentId),
    })),
    ...orders.map((o): AdminServiceDispute => ({
      kind: 'order',
      id: o.id,
      title: o.packageName ? `${o.service.title} · ${o.packageName}` : o.service.title,
      buyer: { id: o.client.id, name: nameOf(o.client, 'The buyer') },
      provider: { id: o.service.provider.id, name: nameOf(o.service.provider, 'The provider') },
      amount: o.totalAmount,
      currency: 'AUD',
      providerPayout: o.providerPayout,
      scheduledAt: null,
      disputedAt: o.disputedAt?.toISOString() ?? null,
      reason: o.disputeReason,
      response: o.disputeResponse,
      respondedAt: o.disputeRespondedAt?.toISOString() ?? null,
      hold: holdView(o.escrow),
      cardDispute: cardDisputeOf(o.escrow?.paymentIntentId),
    })),
  ];

  return rows.sort((a, b) => (a.disputedAt ?? '').localeCompare(b.disputedAt ?? ''));
}

export interface DisputeDecision {
  kind: ServiceDisputeKind;
  id: string;
  outcome: ServiceDisputeOutcome;
  /** For the audit row: who was paid or refunded, and how much. */
  buyerId: string;
  providerId: string;
  amount: number;
  currency: string;
}

/** What the team's decision does to the money, shared by both kinds. */
async function moveMoney(
  intent: string | null,
  outcome: ServiceDisputeOutcome,
  actor: ReturnType<typeof staffActor>,
  note: string | null,
  legacy: { paymentStatus: string } | null,
  fallbackReason: string
): Promise<{ wasCaptured: boolean }> {
  const escrow = intent
    ? await prisma.escrowPayment.findUnique({ where: { paymentIntentId: intent }, select: { id: true, status: true } })
    : null;
  const wasCaptured = escrow ? escrow.status === 'CAPTURED' : legacy?.paymentStatus === 'CAPTURED';

  if (outcome === 'release') {
    if (!intent) throw new ApiError(409, 'There is no payment held for this, so there is nothing to release.');
    if (escrow && ENDED.includes(escrow.status)) {
      throw new ApiError(
        409,
        'The hold on the buyer’s card has ended, so there is nothing to release. Give it back to close the dispute.'
      );
    }
    if (escrow) {
      // Taken first, so that if Stripe refuses the dispute stays open and the reason
      // is shown, rather than being closed with the money unmoved.
      if (escrow.status !== 'CAPTURED') await captureEscrowPayment(intent, actor);
    } else if (!wasCaptured) {
      await captureSessionHold(intent);
    }
    return { wasCaptured };
  }

  // refund
  if (!intent) return { wasCaptured: false };
  if (escrow) {
    // Already given back by an earlier press whose row write failed: nothing to do twice.
    if (escrow.status !== 'CANCELED' && escrow.status !== 'REFUNDED') {
      await cancelEscrowPayment(intent, actor, note ?? fallbackReason);
    }
  } else if (wasCaptured) {
    throw new ApiError(
      409,
      'This payment was taken before payments were recorded the way they are now, so it cannot be given back from here. Refund it in Stripe.'
    );
  } else {
    await cancelSessionHold(intent, note ?? fallbackReason);
  }
  return { wasCaptured };
}

/**
 * The team's decision on a session or an order in dispute.
 *
 * `release` pays the provider: the held payment is taken (or, if it had already
 * been, the dispute is closed as paid). `refund` gives it back to the buyer: the
 * hold is released, or a payment already taken is refunded with the provider's
 * share reversed. A payment the buyer's bank is also disputing is never refunded
 * here, because that could return the money twice (see openCardDisputeOn).
 * The caller writes the audit row; this returns what it needs to.
 */
export async function resolveServiceDispute(
  kind: ServiceDisputeKind,
  id: string,
  staff: DisputeActor,
  outcome: ServiceDisputeOutcome,
  noteInput?: string | null,
  now = new Date()
): Promise<DisputeDecision> {
  const actor = staffActor(staff);
  const note = clean(noteInput) || null;
  const release = outcome === 'release';

  if (kind === 'session') {
    const session = await prisma.mentorSession.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        menteeId: true,
        mentorProfileId: true,
        sessionAmount: true,
        currency: true,
        paymentStatus: true,
        completedAt: true,
        stripePaymentIntentId: true,
        mentorProfile: { select: { userId: true } },
      },
    });
    if (!session) throw new ApiError(404, 'Session not found');
    if (session.status !== 'DISPUTED') throw new ApiError(409, 'Only a session that is in dispute is decided here.');

    if (!release && session.stripePaymentIntentId) {
      const cardDispute = await openCardDisputeOn(session.stripePaymentIntentId);
      if (cardDispute) {
        throw new ApiError(
          409,
          `The mentee’s bank has also disputed this payment (${cardDispute.stripeDisputeId}), so it cannot be refunded here as well. Settle that dispute in Stripe first.`
        );
      }
    }

    const { wasCaptured } = await moveMoney(
      session.stripePaymentIntentId,
      outcome,
      actor,
      note,
      { paymentStatus: session.paymentStatus },
      'Session dispute decided in the mentee’s favour'
    );

    await prisma.$transaction(async (tx) => {
      const moved = await tx.mentorSession.updateMany({
        where: { id, status: 'DISPUTED' },
        data: {
          status: release ? 'COMPLETED' : 'CANCELED',
          disputeResolution: release ? 'RELEASED' : 'REFUNDED',
          disputeResolvedAt: now,
          disputeResolvedById: actor.id,
          paymentReleaseAt: null,
          ...(release
            ? {
                completedAt: session.completedAt ?? now,
                paymentStatus: 'CAPTURED' as const,
                // The day it was first taken, when it had been taken already.
                ...(wasCaptured ? {} : { paymentCapturedAt: now }),
              }
            : wasCaptured
              ? { paymentStatus: 'REFUNDED' as const }
              : { paymentStatus: 'CANCELED' as const, paymentCanceledAt: now }),
        },
      });
      if (moved.count !== 1) throw new ApiError(409, 'This session has just been decided by somebody else.');

      // A session that is paid counts as a finished hour, once; one that is
      // given back and had been counted stops counting.
      if (release && !session.completedAt) {
        await tx.mentorProfile.update({ where: { id: session.mentorProfileId }, data: { sessionCount: { increment: 1 } } });
      }
      if (!release && session.completedAt) {
        await tx.mentorProfile.updateMany({
          where: { id: session.mentorProfileId, sessionCount: { gt: 0 } },
          data: { sessionCount: { decrement: 1 } },
        });
      }
    });

    const amount = money(Number(session.sessionAmount), session.currency);
    const link = `/dashboard/mentors/sessions?session=${id}`;
    await tell(
      session.menteeId,
      'Your session dispute has been decided',
      release
        ? `ATHENA’s team looked at it and released the ${amount} to your mentor. If you disagree, please contact support.`
        : `ATHENA’s team looked at it and gave the ${amount} back to you. It can take a few days to show on your card.`,
      link
    );
    await tell(
      session.mentorProfile.userId,
      release ? 'You have been paid for a session' : 'A session in dispute was decided',
      release
        ? `ATHENA’s team looked at it and released the ${amount} to you.`
        : `ATHENA’s team looked at it and gave the ${amount} back to the mentee.`,
      link
    );

    logger.info('A mentoring session dispute was decided', { sessionId: id, outcome, by: actor.id });
    return {
      kind,
      id,
      outcome,
      buyerId: session.menteeId,
      providerId: session.mentorProfile.userId,
      amount: Number(session.sessionAmount),
      currency: session.currency,
    };
  }

  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      clientId: true,
      serviceId: true,
      totalAmount: true,
      service: { select: { title: true, providerId: true } },
      escrow: { select: { paymentIntentId: true, status: true } },
    },
  });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'DISPUTED') throw new ApiError(409, 'Only an order that is in dispute is decided here.');

  const intent = order.escrow?.paymentIntentId ?? null;
  if (!intent) {
    throw new ApiError(409, 'There is no payment attached to this order, so there is nothing to release or give back.');
  }
  if (!release) {
    const cardDispute = await openCardDisputeOn(intent);
    if (cardDispute) {
      throw new ApiError(
        409,
        `The buyer’s bank has also disputed this payment (${cardDispute.stripeDisputeId}), so it cannot be refunded here as well. Settle that dispute in Stripe first.`
      );
    }
  }

  await moveMoney(intent, outcome, actor, note, null, 'Order dispute decided in the buyer’s favour');

  await prisma.$transaction(async (tx) => {
    const moved = await tx.serviceOrder.updateMany({
      where: { id, status: 'DISPUTED' },
      data: release
        ? { status: 'COMPLETED', completedAt: now, disputeResolution: 'RELEASED', disputeResolvedAt: now, disputeResolvedById: actor.id }
        : {
            status: 'CANCELLED',
            cancelledAt: now,
            cancellationReason: note ?? 'Dispute decided in the buyer’s favour',
            disputeResolution: 'REFUNDED',
            disputeResolvedAt: now,
            disputeResolvedById: actor.id,
          },
    });
    if (moved.count !== 1) throw new ApiError(409, 'This order has just been decided by somebody else.');
    if (release) {
      await tx.skillService.update({ where: { id: order.serviceId }, data: { completedCount: { increment: 1 } } });
    }
  });

  const title = order.service.title;
  const link = `/skills-marketplace/orders/${id}`;
  await tell(
    order.clientId,
    'Your order dispute has been decided',
    release
      ? `${title}: ATHENA’s team looked at it and released the payment to the provider. If you disagree, please contact support.`
      : `${title}: ATHENA’s team looked at it and gave the payment back to you. It can take a few days to show on your card.`,
    link
  );
  await tell(
    order.service.providerId,
    release ? 'You have been paid for an order' : 'An order in dispute was decided',
    release
      ? `${title}: ATHENA’s team looked at it and released the payment to you.`
      : `${title}: ATHENA’s team looked at it and gave the payment back to the buyer.`,
    link
  );

  logger.info('A marketplace order dispute was decided', { orderId: id, outcome, by: actor.id });
  return {
    kind,
    id,
    outcome,
    buyerId: order.clientId,
    providerId: order.service.providerId,
    amount: order.totalAmount,
    currency: 'AUD',
  };
}
