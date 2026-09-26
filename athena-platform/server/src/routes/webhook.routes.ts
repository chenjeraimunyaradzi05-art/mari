import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
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
  confirmAcceleratorEnrollmentPayment,
  recordAcceleratorPaymentFailure,
} from '../services/payments-orchestration.service';
import { syncConnectedAccountFromStripe, minorUnitScale } from '../services/stripe-connect.service';
// Tax invoices: see the header of routes/invoice.routes.ts for who issues them.
import {
  createInvoiceForPayment,
  createInvoiceForSubscription,
  paidChargeFromStripeInvoice,
  type PaymentKind,
} from '../services/invoice.service';
import { prisma } from '../utils/prisma';
import { sendEmail } from '../utils/email';
import { recordFailure, recordIgnored, recordSuccess } from '../utils/ops-metrics';

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

// A gift point is worth a cent. CreatorPayout.amount is in dollars while
// CreatorProfile.pendingPayout counts points, so a reversal has to convert
// back before it can restore her balance. creator.service.ts holds the same
// relationship privately, as GIFT_POINT_VALUE.
const AUD_PER_GIFT_POINT = 0.01;

const PRICE_IDS = {
  PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER || 'price_career',
  PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
  PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR || 'price_entrepreneur',
  PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR || 'price_creator',
} as const;

/**
 * The four tiers that can arrive on a Stripe checkout or subscription. They are
 * a subset of the SubscriptionTier enum — FREE and ENTERPRISE are never sold
 * through Stripe — and naming that subset is what lets PRICE_IDS be indexed and
 * the tier be written to Prisma without casting either one away.
 */
type PaidTier = keyof typeof PRICE_IDS;

function isPaidTier(value: unknown): value is PaidTier {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRICE_IDS, value);
}

function tierFromPriceId(priceId?: string | null): PaidTier | null {
  if (!priceId) return null;
  const entry = (Object.entries(PRICE_IDS) as [PaidTier, string][]).find(([, id]) => id === priceId);
  return entry ? entry[0] : null;
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

/**
 * POST /api/webhooks/stripe
 * Stripe webhooks require the raw request body for signature verification.
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new ApiError(500, 'Stripe webhook secret not configured');
      }

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
        event = stripeWebhooks.constructEvent(req.body as any, signature, webhookSecret);
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

      // Idempotency: record Stripe event ID once.
      try {
        await prisma.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
      } catch (err: any) {
        // Prisma unique constraint violation => already processed.
        if (err?.code === 'P2002') {
          return res.json({ received: true, duplicate: true });
        }
        throw err;
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

      // Handle the event
      try {
        switch (event.type) {
          case 'payment_intent.amount_capturable_updated': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const type = (paymentIntent.metadata as any)?.type;
            const sessionId = (paymentIntent.metadata as any)?.sessionId;

            if (type === 'mentor_session' && typeof sessionId === 'string') {
              await prisma.mentorSession.update({
                where: { id: sessionId },
                data: {
                  stripePaymentIntentId: paymentIntent.id,
                  paymentStatus: 'AUTHORIZED',
                  paymentAuthorizedAt: new Date(),
                },
              });
            }

            // Escrow holds (marketplace orders) move to AUTHORIZED, and the
            // provider hears that a paid order is waiting for them.
            const held = await prisma.escrowPayment.updateMany({
              where: { paymentIntentId: paymentIntent.id, status: 'PENDING' },
              data: { status: 'AUTHORIZED' },
            });
            if (held.count > 0 && (paymentIntent.metadata as any)?.sessionType === 'service_order') {
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
            break;
          }
          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const type = (paymentIntent.metadata as any)?.type;
            const userId = (paymentIntent.metadata as any)?.userId;
            const sessionId = (paymentIntent.metadata as any)?.sessionId;

            if (type === 'gift_balance_purchase' && typeof userId === 'string' && userId.length > 0) {
              await confirmGiftPurchaseFromPaymentIntent(userId, paymentIntent);
            }

            if (type === 'mentor_session' && typeof sessionId === 'string') {
              await prisma.mentorSession.update({
                where: { id: sessionId },
                data: {
                  stripePaymentIntentId: paymentIntent.id,
                  paymentStatus: 'CAPTURED',
                  paymentCapturedAt: new Date(),
                },
              });
            }

            if (type === FORMATION_PAYMENT_TYPE) {
              await confirmFormationPaymentFromWebhook(paymentIntent);
            }

            if (type === ACCELERATOR_PAYMENT_TYPE) {
              await confirmAcceleratorEnrollmentPayment(paymentIntent);
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
            await prisma.escrowPayment.updateMany({
              where: { paymentIntentId: paymentIntent.id, status: { in: ['PENDING', 'AUTHORIZED'] } },
              data:
                event.type === 'payment_intent.canceled'
                  ? { status: 'CANCELED', canceledAt: new Date() }
                  : { status: 'FAILED' },
            });
            const type = (paymentIntent.metadata as any)?.type;
            const sessionId = (paymentIntent.metadata as any)?.sessionId;

            if (type === 'mentor_session' && typeof sessionId === 'string') {
              await prisma.mentorSession.update({
                where: { id: sessionId },
                data: {
                  stripePaymentIntentId: paymentIntent.id,
                  paymentStatus: event.type === 'payment_intent.canceled' ? 'CANCELED' : 'FAILED',
                  paymentCanceledAt: event.type === 'payment_intent.canceled' ? new Date() : undefined,
                  paymentFailedAt: event.type === 'payment_intent.payment_failed' ? new Date() : undefined,
                },
              });
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

            await prisma.subscription.upsert({
              where: { userId },
              create: {
                user: { connect: { id: userId } },
                tier,
                status: 'ACTIVE',
                stripeCustomerId: customerId,
                stripeSubscriptionId,
                stripePriceId: PRICE_IDS[tier] || null,
                currency: currency || undefined,
              },
              update: {
                tier,
                status: 'ACTIVE',
                stripeCustomerId: customerId || undefined,
                stripeSubscriptionId,
                stripePriceId: PRICE_IDS[tier] || null,
                currency: currency || undefined,
              },
            });
            break;
          }

          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
            const stripeSubscriptionId = subscription.id;

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

            const inferredTier = tierFromPriceId(priceId);

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
          // Stripe Identity finished a document check. Passed: the badge is
          // approved and the profile marked verified. Needs input: the member
          // is told why and can go again.
          case 'identity.verification_session.verified':
          case 'identity.verification_session.requires_input': {
            const session = event.data.object as Stripe.Identity.VerificationSession;
            const badge = await prisma.verificationBadge.findFirst({
              where: { type: 'IDENTITY', metadata: { path: ['sessionId'], equals: session.id } },
              select: { id: true, userId: true, status: true },
            });
            if (!badge) {
              logger.warn('Identity session with no badge behind it', { sessionId: session.id });
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
            if (paymentIntentId) {
              const session = await prisma.mentorSession.findFirst({
                where: { stripePaymentIntentId: paymentIntentId },
                select: { id: true },
              });
              if (session) {
                await prisma.mentorSession.update({ where: { id: session.id }, data: { paymentStatus: 'REFUNDED' } });
              }
            }
            if (paymentIntentId) {
              await prisma.escrowPayment.updateMany({
                where: { paymentIntentId },
                data: { status: 'REFUNDED', canceledAt: new Date() },
              });
              // The money row follows the money. Without this a refunded sale
              // still read COMPLETED on the Payment table and on the invoice
              // filed against it.
              await prisma.payment.updateMany({
                where: { stripePaymentIntentId: paymentIntentId },
                data: { status: 'REFUNDED' },
              });
              // A formation fee refunded by hand in the Stripe dashboard has
              // to reach the registration too, or the applicant keeps a place
              // in the review queue that she has been paid back for.
              await reconcileFormationRefund(paymentIntentId, charge.amount_refunded);
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

            const payout = await prisma.creatorPayout.findFirst({
              where: { stripeTransferId: transfer.id },
              select: { id: true, status: true, amount: true, creatorProfileId: true, reversedAmount: true },
            });

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

          case 'charge.dispute.created':
          case 'charge.dispute.closed': {
            const dispute = event.data.object as Stripe.Dispute;
            const paymentIntentId = paymentIntentIdOf(dispute.payment_intent as any);
            logger.warn('Stripe dispute', {
              event: event.type,
              disputeId: dispute.id,
              paymentIntentId,
              amount: dispute.amount,
              reason: dispute.reason,
              status: dispute.status,
            });
            if (event.type === 'charge.dispute.created') {
              const to = process.env.TRUST_SAFETY_EMAIL || 'trust-safety@athena.com';
              const respondBy = dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : 'see Stripe';
              await sendEmail({
                to,
                subject: `Stripe dispute opened: ${dispute.id}`,
                text: `A cardholder has disputed a charge.\n\nDispute: ${dispute.id}\nAmount: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}\nReason: ${dispute.reason}\nPayment intent: ${paymentIntentId ?? 'unknown'}\nEvidence due: ${respondBy}\n\nRespond in the Stripe dashboard.`,
                html: `<p>A cardholder has disputed a charge.</p><ul><li>Dispute: ${dispute.id}</li><li>Amount: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}</li><li>Reason: ${dispute.reason}</li><li>Payment intent: ${paymentIntentId ?? 'unknown'}</li><li>Evidence due: ${respondBy}</li></ul><p>Respond in the Stripe dashboard.</p>`,
              });
            }
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
            await prisma.subscription.update({ where: { id: dbSubscription.id }, data: { status: 'PAST_DUE' } });
            if (dbSubscription.user?.email) {
              const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
              const link = `${base}/dashboard/settings/billing`;
              const greeting = dbSubscription.user.firstName ? `Hi ${dbSubscription.user.firstName},` : 'Hi,';
              await sendEmail({
                to: dbSubscription.user.email,
                subject: 'Your ATHENA payment did not go through',
                text: `${greeting}\n\nWe could not take this period's payment for your ATHENA membership. Stripe will try again over the next few days. To fix it now, update your card here: ${link}\n\nIf the payment keeps failing your membership drops back to the free plan; nothing you have made is lost.\n\nATHENA`,
                html: `<p>${greeting}</p><p>We could not take this period's payment for your ATHENA membership. Stripe will try again over the next few days. To fix it now, <a href="${link}">update your card</a>.</p><p>If the payment keeps failing your membership drops back to the free plan; nothing you have made is lost.</p><p>ATHENA</p>`,
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

        // The idempotency row is written before the handler runs, so leaving it
        // behind after a failure would make Stripe's retry look like a replay
        // and the payment would never be applied. Release it and let the retry
        // through.
        try {
          await prisma.stripeWebhookEvent.delete({ where: { id: event.id } });
        } catch (releaseError) {
          // Best effort: a stuck row is better than losing the original error.
          // But a stuck row means Stripe's retry will be treated as a replay and
          // the payment is lost for good, so it is worth its own counter.
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
      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
