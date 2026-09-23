/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */

import Stripe from 'stripe';
import { digitsOnly, isValidAbn, isValidAcn } from './abr.service';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { FormationState, canTransition, transition } from './formation-state-machine.service';
import { notifyAdmins } from './admin-notify.service';

// Stripe comes from the one shared client in utils/stripe, so this module cannot
// drift onto a different API version from the rest of the server. Whether a key
// exists is asked separately with isStripeConfigured(), because getStripe() never
// returns null - outside production it hands back a placeholder client - and the
// simulated-payment path below depends on being able to tell "no Stripe here"
// apart from "Stripe, ready to charge".
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

const formatAud = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

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

/**
 * The statuses in which an applicant may still change her answers. DRAFT is
 * the obvious one; ADDITIONAL_INFO_REQUIRED is where a reviewer sends her
 * when something is missing, and she cannot answer the question if the form
 * is frozen. NEEDS_INFO is a BusinessStatus the state machine has no edge to
 * and nothing sets, kept here only so any row that already holds it is not
 * stranded.
 */
const EDITABLE_STATUSES: BusinessStatus[] = ['DRAFT', 'NEEDS_INFO', 'ADDITIONAL_INFO_REQUIRED'];

/**
 * Everything a registration must carry before a human looks at it, with no
 * opinion about status. Submission and answering a reviewer's question both
 * need this; only submission also needs the registration to be unpaid.
 */
function validateRegistrationCompleteness(registration: {
  type: BusinessType;
  businessName: string | null;
  data: Prisma.JsonValue | null;
}) {
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

function validateRegistrationForSubmission(registration: {
  type: BusinessType;
  status: BusinessStatus;
  businessName: string | null;
  data: Prisma.JsonValue | null;
}) {
  // Deliberately narrower than EDITABLE_STATUSES. A registration in
  // ADDITIONAL_INFO_REQUIRED has already paid its fee; sending it back
  // through submit would mint a second payment intent and charge her twice
  // for the same registration. Her way back is provideAdditionalInfo.
  if (registration.status !== 'DRAFT' && registration.status !== 'NEEDS_INFO') {
    throw new ApiError(400, 'Cannot submit registration in this status');
  }

  validateRegistrationCompleteness(registration);
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

  if (!EDITABLE_STATUSES.includes(registration.status)) {
    throw new ApiError(400, 'Cannot update registration in this status');
  }

  // An ABN or ACN given here has to pass its checksum before it is kept.
  const abn = data?.abn ? digitsOnly(data.abn) : null;
  if (abn && !isValidAbn(abn)) throw new ApiError(400, 'That ABN does not pass its checksum');
  const acn = data?.acn ? digitsOnly(data.acn) : null;
  if (acn && !isValidAcn(acn)) throw new ApiError(400, 'That ACN does not pass its checksum');

  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      data: data, // Updates the JSON blob
      businessName: data.businessName || registration.businessName,
      abn: abn ?? registration.abn,
      acn: acn ?? registration.acn,
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

  if (!isStripeConfigured()) {
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
      const existing = await getStripe().paymentIntents.retrieve(existingId);
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
    const paymentIntent = await getStripe().paymentIntents.create({
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
    businessName: string | null;
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
  } else {
    // Somebody has to know a woman has paid up to A$699 and is now waiting.
    // Until this call the queue filled up and nobody was ever told, which is
    // how registrations sat at SUBMITTED indefinitely.
    await notifyAdmins({
      title: 'A business registration is waiting for review',
      message: `${registration.businessName || 'An untitled registration'} (${registration.type.replace(/_/g, ' ').toLowerCase()}) has paid its ${formatAud(payment.amountCents)} fee.`,
      link: '/admin/formation',
      data: { kind: 'FORMATION_REVIEW', id: registration.id },
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

  if (isStripeConfigured()) {
    try {
      const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);

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

/**
 * Answer a reviewer's question and go back into the queue.
 *
 * The way out of ADDITIONAL_INFO_REQUIRED, and the reason that status is
 * editable. It does not go through submitRegistration, because the fee has
 * already been paid and submitting would mint a second payment intent.
 */
export async function provideAdditionalInfo(userId: string, registrationId: string) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  if (registration.status !== 'ADDITIONAL_INFO_REQUIRED') {
    throw new ApiError(400, 'This registration is not waiting on more information');
  }

  validateRegistrationCompleteness(registration);

  const result = await transition(registrationId, 'PROVIDE_INFO', {
    infoProvidedAt: new Date().toISOString(),
  });

  if (!result.success) {
    throw new ApiError(400, result.errors?.join('; ') || 'That information could not be accepted');
  }

  await notifyAdmins({
    title: 'A registration has answered its review question',
    message: `${registration.businessName || 'An untitled registration'} is back in the queue with the information you asked for.`,
    link: '/admin/formation',
    data: { kind: 'FORMATION_REVIEW', id: registration.id },
  });

  return prisma.businessRegistration.findUnique({ where: { id: registrationId } });
}

// ==========================================
// FULFILMENT AND REFUNDS
// ==========================================

/**
 * The statuses a registration can be sitting in while it waits on staff. A
 * paid registration reaches SUBMITTED by itself; everything past that needs a
 * person, and until adminAdvanceRegistration existed there was no code path
 * of any kind that could move one - the fee bought a place in a queue nobody
 * could work.
 *
 * APPROVED belongs here too. It is not the end: the registration is approved
 * and still waiting for its certificate to be filed, which is what moves it
 * to COMPLETED, so leaving it out would strand every approval one step short.
 */
export const FORMATION_QUEUE_STATUSES: BusinessStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ADDITIONAL_INFO_REQUIRED',
  'APPROVED',
];

export type FormationDecision = 'MARK_UNDER_REVIEW' | 'REQUEST_INFO' | 'APPROVE' | 'REJECT' | 'COMPLETE';

export interface FormationDecisionInput {
  registrationId: string;
  decision: FormationDecision;
  /** The staff member who made the call, recorded in the state history. */
  reviewerId: string;
  /** REQUEST_INFO: what is missing. REJECT: why. */
  note?: string;
  /** APPROVE: the ASIC or ABR number the registration came back with. */
  registrationNumber?: string;
  abn?: string;
  acn?: string;
  /** COMPLETE: where the certificate lives. */
  certificateUrl?: string;
}

export type FormationRefund =
  | { status: 'refunded'; refundId: string; amountCents: number }
  | { status: 'already_refunded'; refundId: string | null }
  | { status: 'nothing_to_refund' }
  | { status: 'unavailable'; reason: string };

/**
 * Give the fee back.
 *
 * Idempotent twice over: the recorded refund on the registration short
 * circuits a second attempt, and the idempotency key means even a racing
 * call cannot make Stripe issue two. A simulated intent never took money, so
 * there is nothing to return; a deployment with no Stripe key cannot return
 * it and says so rather than recording a refund that did not happen.
 */
export async function refundFormationFee(
  registrationId: string,
  reason: string
): Promise<FormationRefund> {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  const data = asRecord(registration.data);
  const existing = asRecord(data.refund);
  if (nonEmptyString(existing.refundId) || existing.status === 'refunded') {
    return { status: 'already_refunded', refundId: nonEmptyString(existing.refundId) };
  }

  // `paymentId` is written only by the PAYMENT_SUCCESS transition, so its
  // absence means the fee was never taken.
  const paidIntentId = nonEmptyString(data.paymentId);
  if (!paidIntentId || isSimulatedIntent(paidIntentId)) {
    return { status: 'nothing_to_refund' };
  }

  if (!isStripeConfigured()) {
    logger.error('A formation fee needs refunding and Stripe is not configured', { registrationId });
    return { status: 'unavailable', reason: 'Card payments are not configured on this deployment' };
  }

  let refund: Stripe.Refund;
  try {
    refund = await getStripe().refunds.create(
      {
        payment_intent: paidIntentId,
        reason: 'requested_by_customer',
        metadata: { registrationId, athenaReason: reason.slice(0, 400) },
      },
      { idempotencyKey: `formation-refund-${registrationId}` }
    );
  } catch (error) {
    logger.error('Formation fee refund failed at Stripe', {
      registrationId,
      paymentIntentId: paidIntentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Stripe refused the refund',
    };
  }

  await recordRefundOnRegistration(registrationId, {
    refundId: refund.id,
    paymentIntentId: paidIntentId,
    amountCents: refund.amount,
    reason,
    status: 'refunded',
  });

  logger.info('Formation fee refunded', { registrationId, refundId: refund.id, amountCents: refund.amount });

  return { status: 'refunded', refundId: refund.id, amountCents: refund.amount };
}

async function recordRefundOnRegistration(
  registrationId: string,
  refund: Record<string, unknown>
): Promise<void> {
  const current = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
    select: { data: true },
  });

  await prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      data: {
        ...asRecord(current?.data),
        refund: { ...refund, at: new Date().toISOString() },
      },
    },
  });
}

/**
 * Reconcile a refund somebody issued by hand in the Stripe dashboard.
 *
 * Called from the charge.refunded webhook. It does not move the registration
 * itself: the state machine's only route out of review is REJECT from
 * UNDER_REVIEW, and forcing a status from a webhook would skip the reviewer's
 * reason and her notification. It records the money and tells the admins, so
 * a person closes it out with the reason attached.
 */
export async function reconcileFormationRefund(
  paymentIntentId: string,
  amountRefundedCents: number
): Promise<void> {
  const registration = await prisma.businessRegistration.findFirst({
    where: { data: { path: ['paymentId'], equals: paymentIntentId } },
    select: { id: true, businessName: true, status: true, data: true },
  });

  if (!registration) return;

  const existing = asRecord(asRecord(registration.data).refund);
  if (nonEmptyString(existing.refundId) || existing.status === 'refunded') return;

  await recordRefundOnRegistration(registration.id, {
    paymentIntentId,
    amountCents: amountRefundedCents,
    reason: 'Refunded in the Stripe dashboard',
    status: 'refunded',
  });

  await notifyAdmins({
    title: 'A formation fee was refunded outside ATHENA',
    message: `${registration.businessName || 'An untitled registration'} was refunded ${formatAud(amountRefundedCents)} in Stripe and is still at ${registration.status.replace(/_/g, ' ').toLowerCase()}. Close it out with a reason.`,
    link: '/admin/formation',
    data: { kind: 'FORMATION_REFUND', id: registration.id },
  });

  logger.warn('Formation fee refunded outside ATHENA', {
    registrationId: registration.id,
    paymentIntentId,
    amountRefundedCents,
  });
}

/** What a registration in the review queue looks like to staff. */
export async function listFormationQueue(options?: { statuses?: BusinessStatus[]; take?: number }) {
  const statuses = options?.statuses?.length ? options.statuses : FORMATION_QUEUE_STATUSES;

  return prisma.businessRegistration.findMany({
    where: { status: { in: statuses } },
    orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(Math.max(options?.take ?? 100, 1), 200),
    select: {
      id: true,
      type: true,
      status: true,
      businessName: true,
      abn: true,
      acn: true,
      data: true,
      submittedAt: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, displayName: true, email: true } },
    },
  });
}

/**
 * Move a paid registration through review, and pay it back when it is
 * refused.
 *
 * Everything runs through the state machine's transition(), never a direct
 * status write: that is what records the state history and fires the
 * applicant's notification. The function this replaced, adminUpdateStatus,
 * set the column by hand - it had no callers, and whoever wired it up first
 * would have shipped a silent approval with no history and no email.
 */
export async function adminAdvanceRegistration(input: FormationDecisionInput) {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: input.registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  const note = nonEmptyString(input.note);
  const eventData: Record<string, unknown> = {
    reviewedBy: input.reviewerId,
    reviewedAt: new Date().toISOString(),
  };

  let abn: string | null = null;
  let acn: string | null = null;
  let refund: FormationRefund | null = null;

  switch (input.decision) {
    case 'MARK_UNDER_REVIEW':
      break;

    case 'REQUEST_INFO':
      if (!note) throw new ApiError(400, 'Say what is missing, so she knows what to send');
      eventData.infoRequested = note;
      break;

    case 'APPROVE': {
      // STATE_REQUIREMENTS demands registrationNumber before APPROVED, and
      // nothing wrote it, so an approval would have failed validation even
      // once it was reachable.
      const registrationNumber = nonEmptyString(input.registrationNumber);
      if (!registrationNumber) {
        throw new ApiError(400, 'The ASIC or ABR registration number is required to approve');
      }
      eventData.registrationNumber = registrationNumber;
      if (note) eventData.approvalNote = note;

      abn = input.abn ? digitsOnly(input.abn) : null;
      if (abn && !isValidAbn(abn)) throw new ApiError(400, 'That ABN does not pass its checksum');
      acn = input.acn ? digitsOnly(input.acn) : null;
      if (acn && !isValidAcn(acn)) throw new ApiError(400, 'That ACN does not pass its checksum');
      if (registration.type === 'COMPANY' && !acn && !registration.acn) {
        throw new ApiError(400, 'A company registration needs its ACN before it can be approved');
      }
      break;
    }

    case 'REJECT':
      if (!note) throw new ApiError(400, 'A rejection needs a reason; she paid for this');
      eventData.rejectionReason = note;
      break;

    case 'COMPLETE': {
      const certificateUrl = nonEmptyString(input.certificateUrl);
      if (!certificateUrl) {
        throw new ApiError(400, 'The certificate link is required to complete a registration');
      }
      eventData.certificateUrl = certificateUrl;
      break;
    }
  }

  // Whether this decision is even legal from where the registration stands,
  // asked before any money moves. The refund below deliberately runs ahead of
  // the transition, which is right when the transition is going to be
  // attempted — but it meant rejecting an already-completed or already-rejected
  // registration refunded the fee first and only then discovered the decision
  // could not be recorded, leaving her registered and refunded.
  if (!canTransition(registration.status as FormationState, input.decision)) {
    throw new ApiError(
      400,
      `A registration that is ${registration.status.toLowerCase().replace(/_/g, ' ')} cannot be ${input.decision.toLowerCase()}ed`
    );
  }

  // The refund goes first on a rejection. If Stripe refuses, she is not moved
  // into a terminal state that nobody looks at again with her money still
  // here; the reviewer sees the failure and can try again.
  if (input.decision === 'REJECT') {
    refund = await refundFormationFee(input.registrationId, note ?? 'Registration rejected');
    if (refund.status === 'unavailable') {
      throw new ApiError(502, `The fee could not be refunded, so the rejection was not recorded: ${refund.reason}`);
    }
    eventData.refundOutcome = refund.status;
  }

  const result = await transition(input.registrationId, input.decision, eventData);

  if (!result.success) {
    throw new ApiError(400, result.errors?.join('; ') || 'That decision could not be recorded');
  }

  // abn, acn and approvedAt are columns rather than JSON, so the state
  // machine cannot write them.
  if (input.decision === 'APPROVE') {
    await prisma.businessRegistration.update({
      where: { id: input.registrationId },
      data: {
        approvedAt: new Date(),
        ...(abn ? { abn } : {}),
        ...(acn ? { acn } : {}),
      },
    });
  }

  const updated = await prisma.businessRegistration.findUnique({ where: { id: input.registrationId } });

  logger.info('Formation registration advanced by staff', {
    registrationId: input.registrationId,
    decision: input.decision,
    reviewerId: input.reviewerId,
    from: result.previousState,
    to: result.currentState,
  });

  return { registration: updated, previousState: result.previousState, currentState: result.currentState, refund };
}
