import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
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
import { prisma } from '../utils/prisma';
import { sendEmail } from '../utils/email';

const router = Router();

function paymentIntentIdOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_not_configured', {
  apiVersion: '2023-10-16',
});

const PRICE_IDS = {
  PREMIUM_CAREER: process.env.STRIPE_PRICE_CAREER || 'price_career',
  PREMIUM_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
  PREMIUM_ENTREPRENEUR: process.env.STRIPE_PRICE_ENTREPRENEUR || 'price_entrepreneur',
  PREMIUM_CREATOR: process.env.STRIPE_PRICE_CREATOR || 'price_creator',
} as const;

function tierFromPriceId(priceId?: string | null): string | null {
  if (!priceId) return null;
  const entry = Object.entries(PRICE_IDS).find(([, id]) => id === priceId);
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

      let event: Stripe.Event;
      try {
        // req.body is a Buffer because of express.raw.
        event = stripe.webhooks.constructEvent(req.body as any, signature, webhookSecret);
      } catch (err: any) {
        logger.warn('Stripe webhook signature verification failed', {
          message: err?.message,
        });
        throw new ApiError(400, 'Invalid Stripe signature');
      }

      // Idempotency: record Stripe event ID once.
      try {
        await (prisma as any).stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
      } catch (err: any) {
        // Prisma unique constraint violation => already processed.
        if (err?.code === 'P2002') {
          return res.json({ received: true, duplicate: true });
        }
        throw err;
      }

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
            if (session.mode !== 'subscription') break;

            const userId = session.metadata?.userId;
            const tier = session.metadata?.tier;
            const currency = session.metadata?.currency || null;
            const customerId = typeof session.customer === 'string' ? session.customer : null;
            const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

            if (!userId || !tier) break;

            await (prisma as any).subscription.upsert({
              where: { userId },
              create: {
                user: { connect: { id: userId } },
                tier,
                status: 'ACTIVE',
                stripeCustomerId: customerId,
                stripeSubscriptionId,
                stripePriceId: (PRICE_IDS as any)[tier] || null,
                currency: currency || undefined,
              },
              update: {
                tier,
                status: 'ACTIVE',
                stripeCustomerId: customerId || undefined,
                stripeSubscriptionId,
                stripePriceId: (PRICE_IDS as any)[tier] || null,
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

            const dbSubscription = await (prisma as any).subscription.findFirst({
              where: {
                OR: [
                  customerId ? { stripeCustomerId: customerId } : undefined,
                  { stripeSubscriptionId },
                ].filter(Boolean),
              },
            });

            if (!dbSubscription) break;

            if (event.type === 'customer.subscription.deleted') {
              await (prisma as any).subscription.update({
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
            await (prisma as any).subscription.update({
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

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId = paymentIntentIdOf(invoice.customer as any);
            if (!customerId) break;
            const dbSubscription = await prisma.subscription.findFirst({
              where: { stripeCustomerId: customerId },
              include: { user: { select: { email: true, firstName: true } } },
            });
            if (!dbSubscription) break;
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
            break;
        }
      } catch (handlerError) {
        // The idempotency row is written before the handler runs, so leaving it
        // behind after a failure would make Stripe's retry look like a replay
        // and the payment would never be applied. Release it and let the retry
        // through.
        try {
          await (prisma as any).stripeWebhookEvent.delete({ where: { id: event.id } });
        } catch {
          // Best effort: a stuck row is better than losing the original error.
        }
        throw handlerError;
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
