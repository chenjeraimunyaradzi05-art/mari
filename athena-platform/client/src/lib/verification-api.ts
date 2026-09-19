/**
 * Verification badges. A member applies for one and a person reviews it
 * (identity checks can run through Stripe Identity instead). An EMPLOYER or
 * EDUCATOR badge applied for from an organisation page carries that
 * organisation's id, ABN and website; approving it also marks the
 * organisation verified when the applicant owns or administers it.
 */

import { api } from './api';

export type BadgeType = 'IDENTITY' | 'EMPLOYER' | 'EDUCATOR' | 'MENTOR' | 'CREATOR';
export type BadgeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type VerificationBadge = {
  id: string;
  type: BadgeType;
  status: BadgeStatus;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

/** What the review answers about the organisation a badge named, if any. */
export type OrganisationOutcome = {
  organizationId: string;
  name: string | null;
  verified: boolean;
  reason?: string;
};

export type OrganisationVerificationRequest = {
  organizationId: string;
  organizationName: string;
  abn: string;
  website?: string;
};

export const verificationApi = {
  myBadges: () => api.get('/verification/badges'),

  apply: (data: { type: BadgeType; metadata?: Record<string, unknown> }) => api.post('/verification/badges', data),

  /**
   * Apply for an organisation's verification. Universities and TAFEs go
   * through the educator badge, everyone else through the employer badge;
   * the server refuses it unless the applicant owns or administers the
   * organisation.
   */
  applyForOrganisation: (organisationType: string | null | undefined, data: OrganisationVerificationRequest) =>
    api.post('/verification/badges', {
      type: organisationType === 'university' || organisationType === 'tafe' ? 'EDUCATOR' : 'EMPLOYER',
      metadata: data,
    }),

  // Reviewing (ADMIN)
  pending: (status: BadgeStatus = 'PENDING') => api.get('/verification/badges/pending', { params: { status } }),

  decide: (id: string, data: { status: 'APPROVED' | 'REJECTED'; reason?: string }) => api.patch(`/verification/badges/${id}`, data),
};

/** Where a reviewer confirms an ABN: the public ABN Lookup register. */
export const abnLookupUrl = (abn: string) => `https://abr.business.gov.au/ABN/View?abn=${encodeURIComponent(abn.replace(/\s+/g, ''))}`;

/** An ABN is eleven digits; spaces are how people write them. */
export const looksLikeAbn = (value: string) => /^\d{11}$/.test(value.replace(/\s+/g, ''));
