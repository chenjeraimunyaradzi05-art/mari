import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { confirmGiftPurchaseFromPaymentIntent } from '../services/creator.service';
import { prisma } from '../utils/prisma';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
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
          break;
        }

        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
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

        default:
          // Ignore other events for now.
          break;
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
