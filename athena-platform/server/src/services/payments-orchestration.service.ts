/**
 * Payments Orchestration Service
 * Multi-provider payment routing for global expansion
 */

import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

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

// FX rates cache (would be real-time API in production)
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

function assertProviderConfigured(provider: PaymentProvider): void {
  const message = `${provider} payments are not configured`;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  logger.warn(`${message}; returning development simulation`);
}

/**
 * Get best payment provider for region
 */
export function getBestProvider(
  region: string,
  paymentType?: 'card' | 'wallet' | 'mobile_money'
): PaymentProvider {
  const providers = REGION_PROVIDERS[region] || ['stripe'];
  
  // For wallets and mobile money, prefer local providers
  if (paymentType === 'mobile_money') {
    if (region === 'KE') return 'mpesa';
    if (region === 'PH') return 'gcash';
  }
  
  if (paymentType === 'wallet') {
    if (['SG', 'PH', 'ID'].includes(region)) return 'grabpay';
  }
  
  return providers[0];
}

/**
 * Get available payment methods for user's region
 */
export function getAvailablePaymentMethods(region: string): {
  provider: PaymentProvider;
  type: string;
  name: string;
  icon: string;
}[] {
  const methods = [];

  // Always available
  methods.push({
    provider: 'stripe' as PaymentProvider,
    type: 'card',
    name: 'Credit/Debit Card',
    icon: 'credit-card',
  });

  // Region-specific
  const providers = REGION_PROVIDERS[region] || [];

  if (providers.includes('paypal')) {
    methods.push({
      provider: 'paypal' as PaymentProvider,
      type: 'wallet',
      name: 'PayPal',
      icon: 'paypal',
    });
  }

  if (providers.includes('grabpay')) {
    methods.push({
      provider: 'grabpay' as PaymentProvider,
      type: 'wallet',
      name: 'GrabPay',
      icon: 'grabpay',
    });
  }

  if (providers.includes('gcash')) {
    methods.push({
      provider: 'gcash' as PaymentProvider,
      type: 'wallet',
      name: 'GCash',
      icon: 'gcash',
    });
  }

  if (providers.includes('mpesa')) {
    methods.push({
      provider: 'mpesa' as PaymentProvider,
      type: 'mobile_money',
      name: 'M-Pesa',
      icon: 'mpesa',
    });
  }

  if (providers.includes('pix')) {
    methods.push({
      provider: 'pix' as PaymentProvider,
      type: 'bank',
      name: 'Pix',
      icon: 'pix',
    });
  }

  if (providers.includes('upi')) {
    methods.push({
      provider: 'upi' as PaymentProvider,
      type: 'bank',
      name: 'UPI',
      icon: 'upi',
    });
  }

  return methods;
}

/**
 * Process payment with optimal provider routing
 */
export async function processPayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  const region = CURRENCY_REGION[request.currency] || 'AU';
  const provider = getBestProvider(region);

  logger.info('Processing payment', {
    userId: request.userId,
    amount: request.amount,
    currency: request.currency,
    provider,
  });

  try {
    switch (provider) {
      case 'stripe':
        return await processStripePayment(request);
      case 'paypal':
        return await processPayPalPayment(request);
      case 'grabpay':
        return await processGrabPayPayment(request);
      case 'gcash':
        return await processGCashPayment(request);
      case 'mpesa':
        return await processMPesaPayment(request);
      case 'pix':
        return await processPixPayment(request);
      case 'upi':
        return await processUPIPayment(request);
      default:
        return await processStripePayment(request);
    }
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
  if (!stripe) {
    assertProviderConfigured('stripe');
    return {
      success: false,
      provider: 'stripe',
      status: 'requires_action',
      error: 'Stripe is not configured in this environment',
    };
  }

  // Get or create customer
  let customerId = await getStripeCustomerId(request.userId);
  
  if (!customerId) {
    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      name: user?.displayName || undefined,
      metadata: { userId: request.userId },
    });
    customerId = customer.id;
    // Store customer ID (in production, save to user record)
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
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

/**
 * Process PayPal payment (simulated)
 */
async function processPayPalPayment(request: PaymentRequest): Promise<PaymentResult> {
  assertProviderConfigured('paypal');
  logger.info('Processing PayPal payment', { amount: request.amount });
  
  return {
    success: false,
    provider: 'paypal',
    status: 'requires_action',
    redirectUrl: `https://paypal.com/checkout?amount=${request.amount}`,
  };
}

/**
 * Process GrabPay payment (simulated)
 */
async function processGrabPayPayment(request: PaymentRequest): Promise<PaymentResult> {
  assertProviderConfigured('grabpay');
  logger.info('Processing GrabPay payment', { amount: request.amount });
  
  return {
    success: false,
    provider: 'grabpay',
    status: 'requires_action',
    redirectUrl: `https://grab.com/pay?amount=${request.amount}`,
  };
}

/**
 * Process GCash payment (simulated)
 */
async function processGCashPayment(request: PaymentRequest): Promise<PaymentResult> {
  assertProviderConfigured('gcash');
  logger.info('Processing GCash payment', { amount: request.amount });
  
  return {
    success: false,
    provider: 'gcash',
    status: 'requires_action',
    redirectUrl: `https://gcash.com/pay?amount=${request.amount}`,
  };
}

/**
 * Process M-Pesa payment (simulated)
 */
async function processMPesaPayment(request: PaymentRequest): Promise<PaymentResult> {
  assertProviderConfigured('mpesa');
  logger.info('Processing M-Pesa payment', { amount: request.amount });
  
  return {
    success: false,
    provider: 'mpesa',
    status: 'pending',
    // M-Pesa uses STK push - user receives prompt on phone
  };
}

/**
 * Process Pix payment (simulated)
 */
async function processPixPayment(request: PaymentRequest): Promise<PaymentResult> {
  assertProviderConfigured('pix');
  logger.info('Processing Pix payment', { amount: request.amount });
  
  return {
    success: false,
    provider: 'pix',
    status: 'requires_action',
    // Return QR code data for Pix payment
  };
}

/**
 * Process UPI payment (simulated)
 */
async function processUPIPayment(request: PaymentRequest): Promise<PaymentResult> {
  assertProviderConfigured('upi');
  logger.info('Processing UPI payment', { amount: request.amount });
  
  return {
    success: false,
    provider: 'upi',
    status: 'requires_action',
    // Return UPI deep link
  };
}

/**
 * Process creator payout
 */
export async function processCreatorPayout(
  request: PayoutRequest
): Promise<PaymentResult> {
  const region = CURRENCY_REGION[request.currency] || 'AU';
  
  logger.info('Processing creator payout', {
    userId: request.userId,
    amount: request.amount,
    currency: request.currency,
  });

  try {
    // Use Stripe Connect for most regions
    if (['AU', 'NZ', 'US', 'UK', 'EU', 'SG'].includes(region)) {
      return await processStripeConnectPayout(request);
    }

    // Use Wise for international transfers
    return await processWisePayout(request);
  } catch (error: any) {
    logger.error('Payout failed', { error: error.message });
    return {
      success: false,
      provider: 'stripe',
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Process Stripe Connect payout
 */
async function processStripeConnectPayout(request: PayoutRequest): Promise<PaymentResult> {
  if (!stripe) {
    assertProviderConfigured('stripe');
    return {
      success: false,
      provider: 'stripe',
      status: 'failed',
      error: 'Stripe is not configured in this environment',
    };
  }

  // Get connected account ID
  const connectedAccountId = await getStripeConnectAccountId(request.userId);
  
  if (!connectedAccountId) {
    return {
      success: false,
      provider: 'stripe',
      status: 'failed',
      error: 'Creator payout account not set up',
    };
  }

  const transfer = await stripe.transfers.create({
    amount: Math.round(request.amount * 100),
    currency: request.currency.toLowerCase(),
    destination: connectedAccountId,
  });

  return {
    success: true,
    transactionId: transfer.id,
    provider: 'stripe',
    status: 'completed',
  };
}

/**
 * Process Wise payout (simulated)
 */
async function processWisePayout(request: PayoutRequest): Promise<PaymentResult> {
  assertProviderConfigured('wise');
  logger.info('Processing Wise payout', { amount: request.amount, currency: request.currency });
  
  // In production, integrate with Wise API
  return {
    success: true,
    transactionId: `wise_${Date.now()}`,
    provider: 'wise',
    status: 'pending',
  };
}

/**
 * Convert currency with FX rate
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): { amount: number; rate: number; fee: number } {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1, fee: 0 };
  }

  const rateKey = `${fromCurrency}_${toCurrency}`;
  const rate = FX_RATES[rateKey] || 1;
  const fee = amount * 0.01; // 1% FX fee
  const convertedAmount = (amount - fee) * rate;

  return {
    amount: Math.round(convertedAmount * 100) / 100,
    rate,
    fee,
  };
}

/**
 * Get regional pricing table
 */
export function getRegionalPricing(region: string): {
  currency: Currency;
  subscriptionTiers: Record<string, number>;
  creatorFees: { platformFee: number; paymentFee: number };
} {
  const pricing: Record<string, any> = {
    AU: {
      currency: 'AUD',
      subscriptionTiers: {
        PREMIUM_CAREER: 9.99,
        PREMIUM_PROFESSIONAL: 24.99,
        PREMIUM_ENTREPRENEUR: 19.99,
        PREMIUM_CREATOR: 99,
      },
      creatorFees: { platformFee: 0.20, paymentFee: 0.029 },
    },
    US: {
      currency: 'USD',
      subscriptionTiers: {
        PREMIUM_CAREER: 6.99,
        PREMIUM_PROFESSIONAL: 16.99,
        PREMIUM_ENTREPRENEUR: 13.99,
        PREMIUM_CREATOR: 69,
      },
      creatorFees: { platformFee: 0.20, paymentFee: 0.029 },
    },
    UK: {
      currency: 'GBP',
      subscriptionTiers: {
        PREMIUM_CAREER: 5.99,
        PREMIUM_PROFESSIONAL: 14.99,
        PREMIUM_ENTREPRENEUR: 11.99,
        PREMIUM_CREATOR: 59,
      },
      creatorFees: { platformFee: 0.20, paymentFee: 0.025 },
    },
    SG: {
      currency: 'SGD',
      subscriptionTiers: {
        PREMIUM_CAREER: 8.99,
        PREMIUM_PROFESSIONAL: 22.99,
        PREMIUM_ENTREPRENEUR: 17.99,
        PREMIUM_CREATOR: 89,
      },
      creatorFees: { platformFee: 0.25, paymentFee: 0.034 },
    },
    PH: {
      currency: 'PHP',
      subscriptionTiers: {
        PREMIUM_CAREER: 299,
        PREMIUM_PROFESSIONAL: 799,
        PREMIUM_ENTREPRENEUR: 599,
        PREMIUM_CREATOR: 2999,
      },
      creatorFees: { platformFee: 0.25, paymentFee: 0.034 },
    },
    IN: {
      currency: 'INR',
      subscriptionTiers: {
        PREMIUM_CAREER: 399,
        PREMIUM_PROFESSIONAL: 999,
        PREMIUM_ENTREPRENEUR: 799,
        PREMIUM_CREATOR: 3999,
      },
      creatorFees: { platformFee: 0.25, paymentFee: 0.02 },
    },
  };

  return pricing[region] || pricing['AU'];
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

async function getStripeCustomerId(userId: string): Promise<string | null> {
  // In production, query from user record
  return null;
}

async function getStripeConnectAccountId(userId: string): Promise<string | null> {
  // In production, query from creator profile
  return null;
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
  processPayment,
  processCreatorPayout,
  convertCurrency,
  getRegionalPricing,
};
