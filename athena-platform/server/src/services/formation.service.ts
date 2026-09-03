/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */

import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { transition } from './formation-state-machine.service';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;
const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production';
const allowStripeSimulation = process.env.ALLOW_STRIPE_SIMULATION === 'true';

// Formation fee amounts in cents by business type
const FORMATION_FEES: Record<BusinessType, number> = {
  SOLE_TRADER: 4900,   // $49 AUD
  PARTNERSHIP: 9900,   // $99 AUD
  COMPANY: 49900,      // $499 AUD
  TRUST: 69900,        // $699 AUD
};

// Formation fees are quoted in AUD only, so a payment in any other currency
// is a mismatch rather than something to convert.
const FORMATION_FEE_CURRENCY = 'aud';

// The discriminator the Stripe webhook switches on for formation payments.
export const FORMATION_PAYMENT_TYPE = 'business_formation';

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasNonEmptyArray(data: Record<string, any>, keys: string[]): boolean {
  return keys.some((key) => Array.isArray(data[key]) && data[key].length > 0);
}

function hasNonEmptyObject(data: Record<string, any>, keys: string[]): boolean {
  return keys.some((key) => {
    const v = data[key];
    return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;
  });
}

function validateRegistrationForSubmission(registration: {
  type: BusinessType;
  status: BusinessStatus;
  businessName: string | null;
  data: Prisma.JsonValue | null;
}) {
  if (registration.status !== 'DRAFT' && registration.status !== 'NEEDS_INFO') {
    throw new ApiError(400, 'Cannot submit registration in this status');
  }

  const data = asRecord(registration.data);
  const businessName =
    nonEmptyString(registration.businessName) || nonEmptyString(data.businessName) || null;

  if (!businessName) {
    throw new ApiError(400, 'Business name is required to submit');
  }

  // NOTE: The JSON `data` shape can evolve with the client; these checks are
  // intentionally flexible (accepting multiple possible keys) while still
  // preventing clearly incomplete submissions.
  if (registration.type === 'COMPANY') {
    const hasPeople = hasNonEmptyArray(data, ['directors', 'people', 'participants', 'members']);
    const hasAddress = hasNonEmptyObject(data, [
      'registeredAddress',
      'businessAddress',
      'principalPlaceOfBusiness',
      'address',
    ]);

    if (!hasPeople || !hasAddress) {
      throw new ApiError(
        400,
        'Company registrations require director/participant details and a registered address'
      );
    }
  }

  if (registration.type === 'PARTNERSHIP') {
    const hasPartners = hasNonEmptyArray(data, ['partners', 'people', 'participants', 'members']);
    if (!hasPartners) {
      throw new ApiError(400, 'Partnership registrations require partner details');
    }
  }

  if (registration.type === 'TRUST') {
    const hasTrustees = hasNonEmptyArray(data, ['trustees', 'people', 'participants', 'members']);
    const hasTrusteeObject = hasNonEmptyObject(data, ['trustee']);
    if (!hasTrustees && !hasTrusteeObject) {
      throw new ApiError(400, 'Trust registrations require trustee details');
    }
  }
}

export async function createRegistration(
  userId: string,
  type: BusinessType,
  businessName: string
) {
  return prisma.businessRegistration.create({
    data: {
      userId,
      type,
      businessName,
      status: 'DRAFT',
      data: {}, // Initialize empty data
    },
  });
}

export async function updateRegistration(
  userId: string,
  registrationId: string,
  data: any
) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  if (registration.status !== 'DRAFT' && registration.status !== 'NEEDS_INFO') {
    throw new ApiError(400, 'Cannot update registration in this status');
  }

  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      data: data, // Updates the JSON blob
      businessName: data.businessName || registration.businessName,
    },
  });
}

export interface FormationPaymentIntent {
  paymentIntentId: string;
  clientSecret: string | null;
  amountCents: number;
  currency: string;
}

// A PaymentIntent in one of these states has not taken money yet, so it can be
// handed back to a returning applicant instead of creating a second charge.
const REUSABLE_INTENT_STATUSES = new Set<string>([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
]);

function isSimulatedIntent(paymentIntentId: string): boolean {
  return paymentIntentId.startsWith('mock_pi_');
}

function assertStripeAvailable(registrationId: string): void {
  if (isProduction && !allowStripeSimulation) {
    logger.error('Stripe not configured in production for formation payments', { registrationId });
    throw new ApiError(500, 'Payment processing is unavailable. Please contact support.');
  }
}

/**
 * Create - or hand back - the PaymentIntent that pays a registration's fee.
 *
 * Reuse is the point: an applicant who closes the tab mid-checkout and comes
 * back must land on the same intent, otherwise abandoned intents pile up and a
 * double payment becomes possible.
 */
async function ensureFormationPaymentIntent(registration: {
  id: string;
  userId: string;
  type: BusinessType;
  businessName: string | null;
  data: Prisma.JsonValue | null;
}): Promise<FormationPaymentIntent> {
  const amountCents = FORMATION_FEES[registration.type];
  const existingId = nonEmptyString(asRecord(registration.data).stripePaymentIntentId);

  if (!stripe) {
    assertStripeAvailable(registration.id);
    // Development without Stripe keys: a deterministic id so the rest of the
    // flow (and its tests) can run end to end without taking money.
    const paymentIntentId =
      existingId && isSimulatedIntent(existingId) ? existingId : `mock_pi_${registration.id}`;
    logger.info('Mock formation payment (Stripe not configured)', {
      registrationId: registration.id,
      amountCents,
    });
    return { paymentIntentId, clientSecret: null, amountCents, currency: FORMATION_FEE_CURRENCY };
  }

  if (existingId && !isSimulatedIntent(existingId)) {
    try {
      const existing = await stripe.paymentIntents.retrieve(existingId);
      // The fee table can change between attempts, so only reuse an intent that
      // still asks for exactly what we would charge today.
      if (REUSABLE_INTENT_STATUSES.has(existing.status) && existing.amount === amountCents) {
        return {
          paymentIntentId: existing.id,
          clientSecret: existing.client_secret || null,
          amountCents,
          currency: existing.currency,
        };
      }
    } catch (error) {
      logger.warn('Could not reuse formation payment intent, creating a new one', {
        registrationId: registration.id,
        existingId,
      });
    }
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: registration.userId } });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: FORMATION_FEE_CURRENCY,
      metadata: {
        // `type` is what the Stripe webhook routes on; without it a successful
        // payment lands nowhere and the registration stalls at PAYMENT_PENDING.
        type: FORMATION_PAYMENT_TYPE,
        registrationId: registration.id,
        userId: registration.userId,
        businessType: registration.type,
        businessName: registration.businessName || 'Unknown',
      },
      description: `Business Formation: ${registration.type} - ${registration.businessName}`,
      receipt_email: user?.email || undefined,
    });

    logger.info('Created formation payment intent', {
      registrationId: registration.id,
      paymentIntentId: paymentIntent.id,
      amount: amountCents,
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || null,
      amountCents,
      currency: FORMATION_FEE_CURRENCY,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to create Stripe payment intent', { error, registrationId: registration.id });
    throw new ApiError(500, 'Payment processing failed. Please try again.');
  }
}

export async function submitRegistration(userId: string, registrationId: string) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  validateRegistrationForSubmission(registration);

  const payment = await ensureFormationPaymentIntent(registration);

  const updated = await prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status: 'PAYMENT_PENDING',
      submittedAt: new Date(),
      data: {
        ...asRecord(registration.data),
        stripePaymentIntentId: payment.paymentIntentId,
        formationFeeCents: payment.amountCents,
        formationFeeCurrency: payment.currency,
      },
    },
  });

  // The client cannot collect the fee without a client secret, so the payment
  // details travel back with the registration rather than in a second call.
  return { ...updated, payment };
}

/**
 * Hand a PAYMENT_PENDING registration its payment details again, so an
 * applicant who abandoned checkout can finish paying without re-submitting.
 */
export async function getFormationPayment(userId: string, registrationId: string) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  if (registration.status !== 'PAYMENT_PENDING') {
    throw new ApiError(400, 'Registration is not awaiting payment');
  }

  const payment = await ensureFormationPaymentIntent(registration);

  // Persist a newly minted intent id, otherwise the webhook cannot tie the
  // payment back to this registration.
  if (asRecord(registration.data).stripePaymentIntentId !== payment.paymentIntentId) {
    await prisma.businessRegistration.update({
      where: { id: registrationId },
      data: {
        data: {
          ...asRecord(registration.data),
          stripePaymentIntentId: payment.paymentIntentId,
          formationFeeCents: payment.amountCents,
          formationFeeCurrency: payment.currency,
        },
      },
    });
  }

  return payment;
}

export type FormationPaymentOutcome =
  | { status: 'confirmed'; registrationId: string }
  | { status: 'already_processed'; registrationId: string }
  | { status: 'amount_mismatch'; registrationId: string }
  | { status: 'unknown_registration'; registrationId: string | null };

/**
 * Advance a paid registration.
 *
 * Everything that marks money as received funnels through here so the webhook
 * and the browser-side confirmation cannot disagree about the amount, and so a
 * replayed event is a no-op rather than a second state transition.
 */
async function markFormationPaid(
  registration: {
    id: string;
    type: BusinessType;
    status: BusinessStatus;
    data: Prisma.JsonValue | null;
  },
  payment: { paymentIntentId: string; amountCents: number; currency: string }
): Promise<FormationPaymentOutcome> {
  const data = asRecord(registration.data);

  if (registration.status !== 'PAYMENT_PENDING') {
    // Already advanced. A different intent against a non-pending registration
    // is an anomaly worth a log line, but it still must not re-transition.
    if (data.paymentId !== payment.paymentIntentId) {
      logger.warn('Formation payment for a registration that is not awaiting payment', {
        registrationId: registration.id,
        status: registration.status,
        paymentIntentId: payment.paymentIntentId,
      });
    }
    return { status: 'already_processed', registrationId: registration.id };
  }

  const expectedCents = FORMATION_FEES[registration.type];
  if (
    payment.amountCents !== expectedCents ||
    payment.currency.toLowerCase() !== FORMATION_FEE_CURRENCY
  ) {
    // Underpaid, overpaid or wrong currency: refuse to call it paid. A human
    // has to reconcile it; silently advancing would be the worse failure.
    logger.error('Formation payment amount does not match the formation fee', {
      registrationId: registration.id,
      paymentIntentId: payment.paymentIntentId,
      expectedCents,
      receivedCents: payment.amountCents,
      currency: payment.currency,
    });
    return { status: 'amount_mismatch', registrationId: registration.id };
  }

  const paymentResult = await transition(registration.id, 'PAYMENT_SUCCESS', {
    // PAYMENT_COMPLETE requires paymentId, and this is also the record that
    // makes a replayed event recognisable as a duplicate.
    paymentId: payment.paymentIntentId,
    paidAt: new Date().toISOString(),
    paidAmountCents: payment.amountCents,
    paidCurrency: payment.currency.toLowerCase(),
  });

  if (!paymentResult.success) {
    logger.error('Formation payment recorded but the state transition was rejected', {
      registrationId: registration.id,
      errors: paymentResult.errors,
    });
    return { status: 'confirmed', registrationId: registration.id };
  }

  // The applicant already pressed submit; payment was the only gate left, so
  // push it into the review queue rather than parking it at PAYMENT_COMPLETE.
  const submitResult = await transition(registration.id, 'SUBMIT');
  if (!submitResult.success) {
    logger.warn('Paid registration could not be moved to SUBMITTED', {
      registrationId: registration.id,
      errors: submitResult.errors,
    });
  }

  logger.info('Formation payment confirmed', {
    registrationId: registration.id,
    paymentIntentId: payment.paymentIntentId,
    amountCents: payment.amountCents,
  });

  return { status: 'confirmed', registrationId: registration.id };
}

/**
 * Confirm formation payment from the browser after Stripe checkout.
 *
 * This is the fallback path: the webhook is authoritative and usually wins the
 * race, so an already-confirmed registration is a success, not an error.
 */
export async function confirmFormationPayment(
  userId: string,
  registrationId: string,
  paymentIntentId: string
) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  const data = asRecord(registration.data);

  if (registration.status !== 'PAYMENT_PENDING') {
    if (data.paymentId === paymentIntentId) {
      return registration;
    }
    throw new ApiError(400, 'Registration is not awaiting payment');
  }

  // The intent id arrives from the browser, so it is only trustworthy once it
  // matches the intent this registration minted and Stripe agrees it is ours.
  if (data.stripePaymentIntentId && data.stripePaymentIntentId !== paymentIntentId) {
    throw new ApiError(400, 'Payment does not belong to this registration');
  }

  let amountCents = FORMATION_FEES[registration.type];
  let currency: string = FORMATION_FEE_CURRENCY;

  if (stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if ((paymentIntent.metadata as any)?.registrationId !== registrationId) {
        throw new ApiError(400, 'Payment does not belong to this registration');
      }

      if (paymentIntent.status !== 'succeeded') {
        throw new ApiError(400, `Payment not successful. Status: ${paymentIntent.status}`);
      }

      amountCents = paymentIntent.amount_received || paymentIntent.amount;
      currency = paymentIntent.currency;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Failed to verify payment', { error, paymentIntentId });
      throw new ApiError(500, 'Payment verification failed');
    }
  } else {
    assertStripeAvailable(registrationId);
    if (!isSimulatedIntent(paymentIntentId)) {
      throw new ApiError(400, 'Payment verification is unavailable');
    }
  }

  const outcome = await markFormationPaid(registration, { paymentIntentId, amountCents, currency });

  if (outcome.status === 'amount_mismatch') {
    throw new ApiError(400, 'Payment amount does not match the formation fee. Support has been notified.');
  }

  return prisma.businessRegistration.findUnique({ where: { id: registrationId } });
}

/**
 * Confirm formation payment from a verified Stripe webhook event.
 *
 * Stripe is the authority here, so there is no user to authorise against - but
 * the amount is still checked, and the outcome is returned rather than thrown
 * because a deterministic mismatch must not send Stripe into a retry loop.
 */
export async function confirmFormationPaymentFromWebhook(
  paymentIntent: Stripe.PaymentIntent
): Promise<FormationPaymentOutcome> {
  const registrationId = nonEmptyString((paymentIntent.metadata as any)?.registrationId);

  if (!registrationId) {
    logger.error('Formation payment intent carries no registrationId', {
      paymentIntentId: paymentIntent.id,
    });
    return { status: 'unknown_registration', registrationId: null };
  }

  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    logger.error('Formation payment intent references an unknown registration', {
      paymentIntentId: paymentIntent.id,
      registrationId,
    });
    return { status: 'unknown_registration', registrationId };
  }

  return markFormationPaid(registration, {
    paymentIntentId: paymentIntent.id,
    amountCents: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency,
  });
}

/**
 * Record a failed or canceled formation payment.
 *
 * The registration deliberately stays at PAYMENT_PENDING. The state machine's
 * PAYMENT_FAILED edge drops it to DOCUMENTS_UPLOADED, and submitRegistration
 * only accepts DRAFT or NEEDS_INFO, so a declined card would leave the
 * applicant with no way to mint a new intent. Staying pending lets them retry.
 */
export async function recordFormationPaymentFailure(
  paymentIntent: Stripe.PaymentIntent,
  reason: 'failed' | 'canceled'
): Promise<void> {
  const registrationId = nonEmptyString((paymentIntent.metadata as any)?.registrationId);
  if (!registrationId) return;

  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration || registration.status !== 'PAYMENT_PENDING') return;

  await prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      data: {
        ...asRecord(registration.data),
        lastPaymentFailure: {
          paymentIntentId: paymentIntent.id,
          reason,
          message: paymentIntent.last_payment_error?.message || null,
          at: new Date().toISOString(),
        },
      },
    },
  });

  logger.warn('Formation payment did not complete', {
    registrationId,
    paymentIntentId: paymentIntent.id,
    reason,
  });
}

export async function getUserRegistrations(userId: string) {
  return prisma.businessRegistration.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRegistration(userId: string, registrationId: string) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  return registration;
}

// Admin function
export async function adminUpdateStatus(
  registrationId: string,
  status: BusinessStatus,
  abn?: string,
  acn?: string
) {
  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status,
      abn,
      acn,
      approvedAt: status === 'APPROVED' ? new Date() : undefined,
    },
  });
}
