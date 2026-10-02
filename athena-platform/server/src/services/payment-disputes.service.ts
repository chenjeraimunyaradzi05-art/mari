/**
 * Money coming back: card disputes (chargebacks) and refunds, and what each does
 * to the member who paid, the creators who were paid out of it, and ATHENA's
 * own documents.
 *
 * A dispute used to be a log line and one email, and nothing recorded what
 * became of it: it was never stored, never frozen, never closed out, and when
 * ATHENA lost one the member kept what the payment had bought. A refund of any size
 * marked the whole sale refunded, and left the member's tier, the gift points and
 * the tax invoice exactly as the sale had made them.
 *
 * Two entry points, both called from the Stripe webhook:
 *
 *  - recordDisputeEvent(event) takes the five charge.dispute.* events. One row per
 *    Stripe dispute, written by whichever event arrives first and moved only
 *    forward, so a replayed or reordered event lands on the same row. What is
 *    done about a dispute follows its outcome: while it is open and a gift
 *    balance purchase is involved, the creators the points were spent on have
 *    their withdrawals paused; when it is won the pause ends; when it is lost the
 *    membership ends or the gift points are taken back, the invoice is
 *    credited, and the admins are told what was done and what was not.
 *  - applyRefundEffects(charge) follows a refund onto the same things: gift points
 *    come back in proportion, the invoice carries a credit line, and the admins
 *    are told when a refund needs a human to decide about money that has already
 *    left for somebody else.
 *
 * What is deliberately not done automatically, because it moves money or takes
 * something from a person on a guess: a seller's transfer is not reversed, a
 * member's membership is not ended by a refund (a refund is often made on the wrong
 * charge, and says nothing about whether the member is leaving), and creators are never debited
 * for gifts they were already sent. Each of those is put in front of the admins,
 * with the figures, to decide.
 *
 * Everything here is safe to run twice. Stripe sends events at least once and in
 * no promised order, and a handler that failed part way is run again.
 */

import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { getStripe } from '../utils/stripe';
import { sendEmail } from '../utils/email';
import { escapeHtml } from '../utils/escape-html';
import { recordFailure } from '../utils/ops-metrics';
import { bestEffort } from '../utils/best-effort';
import { notifyAdmins } from './admin-notify.service';
import { summariseEscrowFlows } from './escrow-holds.service';
import { trustAndSafetyMailbox } from './content-report.service';
import { minorUnitScale } from './stripe-connect.service';
import { holdCreatorPayouts, releaseCreatorPayouts, reverseGiftPurchase } from './creator.service';
import { creditInvoiceForPayment, creditSubscriptionInvoice } from './invoice.service';

/** Where an admin lands from a dispute notice. */
export const ADMIN_DISPUTES_LINK = '/admin/disputes';

/** The dispute events the webhook hands to recordDisputeEvent. */
export const DISPUTE_EVENT_TYPES = [
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
] as const;

export function isDisputeEvent(type: string): boolean {
  return (DISPUTE_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * OPEN while it can still go either way, then WON, LOST, or CLOSED for an
 * early-warning inquiry that was withdrawn or a charge that was refunded before
 * it became a chargeback.
 */
export type DisputeOutcome = 'OPEN' | 'WON' | 'LOST' | 'CLOSED';

export function outcomeOf(status: string): DisputeOutcome {
  switch (status) {
    case 'won':
      return 'WON';
    case 'lost':
      return 'LOST';
    case 'warning_closed':
    case 'charge_refunded':
    case 'prevented':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/** An amount in minor units as a person reads it, in the currency's own precision. */
function readable(amount: number, currency: string): string {
  const scale = minorUnitScale(currency);
  return `${(amount / scale).toFixed(scale === 1 ? 0 : 2)} ${currency.toUpperCase()}`;
}

/** What a disputed or refunded payment was for, in words an admin reads. */
const KIND_LABELS: Record<string, string> = {
  GIFT_BALANCE: 'a gift balance top-up',
  SUBSCRIPTION: 'a membership payment',
  MENTOR_SESSION: 'a mentoring session',
  FORMATION: 'a business formation fee',
  ACCELERATOR: 'an accelerator place',
  COURSE: 'a course',
  JOB_BOOST: 'a job boost',
  SERVICE_ORDER: 'a marketplace order',
  ESCROW: 'a marketplace payment held and released through escrow',
};

function kindLabel(kind: string | null): string {
  return (kind && KIND_LABELS[kind]) || 'a payment ATHENA could not match to a sale';
}

// ---------------------------------------------------------------------------
// Which of our rows a charge belongs to
// ---------------------------------------------------------------------------

interface DisputedTarget {
  kind: string | null;
  userId: string | null;
  paymentId: string | null;
  escrowPaymentId: string | null;
  /** Our Subscription row, when the charge was a membership period. */
  subscriptionId: string | null;
}

interface SubscriptionCharge {
  subscriptionId: string;
  userId: string;
  stripeSubscriptionId: string | null;
  /** When Stripe recorded the payment of the invoice: how ATHENA's own invoice for it is found. */
  paidAt: Date | null;
}

/**
 * The membership a charge paid for, found through the Stripe invoice behind it.
 *
 * A membership period is paid through a Stripe invoice, so there is no Payment
 * row and no escrow row to find it by. The invoice names the subscription and
 * the instant it was paid, which is exactly how the tax invoice ATHENA filed for
 * that period is found. A charge with no invoice, or whose invoice names nothing
 * ATHENA holds, is not a membership. A Stripe failure is thrown, so that the
 * caller can retry; it is not read as "not a membership".
 */
export async function subscriptionChargeOf(
  invoiceRef: string | null,
  chargeId: string | null
): Promise<SubscriptionCharge | null> {
  let invoiceId = invoiceRef;
  if (!invoiceId && chargeId) {
    const charge = await getStripe().charges.retrieve(chargeId);
    invoiceId = idOf((charge as { invoice?: string | { id: string } | null }).invoice);
  }
  if (!invoiceId) return null;

  const invoice = await getStripe().invoices.retrieve(invoiceId);
  const stripeSubscriptionId = idOf(invoice.subscription as string | { id: string } | null);
  const customerId = idOf(invoice.customer as string | { id: string } | null);
  if (!stripeSubscriptionId && !customerId) return null;

  const matchers: Prisma.SubscriptionWhereInput[] = [];
  if (stripeSubscriptionId) matchers.push({ stripeSubscriptionId });
  if (customerId) matchers.push({ stripeCustomerId: customerId });
  const subscription = await prisma.subscription.findFirst({
    where: { OR: matchers },
    select: { id: true, userId: true, stripeSubscriptionId: true },
  });
  if (!subscription) return null;

  const paidAtSeconds = invoice.status_transitions?.paid_at ?? invoice.created;
  return {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    stripeSubscriptionId: subscription.stripeSubscriptionId ?? stripeSubscriptionId,
    paidAt: typeof paidAtSeconds === 'number' ? new Date(paidAtSeconds * 1000) : null,
  };
}

async function identifyDisputedCharge(paymentIntentId: string | null, chargeId: string | null): Promise<DisputedTarget> {
  const target: DisputedTarget = { kind: null, userId: null, paymentId: null, escrowPaymentId: null, subscriptionId: null };

  if (paymentIntentId) {
    const [escrow, payment] = await Promise.all([
      prisma.escrowPayment.findUnique({
        where: { paymentIntentId },
        select: { id: true, buyerId: true },
      }),
      prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true, userId: true, type: true },
      }),
    ]);
    if (escrow) {
      target.escrowPaymentId = escrow.id;
      target.userId = escrow.buyerId;
      target.kind = 'ESCROW';
    }
    if (payment) {
      target.paymentId = payment.id;
      target.userId = payment.userId;
      target.kind = payment.type ?? target.kind ?? 'PAYMENT';
    }
    if (target.kind) return target;
  }

  // Not a sale ATHENA keeps a row for. A membership period is the one other
  // kind of charge it takes, and Stripe is the only place that says so.
  if (chargeId) {
    try {
      const membership = await subscriptionChargeOf(null, chargeId);
      if (membership) {
        target.kind = 'SUBSCRIPTION';
        target.userId = membership.userId;
        target.subscriptionId = membership.subscriptionId;
      }
    } catch (error) {
      // Looked for again on the next event for this dispute. Not thrown: the
      // dispute itself must be recorded whether or not Stripe answered.
      logger.warn('Could not tell what a disputed charge was for', {
        chargeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return target;
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export interface DisputeRecorded {
  id: string;
  stripeDisputeId: string;
  outcome: DisputeOutcome;
  /** True when this event is the one that made the row. */
  created: boolean;
  /** True when this event is the one that settled it. */
  settled: boolean;
  /** What was done about it, in words, when this call did something. */
  applied: string[];
}

type DisputeRow = Prisma.PaymentDisputeGetPayload<Record<string, never>>;

function effectsRecord(row: Pick<DisputeRow, 'effects'>): { subscriptionId?: string; applied?: string[] } {
  const value = row.effects;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as { subscriptionId?: string; applied?: string[] }) : {};
}

/**
 * Takes one charge.dispute.* event: records the dispute and does what its state
 * calls for. Throws on a database failure, so Stripe delivers the event again;
 * every step is safe to repeat.
 */
export async function recordDisputeEvent(event: Stripe.Event): Promise<DisputeRecorded> {
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId = idOf(dispute.payment_intent as string | { id: string } | null);
  const chargeId = idOf(dispute.charge as string | { id: string } | null);
  const seenAt = Number.isFinite(event.created) ? new Date(event.created * 1000) : new Date();
  const currency = String(dispute.currency || 'aud').toUpperCase();

  logger.warn('Stripe dispute', {
    event: event.type,
    disputeId: dispute.id,
    paymentIntentId,
    amount: dispute.amount,
    reason: dispute.reason,
    status: dispute.status,
  });

  let row = await prisma.paymentDispute.findUnique({ where: { stripeDisputeId: dispute.id } });
  const wasOpen = !row || row.outcome === 'OPEN';

  // A dispute that has been decided stays decided. Stripe does not promise the
  // order of its events, and an `updated` that was made before the `closed` can
  // arrive after it; it must not put a lost dispute back to needing a response.
  const incoming = outcomeOf(dispute.status);
  if (row && !wasOpen && incoming !== 'OPEN' && incoming !== row.outcome) {
    logger.warn('A dispute that was already decided has been reported with another outcome and was left as it was', {
      disputeId: dispute.id,
      recorded: row.outcome,
      reported: incoming,
    });
  }
  const outcome: DisputeOutcome = row && !wasOpen ? (row.outcome as DisputeOutcome) : incoming;
  const status = row && !wasOpen ? row.status : dispute.status;

  // The money leaves ATHENA's Stripe balance when funds are withdrawn and comes
  // back when they are reinstated; the other events do not say either way.
  const fundsWithdrawn =
    event.type === 'charge.dispute.funds_withdrawn'
      ? true
      : event.type === 'charge.dispute.funds_reinstated'
        ? false
        : outcome === 'WON'
          ? false
          : (row?.fundsWithdrawn ?? false);

  const dueBy = dispute.evidence_details?.due_by;
  const data = {
    chargeId,
    paymentIntentId,
    amount: dispute.amount,
    currency,
    reason: dispute.reason ?? null,
    status,
    outcome,
    evidenceDueBy: typeof dueBy === 'number' ? new Date(dueBy * 1000) : (row?.evidenceDueBy ?? null),
    fundsWithdrawn,
    closedAt: outcome === 'OPEN' ? null : (row?.closedAt ?? seenAt),
  };

  let created = false;
  if (!row) {
    try {
      row = await prisma.paymentDispute.create({
        data: {
          stripeDisputeId: dispute.id,
          openedAt: typeof dispute.created === 'number' ? new Date(dispute.created * 1000) : seenAt,
          ...data,
        },
      });
      created = true;
    } catch (error) {
      // Another event for the same dispute wrote the row between our read and
      // our insert. It is the same row; carry on with it.
      if ((error as { code?: unknown } | null)?.code !== 'P2002') throw error;
      row = await prisma.paymentDispute.findUnique({ where: { stripeDisputeId: dispute.id } });
      if (!row) throw error;
    }
  }
  if (!created) {
    row = await prisma.paymentDispute.update({ where: { id: row.id }, data });
  }

  // What the charge was, so that the right thing is done about it. Looked for
  // again on every event until it is found: the first Stripe lookup may have failed.
  if (!row.kind) {
    const target = await identifyDisputedCharge(paymentIntentId, chargeId);
    if (target.kind) {
      row = await prisma.paymentDispute.update({
        where: { id: row.id },
        data: {
          kind: target.kind,
          userId: target.userId,
          paymentId: target.paymentId,
          escrowPaymentId: target.escrowPaymentId,
          ...(target.subscriptionId ? { effects: { ...effectsRecord(row), subscriptionId: target.subscriptionId } as Prisma.InputJsonValue } : {}),
        },
      });
    }
  }

  const applied: string[] = [];

  if (row.outcome === 'OPEN') {
    // The creators a member's gifts went to cannot be reached once they have
    // withdrawn it, and a dispute takes weeks. Their withdrawals are paused
    // from the moment it opens, when the points bought have already been spent.
    if (row.kind === 'GIFT_BALANCE' && row.heldCreatorProfileIds.length === 0 && !row.holdsReleasedAt) {
      const held = await holdRecipientsOfSpentPoints(row);
      if (held.length > 0) {
        row = await prisma.paymentDispute.update({ where: { id: row.id }, data: { heldCreatorProfileIds: held } });
        applied.push(`Paused withdrawals for ${held.length} creator${held.length === 1 ? '' : 's'} the member had already gifted points to.`);
      }
    }
  }

  let effectsAppliedNow = false;
  if (row.outcome === 'LOST' && !row.effectsAppliedAt) {
    effectsAppliedNow = true;
    const done = await applyLostDisputeEffects(row);
    applied.push(...done.notes);
    // Read back, because the effects may have paused creators.
    row = await prisma.paymentDispute.update({
      where: { id: row.id },
      data: {
        effectsAppliedAt: new Date(),
        effects: { ...effectsRecord(row), applied: done.notes } as Prisma.InputJsonValue,
        ...(done.heldCreatorProfileIds.length > 0
          ? { heldCreatorProfileIds: [...new Set([...row.heldCreatorProfileIds, ...done.heldCreatorProfileIds])] }
          : {}),
      },
    });
  }

  if ((row.outcome === 'WON' || row.outcome === 'CLOSED') && row.heldCreatorProfileIds.length > 0 && !row.holdsReleasedAt) {
    const released = await releaseHoldsOf(row);
    applied.push(`Withdrawals are open again for ${released} creator${released === 1 ? '' : 's'}.`);
  }

  // Said once, when the dispute is decided. A lost one is said when its effects
  // are applied, not only on the event that first recorded the decision: if the
  // process failed part way through them, Stripe's retry finds the dispute
  // already decided, and the admins still have to be told what was done.
  const settled = (row.outcome !== 'OPEN' && wasOpen) || effectsAppliedNow;

  await tellAdminsAboutDispute(event, dispute, row, { created, settled, applied });

  return { id: row.id, stripeDisputeId: row.stripeDisputeId, outcome: row.outcome as DisputeOutcome, created, settled, applied };
}

/**
 * The creators whose withdrawals are paused because a member who is disputing
 * the purchase of gift points has already spent some of them.
 *
 * Only when they have been: a member who still holds all the points bought has given
 * nobody anything, and there is nothing to protect. Gifts sent since the purchase
 * are the ones that could be drawn from it, so those recipients, and only those,
 * are paused, and only their withdrawals: their balance still grows.
 */
async function holdRecipientsOfSpentPoints(row: DisputeRow): Promise<string[]> {
  if (!row.paymentIntentId) return [];
  const purchase = await prisma.giftBalancePurchase.findUnique({
    where: { paymentIntentId: row.paymentIntentId },
    select: { userId: true, giftPoints: true, reversedPoints: true, createdAt: true },
  });
  if (!purchase) return [];

  const holder = await prisma.user.findUnique({ where: { id: purchase.userId }, select: { giftBalance: true } });
  const stillHeld = Math.max(holder?.giftBalance ?? 0, 0);
  const stillOwed = purchase.giftPoints - purchase.reversedPoints;
  if (stillHeld >= stillOwed) return [];

  return holdRecipients(purchase.userId, purchase.createdAt, `A card dispute on a gift balance purchase (${row.stripeDisputeId})`);
}

/** Pauses the creators this member has gifted to since `since`; returns their profile ids. */
async function holdRecipients(senderId: string, since: Date, reason: string): Promise<string[]> {
  const gifts = await prisma.giftTransaction.findMany({
    where: { senderId, createdAt: { gte: since } },
    select: { receiverId: true },
    distinct: ['receiverId'],
    take: 200,
  });
  if (gifts.length === 0) return [];

  const profiles = await prisma.creatorProfile.findMany({
    where: { userId: { in: gifts.map((g) => g.receiverId) } },
    select: { id: true },
  });
  const ids = profiles.map((p) => p.id);
  await holdCreatorPayouts(ids, reason);
  return ids;
}

/**
 * Lifts the pause on the creators a dispute held, except any that another dispute
 * still holds. Returns how many were lifted.
 */
async function releaseHoldsOf(row: Pick<DisputeRow, 'id' | 'heldCreatorProfileIds'>): Promise<number> {
  const stillHeldElsewhere = await prisma.paymentDispute.findMany({
    where: {
      id: { not: row.id },
      holdsReleasedAt: null,
      heldCreatorProfileIds: { hasSome: row.heldCreatorProfileIds },
      // Another open dispute, or a lost one nobody has settled with the creator yet.
      outcome: { in: ['OPEN', 'LOST'] },
    },
    select: { heldCreatorProfileIds: true },
  });
  const keep = new Set(stillHeldElsewhere.flatMap((d) => d.heldCreatorProfileIds));
  const free = row.heldCreatorProfileIds.filter((id) => !keep.has(id));

  const lifted = await releaseCreatorPayouts(free);
  await prisma.paymentDispute.update({ where: { id: row.id }, data: { holdsReleasedAt: new Date() } });
  return lifted;
}

/**
 * What a lost dispute does. The money has gone back to the cardholder and out of
 * ATHENA's Stripe balance for good, so whatever the payment bought is taken back
 * where ATHENA can do that without guessing, and put in front of the admins
 * where it cannot.
 */
async function applyLostDisputeEffects(row: DisputeRow): Promise<{ notes: string[]; heldCreatorProfileIds: string[] }> {
  const notes: string[] = [];
  const held: string[] = [];
  const amountLabel = readable(row.amount, row.currency);

  // Money already given back by a refund counts with the dispute: a charge cannot
  // be disputed for more than is left of it, so the two together are what the
  // buyer has been returned.
  const payment = row.paymentId
    ? await prisma.payment.findUnique({ where: { id: row.paymentId }, select: { refundedAmount: true } })
    : null;
  const refundedMajor = payment ? Number(payment.refundedAmount) : 0;
  const scale = minorUnitScale(row.currency);
  const returnedCents = row.amount + Math.round(refundedMajor * scale);

  switch (row.kind) {
    case 'GIFT_BALANCE': {
      if (!row.paymentIntentId) break;
      const reversal = await reverseGiftPurchase(row.paymentIntentId, returnedCents);
      if (!reversal) {
        notes.push('The payment was for gift points, but no purchase is recorded for it, so no points could be taken back.');
      } else if (reversal.alreadyApplied) {
        notes.push('The gift points for this payment had already been taken back.');
      } else {
        notes.push(`Took back ${reversal.tookBackPoints} gift point${reversal.tookBackPoints === 1 ? '' : 's'} from the member.`);
        if (reversal.shortfallPoints > 0) {
          const recipients = await holdRecipients(
            reversal.userId,
            reversal.purchasedAt,
            `A lost card dispute on a gift balance purchase (${row.stripeDisputeId})`
          );
          held.push(...recipients);
          notes.push(
            `${reversal.shortfallPoints} point${reversal.shortfallPoints === 1 ? ' had' : 's had'} already been spent on gifts and could not be taken back. ` +
              (recipients.length > 0
                ? `Withdrawals are paused for the ${recipients.length} creator${recipients.length === 1 ? '' : 's'} who were gifted since; nobody has been debited. Decide what to do about those balances, then release the pause.`
                : 'Nobody could be identified to pause.')
          );
        }
      }
      break;
    }

    case 'SUBSCRIPTION': {
      const subscriptionId = effectsRecord(row).subscriptionId;
      if (subscriptionId) {
        notes.push(await endMembership(subscriptionId));
      } else {
        notes.push('The payment was for a membership, but the membership could not be found, so it was not ended. End it in Stripe.');
      }
      break;
    }

    case 'FORMATION':
      notes.push(
        'The payment was a business formation fee. The registration has not been changed: close it out with a reason from the formation queue.'
      );
      break;

    case 'ACCELERATOR':
      notes.push('The payment was for an accelerator place. The enrolment has not been changed: decide whether the place stays.');
      break;

    case 'MENTOR_SESSION':
    case 'SERVICE_ORDER':
    case 'ESCROW':
      notes.push(
        `The payment was for ${kindLabel(row.kind)}. The seller was paid out of it and has not been debited: reverse the transfer in Stripe if the seller should not keep the money.`
      );
      break;

    default:
      notes.push('ATHENA could not match this payment to a sale, so nothing was taken back. Find it in Stripe and decide.');
  }

  // The document records what happened to the money: the sale stands, and the
  // amount that went back is credited against it.
  try {
    const returnedMajor = returnedCents / scale;
    if (row.paymentId) {
      const credit = await creditInvoiceForPayment(row.paymentId, returnedMajor);
      if (credit?.changed) notes.push(`Credited invoice ${credit.invoiceNumber} by ${readable(Math.round(credit.credited * scale), row.currency)}.`);
    } else if (row.kind === 'SUBSCRIPTION' && effectsRecord(row).subscriptionId && row.chargeId) {
      const membership = await subscriptionChargeOf(null, row.chargeId);
      if (membership?.paidAt) {
        const credit = await creditSubscriptionInvoice(membership.subscriptionId, membership.paidAt, returnedMajor);
        if (credit?.changed) notes.push(`Credited invoice ${credit.invoiceNumber} by ${readable(Math.round(credit.credited * scale), row.currency)}.`);
      }
    }
  } catch (error) {
    // The invoice is a record, and the effects above have been applied. Thrown
    // would run them all again, which is safe but would never get further if
    // Stripe stayed unreachable, so it is counted and left for the next event.
    recordFailure('stripe_webhook.dispute_invoice_credit', error);
    logger.error('A lost dispute could not be credited against its invoice', {
      disputeId: row.stripeDisputeId,
      error: error instanceof Error ? error.message : String(error),
    });
    notes.push(`The invoice could not be credited (${amountLabel} was lost): credit it by hand.`);
  }

  return { notes, heldCreatorProfileIds: held };
}

/**
 * Ends a membership because the card payment for it was lost to a dispute.
 *
 * The tier and status are written first, the same as the
 * customer.subscription.deleted handler writes them, so the member's access ends
 * whether or not Stripe answers. Then the subscription is cancelled at Stripe so
 * that the member is not charged again on a card that has just disputed the last
 * payment; if that fails the admin is told to do it by hand.
 */
async function endMembership(subscriptionRowId: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionRowId },
    select: { id: true, tier: true, status: true, stripeSubscriptionId: true },
  });
  if (!subscription) return 'The membership could not be found, so it was not ended.';
  if (subscription.tier === 'FREE' && subscription.status === 'CANCELED') {
    return 'The membership had already ended.';
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      tier: 'FREE',
      status: 'CANCELED',
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    },
  });

  if (!subscription.stripeSubscriptionId) {
    return 'Ended the membership and returned the member to the free plan.';
  }

  try {
    await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId);
    await prisma.subscription.update({ where: { id: subscription.id }, data: { stripeSubscriptionId: null } });
    return 'Ended the membership, returned the member to the free plan and cancelled the subscription at Stripe.';
  } catch (error) {
    logger.error('A membership was ended after a lost dispute but could not be cancelled at Stripe', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : String(error),
    });
    recordFailure('stripe_webhook.dispute_subscription_cancel', error);
    return 'Ended the membership and returned the member to the free plan, but Stripe would not cancel the subscription. Cancel it in Stripe so the member is not billed again.';
  }
}

// ---------------------------------------------------------------------------
// Telling people
// ---------------------------------------------------------------------------

async function tellAdminsAboutDispute(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  row: DisputeRow,
  what: { created: boolean; settled: boolean; applied: string[] }
): Promise<void> {
  const amount = readable(row.amount, row.currency);
  const respondBy = row.evidenceDueBy ? row.evidenceDueBy.toISOString() : 'see Stripe';

  // The opening alert goes with the `created` event, and also with whichever
  // event first makes the row for a dispute that is still open: Stripe does not
  // promise the order of its events, and an `updated` or `funds_withdrawn` that
  // arrives first, with `created` lost or still to come, must not leave a dispute
  // with a deadline that nobody has been told of.
  if (event.type === 'charge.dispute.created' || (what.created && row.outcome === 'OPEN')) {
    // The email: a person reading a mailbox is who answers a dispute in time.
    // The fallback used to be the literal 'trust-safety@athena.com'. athena.com is
    // not a domain this venture owns, so any deployment without TRUST_SAFETY_EMAIL
    // posted dispute ids, amounts and payment-intent ids to a stranger's mail
    // server. The mailbox now comes from the same resolver the safety alerts use:
    // ATHENA's own support address, or nothing. With nothing, the mail is not sent
    // and the missing mailbox is recorded where the operations screen shows it.
    const to = trustAndSafetyMailbox();
    if (!to) {
      recordFailure('stripe.dispute-alert', new Error('no Trust & Safety mailbox configured'));
    } else {
      const delivered = await sendEmail({
        to,
        subject: `Stripe dispute opened: ${dispute.id}`,
        text: `A cardholder has disputed a charge.\n\nDispute: ${dispute.id}\nAmount: ${amount}\nReason: ${dispute.reason}\nPayment intent: ${row.paymentIntentId ?? 'unknown'}\nEvidence due: ${respondBy}\n\nRespond in the Stripe dashboard.`,
        // Stripe's own strings, escaped anyway: this is markup built from text
        // that arrived over the network, and the cost of escaping it is nil.
        html: `<p>A cardholder has disputed a charge.</p><ul><li>Dispute: ${escapeHtml(dispute.id)}</li><li>Amount: ${escapeHtml(amount)}</li><li>Reason: ${escapeHtml(String(dispute.reason))}</li><li>Payment intent: ${escapeHtml(row.paymentIntentId ?? 'unknown')}</li><li>Evidence due: ${escapeHtml(respondBy)}</li></ul><p>Respond in the Stripe dashboard.</p>`,
      });
      // sendEmail answers false rather than throwing when the mail provider refuses
      // it. The evidence deadline is the one date in a dispute that cannot be
      // moved, so an alert that did not go is put on the operations screen, and the
      // in-app notice below is the other way the admins find out.
      if (!delivered) {
        recordFailure('stripe.dispute-alert', new Error(`The alert email for dispute ${dispute.id} was not delivered`));
      }
    }

    // The in-app notice, so the admins see it without the mailbox and so it
    // lands on the list that carries the evidence deadline.
    await notifyAdmins({
      title: 'A card payment has been disputed',
      message: `${amount} for ${kindLabel(row.kind)} was disputed (${dispute.reason}). Evidence is due ${respondBy}. ${
        what.applied.length > 0 ? what.applied.join(' ') : 'Respond in the Stripe dashboard.'
      }`,
      link: ADMIN_DISPUTES_LINK,
      data: { kind: 'PAYMENT_DISPUTE_OPENED', disputeId: row.id, stripeDisputeId: row.stripeDisputeId },
    });
    await tellSellerOfCardDispute(row);
    return;
  }

  if (what.settled) {
    const title =
      row.outcome === 'LOST'
        ? 'A card dispute was lost'
        : row.outcome === 'WON'
          ? 'A card dispute was won'
          : 'A card dispute was closed';
    await notifyAdmins({
      title,
      message:
        `${amount} for ${kindLabel(row.kind)}: ${row.outcome.toLowerCase()}. ` +
        (what.applied.length > 0
          ? what.applied.join(' ')
          : row.outcome === 'WON'
            ? 'Nothing was taken from anybody.'
            : 'Nothing further was done.'),
      link: ADMIN_DISPUTES_LINK,
      data: { kind: 'PAYMENT_DISPUTE_SETTLED', disputeId: row.id, stripeDisputeId: row.stripeDisputeId, outcome: row.outcome },
    });
  }
}

/**
 * Tells the seller, once, that the bank behind a buyer's card has questioned a
 * payment she was paid out of: a mentoring session, a marketplace order or
 * booking, a car purchase. The money is out of ATHENA's balance, not hers, and
 * nothing is taken from her without a decision from a person; she is told only so
 * that a payment she thought settled is not a surprise later, and that she need
 * do nothing now. Once per dispute, by its id. Best effort: the dispute is
 * recorded and the admins have been told, and a notice that does not write must
 * not fail the Stripe event.
 */
async function tellSellerOfCardDispute(row: DisputeRow): Promise<void> {
  const escrowId = row.escrowPaymentId;
  if (!escrowId) return;
  await bestEffort('notification.card-dispute-seller', async () => {
    const escrow = await prisma.escrowPayment.findUnique({
      where: { id: escrowId },
      select: { sellerId: true, description: true },
    });
    if (!escrow?.sellerId) return;
    const already = await prisma.notification.findFirst({
      where: { userId: escrow.sellerId, data: { path: ['disputeId'], equals: row.id } },
      select: { id: true },
    });
    if (already) return;
    await prisma.notification.create({
      data: {
        userId: escrow.sellerId,
        type: 'SYSTEM',
        title: 'A buyer’s bank has questioned a payment',
        message: `The bank behind a buyer’s card has asked for a payment you were paid for${escrow.description ? ` (${escrow.description})` : ''} to be reviewed. ATHENA’s team is handling it with the bank. You do not need to do anything now, and we will contact you if we need anything from you.`,
        link: '/dashboard/earnings',
        data: { kind: 'CARD_DISPUTE_ON_SALE', disputeId: row.id },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export interface RefundEffects {
  giftPointsTakenBack: number;
  giftPointsShort: number;
  /** The number of the invoice that was credited, when one was. */
  invoiceNumber: string | null;
}

/**
 * What a refund does beyond marking the sale: it takes back the gift points the
 * money bought, in proportion; it credits the invoice filed for the sale; and it
 * tells the admins when the refund leaves something for a person to decide.
 *
 * `charge.amount_refunded` is cumulative, so this is as safe to run twice as the
 * webhook's own status writes: every figure written only ever goes up.
 *
 * Does not touch a membership, a seller's transfer or a creator's balance. A
 * refund taken in the Stripe dashboard says nothing about whether the member is
 * leaving or whether the seller should bear it, so the admins are told and decide.
 */
export async function applyRefundEffects(charge: Stripe.Charge): Promise<RefundEffects> {
  const effects: RefundEffects = { giftPointsTakenBack: 0, giftPointsShort: 0, invoiceNumber: null };
  const paymentIntentId = idOf(charge.payment_intent as string | { id: string } | null);
  const refundedCents = Number.isFinite(charge.amount_refunded) ? charge.amount_refunded : 0;
  if (!paymentIntentId || !(refundedCents > 0)) return effects;

  const currency = String(charge.currency || 'aud');
  const scale = minorUnitScale(currency);
  const refundedMajor = refundedCents / scale;
  const fullyRefunded =
    charge.refunded === true || (typeof charge.amount === 'number' && charge.amount > 0 && refundedCents >= charge.amount);
  const refundLabel = readable(refundedCents, currency);

  // Gift points: the money came back, so the points it bought go with it.
  const gift = await reverseGiftPurchase(paymentIntentId, refundedCents);
  if (gift && !gift.alreadyApplied) {
    effects.giftPointsTakenBack = gift.tookBackPoints;
    effects.giftPointsShort = gift.shortfallPoints;
    if (gift.shortfallPoints > 0) {
      await notifyAdmins({
        title: 'A refunded gift purchase was already spent',
        message: `${refundLabel} was refunded on a gift balance top-up. ${gift.tookBackPoints} point${gift.tookBackPoints === 1 ? ' was' : 's were'} taken back, and ${gift.shortfallPoints} had already been spent on gifts, so ${gift.shortfallPoints === 1 ? 'it' : 'they'} stay with the creators who were sent them. Nobody has been debited.`,
        link: ADMIN_DISPUTES_LINK,
        data: { kind: 'GIFT_REFUND_SHORTFALL', paymentIntentId, shortfallPoints: gift.shortfallPoints },
      });
    }
  }

  // The invoice: a sale ATHENA issued a document for carries what went back.
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true },
  });
  if (payment) {
    const credit = await creditInvoiceForPayment(payment.id, refundedMajor);
    effects.invoiceNumber = credit?.invoiceNumber ?? null;
  } else {
    const invoiceRef = idOf((charge as { invoice?: string | { id: string } | null }).invoice);
    if (invoiceRef) {
      // A membership period. Stripe is asked which one, and a failure to ask is
      // thrown so that the refund is processed again rather than left without
      // its credit.
      const membership = await subscriptionChargeOf(invoiceRef, null);
      if (membership?.paidAt) {
        const credit = await creditSubscriptionInvoice(membership.subscriptionId, membership.paidAt, refundedMajor);
        effects.invoiceNumber = credit?.invoiceNumber ?? null;
      }
      if (membership && fullyRefunded) {
        await notifyAdmins({
          title: 'A membership payment was refunded',
          message: `${refundLabel} was refunded on a membership payment. The plan is unchanged. If the member is leaving, cancel the membership from the subscriptions page.`,
          link: '/admin/subscriptions',
          data: { kind: 'MEMBERSHIP_REFUND', subscriptionId: membership.subscriptionId },
        });
      }
    }
  }

  // A marketplace payment already released to its seller: refunding the buyer
  // does not take the money back from the seller unless the refund said to.
  const released = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
    select: { id: true, capturedAt: true },
  });
  if (released?.capturedAt) {
    await notifyAdmins({
      title: 'A released marketplace payment was refunded',
      message: `${refundLabel} was refunded to a buyer on a payment that had already been released to its seller. If this refund did not reverse the seller's transfer, the seller keeps the money: check the transfer in Stripe and reverse it if the seller should not.`,
      link: '/admin',
      data: { kind: 'ESCROW_REFUND_AFTER_RELEASE', escrowId: released.id, fullyRefunded },
    });
  }

  return effects;
}

// ---------------------------------------------------------------------------
// For the admins
// ---------------------------------------------------------------------------

export interface AdminDispute {
  id: string;
  stripeDisputeId: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  outcome: string;
  evidenceDueBy: string | null;
  openedAt: string;
  closedAt: string | null;
  fundsWithdrawn: boolean;
  kind: string | null;
  kindLabel: string;
  member: { id: string; name: string } | null;
  /** What was done about it, in words; empty until it is lost. */
  applied: string[];
  /** How many creators' withdrawals it is still holding. */
  creatorsHeld: number;
  paymentIntentId: string | null;
  /**
   * What the payment was for, when it was a marketplace order, booking, mentoring
   * session or car purchase: which one, and where it has got to. Null for a sale
   * with no flow behind it.
   */
  flow: { label: string; id: string; status: string } | null;
}

function flowOf(
  escrowPaymentId: string | null,
  flows: Map<string, { label: string; id: string; status: string }>
): { label: string; id: string; status: string } | null {
  const found = escrowPaymentId ? flows.get(escrowPaymentId) : undefined;
  return found ? { label: found.label, id: found.id, status: found.status } : null;
}

/**
 * The disputes, newest first, with what was done about each. `outcome` narrows
 * the list; without it every dispute is listed, so a decided one can still be
 * looked up.
 */
export async function listDisputesForAdmin(
  query: { outcome?: string; cursor?: string; limit?: number } = {}
): Promise<{ disputes: AdminDispute[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 200);
  const outcome = query.outcome && ['OPEN', 'WON', 'LOST', 'CLOSED'].includes(query.outcome) ? query.outcome : undefined;

  const rows = await prisma.paymentDispute.findMany({
    where: outcome ? { outcome } : {},
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);

  const userIds = [...new Set(page.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, firstName: true, lastName: true },
      })
    : [];
  const nameOf = new Map(
    users.map((u) => [u.id, u.displayName?.trim() || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'A member'])
  );

  // Which order, booking, session or purchase each escrow-backed dispute is about.
  // A lookup that fails leaves the column blank rather than the list unreadable.
  const escrowIds = [...new Set(page.map((r) => r.escrowPaymentId).filter((id): id is string => Boolean(id)))];
  const flows: Map<string, { label: string; id: string; status: string }> = escrowIds.length
    ? await bestEffort('payment-disputes.flows', () => summariseEscrowFlows(escrowIds), new Map())
    : new Map();

  return {
    disputes: page.map((row) => ({
      id: row.id,
      stripeDisputeId: row.stripeDisputeId,
      amount: row.amount,
      currency: row.currency,
      reason: row.reason,
      status: row.status,
      outcome: row.outcome,
      evidenceDueBy: row.evidenceDueBy ? row.evidenceDueBy.toISOString() : null,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      fundsWithdrawn: row.fundsWithdrawn,
      kind: row.kind,
      kindLabel: kindLabel(row.kind),
      member: row.userId ? { id: row.userId, name: nameOf.get(row.userId) ?? 'A member' } : null,
      applied: effectsRecord(row).applied ?? [],
      creatorsHeld: row.holdsReleasedAt ? 0 : row.heldCreatorProfileIds.length,
      paymentIntentId: row.paymentIntentId,
      flow: flowOf(row.escrowPaymentId, flows),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

/**
 * Ends the pause on withdrawals that a dispute put on creators, for the admin who
 * has decided what to do about them. A lost dispute leaves its pause in place on
 * purpose, because what happens to a creator's balance after one is a decision;
 * this is how that decision is recorded. A creator another dispute still holds
 * stays paused. Returns how many were released, or null when the dispute is not
 * there; 0 when there was nothing to release.
 */
export async function releaseDisputeHolds(disputeId: string): Promise<number | null> {
  const row = await prisma.paymentDispute.findUnique({ where: { id: disputeId } });
  if (!row) return null;
  if (row.heldCreatorProfileIds.length === 0 || row.holdsReleasedAt) return 0;
  if (row.outcome === 'OPEN') {
    // Still open: Stripe has not decided, and the pause is what protects the
    // money until it does.
    return 0;
  }
  return releaseHoldsOf(row);
}
