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

/**
 * The host employer safety attestation. An organisation may place apprentices
 * through ATHENA only while it is verified (the badge above) AND holds an
 * approved attestation that has not run out. An owner or admin answers the
 * safety statements and names a safety contact and an ABN; staff read it and
 * decide. Organisation-level facts only: ATHENA never collects an individual's
 * police or background check.
 */
export type HostSafetyQuestion = { id: string; statement: string };
export type HostStanding = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type HostAttestation = {
  id?: string;
  standing: HostStanding;
  canSubmit: boolean;
  renewable: boolean;
  safetyContactName?: string;
  safetyContactEmail?: string | null;
  safetyContactPhone?: string | null;
  abn?: string | null;
  attestedAt?: string;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  /** What staff did, or for a refusal why not. */
  reviewNote?: string | null;
};

export type HostSafetyStatus = {
  version: number;
  questions: HostSafetyQuestion[];
  renewalWindowDays: number;
  organization: { id: string; name: string; isVerified: boolean; abn: string | null };
  attestation: HostAttestation;
  mayAttest: boolean;
  canSubmit: boolean;
  mayPlaceApprentices: boolean;
};

export type HostAttestationRequest = {
  answers: Record<string, boolean>;
  safetyContactName: string;
  safetyContactEmail?: string;
  safetyContactPhone?: string;
  abn: string;
};

/** What staff see in the queue: the attestation, the organisation, and who sent it. */
export type HostAttestationForReview = Omit<HostAttestation, 'id'> & {
  id: string;
  organizationId: string;
  organization: { id: string; name: string; slug?: string; website?: string | null; type?: string | null; city?: string | null; state?: string | null; isVerified: boolean; abn: string | null } | null;
  answers: Record<string, boolean> | null;
  abnCheck: { lookup: string; abn: string; entityName?: string; abnStatus?: string; checkedAt: string } | null;
  attestedBy: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; email: string } | null;
  renewal: boolean;
  currentApprovalEndsAt: string | null;
};

export const hostSafetyApi = {
  status: (organizationId: string) => api.get(`/verification/host-safety/${organizationId}`),
  submit: (organizationId: string, data: HostAttestationRequest) => api.post(`/verification/host-safety/${organizationId}`, data),

  // Reviewing (ADMIN)
  queue: () => api.get('/verification/host-safety-queue'),
  decide: (attestationId: string, data: { decision: 'APPROVE' | 'REJECT'; note: string; validForDays?: number }) =>
    api.patch(`/verification/host-safety-attestations/${attestationId}`, data),
};

/** Where a reviewer confirms an ABN: the public ABN Lookup register. */
export const abnLookupUrl = (abn: string) => `https://abr.business.gov.au/ABN/View?abn=${encodeURIComponent(abn.replace(/\s+/g, ''))}`;

/** An ABN is eleven digits; spaces are how people write them. */
export const looksLikeAbn = (value: string) => /^\d{11}$/.test(value.replace(/\s+/g, ''));
