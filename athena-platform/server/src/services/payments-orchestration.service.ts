/**
 * Payments Orchestration Service
 * Multi-provider payment routing for global expansion
 */

import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { getPriceIdForTier, SubscriptionTierKey } from '../config/regions';
import { minorUnitScale } from './stripe-connect.service';

// Stripe comes from the one shared client in utils/stripe; `Stripe` is still
// imported here for the PaymentIntent type the webhook handlers take. Whether a
// key exists is asked with isStripeConfigured() rather than by null-testing a
// client, because getStripe() never returns null - outside production it hands
// back a placeholder - and the routing below has to be able to report "stripe is
// not configured in this environment" instead of attempting a charge.

export type PaymentProvider = 'stripe' | 'paypal' | 'wise' | 'gcash' | 'grabpay' | 'mpesa' | 'pix' | 'upi';
export type Currency = 'AUD' | 'USD' | 'GBP' | 'EUR' | 'NZD' | 'SGD' | 'PHP' | 'IDR' | 'INR' | 'BRL' | 'KES';

export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  type: 'card' | 'bank' | 'wallet' | 'mobile_money';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface PaymentRequest {
  userId: string;
  amount: number;
  currency: Currency;
  description: string;
  metadata?: Record<string, string>;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  provider: PaymentProvider;
  status: 'completed' | 'pending' | 'failed' | 'requires_action';
  clientSecret?: string;
  redirectUrl?: string;
  error?: string;
}

export interface PayoutRequest {
  userId: string;
  amount: number;
  currency: Currency;
  destinationType: 'bank' | 'wallet' | 'mobile_money';
  destinationId: string;
}

// Regional payment provider routing
const REGION_PROVIDERS: Record<string, PaymentProvider[]> = {
  AU: ['stripe'],
  NZ: ['stripe'],
  US: ['stripe', 'paypal'],
  UK: ['stripe', 'paypal'],
  EU: ['stripe', 'paypal'],
  SG: ['stripe', 'grabpay'],
  PH: ['gcash', 'grabpay'],
  ID: ['grabpay'],
  IN: ['upi', 'stripe'],
  BR: ['pix', 'stripe'],
  KE: ['mpesa'],
};

// Currency to region mapping
const CURRENCY_REGION: Record<Currency, string> = {
  AUD: 'AU',
  NZD: 'NZ',
  USD: 'US',
  GBP: 'UK',
  EUR: 'EU',
  SGD: 'SG',
  PHP: 'PH',
  IDR: 'ID',
  INR: 'IN',
  BRL: 'BR',
  KES: 'KE',
};

/**
 * Indicative FX rates, and the day they were taken.
 *
 * These are compile-time constants, not a feed, and they are treated as an
 * estimate everywhere they surface. Two things used to be wrong with them and
 * both mattered. Any pair not in this table converted at `|| 1` — a silent
 * parity — so A$100 came back as 99 pesos, 99 rupees or 99 shillings for
 * currencies this service's own type union advertises. And nothing recorded
 * when the numbers were written, so they could drift for years without anything
 * saying so.
 *
 * A missing pair is now a refusal (see convertCurrency) and the date below
 * travels with every quote, so a caller can see how old the number it is
 * showing is.
 */
const FX_RATES_AS_AT = '2025-01-01';

const FX_RATES: Record<string, number> = {
  'AUD_USD': 0.65,
  'USD_AUD': 1.54,
  'AUD_GBP': 0.52,
  'GBP_AUD': 1.92,
  'AUD_EUR': 0.60,
  'EUR_AUD': 1.67,
  'AUD_NZD': 1.08,
  'NZD_AUD': 0.93,
  'AUD_SGD': 0.88,
  'SGD_AUD': 1.14,
  'USD_GBP': 0.80,
  'GBP_USD': 1.25,
};

/** The pairs a quote can actually be given for, for a caller that wants to ask first. */
export function supportedConversions(): string[] {
  return Object.keys(FX_RATES);
}

/**
 * The providers this platform can actually take money with.
 *
 * Stripe is the only one that is built. PayPal, GrabPay, GCash, M-Pesa, Pix and
 * UPI each have a function below, and each of those functions fabricates its
 * answer — there is no integration behind any of them. Routing a member to one
 * is therefore not a payment that might fail; it is a payment that cannot
 * happen, and the difference belongs in one place rather than in six.
 *
 * Stripe counts as live only when a key is configured, because without one it
 * cannot take money either.
 */
export function isProviderLive(provider: PaymentProvider): boolean {
  return provider === 'stripe' && isStripeConfigured();
}

function assertProviderConfigured(provider: PaymentProvider): void {
  const message = `${provider} payments are not configured`;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  logger.warn(`${message}; returning development simulation`);
}

/**
 * What an unbuilt provider returns.
 *
 * Each of these used to answer with a redirect it had invented —
 * `paypal.com/checkout?amount=`, `grab.com/pay?amount=`,
 * `gcash.com/pay?amount=` — none of which is a checkout anywhere. A UI given
 * one of those would have sent a woman to a page that could not take her money
 * and, for the two that are not even real endpoints, would have shown her an
 * error from somebody else's domain. Nothing is invented now: the result says
 * the provider is not available and names it.
 */
function providerNotAvailable(provider: PaymentProvider): PaymentResult {
  assertProviderConfigured(provider);

  return {
    success: false,
    provider,
    status: 'failed',
    error: `ATHENA cannot take payments through ${provider} yet. Please pay by card.`,
  };
}

/**
 * The provider a payment in this region should go through: the first one in
 * order of preference that can actually take the money, or null when none can.
 *
 * The preference order is unchanged — a local wallet or mobile-money provider
 * first when that is what was asked for, then the region's own list, then card
 * — but it is now filtered through isProviderLive, the same test
 * getAvailablePaymentMethods applies. This function used to return the first
 * name in the table whether or not it was built, so /best-provider answered
 * 'gcash' for the Philippines, 'upi' for India and 'pix' for Brazil, and
 * processPayment, which routes by this answer, then refused every payment in
 * PHP, IDR, INR, BRL or KES with "please pay by card" — to a member whom
 * /methods had just offered card.
 *
 * Card (Stripe) is always the last candidate because Stripe charges in every
 * region the table names, whether or not the region lists it.
 */
export function getBestProvider(
  region: string,
  paymentType?: 'card' | 'wallet' | 'mobile_money'
): PaymentProvider | null {
  const candidates: PaymentProvider[] = [];

  // For wallets and mobile money, prefer local providers
  if (paymentType === 'mobile_money') {
    if (region === 'KE') candidates.push('mpesa');
    if (region === 'PH') candidates.push('gcash');
  }

  if (paymentType === 'wallet') {
    if (['SG', 'PH', 'ID'].includes(region)) candidates.push('grabpay');
  }

  candidates.push(...(REGION_PROVIDERS[region] || []), 'stripe');

  return candidates.find(isProviderLive) ?? null;
}

const PROVIDER_LABELS: Record<PaymentProvider, { type: string; name: string; icon: string }> = {
  stripe: { type: 'card', name: 'Credit/Debit Card', icon: 'credit-card' },
  paypal: { type: 'wallet', name: 'PayPal', icon: 'paypal' },
  grabpay: { type: 'wallet', name: 'GrabPay', icon: 'grabpay' },
  gcash: { type: 'wallet', name: 'GCash', icon: 'gcash' },
  mpesa: { type: 'mobile_money', name: 'M-Pesa', icon: 'mpesa' },
  pix: { type: 'bank', name: 'Pix', icon: 'pix' },
  upi: { type: 'bank', name: 'UPI', icon: 'upi' },
  wise: { type: 'bank', name: 'Wise', icon: 'wise' },
};

/**
 * The payment methods a member in this region can actually use.
 *
 * This endpoint used to list every provider mapped to the region regardless of
 * whether it was built or configured, so a woman in Manila was offered GCash and
 * GrabPay and a woman in Nairobi was offered M-Pesa, and all three of those
 * choices led to a function that fabricated a result. Six advertised ways to pay
 * and one that worked. Only live providers are returned now — which is Stripe,
 * and only where a key is configured — so the list matches what /process will
 * accept.
 */
export function getAvailablePaymentMethods(region: string): {
  provider: PaymentProvider;
  type: string;
  name: string;
  icon: string;
}[] {
  // Card is offered in every region Stripe covers, whether or not the region
  // table names it, which is why stripe is unioned in rather than looked up.
  const candidates = new Set<PaymentProvider>(['stripe', ...(REGION_PROVIDERS[region] || [])]);

  return [...candidates]
    .filter(isProviderLive)
    .map((provider) => ({ provider, ...PROVIDER_LABELS[provider] }));
}

/**
 * Process payment with optimal provider routing
 */
export async function processPayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  const region = CURRENCY_REGION[request.currency] || 'AU';
  // No live provider means Stripe has no key in this environment. Stripe is
  // still the path, because its own branch is what says so — as a 503 in
  // production and as the development result everywhere else — rather than
  // this function inventing a third answer.
  const provider: PaymentProvider = getBestProvider(region) ?? 'stripe';

  logger.info('Processing payment', {
    userId: request.userId,
    amount: request.amount,
    currency: request.currency,
    provider,
  });

  try {
    if (provider !== 'stripe') {
      return providerNotAvailable(provider);
    }

    return await processStripePayment(request);
  } catch (error: any) {
    logger.error('Payment processing failed', { error: error.message, provider });
    return {
      success: false,
      provider,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Process Stripe payment
 */
async function processStripePayment(request: PaymentRequest): Promise<PaymentResult> {
  if (!isStripeConfigured()) {
    assertProviderConfigured('stripe');
    return {
      success: false,
      provider: 'stripe',
      status: 'requires_action',
      error: 'Stripe is not configured in this environment',
    };
  }

  const customerId = await resolveStripeCustomerId(request.userId);

  // Create payment intent
  const paymentIntent = await getStripe().paymentIntents.create({
    amount: Math.round(request.amount * 100), // Convert to cents
    currency: request.currency.toLowerCase(),
    customer: customerId,
    description: request.description,
    metadata: request.metadata || {},
    payment_method: request.paymentMethodId,
    confirm: !!request.paymentMethodId,
    return_url: request.returnUrl,
  });

  return {
    success: paymentIntent.status === 'succeeded',
    transactionId: paymentIntent.id,
    provider: 'stripe',
    status: mapStripeStatus(paymentIntent.status),
    clientSecret: paymentIntent.client_secret || undefined,
  };
}

// PayPal, GrabPay, GCash, M-Pesa, Pix and UPI are not integrated. Each is
// routed through the one refusal above rather than its own invented answer, so
// that there is a single place to delete from when one of them is genuinely
// built.

/**
 * Creator payouts do not happen here, and this says so rather than trying.
 *
 * This was a second way out of the platform's Stripe balance, and it was the
 * dangerous one. It took the amount straight from the request body with no
 * reference to what the creator had actually earned, moved the money with a
 * bare transfers.create, and wrote no CreatorPayout row at all - so anything
 * paid out this way was invisible to her payout history and to the earnings
 * statement, and nothing stopped the same amount being asked for twice. It
 * only ever failed in practice because the destination lookup behind it was a
 * stub that returned null for every creator, which is the sort of accident
 * that stops being an accident the moment somebody finishes the stub.
 *
 * A creator payout is a claim against a balance. creator.service's
 * requestPayout is the one path that can make that claim: it decrements
 * pendingPayout, files the CreatorPayout row the Stripe webhook later moves
 * to COMPLETED, and pays out what she is owed rather than what was typed.
 * Two doors disagreeing about whether a payout is recorded is worse than one
 * door, so this one is shut and named.
 */
export async function processCreatorPayout(
  request: PayoutRequest
): Promise<PaymentResult> {
  logger.warn('A creator payout was requested through the orchestration route', {
    userId: request.userId,
    amount: request.amount,
    currency: request.currency,
  });

  return {
    success: false,
    provider: 'stripe',
    status: 'failed',
    error:
      'Creator payouts are made against your earned balance, from Creator tools; this route cannot pay an arbitrary amount.',
  };
}

/**
 * An indicative conversion, or nothing.
 *
 * `FX_RATES[rateKey] || 1` was the whole of the rate lookup, so every pair
 * outside the twelve-entry table converted at parity after the 1% fee was taken
 * off: A$100 to PHP returned 99, A$100 to INR returned 99, A$100 to KES
 * returned 99. Those are currencies the Currency union above offers, so this
 * was not an edge — it was most of the advertised surface returning a number
 * that was wrong by a factor of fifty and looked like a quote.
 *
 * An unsupported pair now throws. `rateAsAt` goes out with every quote that
 * does work, because these are stored numbers rather than a live feed and a
 * caller showing one to a member should be able to say how old it is.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): { amount: number; rate: number; fee: number; rateAsAt: string } {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1, fee: 0, rateAsAt: FX_RATES_AS_AT };
  }

  const rateKey = `${fromCurrency}_${toCurrency}`;
  const rate = FX_RATES[rateKey];

  if (rate === undefined) {
    throw new ApiError(
      422,
      `ATHENA has no exchange rate for ${fromCurrency} to ${toCurrency}, so it cannot quote this conversion.`
    );
  }

  const fee = amount * 0.01; // 1% FX fee
  const convertedAmount = (amount - fee) * rate;

  return {
    amount: Math.round(convertedAmount * 100) / 100,
    rate,
    fee,
    rateAsAt: FX_RATES_AS_AT,
  };
}

// ==========================================
// MEMBERSHIP PRICES
// ==========================================

/** The paid membership tiers checkout sells. `ENTERPRISE` is not one: it has no Stripe price in any currency. */
export const PAID_TIERS: SubscriptionTierKey[] = [
  'PREMIUM_CAREER',
  'PREMIUM_PROFESSIONAL',
  'PREMIUM_ENTREPRENEUR',
  'PREMIUM_CREATOR',
];

// The exact fallbacks in config/regions.ts, for a tier whose STRIPE_PRICE_*
// variable is unset. If a tier is added there its placeholder belongs here too;
// a placeholder missing from this list is not a crash, it is a checkout sent to
// Stripe with a price that does not exist, which is why the list is written
// out rather than inferred from a pattern that a real price id might also match.
const PLACEHOLDER_PRICE_IDS = new Set([
  'price_career',
  'price_professional',
  'price_entrepreneur',
  'price_creator',
]);

/** Whether a price id is one of the literals config/regions.ts falls back to, rather than a real Stripe price. */
export function isPlaceholderPriceId(priceId: string): boolean {
  return PLACEHOLDER_PRICE_IDS.has(priceId);
}

/**
 * What one membership tier costs, as Stripe will charge it.
 *
 * `available: false` means no price is shown for the tier at all: its price id
 * is a placeholder, Stripe is not configured, or Stripe could not be asked. A
 * page that gets one of those says it does not know the price rather than
 * printing a number, because the number it used to print was invented.
 */
export interface SubscriptionPlanPrice {
  tier: SubscriptionTierKey;
  available: boolean;
  /** Upper-case ISO code of the price itself, which is not always the one asked for. */
  currency?: string;
  /** In the currency's smallest unit, exactly as Stripe holds it. */
  unitAmount?: number;
  /** In major units, for display. */
  amount?: number;
  interval?: Stripe.Price.Recurring.Interval;
  intervalCount?: number;
}

// Prices change when somebody edits them in the Stripe dashboard, which is
// rare, and the public pricing page would otherwise make four Stripe calls for
// every visitor. Ten minutes is short enough that a price change shows up
// before anyone reaches checkout with the old number in mind. Only complete,
// successful reads are kept, so an outage is not remembered after it ends.
const PLAN_PRICE_TTL_MS = 10 * 60 * 1000;
const planPriceCache = new Map<string, { at: number; plans: SubscriptionPlanPrice[] }>();

/** Drops the cached prices, so the next read goes to Stripe. */
export function clearPlanPriceCache(): void {
  planPriceCache.clear();
}

/**
 * The price of every paid tier, read from the Stripe price that checkout will
 * actually charge for a member in `currency`.
 *
 * Before this, three places each held their own numbers and none of them was
 * Stripe: the billing page said A$29 and A$99, lib/pricing.ts said A$29 a month
 * or A$290 a year, and the table getRegionalPricing returned said A$9.99. The
 * Pro button then started a monthly PREMIUM_CAREER checkout at whatever the
 * Stripe price really was. The price shown at the point of sale has to be the
 * price charged, so it is now read from the same price id checkout uses.
 */
export async function getSubscriptionPlanPrices(currency: string): Promise<SubscriptionPlanPrice[]> {
  const code = currency.toUpperCase();

  if (!isStripeConfigured()) {
    return PAID_TIERS.map((tier) => ({ tier, available: false }));
  }

  const cached = planPriceCache.get(code);
  if (cached && Date.now() - cached.at < PLAN_PRICE_TTL_MS) {
    return cached.plans;
  }

  let complete = true;

  const plans = await Promise.all(
    PAID_TIERS.map(async (tier): Promise<SubscriptionPlanPrice> => {
      const priceId = getPriceIdForTier(tier, code);
      if (isPlaceholderPriceId(priceId)) {
        return { tier, available: false };
      }

      try {
        const price = await getStripe().prices.retrieve(priceId);

        // A price with no fixed unit amount (tiered, metered or pay-what-you-
        // want) has no single number to show, and an inactive one cannot be
        // bought. Neither is shown as though it could be.
        if (!price.active || price.unit_amount == null) {
          return { tier, available: false };
        }

        const priceCurrency = price.currency.toUpperCase();
        return {
          tier,
          available: true,
          currency: priceCurrency,
          unitAmount: price.unit_amount,
          amount: price.unit_amount / minorUnitScale(priceCurrency),
          interval: price.recurring?.interval,
          intervalCount: price.recurring?.interval_count,
        };
      } catch (error) {
        complete = false;
        logger.error('Could not read a membership price from Stripe', { tier, currency: code, priceId, error });
        return { tier, available: false };
      }
    })
  );

  if (complete) {
    planPriceCache.set(code, { at: Date.now(), plans });
  }

  return plans;
}

// The currency each region is priced in. A region not listed is priced as
// Australia, this being a Queensland platform.
const REGION_CURRENCY: Record<string, string> = {
  AU: 'AUD',
  US: 'USD',
  UK: 'GBP',
  SG: 'SGD',
  PH: 'PHP',
  IN: 'INR',
};

// The platform's cut and the card processor's, per region. Unchanged from the
// table these sat in; only the membership prices beside them were invented.
const CREATOR_FEES: Record<string, { platformFee: number; paymentFee: number }> = {
  AU: { platformFee: 0.20, paymentFee: 0.029 },
  US: { platformFee: 0.20, paymentFee: 0.029 },
  UK: { platformFee: 0.20, paymentFee: 0.025 },
  SG: { platformFee: 0.25, paymentFee: 0.034 },
  PH: { platformFee: 0.25, paymentFee: 0.034 },
  IN: { platformFee: 0.25, paymentFee: 0.02 },
};

/**
 * Membership prices for a region, for the mobile upgrade screen.
 *
 * `subscriptionTiers` used to be a hand-written table — A$9.99 for Career,
 * A$24.99 for Professional — that nothing kept in step with Stripe, and that
 * disagreed with every other price the platform showed. It is now built from
 * getSubscriptionPlanPrices, and keeps its old shape (major units, one currency,
 * per month) so the screens reading it still work. A tier is left out of it
 * rather than guessed at when its price could not be read, is not monthly, or is
 * in a different currency from the rest: a missing price renders as a dash, and
 * a wrong one renders as a promise. `prices` carries the full detail for a
 * caller that can use it.
 */
export async function getRegionalPricing(region: string): Promise<{
  currency: string;
  subscriptionTiers: Record<string, number>;
  prices: SubscriptionPlanPrice[];
  creatorFees: { platformFee: number; paymentFee: number };
}> {
  const regionCode = REGION_CURRENCY[region] ? region : 'AU';
  const prices = await getSubscriptionPlanPrices(REGION_CURRENCY[regionCode]);

  // The currency the prices really came back in. A region whose price ids are
  // not all configured falls back to the Australian ones, so this is read from
  // the prices rather than assumed from the region.
  const readable = prices.filter((p) => p.available && p.currency);
  const currency = readable[0]?.currency ?? REGION_CURRENCY[regionCode];

  const subscriptionTiers: Record<string, number> = {};
  for (const plan of readable) {
    if (
      plan.currency === currency &&
      plan.interval === 'month' &&
      (plan.intervalCount ?? 1) === 1 &&
      plan.amount != null
    ) {
      subscriptionTiers[plan.tier] = plan.amount;
    }
  }

  return {
    currency,
    subscriptionTiers,
    prices,
    creatorFees: CREATOR_FEES[regionCode],
  };
}

// ==========================================
// ACCELERATOR ENROLLMENT PAYMENTS
// ==========================================

// The discriminator the Stripe webhook switches on for accelerator payments.
export const ACCELERATOR_PAYMENT_TYPE = 'accelerator_enrollment';

export interface AcceleratorPaymentIntent {
  free: boolean;
  amountCents: number;
  currency: Currency;
  clientSecret?: string | null;
  paymentIntentId?: string;
  status: PaymentResult['status'];
  error?: string;
}

export type AcceleratorPaymentOutcome =
  | { status: 'confirmed'; enrollmentId: string }
  | { status: 'already_processed'; enrollmentId: string }
  | { status: 'amount_mismatch'; enrollmentId: string }
  | { status: 'unknown_enrollment'; enrollmentId: string | null };

/**
 * Cohort prices are Decimal dollars; Stripe works in minor units. Anything that
 * is not a finite number is treated as zero rather than NaN, which would sail
 * through a comparison and let an unpaid enrollment look settled.
 */
function toCents(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/**
 * Start payment for an accelerator enrollment.
 *
 * The caller is responsible for authorising the enrollment; this function owns
 * the money: it prices the cohort, records the intent id against the enrollment
 * so the webhook can be cross-checked, and never activates a spot it has not
 * been paid for.
 */
export async function createAcceleratorEnrollmentPayment(params: {
  enrollmentId: string;
  userId: string;
  cohortId: string;
  cohortName: string;
  priceAud: unknown;
}): Promise<AcceleratorPaymentIntent> {
  const amountCents = toCents(params.priceAud);

  if (amountCents <= 0) {
    // A cohort priced at zero is genuinely paid in full, so the enrollment is
    // activated without a Stripe round trip rather than being left in limbo.
    await prisma.acceleratorEnrollment.update({
      where: { id: params.enrollmentId },
      data: { paymentStatus: 'PAID', status: 'ACTIVE' },
    });

    logger.info('Accelerator enrollment activated without payment (cohort is free)', {
      enrollmentId: params.enrollmentId,
      cohortId: params.cohortId,
    });

    return { free: true, amountCents: 0, currency: 'AUD', status: 'completed' };
  }

  const result = await processPayment({
    userId: params.userId,
    amount: amountCents / 100,
    currency: 'AUD',
    description: `Accelerator cohort: ${params.cohortName}`,
    metadata: {
      type: ACCELERATOR_PAYMENT_TYPE,
      enrollmentId: params.enrollmentId,
      cohortId: params.cohortId,
      userId: params.userId,
      // Stripe signs this back to us on the webhook, so it is the price the
      // applicant actually agreed to even if the cohort is repriced later.
      amountCents: String(amountCents),
    },
  });

  if (!result.transactionId) {
    return {
      free: false,
      amountCents,
      currency: 'AUD',
      status: result.status,
      error: result.error,
    };
  }

  await prisma.acceleratorEnrollment.update({
    where: { id: params.enrollmentId },
    data: { paymentId: result.transactionId },
  });

  return {
    free: false,
    amountCents,
    currency: 'AUD',
    clientSecret: result.clientSecret || null,
    paymentIntentId: result.transactionId,
    status: result.status,
  };
}

/**
 * Confirm an accelerator payment from a verified Stripe webhook event.
 *
 * Returns an outcome rather than throwing: a mismatch is deterministic, and
 * making Stripe retry it forever would not fix anything.
 */
export async function confirmAcceleratorEnrollmentPayment(
  paymentIntent: Stripe.PaymentIntent
): Promise<AcceleratorPaymentOutcome> {
  const metadata = (paymentIntent.metadata as any) || {};
  const enrollmentId = typeof metadata.enrollmentId === 'string' ? metadata.enrollmentId : null;

  if (!enrollmentId) {
    logger.error('Accelerator payment intent carries no enrollmentId', {
      paymentIntentId: paymentIntent.id,
    });
    return { status: 'unknown_enrollment', enrollmentId: null };
  }

  const enrollment = await prisma.acceleratorEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { cohort: true },
  });

  if (!enrollment) {
    logger.error('Accelerator payment intent references an unknown enrollment', {
      paymentIntentId: paymentIntent.id,
      enrollmentId,
    });
    return { status: 'unknown_enrollment', enrollmentId };
  }

  if (enrollment.paymentStatus === 'PAID') {
    return { status: 'already_processed', enrollmentId };
  }

  const quoted = Number(metadata.amountCents);
  const quotedCents = Number.isFinite(quoted) && quoted > 0 ? Math.round(quoted) : 0;
  const expectedCents = quotedCents || toCents(enrollment.cohort.priceAud);
  const receivedCents = paymentIntent.amount_received || paymentIntent.amount;

  if (receivedCents !== expectedCents || paymentIntent.currency.toLowerCase() !== 'aud') {
    logger.error('Accelerator payment amount does not match the cohort price', {
      enrollmentId,
      paymentIntentId: paymentIntent.id,
      expectedCents,
      receivedCents,
      currency: paymentIntent.currency,
    });
    return { status: 'amount_mismatch', enrollmentId };
  }

  await prisma.acceleratorEnrollment.update({
    where: { id: enrollmentId },
    data: {
      paymentStatus: 'PAID',
      paymentId: paymentIntent.id,
      // A participant who dropped out and whose card settled late keeps the
      // status they chose; only a pending spot is activated by payment.
      ...(enrollment.status === 'PENDING' ? { status: 'ACTIVE' as const } : {}),
    },
  });

  logger.info('Accelerator enrollment payment confirmed', {
    enrollmentId,
    paymentIntentId: paymentIntent.id,
    amountCents: receivedCents,
  });

  return { status: 'confirmed', enrollmentId };
}

/**
 * Record a failed or canceled accelerator payment so the applicant is told to
 * try again instead of waiting on a spot that was never paid for.
 */
export async function recordAcceleratorPaymentFailure(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const enrollmentId = (paymentIntent.metadata as any)?.enrollmentId;
  if (typeof enrollmentId !== 'string' || enrollmentId.length === 0) return;

  const enrollment = await prisma.acceleratorEnrollment.findUnique({
    where: { id: enrollmentId },
  });

  // Never move a settled enrollment backwards on a late failure event.
  if (!enrollment || enrollment.paymentStatus !== 'PENDING') return;

  await prisma.acceleratorEnrollment.update({
    where: { id: enrollmentId },
    data: { paymentStatus: 'FAILED', paymentId: paymentIntent.id },
  });

  logger.warn('Accelerator enrollment payment did not complete', {
    enrollmentId,
    paymentIntentId: paymentIntent.id,
  });
}

// Helper functions

/**
 * The one Stripe customer behind a member, created once and remembered.
 *
 * The lookup this replaces was a two-line stub whose whole body was a comment
 * and `return null`, so every call to processStripePayment fell through to
 * customers.create and Stripe accumulated a fresh customer record for the same
 * woman on every single payment. Nothing pointed her subscription, her saved
 * cards or her billing portal at any of them, and Stripe's own dashboard showed
 * one person as a dozen.
 *
 * `Subscription.stripeCustomerId` is where the id lives — subscription.routes
 * writes it on the first checkout and reads it back for the billing portal — so
 * that is the column consulted and written here too, rather than a second one
 * that would disagree with it.
 */
async function resolveStripeCustomerId(userId: string): Promise<string> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  });

  const customer = await getStripe().customers.create({
    email: user?.email || undefined,
    name: user?.displayName || undefined,
    metadata: { userId },
  });

  // updateMany, because a member who has never had a membership has no
  // Subscription row at all and an update would throw on her. She still gets a
  // customer for this one payment; the id is simply not stored until there is a
  // row to store it on, which is the same position as before this change for
  // her and a strict improvement for everybody who has one.
  const stored = await prisma.subscription.updateMany({
    where: { userId },
    data: { stripeCustomerId: customer.id },
  });

  if (stored.count === 0) {
    logger.info('Created a Stripe customer for a member with no subscription row to hold it', {
      userId,
      customerId: customer.id,
    });
  }

  return customer.id;
}

function mapStripeStatus(status: string): PaymentResult['status'] {
  switch (status) {
    case 'succeeded':
      return 'completed';
    case 'processing':
    case 'requires_capture':
      return 'pending';
    case 'requires_action':
    case 'requires_confirmation':
    case 'requires_payment_method':
      return 'requires_action';
    default:
      return 'failed';
  }
}

export default {
  getBestProvider,
  getAvailablePaymentMethods,
  isProviderLive,
  processPayment,
  processCreatorPayout,
  convertCurrency,
  supportedConversions,
  getRegionalPricing,
};
