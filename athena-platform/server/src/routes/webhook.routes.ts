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
} from '../services/formation.service';
import {
  ACCELERATOR_PAYMENT_TYPE,
  confirmAcceleratorEnrollmentPayment,
  recordAcceleratorPaymentFailure,
} from '../services/payments-orchestration.service';
// Tax invoices: see the header of routes/invoice.routes.ts for who issues them.
import {
  createInvoiceForPayment,
  createInvoiceForSubscription,
  paidChargeFromStripeInvoice,
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
 * Invoice hook for one-off payments. A Payment row that carries this intent
 * is marked COMPLETED and gets an ATHENA invoice, once (the service is
 * idempotent on paymentId). No flow writes Payment rows yet, so today this
 * finds nothing; it is the hook mentor sessions and the formation fee will
 * use when they do. Best effort on purpose: the payment itself has already
 * been applied by the handler above, and a failed filing can be re-issued
 * from the admin subscriptions page, so an error here is logged rather than
 * handed back to Stripe as a retry that would re-run the whole event.
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

            // Tax invoice for a Payment row carrying this intent (best effort,
            // idempotent; see the helper above).
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
            await prisma.subscription.update({
              where: { id: dbSubscription.id },
              data: {
                stripeCustomerId: customerId || undefined,
                stripeSubscriptionId,
                stripePriceId: priceId,
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
            }
            logger.info('Stripe charge refunded', { chargeId: charge.id, paymentIntentId, amountRefunded: charge.amount_refunded });
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
