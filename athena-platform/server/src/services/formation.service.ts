/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { logger } from '../utils/logger';

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Fee structure for business registrations (in cents)
const REGISTRATION_FEES: Record<BusinessType, number> = {
  SOLE_TRADER: 4900, // $49
  PARTNERSHIP: 9900, // $99
  COMPANY: 14900, // $149
  TRUST: 19900, // $199
};

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  error?: string;
}

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

  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status: 'PENDING_PAYMENT',
    },
  });
}

/**
 * Create a Stripe Payment Intent for business registration
 */
export async function createRegistrationPaymentIntent(
  userId: string,
  registrationId: string
): Promise<PaymentResult> {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  if (registration.status !== 'PENDING_PAYMENT' && registration.status !== 'DRAFT') {
    throw new ApiError(400, 'Registration is not awaiting payment');
  }

  const amount = REGISTRATION_FEES[registration.type];
  const businessName = registration.businessName || 'New Business';

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'aud',
      metadata: {
        registrationId,
        userId,
        businessType: registration.type,
        businessName,
      },
      description: `ATHENA Business Registration: ${businessName} (${registration.type})`,
      receipt_email: registration.user?.email,
    });

    // Update registration with payment intent ID
    await prisma.businessRegistration.update({
      where: { id: registrationId },
      data: {
        data: {
          ...(registration.data as object || {}),
          paymentIntentId: paymentIntent.id,
        },
      },
    });

    logger.info('Payment intent created for registration', {
      registrationId,
      paymentIntentId: paymentIntent.id,
      amount,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
    };
  } catch (error) {
    logger.error('Failed to create payment intent', { registrationId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment initialization failed',
    };
  }
}

/**
 * Confirm payment and submit registration
 */
export async function confirmRegistrationPayment(
  userId: string,
  registrationId: string,
  paymentIntentId: string
): Promise<{ registration: any; success: boolean }> {
  const registration = await prisma.businessRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (registration.userId !== userId) {
    throw new ApiError(403, 'Not authorized');
  }

  try {
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new ApiError(400, `Payment not completed. Status: ${paymentIntent.status}`);
    }

    // Verify the payment is for this registration
    if (paymentIntent.metadata.registrationId !== registrationId) {
      throw new ApiError(400, 'Payment does not match registration');
    }

    // Update registration to submitted
    const updatedRegistration = await prisma.businessRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        data: {
          ...(registration.data as object || {}),
          paymentIntentId,
          paymentConfirmedAt: new Date().toISOString(),
          amountPaid: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      },
    });

    logger.info('Registration payment confirmed and submitted', {
      registrationId,
      paymentIntentId,
    });

    return { registration: updatedRegistration, success: true };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Failed to confirm payment', { registrationId, paymentIntentId, error });
    throw new ApiError(500, 'Failed to confirm payment');
  }
}

/**
 * Get registration fee for a business type
 */
export function getRegistrationFee(type: BusinessType): { amount: number; currency: string; formatted: string } {
  const amount = REGISTRATION_FEES[type];
  return {
    amount,
    currency: 'AUD',
    formatted: `$${(amount / 100).toFixed(2)} AUD`,
  };
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
