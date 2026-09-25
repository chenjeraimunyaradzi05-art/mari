import { Router } from 'express';
import Stripe from 'stripe';
import { getStripe } from '../utils/stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPriceIdForTier, SubscriptionTierKey } from '../config/regions';
import { getCurrencyForUser } from '../utils/region';

// Must match TRIAL_DAYS in client/src/lib/pricing.ts, which is what the
// pricing page and its FAQ render. If these two drift, the site advertises
// one trial length and Stripe grants another.
const TRIAL_DAYS = 14;

const router = Router();

// The Stripe client is fetched per call rather than held in a module constant.
// Capturing it at import time froze whatever getStripe() could build at that
// moment: if STRIPE_SECRET_KEY was not in the environment yet when this router
// loaded, every checkout, portal and cancellation for the life of the process
// went to Stripe with the sk_test_not_configured placeholder, and getStripe()
// rebuilding its cache when the key appears could never reach it.
//
// Nothing here degrades gracefully - these routes have no non-Stripe path and
// are not meant to - so there is no isStripeConfigured() gate. An unconfigured
// deployment fails exactly as it did before: in production the client from
// getStripe() throws 503 'Payments are not configured on this deployment' on
// first use, and elsewhere the placeholder key is refused by Stripe.

const VALID_TIERS: SubscriptionTierKey[] = [
  'PREMIUM_CAREER',
  'PREMIUM_PROFESSIONAL',
  'PREMIUM_ENTREPRENEUR',
  'PREMIUM_CREATOR',
];

// Price IDs for subscription tiers are resolved per currency in config/regions.ts
//
// Each of them falls back to a literal - 'price_career', 'price_professional'
// and so on - when its STRIPE_PRICE_* variable is unset, and nothing validates
// those at boot: env.ts checks STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET and
// marks both optional, so a deployment with no Stripe configuration at all
// starts cleanly and the first anyone hears of it is a member pressing Upgrade
// and getting Stripe's 'No such price: price_career' back as a 500.
//
// These are the exact fallbacks in config/regions.ts. If a tier is added there
// its placeholder belongs here too; a placeholder missing from this list is not
// a crash, it is the old behaviour back again, which is why the list is written
// out rather than inferred from a pattern that a real price id might also match.
const PLACEHOLDER_PRICE_IDS = new Set([
  'price_career',
  'price_professional',
  'price_entrepreneur',
  'price_creator',
]);

/**
 * Refuses a checkout that would be sent to Stripe with a price that does not
 * exist, and says which environment variable is missing.
 *
 * A 503 rather than a 500: nothing is wrong with the request, the deployment is
 * not finished, and an operator reading the log needs to be told that rather
 * than left to decode a Stripe error.
 */
function assertRealPriceId(priceId: string, tier: SubscriptionTierKey, currency: string): void {
  if (!PLACEHOLDER_PRICE_IDS.has(priceId)) return;

  logger.error('A checkout was attempted against a placeholder Stripe price id', {
    tier,
    currency,
    priceId,
  });

  throw new ApiError(
    503,
    'Paid memberships are not configured on this deployment yet, so this upgrade cannot be started.'
  );
}

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

    // Resolved before the Stripe customer is created, so that an unconfigured
    // deployment refuses the upgrade without first leaving a customer record
    // behind at Stripe for a checkout that was never going to start.
    const currency = getCurrencyForUser(user);
    const priceId = getPriceIdForTier(tier as SubscriptionTierKey, currency);
    assertRealPriceId(priceId, tier as SubscriptionTierKey, currency);

    // Get or create Stripe customer
    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
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

    // Whether this customer has already used their trial. Stripe will happily
    // grant a fresh trial on every new subscription, so without this check
    // someone could cancel and resubscribe indefinitely and never pay.
    const previousSubscriptions = await getStripe().subscriptions.list({
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
    const session = await getStripe().checkout.sessions.create({
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

    const session = await getStripe().billingPortal.sessions.create({
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
    await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
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
