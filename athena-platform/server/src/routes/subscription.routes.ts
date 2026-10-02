import { Router } from 'express';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getStripe } from '../utils/stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { getPriceIdForTier, SubscriptionTierKey } from '../config/regions';
import { getCurrencyForUser } from '../utils/region';
import {
  PAID_TIERS,
  isPlaceholderPriceId,
  getSubscriptionPlanPrices,
} from '../services/payments-orchestration.service';
import { TRIAL_DAYS, publicPriceBook } from '../config/price-book';
import { isGstRegistered } from '../services/invoice.service';
import { minorUnitScale } from '../services/stripe-connect.service';
import { startingAPayment } from '../middleware/moneyLimits';
import { zodBody } from '../middleware/validate';
import { BILLING_STATUSES, hasLiveEntitlement, pastDueGraceEndsAt } from '../utils/subscription-entitlement';
import { entitlementsFor, planEntitlements } from '../services/entitlements.service';
import { getPaymentsPause } from '../services/feature-flags.service';

// The trial length is TRIAL_DAYS in the price book. client/src/lib/pricing.ts
// holds the copy the static pages render, and a test in each package fails when
// the two differ, so the site cannot advertise one trial length while Stripe
// grants another.

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

// The tiers checkout sells, and the placeholder price ids it refuses, live in
// payments-orchestration beside the price reader that /plans and the mobile
// pricing endpoint share, so the tiers a page prices and the tiers checkout
// accepts cannot drift apart.
const VALID_TIERS: SubscriptionTierKey[] = PAID_TIERS;

// Price IDs for subscription tiers are resolved per currency in config/regions.ts
//
// Each of them falls back to a literal - 'price_career', 'price_professional'
// and so on - when its STRIPE_PRICE_* variable is unset, and nothing validates
// those at boot: env.ts checks STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET and
// marks both optional, so a deployment with no Stripe configuration at all
// starts cleanly and the first anyone hears of it is a member pressing Upgrade
// and getting Stripe's 'No such price: price_career' back as a 500.
//
// The placeholders themselves are listed in payments-orchestration
// (isPlaceholderPriceId), written out rather than inferred from a pattern that a
// real price id might also match.

/**
 * Refuses a checkout that would be sent to Stripe with a price that does not
 * exist, and says which environment variable is missing.
 *
 * A 503 rather than a 500: nothing is wrong with the request, the deployment is
 * not finished, and an operator reading the log needs to be told that rather
 * than left to decode a Stripe error.
 */
function assertRealPriceId(priceId: string, tier: SubscriptionTierKey, currency: string): void {
  if (!isPlaceholderPriceId(priceId)) return;

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

    // The row as it is, and what it is worth today: whether the paid tools are on
    // (the one rule every plan gate reads) and, for a payment that failed, the day
    // they will pause if it is not put right. The billing page says which of those
    // she is in rather than guessing it from the status.
    res.json({
      success: true,
      data: {
        ...subscription,
        entitled: hasLiveEntitlement(subscription),
        graceEndsAt: pastDueGraceEndsAt(subscription)?.toISOString() ?? null,
        // What the member gets today, from the same table the paid routes are gated by.
        entitlements: entitlementsFor(subscription),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// WHAT EACH TIER COSTS
// ===========================================
/**
 * The price of every paid tier, read from the Stripe price checkout will
 * charge, in the currency checkout will charge it in.
 *
 * The billing and pricing pages used to print their own numbers - A$29 and
 * A$99 a month, A$290 a year - while the Pro button started a checkout for
 * whatever the Stripe price really was, and no yearly price existed at all.
 * They read this instead, so the price shown at the point of sale is the one
 * charged.
 *
 * Public, because the pricing page is. A signed-in member is priced in her own
 * currency exactly as checkout resolves it; anyone else in the currency they
 * ask for, or Australian dollars.
 */
router.get('/plans', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    let currency: string;

    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { region: true, preferredCurrency: true },
      });
      currency = getCurrencyForUser(user);
    } else {
      const asked = typeof req.query.currency === 'string' ? req.query.currency.trim() : '';
      currency = /^[A-Za-z]{3}$/.test(asked) ? asked.toUpperCase() : getCurrencyForUser(null);
    }

    const plans = await getSubscriptionPlanPrices(currency);

    // The rest of the price book rides along: the refund promise, the fees and
    // the GST sentence a price page prints beside the price. `currency` here is
    // the one the membership is priced in; the book's own currency is what
    // everything that is not a membership is charged in.
    const book = publicPriceBook(isGstRegistered());

    // The GST sentence opens "Prices are in Australian dollars". It is printed
    // beside the membership prices, which are the Stripe prices checkout
    // charges, and a deployment that has set up a price in another currency
    // (STRIPE_PRICE_<TIER>_<CURRENCY>) shows that price to a member who has
    // chosen that currency. Printing the sentence beside a price in US dollars
    // would say something false on the page that sells the plan, and GST is not
    // a statement about a foreign-currency price anyway, so it is sent only when
    // every price shown is in Australian dollars.
    const sellsOnlyInAud = plans.every((plan) => !plan.available || plan.currency === book.currency);

    // Whether new payments are paused (services/feature-flags.service), so a page
    // can say so and hold its upgrade button instead of letting each press fail.
    // The message is the admin's own wording or the default; it is public.
    const pause = await getPaymentsPause();

    res.json({
      success: true,
      data: {
        currency,
        trialDays: book.trialDays,
        refundDays: book.refundDays,
        gst: sellsOnlyInAud ? book.gst : null,
        fees: book.fees,
        plans,
        // What Free and a paid membership each get, from the table the paid
        // routes are gated by (services/entitlements.service), so the pages print
        // the facts the server enforces and nothing it does not.
        entitlements: planEntitlements(),
        paused: pause.paused,
        pauseMessage: pause.paused ? pause.message : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE CHECKOUT SESSION
// ===========================================
// validated: tier must be one of VALID_TIERS before anything is read or created.
router.post('/checkout', authenticate, startingAPayment, async (req: AuthRequest, res, next) => {
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
    //
    // The same list says whether she already has one. Stripe is asked, not the
    // row on our side: a membership that was bought a moment ago is not on the row
    // until its webhook arrives, and a row that still says ACTIVE for a membership
    // Stripe has since ended would lock her out of buying again. Without this a
    // second checkout made a second subscription, the webhook then pointed her row
    // at the new one, and the first went on billing her card with nothing of ours
    // pointing at it.
    const previousSubscriptions = await getStripe().subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });
    const alreadyBilled = previousSubscriptions.data.find((held) =>
      (BILLING_STATUSES as readonly string[]).includes(held.status.toUpperCase())
    );
    if (alreadyBilled) {
      const endsOn =
        alreadyBilled.cancel_at_period_end && typeof alreadyBilled.current_period_end === 'number'
          ? new Date(alreadyBilled.current_period_end * 1000).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Australia/Brisbane',
            })
          : null;
      throw new ApiError(
        409,
        endsOn
          ? `You already have an ATHENA membership. It is set to end on ${endsOn}, and you keep it until then. To carry on without a gap, use Manage billing on this page; you will not be charged twice.`
          : 'You already have an ATHENA membership, so there is nothing to buy. To change your card or your plan, use Manage billing on this page.'
      );
    }
    const isFirstSubscription = previousSubscriptions.data.length === 0;

    // Create checkout session.
    //
    // The pricing page advertises a free trial. Until now the session
    // carried no trial at all, so anyone who took that offer was charged the
    // full amount immediately — a representation we made and did not honour.
    // TRIAL_DAYS is the same constant the marketing copy renders from.
    //
    // The trial is a card trial and says so. The card is collected here, at the
    // start (`payment_method_collection: 'always'` is Stripe's default for a
    // subscription, written out so a change of default cannot turn this into a
    // no-card trial that converts without her having given a card), and it is
    // charged on the day the trial ends unless she cancels first. Stripe's own
    // checkout page shows the trial and the price after it; the sentence under
    // the button repeats it in ATHENA's words so the charge is never a surprise.
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      payment_method_collection: 'always',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      custom_text: {
        submit: {
          message: isFirstSubscription
            ? `Your ${TRIAL_DAYS}-day free trial starts today and nothing is charged now. Your card is charged the price shown on the day the trial ends, and then on each renewal, unless you cancel first. You can cancel any time from Settings, then Billing, and we will email you a few days before the first charge.`
            : 'Your card is charged the price shown today, and then on each renewal, until you cancel. You can cancel any time from Settings, then Billing.',
        },
      },
      ...(isFirstSubscription
        ? {
            subscription_data: {
              trial_period_days: TRIAL_DAYS,
              metadata: { userId: user.id, tier },
            },
          }
        : {}),
      // Both used to name /subscription/success and /subscription/cancel, and
      // neither page exists: a member who had just paid landed on a 404 with no
      // word on whether it had worked. The billing page reads the flag and
      // says what happened.
      success_url: `${process.env.CLIENT_URL}/dashboard/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard/settings/billing?checkout=cancelled`,
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
      // /settings/billing does not exist; the billing page is under /dashboard.
      // A member who finished in the Stripe portal was sent back to a 404.
      return_url: `${process.env.CLIENT_URL}/dashboard/settings/billing`,
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
    const updated = await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.subscription.update({
      where: { userId: req.user!.id },
      data: { cancelAtPeriodEnd: true },
    });

    // The day the membership ends, as Stripe has it. A cancel is a promise about
    // a date ("you keep Pro until then", or for a trial "you will not be
    // charged"), and the page used to say only that it had been cancelled, which
    // reads as ending now. For a trial the period is the trial, so the date is
    // the day the card would have been charged.
    const endsAt = typeof updated?.current_period_end === 'number' ? new Date(updated.current_period_end * 1000) : null;

    res.json({
      success: true,
      message: 'Subscription will be canceled at end of billing period',
      data: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: endsAt ? endsAt.toISOString() : null,
        trialing: updated?.status === 'trialing',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CHANGE PLAN
// ===========================================
// The tier is checked against the ones checkout sells before anything is read or changed.
const changePlanBody = z.object({
  tier: z
    .string({ required_error: 'Invalid subscription tier', invalid_type_error: 'Invalid subscription tier' })
    .refine((value): value is SubscriptionTierKey => (VALID_TIERS as string[]).includes(value), 'Invalid subscription tier'),
});

/**
 * Moves a live membership onto another paid tier, in place.
 *
 * Checkout refuses a member who already has a membership, so changing plan used
 * to mean the Stripe portal, if the portal happened to be set up to allow it, or
 * cancelling and buying again. This changes the one subscription Stripe is
 * billing, on the price of the new tier in the currency she is already billed
 * in (a subscription cannot change currency), and lets Stripe work out the
 * difference to the day: it is added to, or credited against, her next bill, and
 * a trial carries on untouched. Nothing is charged by this request itself.
 *
 * Her tier on our side is written here as well as by the webhook, so the page she
 * is looking at says the new plan at once; the webhook then writes the same thing.
 */
router.post('/change-plan', authenticate, startingAPayment, zodBody(changePlanBody), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ApiError(401, 'Sign in to continue');
    const { tier } = req.body as z.output<typeof changePlanBody>;

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    const isBilled = subscription && (BILLING_STATUSES as readonly string[]).includes(subscription.status);
    if (!subscription?.stripeSubscriptionId || !isBilled) {
      throw new ApiError(409, 'You do not have a membership to change. You can start one from the plans on this page.');
    }

    if (subscription.status === 'PAST_DUE') {
      throw new ApiError(
        409,
        'Your last payment did not go through. Update your card with Manage billing first, and then you can change your plan.'
      );
    }

    if (subscription.tier === tier) {
      throw new ApiError(400, 'You are already on this plan.');
    }

    const stripe = getStripe();
    const live = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

    if (live.status !== 'active' && live.status !== 'trialing') {
      throw new ApiError(
        409,
        'Stripe shows this membership as not active, so its plan cannot be changed here. Open Manage billing to see where it stands.'
      );
    }

    // One price on the subscription, because that is what checkout makes. Anything
    // else was set up by hand, and swapping "the" price on it would be a guess.
    const items = live.items?.data ?? [];
    if (items.length !== 1) {
      throw new ApiError(409, 'This membership cannot be changed from here. Please get in touch and we will change it for you.');
    }
    const item = items[0];

    // A subscription cannot move to a price in another currency, whatever she has
    // since chosen as her own, so the new price is looked up in the one she pays in.
    const currency = (item.price?.currency || subscription.currency || 'AUD').toUpperCase();
    const priceId = getPriceIdForTier(tier, currency);
    assertRealPriceId(priceId, tier, currency);

    if (priceId === item.price?.id) {
      throw new ApiError(400, 'You are already on this plan.');
    }

    // getPriceIdForTier falls back to the Australian-dollar price for a currency
    // that has none set up, which Stripe would refuse with its own words. Read the
    // price first and say it plainly.
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || !price.recurring || price.currency.toUpperCase() !== currency) {
      throw new ApiError(
        409,
        `That plan is not available in ${currency}, the currency your membership is billed in. Please get in touch and we will move it for you.`
      );
    }

    await stripe.subscriptions.update(live.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    const billed =
      typeof price.unit_amount === 'number'
        ? {
            amount: new Prisma.Decimal(price.unit_amount).div(minorUnitScale(price.currency)),
            currency: price.currency.toUpperCase(),
            interval: price.recurring.interval ?? null,
          }
        : {};

    await prisma.subscription.update({
      where: { userId },
      data: { tier, stripePriceId: priceId, ...billed },
    });

    res.json({
      success: true,
      message:
        live.status === 'trialing'
          ? 'Your plan has been changed. Your free trial carries on, and nothing is charged until it ends.'
          : 'Your plan has been changed. The difference for the rest of this period is worked out to the day and taken from, or credited to, your next bill.',
      data: {
        tier,
        trialing: live.status === 'trialing',
        currentPeriodEnd: typeof live.current_period_end === 'number' ? new Date(live.current_period_end * 1000).toISOString() : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
