/**
 * Formation Studio Service
 * Handles business registration logic and ASIC integration
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { BusinessType, BusinessStatus, Prisma } from '@prisma/client';

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
  // TODO: Integrate Stripe Payment here (Phase 4)
  
  return prisma.businessRegistration.update({
    where: { id: registrationId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
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
