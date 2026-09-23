/**
 * The women-only gate, from both ends: the member asking to be verified, and
 * the reviewer deciding.
 *
 * It lives in its own module rather than in lib/api.ts because it is one
 * feature with two audiences and a shape of its own — the request can start a
 * hosted document check and hand back a URL to send her to, and the reviewer's
 * queue carries the evidence that request produced. Squeezing that into the
 * flat helper list is how it ended up as `requestWomanVerification: () =>
 * api.post('/users/me/woman-verification')`, a call with an empty body that
 * collected nothing.
 */

import { api } from '@/lib/api';

export type WomanGateStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type WomanGateEvidence = {
  provider: 'stripe_identity' | 'manual';
  sessionId: string | null;
  documentCheckPassedAt: string | null;
  documentName: string | null;
  documentType: string | null;
  statement: string | null;
  evidenceUrl: string | null;
  submittedAt: string | null;
};

export type WomanGateSelfState = {
  status: WomanGateStatus;
  verifiedAt: string | null;
  selfAttested: boolean;
  /** False when this deployment has no Stripe key, so only the written path is offered. */
  identityCheckAvailable: boolean;
  submittedAt: string | null;
  evidence: WomanGateEvidence | null;
};

export type WomanGateRequestRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatar: string | null;
  womanVerificationStatus: WomanGateStatus;
  womanVerifiedAt: string | null;
  createdAt: string;
  ageVerifiedAt: string | null;
  subscription?: { tier: string; status: string } | null;
  submission: {
    badgeId: string;
    badgeStatus: string;
    submittedAt: string;
    reason: string | null;
    evidence: WomanGateEvidence | null;
  } | null;
};

export type WomanGateQueue = {
  users: WomanGateRequestRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type IdentityGatesState = {
  dateOfBirth: string | null;
  ageVerifiedAt: string | null;
  minimumAgeMet: boolean;
  womanVerification: WomanGateSelfState;
};

/**
 * Both gates on the signed-in account. One read, because a member experiences
 * them as one question: what is still standing between her and the rest of
 * ATHENA.
 */
export async function fetchIdentityGates(): Promise<IdentityGatesState> {
  const response = await api.get('/users/me/identity-gates');
  return response.data.data as IdentityGatesState;
}

export const womanGateApi = {
  /**
   * Ask to be verified. `IDENTITY` starts the hosted document-and-selfie check
   * and answers with the URL to send her to; `MANUAL` records what she wrote
   * for a reviewer.
   */
  request: async (payload: { method: 'IDENTITY' } | { method: 'MANUAL'; statement: string; evidenceUrl?: string }) => {
    const response = await api.post('/users/me/woman-verification', payload);
    return response.data as {
      success: boolean;
      status: WomanGateStatus;
      method: 'IDENTITY' | 'MANUAL';
      data?: { redirectUrl: string | null; sessionId: string };
    };
  },

  /** Called when she comes back from the hosted check, so the result lands without waiting on the webhook. */
  complete: async () => {
    const response = await api.post('/users/me/woman-verification/complete');
    return response.data as {
      success: boolean;
      status: WomanGateStatus;
      data: { documentCheck: string; reason?: string | null };
    };
  },

  /** The reviewer's queue, with what each member submitted. */
  queue: async (params: { status: WomanGateStatus; page: number; limit: number }): Promise<WomanGateQueue> => {
    const response = await api.get('/verification/woman-gate/requests', { params });
    return response.data.data as WomanGateQueue;
  },

  /** The reviewer's decision. The server refuses an approval with no evidence behind it. */
  review: async (userId: string, payload: { status: 'VERIFIED' | 'REJECTED'; reason?: string }) => {
    const response = await api.patch(`/verification/woman-gate/${userId}`, payload);
    return response.data;
  },
};

/** Save a date of birth on an account that predates the column. Set once. */
export async function saveDateOfBirth(dateOfBirth: string) {
  const response = await api.post('/users/me/date-of-birth', { dateOfBirth });
  return response.data;
}
