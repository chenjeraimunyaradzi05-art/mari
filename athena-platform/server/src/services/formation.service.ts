/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */

import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;
const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT === 'production';
const allowStripeSimulation = process.env.ALLOW_STRIPE_SIMULATION === 'true';

// Formation fee amounts in cents by business type
const FORMATION_FEES: Record<BusinessType, number> = {
  SOLE_TRADER: 4900,   // $49 AUD
  PARTNERSHIP: 9900,   // $99 AUD
  COMPANY: 49900,      // $499 AUD
  TRUST: 69900,        // $699 AUD
};

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

  // Create Stripe payment intent for formation fee
  const feeAmount = FORMATION_FEES[registration.type];
  let paymentIntentId: string | null = null;

  if (stripe) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const paymentIntent = await stripe.paymentIntents.create({
        amount: feeAmount,
        currency: 'aud',
        metadata: {
          registrationId,
          userId,
          businessType: registration.type,
          businessName: registration.businessName || 'Unknown',
        },
        description: `Business Formation: ${registration.type} - ${registration.businessName}`,
        receipt_email: user?.email || undefined,
      });
      paymentIntentId = paymentIntent.id;
      logger.info('Created formation payment intent', { registrationId, paymentIntentId, amount: feeAmount });
    } catch (error) {
      logger.error('Failed to create Stripe payment intent', { error, registrationId });
      throw new ApiError(500, 'Payment processing failed. Please try again.');
    }
  } else {
    if (isProduction && !allowStripeSimulation) {
      logger.error('Stripe not configured in production for formation payments', { registrationId });
      throw new ApiError(500, 'Payment processing is unavailable. Please contact support.');
    }
    // Development mode without Stripe
    paymentIntentId = `mock_pi_${registrationId}`;
    logger.info('Mock formation payment (Stripe not configured)', { registrationId, amount: feeAmount });
  }

  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status: 'PAYMENT_PENDING',
      submittedAt: new Date(),
      data: { ...asRecord(registration.data), stripePaymentIntentId: paymentIntentId },
    },
  });
}

/**
 * Confirm formation payment after Stripe checkout
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

  if (registration.status !== 'PAYMENT_PENDING') {
    throw new ApiError(400, 'Registration is not awaiting payment');
  }

  // Verify payment with Stripe
  if (stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        throw new ApiError(400, `Payment not successful. Status: ${paymentIntent.status}`);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Failed to verify payment', { error, paymentIntentId });
      throw new ApiError(500, 'Payment verification failed');
    }
  }

  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status: 'PAID',
    },
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
