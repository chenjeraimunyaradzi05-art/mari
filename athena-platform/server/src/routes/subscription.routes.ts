import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPriceIdForTier, SubscriptionTierKey } from '../config/regions';
import { getCurrencyForUser } from '../utils/region';

// Must match TRIAL_DAYS in client/src/lib/pricing.ts, which is what the
// pricing page and its FAQ render. If these two drift, the site advertises
// one trial length and Stripe grants another.
const TRIAL_DAYS = 14;

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_not_configured', {
  apiVersion: '2023-10-16',
});

const VALID_TIERS: SubscriptionTierKey[] = [
  'PREMIUM_CAREER',
  'PREMIUM_PROFESSIONAL',
  'PREMIUM_ENTREPRENEUR',
  'PREMIUM_CREATOR',
];

// Price IDs for subscription tiers are resolved per currency in config/regions.ts

// ===========================================
// GET CURRENT SUBSCRIPTION
// ===========================================
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription) {
      throw new ApiError(404, 'Subscription not found');
    }

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE CHECKOUT SESSION
// ===========================================
router.post('/checkout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { tier } = req.body;

    if (!tier || !VALID_TIERS.includes(tier)) {
      throw new ApiError(400, 'Invalid subscription tier');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { subscription: true },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Get or create Stripe customer
    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const currency = getCurrencyForUser(user);
    const priceId = getPriceIdForTier(tier as SubscriptionTierKey, currency);

    // Whether this customer has already used their trial. Stripe will happily
    // grant a fresh trial on every new subscription, so without this check
    // someone could cancel and resubscribe indefinitely and never pay.
    const previousSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });
    const isFirstSubscription = previousSubscriptions.data.length === 0;

    // Create checkout session.
    //
    // The pricing page advertises a 14-day free trial. Until now the session
    // carried no trial at all, so anyone who took that offer was charged the
    // full amount immediately — a representation we made and did not honour.
    // TRIAL_DAYS is the same constant the marketing copy renders from.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(isFirstSubscription
        ? {
            subscription_data: {
              trial_period_days: TRIAL_DAYS,
              metadata: { userId: user.id, tier },
            },
          }
        : {}),
      success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
      metadata: {
        userId: user.id,
        tier,
        currency,
        trialGranted: String(isFirstSubscription),
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        currency,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE CUSTOMER PORTAL SESSION
// ===========================================
router.post('/portal', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription?.stripeCustomerId) {
      throw new ApiError(400, 'No Stripe customer found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/settings/billing`,
    });

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CANCEL SUBSCRIPTION
// ===========================================
router.post('/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });

    if (!subscription?.stripeSubscriptionId) {
      throw new ApiError(400, 'No active subscription found');
    }

    // Cancel at period end
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.subscription.update({
      where: { userId: req.user!.id },
      data: { cancelAtPeriodEnd: true },
    });

    res.json({
      success: true,
      message: 'Subscription will be canceled at end of billing period',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
