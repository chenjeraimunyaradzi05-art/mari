import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { Prisma, type MentorPaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { getStripe } from '../utils/stripe';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { confirmGiftPurchaseFromPaymentIntent } from '../services/creator.service';
import {
  FORMATION_PAYMENT_TYPE,
  confirmFormationPaymentFromWebhook,
  recordFormationPaymentFailure,
  reconcileFormationRefund,
} from '../services/formation.service';
import {
  ACCELERATOR_PAYMENT_TYPE,
  PAID_TIERS,
  confirmAcceleratorEnrollmentPayment,
  recordAcceleratorPaymentFailure,
} from '../services/payments-orchestration.service';
import { getPriceIdForTier, tierForPriceId, type SubscriptionTierKey } from '../config/regions';
import { notifyAdmins } from '../services/admin-notify.service';
import { BILLING_STATUSES, pastDueGraceEndsAt } from '../utils/subscription-entitlement';
import { syncConnectedAccountFromStripe, minorUnitScale } from '../services/stripe-connect.service';
// Tax invoices: see the header of routes/invoice.routes.ts for who issues them.
import {
  createInvoiceForPayment,
  createInvoiceForSubscription,
  paidChargeFromStripeInvoice,
  type PaymentKind,
} from '../services/invoice.service';
import { applyRefundEffects, recordDisputeEvent } from '../services/payment-disputes.service';
import { prisma } from '../utils/prisma';
import { deliverEmail, sendEmail } from '../utils/email';
import { escapeHtml } from '../utils/escape-html';
import { recordFailure, recordIgnored, recordSuccess } from '../utils/ops-metrics';
import { GIFT_POINT_VALUE_AUD } from '../config/price-book';
import { isWomanGateMetadata } from '../middleware/account-gates';
import { noteDeclinedPayment } from '../middleware/moneyLimits';
import { noteLapsedOrderHold, recordCaptureDeadline, settleOrderRenewal } from '../services/escrow-renewal.service';
import { notifyMentorOfRequestById } from '../services/mentor-session-authorisation.service';
import { bestEffort } from '../utils/best-effort';
import { recordWomanGateDocumentCheck, redactIdentitySession } from '../services/identity-verification.service';
import {
  recordSuppressions,
  suppressionsFromEvents,
  verifySendGridSignature,
} from '../services/email-suppression.service';

const router = Router();

function paymentIntentIdOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

// The Stripe client is asked for per request, never held from module load, the
// same way invoice.routes.ts asks for it. getStripe() caches per key, but a
// client captured at import is whatever existed at import: on a deployment that
// boots before STRIPE_SECRET_KEY reaches the environment that is the
// placeholder - in production, a proxy that throws 503 on every use - and this
// module went on holding it for the life of the process, long after the real
// key arrived.
//
// Not gated on isStripeConfigured() the way the services are. Verifying the
// signature is pure cryptography over STRIPE_WEBHOOK_SECRET and needs no API
// key, so refusing the request for a missing key would reject events this
// endpoint can read perfectly well. A handler that does go on to call Stripe
// gets the 503 from the client itself.

// What creator.service.ts stamps on the transfer it creates for a payout, and
// the only way to tell one of those apart from the transfer every destination
// charge produces.
const CREATOR_PAYOUT_TRANSFER_TYPE = 'creator_payout';

// CreatorPayout.amount is in dollars while CreatorProfile.pendingPayout counts
// points, so a reversal has to convert back before it can restore her balance.
// What a point is worth comes from the price book, like everywhere else.
const AUD_PER_GIFT_POINT = GIFT_POINT_VALUE_AUD;

/**
 * The four tiers that can arrive on a Stripe checkout or subscription. They are
 * a subset of the SubscriptionTier enum — FREE and ENTERPRISE are never sold
 * through Stripe — and naming that subset is what lets the tier be written to
 * Prisma without casting it away.
 *
 * The price ids come from config/regions, the table checkout charges from, in
 * every currency it is sold in. This file kept its own copy of the four
 * Australian-dollar ids, so a subscription priced in any other currency could not
 * be placed on a tier, and a checkout in one was recorded against the
 * Australian-dollar price.
 */
type PaidTier = SubscriptionTierKey;

function isPaidTier(value: unknown): value is PaidTier {
  return typeof value === 'string' && (PAID_TIERS as readonly string[]).includes(value);
}

/**
 * Whether a subscription is one that Stripe is still billing: it has not ended,
 * and is not waiting on a first payment that may never come.
 */
function isBillingAtStripe(status: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

function mapStripeSubscriptionStatus(status: string): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    default:
      return 'CANCELED';
  }
}

/**
 * Writes what Stripe says about a membership that has just been bought: whether
 * it is a trial, the day its period (the trial, while it runs) ends, and what
 * it costs.
 *
 * checkout.session.completed grants the tier and says ACTIVE, and that is all it
 * knows. The billing page's trial notice, and the date and amount in it, read
 * `status`, `currentPeriodEnd` and `amount`, which only a customer.subscription
 * event used to write. A trial is created already running, so it may never be
 * followed by an update until it ends, and one that arrives first is overwritten
 * by the ACTIVE written here: a member in her trial was shown no trial, no end
 * date and no way to cancel before the charge. Asking Stripe for the
 * subscription itself puts the row right whichever event came first.
 *
 * Best effort. The tier has already been granted, which is the part that must
 * not wait on a second Stripe call, and a later subscription event writes the
 * same columns. Only a live membership is written: a subscription Stripe has
 * already cancelled is left to its own event rather than marked CANCELED under
 * a tier that was just granted.
 */
async function recordLiveSubscriptionState(userId: string, stripeSubscriptionId: string): Promise<void> {
  try {
    const live = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    if (live.status !== 'trialing' && live.status !== 'active' && live.status !== 'past_due') return;

    const price = live.items?.data?.[0]?.price;
    const billed =
      price && typeof price.unit_amount === 'number' && price.currency
        ? {
            amount: new Prisma.Decimal(price.unit_amount).div(minorUnitScale(price.currency)),
            currency: price.currency.toUpperCase(),
            interval: price.recurring?.interval ?? null,
          }
        : {};

    await prisma.subscription.update({
      where: { userId },
      data: {
        ...billed,
        status: mapStripeSubscriptionStatus(live.status),
        currentPeriodStart: live.current_period_start ? new Date(live.current_period_start * 1000) : null,
        currentPeriodEnd: live.current_period_end ? new Date(live.current_period_end * 1000) : null,
        cancelAtPeriodEnd: !!live.cancel_at_period_end,
      },
    });
  } catch (error) {
    logger.warn('Could not read the new subscription back from Stripe; its own events will fill the row in', {
      stripeSubscriptionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * A membership checkout that completed for a member who is already being billed
 * for another one.
 *
 * Checkout now refuses a second membership, but two checkouts opened in two tabs
 * before either was paid both go through, and a trial is granted to each because
 * neither had a subscription when it was made. Left alone the second one took the
 * row over (the member's tier and subscription id were written from it) and the
 * first went on billing her card with nothing of ours pointing at it.
 *
 * What is done depends on whether anything has been taken. A trial has charged
 * nothing, so the new one is simply cancelled and she keeps the membership she had.
 * One that has already been paid is not undone by this handler, because that is
 * money to give back and a person should look at it, so staff are told with both
 * ids. Either way the row is left on the membership it was on.
 *
 * Returns false when this is not a duplicate (she has no other live membership, the
 * one on her row has ended at Stripe, or it is the same subscription), and the
 * caller carries on as before. Asked of Stripe rather than read off the row: a row
 * can lag a cancellation, and ignoring a real membership because the row was stale
 * would leave her paid and on the free plan.
 */
async function settleDuplicateMembership(userId: string, newSubscriptionId: string): Promise<boolean> {
  const tracked = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });
  const trackedId = tracked?.stripeSubscriptionId;
  if (!tracked || !trackedId || trackedId === newSubscriptionId) return false;
  if (!(BILLING_STATUSES as readonly string[]).includes(tracked.status)) return false;

  let trackedBilling: boolean;
  try {
    trackedBilling = isBillingAtStripe((await getStripe().subscriptions.retrieve(trackedId)).status);
  } catch (error) {
    const code = (error as { code?: string; statusCode?: number })?.code;
    const statusCode = (error as { statusCode?: number })?.statusCode;
    // A subscription Stripe has no record of is not being billed. Anything else
    // is thrown, so Stripe sends the event again once it can be answered.
    if (code !== 'resource_missing' && statusCode !== 404) throw error;
    trackedBilling = false;
  }
  if (!trackedBilling) return false;

  const duplicate = await getStripe().subscriptions.retrieve(newSubscriptionId);
  // Already cancelled, by an earlier run of this same event that failed after it.
  if (duplicate.status === 'canceled') return true;

  if (duplicate.status === 'trialing') {
    await getStripe().subscriptions.cancel(newSubscriptionId);
    logger.warn('A second membership checkout completed for a member already being billed; the new trial was cancelled', {
      userId,
      keptSubscriptionId: trackedId,
      cancelledSubscriptionId: newSubscriptionId,
    });
    return true;
  }

  logger.error('A second membership was paid for by a member already being billed', {
    userId,
    keptSubscriptionId: trackedId,
    duplicateSubscriptionId: newSubscriptionId,
  });
  await notifyAdmins({
    title: 'A member is being billed for two memberships',
    message: `A member paid for a second ATHENA membership while the first was still running. Her record has been left on the first (${trackedId}). The second (${newSubscriptionId}) has taken a payment and is still billing: cancel it in Stripe and refund what it took.`,
    link: '/admin/subscriptions',
    data: { kind: 'DUPLICATE_MEMBERSHIP', userId, keptSubscriptionId: trackedId, duplicateSubscriptionId: newSubscriptionId },
  });
  return true;
}

/**
 * Who paid, what for, and which of our rows it belongs to.
 *
 * Every one-off charge already carries its identifiers in the intent's
 * metadata, because each flow needs them to find its own record on the way
 * back. Reading them in one place is what makes a single Payment row possible
 * for every sale, which is what the invoice pipeline needs: until this
 * existed, nothing anywhere called prisma.payment.create, so the Payment
 * table was permanently empty, every invoice hook found nothing, and the
 * admin re-issue route could only answer "Payment not found".
 *
 * Mentor sessions are the trap: their metadata names the buyer `menteeId`,
 * not `userId`, and taking `userId` from them would have written the payment
 * against nobody.
 */
type PaymentAttribution = { userId: string; type: PaymentKind; referenceId: string | null };

function metadataString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Who was paying for an intent, by whichever key its flow wrote: userId for a
 * gift, a formation fee or an accelerator place, menteeId for a mentor session,
 * buyerId for an escrow hold.
 */
function payerOf(paymentIntent: Stripe.PaymentIntent): string | null {
  const metadata = (paymentIntent.metadata ?? {}) as Record<string, unknown>;
  return metadataString(metadata.userId) ?? metadataString(metadata.menteeId) ?? metadataString(metadata.buyerId);
}

function attributionFor(paymentIntent: Stripe.PaymentIntent): PaymentAttribution | null {
  const metadata = (paymentIntent.metadata ?? {}) as Record<string, unknown>;
  const userId = metadataString(metadata.userId);

  switch (metadataString(metadata.type)) {
    case 'gift_balance_purchase':
      return userId ? { userId, type: 'GIFT_BALANCE', referenceId: null } : null;
    case 'mentor_session': {
      const menteeId = metadataString(metadata.menteeId);
      return menteeId ? { userId: menteeId, type: 'MENTOR_SESSION', referenceId: metadataString(metadata.sessionId) } : null;
    }
    case FORMATION_PAYMENT_TYPE:
      return userId ? { userId, type: 'FORMATION', referenceId: metadataString(metadata.registrationId) } : null;
    case ACCELERATOR_PAYMENT_TYPE:
      return userId ? { userId, type: 'ACCELERATOR', referenceId: metadataString(metadata.enrollmentId) } : null;
    default:
      return null;
  }
}

/**
 * Record the money. One upsert keyed on the intent id, so a Stripe retry or a
 * late browser confirmation lands on the same row rather than a second one.
 *
 * Marketplace escrow is deliberately absent: those intents carry buyerId and
 * sellerId rather than a `type`, the funds are the provider's with ATHENA
 * keeping a fee, and a Payment row for the whole amount would say ATHENA sold
 * something it did not. They stay on EscrowPayment, which is the record of
 * what actually happened.
 */
async function recordPaymentForIntent(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const attribution = attributionFor(paymentIntent);
  if (!attribution) return;

  const amount = (paymentIntent.amount_received || paymentIntent.amount) / 100;
  const currency = paymentIntent.currency.toUpperCase();
  const method = paymentIntent.payment_method_types?.[0] ?? null;
  const stripeChargeId = paymentIntentIdOf(paymentIntent.latest_charge as any);

  try {
    await prisma.payment.upsert({
      where: { stripePaymentIntentId: paymentIntent.id },
      create: {
        userId: attribution.userId,
        amount,
        currency,
        status: 'COMPLETED',
        method,
        type: attribution.type,
        referenceId: attribution.referenceId,
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId,
      },
      update: {
        status: 'COMPLETED',
        amount,
        currency,
        stripeChargeId: stripeChargeId ?? undefined,
      },
    });
  } catch (err: any) {
    // A missing user is the one failure a retry cannot mend - she has been
    // erased since she paid - and throwing would make Stripe redeliver this
    // event for days. Counted and logged so it is visible on /health/detailed
    // instead of disappearing; everything else is thrown, because a Payment
    // row is the record of money received and losing one quietly is worse
    // than a retry.
    if (err?.code === 'P2003' || err?.code === 'P2025') {
      recordFailure('stripe_webhook.payment_row_orphaned', err);
      logger.error('A succeeded payment belongs to a user who no longer exists', {
        paymentIntentId: paymentIntent.id,
        userId: attribution.userId,
        type: attribution.type,
      });
      return;
    }
    throw err;
  }
}

/**
 * Moves a mentoring session's payment status, but only for the intent that
 * really belongs to that session.
 *
 * The three mentor_session branches below used to act on whatever session id the
 * intent's metadata named: `update` by id, overwriting the session's stored
 * intent id and marking it CAPTURED. Metadata is a note we wrote when the intent
 * was created, and anything that could get an intent created with chosen
 * metadata could mark any other member's session paid, or replace the intent a
 * real session was waiting on. The session is now matched on the mentee the
 * metadata names as well as its id, and only while it holds no intent yet or
 * already holds this one, so an intent can neither take another member's session
 * nor displace another intent. A write that matches nothing is counted as a
 * failure, because a mentoring payment that fits no session is either a bug or
 * somebody trying it.
 */
async function applyMentorSessionPayment(
  paymentIntent: Stripe.PaymentIntent,
  data: Prisma.MentorSessionUpdateManyMutationInput,
  movableFrom: readonly MentorPaymentStatus[]
): Promise<boolean> {
  const metadata = (paymentIntent.metadata ?? {}) as Record<string, unknown>;
  const sessionId = metadataString(metadata.sessionId);
  const menteeId = metadataString(metadata.menteeId);
  const ownSession: Prisma.MentorSessionWhereInput = {
    id: sessionId ?? undefined,
    menteeId: menteeId ?? undefined,
    OR: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: paymentIntent.id }],
  };

  // Only from the statuses this event may move a payment out of. Stripe does not
  // deliver events in the order they happened, and a payment has a direction: an
  // authorisation that arrives after the capture it led to must not write
  // AUTHORIZED over CAPTURED, a decline from an earlier attempt must not undo a
  // later card that went through, and a refunded or cancelled payment is over.
  const moved =
    sessionId && menteeId
      ? await prisma.mentorSession.updateMany({
          where: { ...ownSession, paymentStatus: { in: [...movableFrom] } },
          data: { ...data, stripePaymentIntentId: paymentIntent.id },
        })
      : { count: 0 };

  if (moved.count === 0 && sessionId && menteeId) {
    // The session is this member's and the intent is its own, so the event is
    // not for somebody else's session: it describes a step the payment has
    // already moved past, which is the guard above doing its job.
    const alreadyPast = await prisma.mentorSession.findFirst({ where: ownSession, select: { id: true } });
    if (alreadyPast) {
      logger.info('A mentoring payment event arrived after the payment had moved past it, and was not applied', {
        paymentIntentId: paymentIntent.id,
        sessionId,
      });
      return false;
    }
  }

  if (moved.count === 0) {
    recordFailure(
      'stripe_webhook.mentor_session_unmatched',
      new Error(`Payment intent ${paymentIntent.id} names mentor session ${sessionId ?? '(none)'} and it is not that session's payment`)
    );
    logger.error('A mentoring payment does not fit the session it names and was not applied', {
      paymentIntentId: paymentIntent.id,
      sessionId,
      menteeId,
    });
    return false;
  }

  return true;
}

/**
 * Invoice hook for one-off payments. The Payment row written just above is
 * marked COMPLETED and gets an ATHENA document, once (the service is
 * idempotent on paymentId). Best effort on purpose: the payment itself has
 * already been applied by the handler above, and a failed filing can be
 * re-issued from the admin subscriptions page, so an error here is logged
 * rather than handed back to Stripe as a retry that would re-run the whole
 * event.
 */
async function issueInvoiceForPaymentIntent(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: { id: true, status: true },
    });
    if (!payment) return;
    if (payment.status !== 'COMPLETED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });
    }
    await createInvoiceForPayment(payment.id);
  } catch (err: any) {
    // Swallowed on purpose (see above), which is exactly the kind of failure
    // that used to leave no trace outside the log. Counted so an operator can
    // see unissued invoices piling up on /health/detailed.
    recordFailure('stripe_webhook.invoice_for_payment_intent', err);
    logger.error('Invoice for a succeeded payment intent could not be filed', {
      paymentIntentId: paymentIntent.id,
      message: err?.message,
    });
  }
}

// How long a claim on an event stands before it is taken to belong to a process
// that died. A handler here is a handful of database writes and at most a few
// Stripe calls, so five minutes is far longer than a live one runs, and short
// enough that Stripe's retry, which comes within the hour, finds it stale.
const STALE_CLAIM_MS = 5 * 60 * 1000;

type EventClaim = 'owned' | 'done' | 'in_progress';

/**
 * The Stripe object an event is about, where later events about the same object
 * have to be told apart from earlier ones: a subscription, for its own events.
 */
function subjectOf(event: Stripe.Event): string | null {
  if (!event.type.startsWith('customer.subscription.')) return null;
  const id = (event.data?.object as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' && id ? id : null;
}

/**
 * Takes up an event so that it is worked on once, and so that it is worked on
 * to the end.
 *
 * The id is the primary key, so only one delivery can write the row. That used
 * to be all there was: the row was written before the handler ran and was never
 * marked finished, so a process that died between the two (a deploy, an
 * out-of-memory kill) left an event that Stripe's retry would be told was a
 * duplicate and would never be run again, with the member's money taken and
 * nothing applied. Now the row also says when the handler finished
 * (`completedAt`), and:
 *
 *   owned        this delivery holds the claim and runs the handler
 *   done         the event was handled; this delivery is a replay
 *   in_progress  another delivery holds a fresh claim and may still be working
 *
 * A row with no `completedAt` whose claim is older than STALE_CLAIM_MS belongs
 * to a process that died, and is taken over with a conditional update so that
 * two retries cannot both take it. Every handler below is safe to run twice,
 * which is what makes taking over a half-done event safe.
 */
async function claimStripeEvent(event: Stripe.Event): Promise<EventClaim> {
  const data = {
    id: event.id,
    type: event.type,
    subjectId: subjectOf(event),
    eventCreatedAt: Number.isFinite(event.created) ? new Date(event.created * 1000) : null,
  };

  // Twice at most: the row can be released (a failed handler lets go of its
  // claim) between our insert being refused and our reading it back.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await prisma.stripeWebhookEvent.create({ data });
      return 'owned';
    } catch (err: any) {
      // Anything but a unique violation is a real fault, and Stripe retries it.
      if (err?.code !== 'P2002') throw err;
    }

    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
      select: { completedAt: true, claimedAt: true },
    });
    if (!existing) continue;
    if (existing.completedAt) return 'done';
    if (Date.now() - existing.claimedAt.getTime() < STALE_CLAIM_MS) return 'in_progress';

    const takenOver = await prisma.stripeWebhookEvent.updateMany({
      where: { id: event.id, completedAt: null, claimedAt: existing.claimedAt },
      data: { claimedAt: new Date() },
    });
    if (takenOver.count > 0) {
      logger.warn('Taking over a Stripe event whose handler never finished', { eventId: event.id, type: event.type });
      recordIgnored('stripe_webhook.stale_claim_taken_over');
      return 'owned';
    }
    return 'in_progress';
  }
  return 'in_progress';
}

/**
 * Says the handler finished. Not allowed to fail the request: the work is done,
 * and a claim left without its completion time only means the event is run once
 * more if Stripe sends it again after the claim has gone stale, which is safe.
 */
async function markEventHandled(eventId: string): Promise<void> {
  try {
    await prisma.stripeWebhookEvent.updateMany({ where: { id: eventId }, data: { completedAt: new Date() } });
  } catch (error) {
    recordIgnored('stripe_webhook.completion_not_recorded');
    logger.warn('A Stripe event was handled but could not be marked complete', {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Whether a subscription event has been overtaken by a newer one that is
 * already applied.
 *
 * Stripe delivers events at least once and in no promised order, and a
 * customer.subscription.updated carries a snapshot of the subscription as it was
 * when the event was made. Applying a snapshot that arrives after a newer one
 * put the tier and status back to where they used to be: a member who had
 * upgraded was dropped to her old plan, or one whose subscription had ended was
 * given it back. The events of the same subscription are compared by the time
 * Stripe made them. A subscription that has been deleted cannot come back, so
 * an update that arrives after its deletion is stale even when both fall in the
 * same second.
 */
async function supersededBySubscriptionEvent(event: Stripe.Event, subscriptionId: string): Promise<boolean> {
  if (!Number.isFinite(event.created)) return false;
  const made = new Date(event.created * 1000);
  const newer: Prisma.StripeWebhookEventWhereInput[] = [{ eventCreatedAt: { gt: made } }];
  if (event.type === 'customer.subscription.updated') {
    newer.push({ type: 'customer.subscription.deleted', eventCreatedAt: { gte: made } });
  }
  const found = await prisma.stripeWebhookEvent.findFirst({
    where: {
      id: { not: event.id },
      subjectId: subscriptionId,
      completedAt: { not: null },
      type: { in: ['customer.subscription.updated', 'customer.subscription.deleted'] },
      OR: newer,
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * POST /api/webhooks/stripe
 * Stripe webhooks require the raw request body for signature verification.
 */
// validated: the body is the raw Stripe payload (express.raw); constructEvent verifies its
//   signature against the webhook secret before any of it is read.
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new ApiError(500, 'Stripe webhook secret not configured');
      }

      // Stripe delivers events about connected accounts — a mentor's account
      // being verified, her bank payout arriving or bouncing — only to a Connect
      // endpoint, which Stripe signs with a secret of its own. With one secret
      // this route could only ever hear the platform's events, so the
      // account.updated handler below never fired for anybody and a withdrawal
      // that bounced was never mentioned to the woman whose money it was. Both
      // endpoints can point at this same URL; each event is verified against
      // whichever secret signed it.
      const connectWebhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || null;

      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string' || signature.length === 0) {
        throw new ApiError(400, 'Missing Stripe signature');
      }

      // Reached for outside the try on purpose. In production without
      // STRIPE_SECRET_KEY getStripe() hands back a proxy that throws
      // ApiError(503) on the first property access, so asking for .webhooks
      // inside the try meant a deployment with no Stripe key at all was caught
      // below and reported as an invalid signature - a total payments outage
      // wearing the costume of a stranger posting junk, and counted as one.
      const stripeWebhooks = getStripe().webhooks;

      let event: Stripe.Event;
      try {
        // req.body is a Buffer because of express.raw.
        try {
          event = stripeWebhooks.constructEvent(req.body as any, signature, webhookSecret);
        } catch (platformError) {
          if (!connectWebhookSecret) throw platformError;
          event = stripeWebhooks.constructEvent(req.body as any, signature, connectWebhookSecret);
        }
      } catch (err: any) {
        // Counted as ignored, not as a failure. A post whose signature does not
        // verify is a stranger being turned away before any identity check, on a
        // public endpoint that is exempt from the global rate limiter (see the
        // limiter's skip in index.ts). While this was a recordFailure() anyone on
        // the internet could push twenty of them to evict every real payment
        // failure from the ring buffer and hold /health/detailed at "degraded"
        // for as long as they kept posting. recordIgnored is a plain counter, so
        // it can do neither - and the case worth catching, a stale
        // STRIPE_WEBHOOK_SECRET after a redeploy that silently drops every
        // payment event, still shows up as this number climbing.
        recordIgnored('stripe_webhook.bad_signature');
        logger.warn('Stripe webhook signature verification failed', {
          message: err?.message,
        });
        throw new ApiError(400, 'Invalid Stripe signature');
      }

      // Idempotency: claim the event id, and finish the claim when the work is
      // done. See claimStripeEvent for what each answer means.
      const claim = await claimStripeEvent(event);
      if (claim === 'done') {
        return res.json({ received: true, duplicate: true });
      }
      if (claim === 'in_progress') {
        // Another delivery of this event is being worked on right now. Answered
        // with a failure rather than as a duplicate, because a duplicate is never
        // sent again: if that other delivery dies, this answer is what makes
        // Stripe try once more, and the retry finds either the finished event or
        // a claim that has gone stale and is taken over.
        recordIgnored('stripe_webhook.in_flight');
        return res.status(409).json({ received: false, inProgress: true });
      }

      // Set by the default branch below, and read after the switch. Reaching the
      // end of the switch used to be counted as a success whatever happened,
      // which meant every event type nothing here handles - and Stripe sends a
      // great many - was recorded as successful money-path work and inflated the
      // success rate on the one report where it has to be true.
      //
      // Three outcomes, not two: the early `break`s inside handled cases also
      // reach the end of the switch, so a checkout we looked at and could not
      // act on was being counted alongside one that worked.
      let outcome: 'handled' | 'ignored' | 'failed' = 'handled';
      let failureReason: string | null = null;
      // Who a declined payment is to be counted against; see payment_failed below.
      let declinedPayer: string | null = null;

      // Handle the event
      try {
        switch (event.type) {
          case 'payment_intent.amount_capturable_updated': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const type = (paymentIntent.metadata as any)?.type;

            if (type === 'mentor_session') {
              // From PENDING, or FAILED when an earlier card was declined and
              // another went through. Never from CAPTURED: an authorisation that
              // arrives after the capture it led to is old news.
              const authorised = await applyMentorSessionPayment(
                paymentIntent,
                { paymentStatus: 'AUTHORIZED', paymentAuthorizedAt: new Date() },
                ['PENDING', 'FAILED']
              );

              // The mentor is told of a paid request now, when the mentee's card
              // is really held, and not when the intent was created: before this
              // she was told about requests nobody had paid for, and could accept
              // one. Only when this event is the one that moved the payment, so a
              // redelivery, or a catch-up that already told her, sends nothing.
              // Best effort: the payment status above is the part that must not
              // be lost, and the request is on her sessions list either way.
              const requestedSessionId = metadataString((paymentIntent.metadata as Record<string, unknown> | null)?.sessionId);
              if (authorised && requestedSessionId) {
                await bestEffort('notification.mentor-request', () => notifyMentorOfRequestById(requestedSessionId));
              }
            }

            // Escrow holds (marketplace orders) move to AUTHORIZED, and the
            // provider hears that a paid order is waiting for them.
            //
            // FAILED as well as PENDING: a declined card marks the row FAILED
            // on payment_intent.payment_failed, and the buyer can try another
            // card on the same intent. When that one authorises, the row used
            // to stay FAILED — so the money was held on her card while every
            // screen said the payment had failed and nothing would release it.
            const held = await prisma.escrowPayment.updateMany({
              where: { paymentIntentId: paymentIntent.id, status: { in: ['PENDING', 'FAILED'] } },
              data: { status: 'AUTHORIZED' },
            });
            const heldSessionType = (paymentIntent.metadata as any)?.sessionType;
            if (held.count > 0 && heldSessionType === 'service_order') {
              const order = await prisma.serviceOrder.findFirst({
                where: { escrow: { paymentIntentId: paymentIntent.id } },
                select: { id: true, packageName: true, service: { select: { title: true, providerId: true } } },
              });
              if (order) {
                await prisma.notification.create({
                  data: {
                    userId: order.service.providerId,
                    type: 'SYSTEM',
                    title: 'New order',
                    message: `${order.packageName ? `${order.packageName} · ` : ''}${order.service.title}: payment is held. Accept to start the clock.`,
                    link: `/skills-marketplace/orders/${order.id}`,
                  },
                });
              }
            }
            // An hour booked on a listing, and a proposal the buyer accepted: the
            // provider is told once the money is really held, which is the point
            // at which confirming the time, or starting the work, is safe.
            if (held.count > 0 && heldSessionType === 'service_booking') {
              const booking = await prisma.serviceBooking.findFirst({
                where: { escrow: { paymentIntentId: paymentIntent.id } },
                select: { id: true, scheduledAt: true, service: { select: { title: true, providerId: true } } },
              });
              if (booking) {
                await prisma.notification.create({
                  data: {
                    userId: booking.service.providerId,
                    type: 'SYSTEM',
                    title: 'New booking',
                    message: `${booking.service.title}: payment is held for ${booking.scheduledAt.toLocaleString('en-AU', {
                      timeZone: 'Australia/Brisbane',
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}. Confirm the time to accept it.`,
                    link: '/skills-marketplace/bookings',
                  },
                });
              }
            }
            if (held.count > 0 && heldSessionType === 'custom_request') {
              const proposal = await prisma.serviceProposal.findFirst({
                where: { escrow: { paymentIntentId: paymentIntent.id } },
                select: { providerId: true, request: { select: { title: true } } },
              });
              if (proposal) {
                await prisma.notification.create({
                  data: {
                    userId: proposal.providerId,
                    type: 'SYSTEM',
                    title: 'Your proposal was accepted',
                    message: `${proposal.request.title}: the buyer has accepted your proposal and the payment is held. You can start.`,
                    link: '/skills-marketplace',
                  },
                });
              }
            }

            // When Stripe says this authorisation runs out, and, if this hold is
            // the buyer renewing an order's earlier one, the move of the order
            // onto it. Both are safe to repeat, so a retry after a failure here
            // is harmless, and the second one is thrown on a database error so
            // that the retry happens: an order left on a hold that is about to
            // lapse, while the new one sits unused, is the very thing it fixes.
            await recordCaptureDeadline(paymentIntent);
            await settleOrderRenewal(paymentIntent);
            break;
          }
          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const type = (paymentIntent.metadata as any)?.type;
            const userId = (paymentIntent.metadata as any)?.userId;

            if (type === 'gift_balance_purchase' && typeof userId === 'string' && userId.length > 0) {
              try {
                await confirmGiftPurchaseFromPaymentIntent(userId, paymentIntent);
              } catch (giftError) {
                // A payment whose points do not match what was paid, or that was
                // not made in Australian dollars, is refused by the service with
                // a 4xx. That is the same answer on every delivery, so handing it
                // back to Stripe would only make it retry for three days. It is
                // counted as a failure, which is what puts it in front of a
                // person: money was taken and no points were added. The Payment
                // row below still records what was received, so it can be found
                // and refunded. Anything else, a database error for one, is
                // thrown so that the retry can fix it.
                if (giftError instanceof ApiError && giftError.statusCode < 500) {
                  recordFailure('stripe_webhook.gift_purchase_refused', giftError);
                } else {
                  throw giftError;
                }
              }
            }

            if (type === 'mentor_session') {
              // Money received. Refunded and cancelled are the end of a payment
              // and a late success event does not reopen it.
              await applyMentorSessionPayment(
                paymentIntent,
                { paymentStatus: 'CAPTURED', paymentCapturedAt: new Date() },
                ['PENDING', 'AUTHORIZED', 'FAILED']
              );
            }

            if (type === FORMATION_PAYMENT_TYPE) {
              await confirmFormationPaymentFromWebhook(paymentIntent);
            }

            if (type === ACCELERATOR_PAYMENT_TYPE) {
              const accelerator = await confirmAcceleratorEnrollmentPayment(paymentIntent);
              // A refusal is the same answer on every delivery, so it is not
              // thrown back to Stripe, but it is counted: money was taken and no
              // place was marked paid, which a person has to look at.
              if (accelerator.status !== 'confirmed' && accelerator.status !== 'already_processed') {
                recordFailure(
                  'stripe_webhook.accelerator_payment_refused',
                  new Error(`Accelerator payment ${paymentIntent.id} was not applied: ${accelerator.status}`)
                );
              }
            }

            // A manual-capture intent succeeding is an escrow hold being
            // captured. captureEscrowPayment writes the row itself when it is
            // the one capturing, but a hold captured any other way — from the
            // Stripe dashboard by an admin rescuing it before it lapsed, or by a
            // capture whose row write failed — left the row saying the money
            // was still held: the seller's earnings screen showed it pending,
            // the statement left it out, and the expiry sweep went on warning
            // about money that had already moved. Only rows still held are
            // moved, so a row a flow has already settled is left as it is.
            if (paymentIntent.capture_method === 'manual') {
              await prisma.escrowPayment.updateMany({
                where: { paymentIntentId: paymentIntent.id, status: { in: ['PENDING', 'AUTHORIZED', 'FAILED'] } },
                data: { status: 'CAPTURED', capturedAt: new Date(event.created * 1000) },
              });
            }

            // The money itself, on the Payment table, after each flow has
            // applied what the member bought. Then her document.
            await recordPaymentForIntent(paymentIntent);
            await issueInvoiceForPaymentIntent(paymentIntent);
            break;
          }

          case 'payment_intent.payment_failed':
          case 'payment_intent.canceled': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;

            // An escrow hold that never authorised, or was cancelled at Stripe.
            // A decline only means something for a hold that has not authorised:
            // the buyer can try another card on the same intent, and a decline
            // event from the first card that arrives after the second one went
            // through must not mark a live hold FAILED.
            await prisma.escrowPayment.updateMany({
              where: {
                paymentIntentId: paymentIntent.id,
                status: { in: event.type === 'payment_intent.canceled' ? ['PENDING', 'AUTHORIZED', 'FAILED'] : ['PENDING'] },
              },
              data:
                event.type === 'payment_intent.canceled'
                  ? { status: 'CANCELED', canceledAt: new Date() }
                  : { status: 'FAILED' },
            });
            const type = (paymentIntent.metadata as any)?.type;

            // A hold that ran out under an order still being worked on: the buyer
            // is asked to renew it and the provider to wait. Never fails the event.
            if (event.type === 'payment_intent.canceled') {
              await noteLapsedOrderHold(paymentIntent);
            }

            // A declined payment counts against the member who was paying, so a
            // run of declines (card testing) pauses new payments for a while.
            // See middleware/moneyLimits.ts. Remembered here and counted once the
            // event has been handled, below: this event is run again whenever a
            // later step fails and Stripe retries it, and counting here would
            // count the same decline once per retry.
            if (event.type === 'payment_intent.payment_failed') {
              declinedPayer = payerOf(paymentIntent);
            }

            if (type === 'mentor_session') {
              await applyMentorSessionPayment(
                paymentIntent,
                event.type === 'payment_intent.canceled'
                  ? { paymentStatus: 'CANCELED', paymentCanceledAt: new Date() }
                  : { paymentStatus: 'FAILED', paymentFailedAt: new Date() },
                // A payment that has gone through is not undone by a failure
                // reported late; a cancellation ends one that is only held.
                event.type === 'payment_intent.canceled' ? ['PENDING', 'AUTHORIZED', 'FAILED'] : ['PENDING']
              );
            }

            if (type === FORMATION_PAYMENT_TYPE) {
              await recordFormationPaymentFailure(
                paymentIntent,
                event.type === 'payment_intent.canceled' ? 'canceled' : 'failed'
              );
            }

            if (type === ACCELERATOR_PAYMENT_TYPE) {
              await recordAcceleratorPaymentFailure(paymentIntent);
            }
            break;
          }

          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.mode !== 'subscription') {
              // A one-off payment checkout, not the membership flow this case is
              // for. Nothing to do, and nothing went wrong.
              outcome = 'ignored';
              break;
            }

            const userId = session.metadata?.userId;
            const tier = session.metadata?.tier;
            const currency = session.metadata?.currency || null;
            const customerId = typeof session.customer === 'string' ? session.customer : null;
            const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

            if (!userId || !tier) {
              // Stripe says a membership checkout completed and our own metadata
              // cannot say whose. Somebody has paid and will not be given what
              // she paid for, which is the loudest thing this counter exists to
              // surface - it must never read as success.
              outcome = 'failed';
              failureReason = `Subscription checkout ${session.id} completed without userId/tier metadata`;
              break;
            }

            // tier arrives as a plain metadata string. Subscription.tier is the
            // SubscriptionTier enum, and the cast that used to be here meant an
            // unrecognised value reached Prisma and blew up deep inside the
            // client. Checkout only ever writes one of these four, so anything
            // else is a bug on our side: thrown rather than skipped, because
            // skipping would quietly leave a member who has paid on the free
            // plan, and throwing makes Stripe retry and show the failure.
            if (!isPaidTier(tier)) {
              throw new Error(`Checkout session ${session.id} carries an unknown tier "${tier}"`);
            }

            // A second membership for a member already being billed for one is
            // not allowed to take her row over; see the helper.
            if (stripeSubscriptionId && (await settleDuplicateMembership(userId, stripeSubscriptionId))) {
              break;
            }

            // The price this checkout charged, which is the one for the currency
            // it was made in. It used to be the Australian-dollar price whatever
            // the currency was.
            const chargedPriceId = getPriceIdForTier(tier, currency || 'AUD');

            await prisma.subscription.upsert({
              where: { userId },
              create: {
                user: { connect: { id: userId } },
                tier,
                status: 'ACTIVE',
                stripeCustomerId: customerId,
                stripeSubscriptionId,
                stripePriceId: chargedPriceId || null,
                currency: currency || undefined,
              },
              update: {
                tier,
                status: 'ACTIVE',
                stripeCustomerId: customerId || undefined,
                stripeSubscriptionId,
                stripePriceId: chargedPriceId || null,
                currency: currency || undefined,
              },
            });

            // Whether it is a trial, and when it ends: see the helper.
            if (stripeSubscriptionId) {
              await recordLiveSubscriptionState(userId, stripeSubscriptionId);
            }
            break;
          }

          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
            const stripeSubscriptionId = subscription.id;

            // An event that arrives after a newer one for the same subscription
            // has been applied describes a state that has since changed.
            if (await supersededBySubscriptionEvent(event, stripeSubscriptionId)) {
              logger.info('A subscription event arrived after a newer one for the same subscription and was not applied', {
                eventId: event.id,
                type: event.type,
                stripeSubscriptionId,
              });
              outcome = 'ignored';
              break;
            }

            const priceId =
              subscription.items?.data?.[0]?.price?.id ||
              (subscription.items as any)?.data?.[0]?.plan?.id ||
              null;

            // Built up rather than filtered, because .filter(Boolean) does not
            // narrow away the undefined and that is what the cast here was
            // hiding. Same two branches as before, in the same order.
            const matchers: Prisma.SubscriptionWhereInput[] = [];
            if (customerId) matchers.push({ stripeCustomerId: customerId });
            matchers.push({ stripeSubscriptionId });

            const dbSubscription = await prisma.subscription.findFirst({
              where: { OR: matchers },
            });

            if (!dbSubscription) {
              // A subscription we hold no row for. Legitimate for anything created
              // outside ATHENA, so not a failure - but not work done either.
              outcome = 'ignored';
              break;
            }

            // The row is found by customer as well as by subscription, so an event
            // about another subscription of the same customer reaches it. While the
            // row is on a membership that is still being billed, that is not its
            // event: a deleted one for a membership that has been replaced, or for
            // the second trial this file cancels as a duplicate, would otherwise
            // send a member who is paid up back to the free plan.
            if (
              dbSubscription.stripeSubscriptionId &&
              dbSubscription.stripeSubscriptionId !== stripeSubscriptionId &&
              (BILLING_STATUSES as readonly string[]).includes(dbSubscription.status)
            ) {
              logger.info('A subscription event for another subscription of the same customer was not applied to a membership still being billed', {
                eventId: event.id,
                type: event.type,
                stripeSubscriptionId,
                keptSubscriptionId: dbSubscription.stripeSubscriptionId,
              });
              outcome = 'ignored';
              break;
            }

            if (event.type === 'customer.subscription.deleted') {
              await prisma.subscription.update({
                where: { id: dbSubscription.id },
                data: {
                  tier: 'FREE',
                  status: 'CANCELED',
                  stripeSubscriptionId: null,
                  stripePriceId: null,
                  cancelAtPeriodEnd: false,
                  currentPeriodStart: null,
                  currentPeriodEnd: null,
                },
              });
              break;
            }

            // The tier the price sells, in whichever currency it is priced.
            const inferredTier = tierForPriceId(priceId);

            // What she is actually paying, from the price on the subscription
            // itself. Nothing wrote these columns before, so the billing page
            // had no amount to show and filled the gap with an invented A$29.
            // Written only when Stripe gave a fixed amount; a price without one
            // leaves the last known figure rather than blanking it.
            const price = subscription.items?.data?.[0]?.price;
            const billed =
              price && typeof price.unit_amount === 'number' && price.currency
                ? {
                    amount: new Prisma.Decimal(price.unit_amount).div(minorUnitScale(price.currency)),
                    currency: price.currency.toUpperCase(),
                    interval: price.recurring?.interval ?? null,
                  }
                : {};

            await prisma.subscription.update({
              where: { id: dbSubscription.id },
              data: {
                stripeCustomerId: customerId || undefined,
                stripeSubscriptionId,
                stripePriceId: priceId,
                ...billed,
                ...(inferredTier ? { tier: inferredTier } : {}),
                status: mapStripeSubscriptionStatus(subscription.status),
                currentPeriodStart: subscription.current_period_start
                  ? new Date(subscription.current_period_start * 1000)
                  : null,
                currentPeriodEnd: subscription.current_period_end
                  ? new Date(subscription.current_period_end * 1000)
                  : null,
                cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
              },
            });
            break;
          }

          // Money going back, or being fought over. Refunds mark what they
          // refund; disputes wake up trust and safety; a failed renewal tells
          // the member how to fix it instead of silently lapsing.
          // Stripe Identity finished a document check. Two different badges wait
          // on one, and metadata.purpose is all that tells them apart.
          //
          // The ordinary identity badge: passed, and the badge is approved and
          // the profile marked verified. Needs input: the member is told why and
          // can go again.
          //
          // The women-only gate: a document proves who she is and how old she
          // is, not that she is a woman, so a passed check is recorded as
          // evidence and the request stays with the reviewer. This used to fall
          // through to the branch above, which approved the badge, set the
          // Verified mark with no person involved, and never wrote the evidence
          // the reviewer's queue reads - so the reviewer then had nothing to
          // approve and the member was stuck.
          case 'identity.verification_session.verified':
          case 'identity.verification_session.requires_input': {
            const session = event.data.object as Stripe.Identity.VerificationSession;
            const badge = await prisma.verificationBadge.findFirst({
              where: { type: 'IDENTITY', metadata: { path: ['sessionId'], equals: session.id } },
              select: { id: true, userId: true, status: true, metadata: true },
            });
            if (!badge) {
              logger.warn('Identity session with no badge behind it', { sessionId: session.id });
              outcome = 'ignored';
              break;
            }

            if (isWomanGateMetadata(badge.metadata)) {
              // A reviewer's decision is not rewritten by a late event.
              if (badge.status !== 'PENDING') {
                outcome = 'ignored';
                break;
              }
              if (event.type === 'identity.verification_session.verified') {
                const check = await recordWomanGateDocumentCheck(badge.userId, badge, session.id);
                if (check.outcome === 'not_ready') {
                  // The event says verified and Stripe's own record now says
                  // otherwise. Failing the handler lets Stripe deliver it again
                  // rather than leaving a passed check unrecorded.
                  throw new Error(`Identity session ${session.id} was reported verified but reads ${check.documentCheck}`);
                }
              } else {
                const reason = session.last_error?.reason ?? 'The check could not be completed.';
                await prisma.$transaction([
                  prisma.verificationBadge.update({ where: { id: badge.id }, data: { reason } }),
                  prisma.notification.create({
                    data: {
                      userId: badge.userId,
                      type: 'SYSTEM',
                      title: 'Your document check needs another go',
                      message: `${reason} You can try again from Settings.`,
                      link: '/dashboard/settings/profile',
                    },
                  }),
                ]);
              }
              break;
            }

            // A reviewer's decision is not rewritten by a late event here
            // either. A badge a person rejected while the member was still on
            // Stripe's page would otherwise be approved, and the Verified mark
            // set, by the check finishing afterwards. She can start again: a
            // new check makes a new badge.
            if (badge.status === 'REJECTED') {
              outcome = 'ignored';
              break;
            }

            if (event.type === 'identity.verification_session.verified') {
              if (badge.status !== 'APPROVED') {
                await prisma.$transaction([
                  prisma.verificationBadge.update({
                    where: { id: badge.id },
                    data: { status: 'APPROVED', reviewedAt: new Date(), reason: 'Verified by Stripe Identity' },
                  }),
                  prisma.user.update({ where: { id: badge.userId }, data: { isVerified: true } }),
                  prisma.notification.create({
                    data: {
                      userId: badge.userId,
                      type: 'SYSTEM',
                      title: 'Identity verified',
                      message: 'Your identity check passed. The verified badge is on your profile.',
                      link: '/dashboard/settings/verification',
                    },
                  }),
                ]);
                // The decision is made, so the document and selfie have done
                // their job. Never fails the event; the retention sweep asks
                // again for any session this could not redact.
                await redactIdentitySession(badge);
              }
            } else {
              const reason = session.last_error?.reason ?? 'The check could not be completed.';
              await prisma.$transaction([
                prisma.verificationBadge.update({ where: { id: badge.id }, data: { reason } }),
                prisma.notification.create({
                  data: {
                    userId: badge.userId,
                    type: 'SYSTEM',
                    title: 'Identity check needs another go',
                    message: `${reason} You can try again from Settings.`,
                    link: '/dashboard/settings/verification',
                  },
                }),
              ]);
            }
            break;
          }

          case 'charge.refunded': {
            const charge = event.data.object as Stripe.Charge;
            const paymentIntentId = paymentIntentIdOf(charge.payment_intent as any);

            // charge.refunded fires for any refund, a part of the money as much as
            // all of it: `amount_refunded` is what has gone back so far and
            // `amount` what was charged. Every row used to be marked REFUNDED on
            // the first event, so a A$10 goodwill refund on a A$250 order read as
            // the whole sale refunded, and the provider's earnings, the buyer's
            // history and the invoice all lost it. A sale is REFUNDED only when
            // Stripe says the charge is refunded in full; a part refund leaves it
            // as it was and records how much came back. The figure is cumulative,
            // so it only ever grows: an older event delivered late cannot shrink it.
            const refundedCents = Number.isFinite(charge.amount_refunded) ? charge.amount_refunded : 0;
            const fullyRefunded =
              charge.refunded === true || (typeof charge.amount === 'number' && charge.amount > 0 && refundedCents >= charge.amount);

            if (paymentIntentId && fullyRefunded) {
              // Not a payment that is already refunded or cancelled, which are the
              // end of one and are not written over.
              await prisma.mentorSession.updateMany({
                where: {
                  stripePaymentIntentId: paymentIntentId,
                  paymentStatus: { in: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED'] },
                },
                data: { paymentStatus: 'REFUNDED' },
              });
            }
            if (paymentIntentId) {
              if (fullyRefunded) {
                await prisma.escrowPayment.updateMany({
                  where: { paymentIntentId, status: { not: 'REFUNDED' } },
                  data: { status: 'REFUNDED', canceledAt: new Date(), refundedAmount: refundedCents },
                });
              } else if (refundedCents > 0) {
                await prisma.escrowPayment.updateMany({
                  where: { paymentIntentId, refundedAmount: { lt: refundedCents } },
                  data: { refundedAmount: refundedCents },
                });
              }
              // The money row follows the money. Without this a refunded sale
              // still read COMPLETED on the Payment table and on the invoice
              // filed against it. In the same dollars as the row's amount.
              const refundedAmount = new Prisma.Decimal(refundedCents).div(minorUnitScale(charge.currency || 'aud'));
              if (fullyRefunded) {
                await prisma.payment.updateMany({
                  where: { stripePaymentIntentId: paymentIntentId, status: { not: 'REFUNDED' } },
                  data: { status: 'REFUNDED', refundedAmount },
                });
              } else if (refundedCents > 0) {
                await prisma.payment.updateMany({
                  where: { stripePaymentIntentId: paymentIntentId, refundedAmount: { lt: refundedAmount } },
                  data: { refundedAmount },
                });
              }
              // A formation fee refunded by hand in the Stripe dashboard has
              // to reach the registration too, or the applicant keeps a place
              // in the review queue that she has been paid back for.
              await reconcileFormationRefund(paymentIntentId, charge.amount_refunded);

              // What the refund does to what was bought and to ATHENA's own
              // document: gift points come back in proportion, the invoice
              // carries a credit line, and the admins are told about a refund
              // that leaves money with somebody else. A membership is not ended
              // by a refund; see the service for why.
              await applyRefundEffects(charge);
            }
            logger.info('Stripe charge refunded', { chargeId: charge.id, paymentIntentId, amountRefunded: charge.amount_refunded });
            break;
          }

          // A creator payout settling, or coming back.
          //
          // creator.service.ts creates the transfer and files a CreatorPayout
          // row at status PENDING; nothing ever moved it on, so every payout
          // ever made is still PENDING, completedAt is still null, and the
          // "paid to your bank" line of the earnings statement is permanently
          // zero. These three cases are what close that loop.
          //
          // The audit that found this asked for transfer.paid and
          // transfer.failed. Neither exists any more: they were legacy-payout
          // events, and the current API sends transfer.created, .updated and
          // .reversed. For a transfer to a connected account, creation is the
          // movement of the funds, so transfer.created is the settlement.
          // payout.paid and payout.failed are a different object entirely -
          // the creator's own bank payout out of her Stripe balance, on her
          // connected account - and its id would never match a stripeTransferId
          // of ours.
          case 'transfer.created':
          case 'transfer.reversed': {
            const transfer = event.data.object as Stripe.Transfer;
            const ours = metadataString((transfer.metadata as any)?.type) === CREATOR_PAYOUT_TRANSFER_TYPE;

            const payoutSelect = {
              id: true,
              status: true,
              amount: true,
              creatorProfileId: true,
              reversedAmount: true,
            } as const;

            let payout = await prisma.creatorPayout.findFirst({
              where: { stripeTransferId: transfer.id },
              select: payoutSelect,
            });

            // creator.service stores the transfer id on the row only after
            // Stripe has created the transfer. When that write failed, or the
            // process died between the two, the row never learned its id: this
            // event was thrown back to Stripe on every delivery until Stripe
            // gave up, and the payout stayed PENDING for good although the
            // money had gone. The transfer carries the row's id in its signed
            // metadata, so the row is found by that and linked. Only a row with
            // no transfer yet is claimed, so a row already linked to another
            // transfer is never re-pointed at this one.
            if (!payout && ours) {
              const payoutId = metadataString((transfer.metadata as any)?.payoutId);
              if (payoutId) {
                const linked = await prisma.creatorPayout.updateMany({
                  where: { id: payoutId, stripeTransferId: null },
                  data: { stripeTransferId: transfer.id },
                });
                if (linked.count > 0) {
                  logger.warn('Linked a creator payout to its transfer from the transfer metadata', {
                    payoutId,
                    transferId: transfer.id,
                  });
                  payout = await prisma.creatorPayout.findFirst({
                    where: { stripeTransferId: transfer.id },
                    select: payoutSelect,
                  });
                }
              }
            }

            if (!payout) {
              if (!ours) {
                // Every destination charge creates a transfer too. Not ours to
                // reconcile, and nothing went wrong.
                outcome = 'ignored';
                break;
              }
              // It is a creator payout, and the row that records it has not
              // been written yet: the transfer is created before its id can be
              // stored. Thrown so Stripe redelivers once the row exists, the
              // same way invoice.paid waits for the subscription row.
              throw new Error(`Creator payout transfer ${transfer.id} has no CreatorPayout row yet; retry`);
            }

            if (event.type === 'transfer.created') {
              if (payout.status !== 'COMPLETED') {
                await prisma.creatorPayout.update({
                  where: { id: payout.id },
                  data: { status: 'COMPLETED', completedAt: new Date(event.created * 1000) },
                });
              }
              break;
            }

            // Reversed. Give her back exactly the share that came back, in
            // gift points, because pendingPayout counts points and the payout
            // row records dollars.
            //
            // `amount_reversed` is cumulative, so this is the total that should
            // have been restored by now, not the amount this event represents.
            // Crediting the event's own fraction each time meant a payout
            // reversed in two parts put back more than was ever taken.
            const reversedFraction =
              transfer.amount > 0 ? Math.min(1, (transfer.amount_reversed || 0) / transfer.amount) : 1;
            const owedBack = payout.amount * reversedFraction;
            const alreadyRestored = payout.reversedAmount ?? 0;
            const delta = owedBack - alreadyRestored;
            const fully = reversedFraction >= 1;

            // A redelivery, or an event that arrived out of order behind a
            // larger one, owes nothing further. The row is still moved to its
            // terminal state so a late full reversal is not lost.
            if (delta <= 0) {
              if (fully && payout.status !== 'FAILED') {
                await prisma.creatorPayout.update({
                  where: { id: payout.id },
                  data: { status: 'FAILED', completedAt: new Date(event.created * 1000) },
                });
              }
              logger.info('Transfer reversal carried nothing new to restore', {
                payoutId: payout.id,
                transferId: transfer.id,
                alreadyRestored,
                owedBack,
              });
              break;
            }

            const pointsToRestore = Math.round(delta / AUD_PER_GIFT_POINT);

            await prisma.$transaction([
              prisma.creatorPayout.update({
                where: { id: payout.id },
                data: {
                  status: fully ? 'FAILED' : payout.status,
                  reversedAmount: owedBack,
                  completedAt: new Date(event.created * 1000),
                },
              }),
              prisma.creatorProfile.update({
                where: { id: payout.creatorProfileId },
                data: { pendingPayout: { increment: pointsToRestore } },
              }),
            ]);

            logger.warn('A creator payout was reversed and her balance restored', {
              payoutId: payout.id,
              transferId: transfer.id,
              pointsRestored: pointsToRestore,
              alreadyRestored,
              owedBack,
              fully,
            });
            break;
          }

          // Stripe decides asynchronously whether a connected account may take
          // charges and receive payouts, and this is the only thing that tells
          // ATHENA the answer. Without it `stripeConnectStatus` stayed at
          // PENDING forever: escrow refuses a seller who is not ACTIVE, so a
          // mentor or creator who had completed Stripe's checks still could not
          // be paid, and nothing anywhere would have said why. Three comments
          // elsewhere in the codebase claimed this handler already existed.
          // A member's own bank payout, out of her connected account's Stripe
          // balance: the withdrawal she asked for on the earnings screen, or
          // Stripe's scheduled one. These arrive only through the Connect
          // endpoint (see STRIPE_CONNECT_WEBHOOK_SECRET above), with
          // `event.account` naming whose balance it was.
          //
          // Nothing listened for either. A withdrawal to a closed or mistyped
          // account failed at the bank days after the earnings screen had told
          // her it was "on its way", Stripe put the money back in her balance,
          // and she was never told — she would find out by its not arriving.
          case 'payout.failed':
          case 'payout.paid': {
            const payout = event.data.object as Stripe.Payout;
            const accountId = event.account ?? null;

            // A payout of ATHENA's own balance to ATHENA's bank carries no
            // account. Not ours to tell anybody about.
            if (!accountId) {
              outcome = 'ignored';
              break;
            }

            const member = await prisma.user.findFirst({
              where: { stripeConnectAccountId: accountId },
              select: { id: true },
            });
            if (!member) {
              logger.warn('Payout event for a connected account no member owns', { accountId, payoutId: payout.id });
              outcome = 'ignored';
              break;
            }

            const scale = minorUnitScale(payout.currency);
            const amount = `${(payout.amount / scale).toFixed(scale === 1 ? 0 : 2)} ${payout.currency.toUpperCase()}`;

            if (event.type === 'payout.failed') {
              logger.warn('A member’s bank payout failed', {
                userId: member.id,
                payoutId: payout.id,
                failureCode: payout.failure_code,
              });
              await prisma.notification.create({
                data: {
                  userId: member.id,
                  type: 'SYSTEM',
                  title: 'Your withdrawal did not reach your bank',
                  message:
                    `Your bank returned the payout of ${amount}` +
                    (payout.failure_message ? `: ${payout.failure_message}` : '.') +
                    ' Stripe has put the money back in your balance, so nothing is lost. Check the bank account on your earnings page before you withdraw again.',
                  link: '/dashboard/earnings',
                  data: { kind: 'PAYOUT_FAILED', payoutId: payout.id } as Prisma.InputJsonValue,
                },
              });
              break;
            }

            // Stripe's own schedule pays out without her asking, and Stripe
            // tells her about those itself; the one worth a notification here
            // is the withdrawal she asked for on ATHENA.
            if (payout.automatic) {
              outcome = 'ignored';
              break;
            }

            await prisma.notification.create({
              data: {
                userId: member.id,
                type: 'SYSTEM',
                title: 'Your withdrawal has been paid',
                message: `Stripe has paid ${amount} to your bank. It should now be in your account; some banks take until the next business day to show it.`,
                link: '/dashboard/earnings',
                data: { kind: 'PAYOUT_PAID', payoutId: payout.id } as Prisma.InputJsonValue,
              },
            });
            break;
          }

          case 'account.updated': {
            const account = event.data.object as Stripe.Account;
            const matched = await syncConnectedAccountFromStripe(account);
            logger.info('Connected account state refreshed from Stripe', {
              accountId: account.id,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
              matchedAMember: matched,
            });
            break;
          }

          // A card dispute (chargeback), at any of the five points Stripe reports
          // one. The row is written by whichever event arrives first and moved
          // forward by the rest; what each one does is in the service. The alert
          // email to the Trust and Safety mailbox is sent from there too.
          case 'charge.dispute.created':
          case 'charge.dispute.updated':
          case 'charge.dispute.closed':
          case 'charge.dispute.funds_withdrawn':
          case 'charge.dispute.funds_reinstated': {
            await recordDisputeEvent(event);
            break;
          }

          // A paid membership period becomes an ATHENA tax invoice, filed
          // once per Stripe invoice (the service is idempotent on the paid-at
          // instant Stripe recorded). Only subscription invoices: one-off
          // charges are payment intents and handled above. The subscription
          // row is matched by Stripe subscription id, then customer, then the
          // userId checkout put in the subscription's metadata; when none
          // matches yet (invoice.paid can land before checkout.session
          // .completed writes the row) the error is thrown so Stripe retries
          // once the row exists, rather than the invoice being lost.
          case 'invoice.paid': {
            const stripeInvoice = event.data.object as Stripe.Invoice;
            const stripeSubscriptionId = paymentIntentIdOf(stripeInvoice.subscription as any);
            if (!stripeSubscriptionId) break;
            const charge = paidChargeFromStripeInvoice(stripeInvoice);
            if (!charge) break;
            const customerId = paymentIntentIdOf(stripeInvoice.customer as any);
            const metadataUserId = (stripeInvoice.subscription_details?.metadata as any)?.userId;
            const dbSubscription = await prisma.subscription.findFirst({
              where: {
                OR: [
                  { stripeSubscriptionId },
                  customerId ? { stripeCustomerId: customerId } : undefined,
                  typeof metadataUserId === 'string' && metadataUserId ? { userId: metadataUserId } : undefined,
                ].filter(Boolean) as any[],
              },
              select: { id: true },
            });
            if (!dbSubscription) {
              throw new Error(`No ATHENA subscription yet for Stripe subscription ${stripeSubscriptionId}; retry`);
            }
            await createInvoiceForSubscription(dbSubscription.id, charge);
            break;
          }

          // The reminder before the first charge. A trial starts with a card and
          // ends with that card being charged, and the Terms and the checkout
          // page both say we write to her first. Stripe sends this event three
          // days before the trial ends (and again if a trial is cut short), and
          // nothing here listened for it, so the first she heard of the charge
          // was the charge. The webhook row dedupes the event, so one trial gets
          // one email.
          //
          // No email when there is nothing to warn her of: she has already
          // cancelled, so no charge is coming, or the trial is not running any
          // more.
          case 'customer.subscription.trial_will_end': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;

            const matchers: Prisma.SubscriptionWhereInput[] = [];
            if (customerId) matchers.push({ stripeCustomerId: customerId });
            matchers.push({ stripeSubscriptionId: subscription.id });

            const dbSubscription = await prisma.subscription.findFirst({
              where: { OR: matchers },
              include: { user: { select: { email: true, firstName: true } } },
            });
            if (!dbSubscription) {
              outcome = 'ignored';
              break;
            }

            const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
            const stillComing =
              trialEnd !== null &&
              trialEnd.getTime() > Date.now() &&
              subscription.status === 'trialing' &&
              !subscription.cancel_at_period_end &&
              !subscription.cancel_at;
            if (!stillComing || !trialEnd || !dbSubscription.user?.email) {
              outcome = 'ignored';
              break;
            }

            const price = subscription.items?.data?.[0]?.price;
            const charge =
              price && typeof price.unit_amount === 'number' && price.currency
                ? `${new Intl.NumberFormat('en-AU', { style: 'currency', currency: price.currency.toUpperCase() }).format(
                    price.unit_amount / minorUnitScale(price.currency)
                  )}${price.recurring?.interval ? ` a ${price.recurring.interval}` : ''}`
                : 'the price shown on your billing page';
            const endsOn = trialEnd.toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Australia/Brisbane',
            });
            const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
            const link = `${base}/dashboard/settings/billing`;
            const firstName = dbSubscription.user.firstName;
            const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
            // Her name is her own text, so it is escaped before it goes into markup.
            const htmlGreeting = firstName
              ? `Hi ${firstName.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)},`
              : 'Hi,';

            const delivery = await deliverEmail({
              to: dbSubscription.user.email,
              subject: `Your ATHENA free trial ends on ${endsOn}`,
              text: `${greeting}\n\nYour ATHENA free trial ends on ${endsOn}. On that day the card you gave us when you started will be charged ${charge}, and then again on each renewal until you cancel.\n\nIf you would rather not continue, cancel before then and you will not be charged anything: ${link}\n\nIf you cancel you keep the free plan, and nothing you have made is lost.\n\nATHENA`,
              html: `<p>${htmlGreeting}</p><p>Your ATHENA free trial ends on <strong>${endsOn}</strong>. On that day the card you gave us when you started will be charged <strong>${charge}</strong>, and then again on each renewal until you cancel.</p><p>If you would rather not continue, <a href="${link}">cancel before then</a> and you will not be charged anything.</p><p>If you cancel you keep the free plan, and nothing you have made is lost.</p><p>ATHENA</p>`,
            });
            if (!delivery.ok) {
              if (delivery.retryable) {
                // A reminder we promised and could not send, because the provider
                // was busy or did not answer, is thrown back to Stripe, which
                // delivers the event again, rather than recorded as done. The
                // failure also shows on the operations screen.
                throw new Error(
                  `Could not send the trial-ending reminder for subscription ${subscription.id} (${delivery.reason ?? 'unknown'})`
                );
              }
              // A refusal that will be the same next time (an address on the
              // suppression list, a sender that is not set up, an address the
              // provider rejects) is not cured by Stripe sending the event
              // again: it would only fail for three days and hold the failure
              // list open. The address is not logged; the subscription is
              // enough to find her.
              logger.warn('The trial-ending reminder could not be sent and will not be retried', {
                subscriptionId: subscription.id,
                reason: delivery.reason,
              });
              if (delivery.reason === 'suppressed') {
                // Expected: she, or her mail provider, asked not to be mailed.
                outcome = 'ignored';
              } else {
                outcome = 'failed';
                failureReason = `Trial-ending reminder for subscription ${subscription.id} was refused: ${delivery.reason ?? 'unknown'}`;
              }
            }
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId = paymentIntentIdOf(invoice.customer as any);
            if (!customerId) {
              outcome = 'ignored';
              break;
            }
            const dbSubscription = await prisma.subscription.findFirst({
              where: { stripeCustomerId: customerId },
              include: { user: { select: { email: true, firstName: true } } },
            });
            if (!dbSubscription) {
              // A failed invoice for a customer we hold no subscription row for.
              // Nothing of ours went wrong, but nothing was done either.
              outcome = 'ignored';
              break;
            }

            // The row is found by customer, so an invoice for another subscription of
            // hers reaches it: the second membership that settleDuplicateMembership
            // leaves billing for staff to cancel, or an invoice that is not for a
            // membership at all. While the row is on a membership that is still being
            // billed, that is not its invoice, and marking it past due would pause the
            // paid tools of a member who is paid up.
            const invoiceSubscriptionId = paymentIntentIdOf((invoice as { subscription?: string | { id: string } | null }).subscription);
            if (
              invoiceSubscriptionId &&
              dbSubscription.stripeSubscriptionId &&
              invoiceSubscriptionId !== dbSubscription.stripeSubscriptionId &&
              (BILLING_STATUSES as readonly string[]).includes(dbSubscription.status)
            ) {
              logger.info('A failed invoice for another subscription of the same customer was not applied to a membership still being billed', {
                eventId: event.id,
                invoiceSubscriptionId,
                keptSubscriptionId: dbSubscription.stripeSubscriptionId,
              });
              outcome = 'ignored';
              break;
            }

            await prisma.subscription.update({ where: { id: dbSubscription.id }, data: { status: 'PAST_DUE' } });
            if (dbSubscription.user?.email) {
              const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
              const link = `${base}/dashboard/settings/billing`;
              const greeting = dbSubscription.user.firstName ? `Hi ${dbSubscription.user.firstName},` : 'Hi,';
              // Her name is her own text, so the markup copy of the greeting is escaped.
              const htmlGreeting = dbSubscription.user.firstName ? `Hi ${escapeHtml(dbSubscription.user.firstName)},` : 'Hi,';

              // What she is told about her plan is what the plan gates will do, which
              // is the day the grace ends (counted from the period that failed), not
              // a fresh number of days. Stripe sends this event for every attempt
              // over the following week, so "you keep your plan for 7 days" on the
              // third of them promised days she would not get, and on one that came
              // after the grace had gone it said she kept a plan whose tools were
              // already paused. With no period start on the row the gates give no
              // grace at all, so none is promised.
              const graceEndsAt = pastDueGraceEndsAt({ status: 'PAST_DUE', currentPeriodStart: dbSubscription.currentPeriodStart });
              const graceOpen = graceEndsAt !== null && graceEndsAt.getTime() > Date.now();
              const graceEndsOn = graceEndsAt
                ? graceEndsAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
                : null;
              const retryLine = graceOpen
                ? `Stripe will try again over the next few days, and you keep your plan until ${graceEndsOn} while it does.`
                : 'Stripe will try again over the next few days.';
              const afterLine = graceOpen
                ? 'If the payment still has not gone through by then, your paid tools pause until it does, and if it keeps failing your membership drops back to the free plan. Nothing you have made is lost.'
                : 'Until it goes through, your paid tools are paused, and if it keeps failing your membership drops back to the free plan. Nothing you have made is lost.';
              await sendEmail({
                to: dbSubscription.user.email,
                subject: 'Your ATHENA payment did not go through',
                text: `${greeting}\n\nWe could not take this period's payment for your ATHENA membership. ${retryLine} To fix it now, update your card here: ${link}\n\n${afterLine}\n\nATHENA`,
                html: `<p>${htmlGreeting}</p><p>We could not take this period's payment for your ATHENA membership. ${retryLine} To fix it now, <a href="${link}">update your card</a>.</p><p>${afterLine}</p><p>ATHENA</p>`,
              });
            }
            break;
          }

          default:
            // Ignore other events for now.
            outcome = 'ignored';
            break;
        }
      } catch (handlerError) {
        // Counted before anything else, so the failure is on the record even if
        // releasing the idempotency row below also goes wrong. recordFailure
        // cannot throw; see utils/ops-metrics.ts.
        recordFailure(`stripe_webhook.${event.type}`, handlerError);

        // The claim is written before the handler runs, so leaving it behind
        // after a failure would make Stripe's retry wait for it to go stale.
        // Release it and let the retry through straight away.
        try {
          await prisma.stripeWebhookEvent.delete({ where: { id: event.id } });
        } catch (releaseError) {
          // Best effort: losing the original error is worse. A claim that could
          // not be released is not lost work any more, because it was never
          // marked complete: once it has stood for STALE_CLAIM_MS the retry takes
          // it over and runs the handler again. It is still worth its own
          // counter, because until then the retry is turned away.
          recordFailure('stripe_webhook.idempotency_release', releaseError);
        }
        throw handlerError;
      }

      // One bucket rather than one per event type: Stripe has hundreds of them
      // and a name per type would push the real operation names past the cap in
      // ops-metrics and into "(other)". Which types arrived is already on the
      // StripeWebhookEvent rows.
      if (outcome === 'failed') {
        recordFailure(`stripe_webhook.${event.type}`, new Error(failureReason ?? 'Handled no further'));
      } else if (outcome === 'ignored') {
        recordIgnored('stripe_webhook.unhandled_event');
      } else {
        recordSuccess(`stripe_webhook.${event.type}`);
      }
      // The decline is counted now that the event has been applied in full, so
      // a retry of a half-done one does not count it twice. Never throws.
      if (declinedPayer) await noteDeclinedPayment(declinedPayer);

      // Last, and only now: the handler has finished (including the events it
      // chose to ignore or to count as a failure it cannot cure by being run
      // again), so a replay is a replay.
      await markEventHandled(event.id);
      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

/** A batch of events is a list; each entry is read on its own, later. */
const sendGridBatchSchema = z.array(z.unknown()).max(10_000);

/**
 * POST /api/webhooks/sendgrid
 *
 * SendGrid's Event Webhook, which is how this platform finds out that an email
 * did not arrive. A hard bounce, a drop for a bounced or invalid address and a
 * spam report put the address on the suppression list, and utils/email.ts then
 * stops mailing it: a mistyped address at sign-up is no longer sent a
 * confirmation link on every resend, and a member who reported our mail as spam
 * is not mailed again. See services/email-suppression.service.ts for what counts.
 *
 * Signed. SendGrid signs the timestamp and the raw body with a key whose public
 * half is SENDGRID_WEBHOOK_PUBLIC_KEY, so the body is read raw here, as the
 * Stripe route reads its own. Without the key this refuses with 503 rather than
 * accepting deliveries nobody can vouch for: anyone can post to this URL, and an
 * unsigned suppression list would let a stranger stop a member's password-reset
 * mail from being sent.
 *
 * Idempotent: one row per address, so SendGrid delivering a batch twice, as it
 * does whenever it is unsure we received it, changes nothing.
 */
router.post(
  '/sendgrid',
  // SendGrid delivers events in batches that can run to a few megabytes. A body
  // over the limit is refused with a 413 and SendGrid sends the same batch
  // again until it gives up, so the limit sits well above the usual size, and the
  // signature is checked before the body is read as JSON. Not larger: the body
  // has to be held whole to be verified, and anyone can post to this URL.
  express.raw({ type: 'application/json', limit: '5mb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
      if (!publicKey) {
        throw new ApiError(503, 'SendGrid event webhook is not configured');
      }

      const signature = req.headers['x-twilio-email-event-webhook-signature'];
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];
      const body = req.body;
      if (
        typeof signature !== 'string' ||
        typeof timestamp !== 'string' ||
        !signature ||
        !timestamp ||
        !Buffer.isBuffer(body) ||
        !verifySendGridSignature(publicKey, body, signature, timestamp)
      ) {
        // A counter and not a failure, for the same reason as the Stripe route:
        // this endpoint is open to the internet, and a stranger must not be able
        // to fill the failure list or hold /health/detailed at "degraded". A
        // stale key after the webhook was re-created in SendGrid shows up as
        // this number climbing.
        recordIgnored('sendgrid_webhook.bad_signature');
        logger.warn('SendGrid event webhook signature verification failed');
        throw new ApiError(400, 'Invalid SendGrid signature');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        throw new ApiError(400, 'The event batch is not valid JSON');
      }

      // A batch is a list. What is in each entry is read one at a time by
      // suppressionsFromEvents, which skips what it cannot use: one odd entry
      // must not make SendGrid retry the whole batch for ever.
      const batch = sendGridBatchSchema.safeParse(parsed);
      if (!batch.success) {
        throw new ApiError(400, 'The event batch is not a list of events');
      }

      const entries = suppressionsFromEvents(batch.data);
      try {
        await recordSuppressions(entries);
      } catch (error) {
        // Not acknowledged, so SendGrid sends the batch again; writing it twice
        // is harmless.
        recordFailure('sendgrid_webhook.suppression', error);
        throw error;
      }

      if (entries.length > 0) {
        recordSuccess('sendgrid_webhook.suppression');
        // Counts only. An address is personal data and does not belong in a log line.
        logger.info('Email addresses added to the suppression list', { count: entries.length });
      }
      res.json({ received: true, suppressed: entries.length });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
