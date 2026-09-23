/**
 * Business formation, from the platform's side.
 *
 * The formation studio takes A$49 to A$699 and, until the admin router
 * existed, nothing could move a paid registration past "submitted": no
 * review, no ABN recorded, no refund. These are the calls that work the
 * queue. Every decision runs through the server's state machine, so each one
 * writes state history and notifies the applicant.
 */

import { api } from './api';

/**
 * APPROVED is a waiting stage, not an ending: the registration is approved
 * and still needs its certificate filed before it reaches COMPLETED.
 */
export type FormationQueueStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'ADDITIONAL_INFO_REQUIRED' | 'APPROVED';

export type FormationDecision =
  | 'MARK_UNDER_REVIEW'
  | 'REQUEST_INFO'
  | 'APPROVE'
  | 'REJECT'
  | 'COMPLETE';

export type FormationRegistration = {
  id: string;
  type: 'SOLE_TRADER' | 'PARTNERSHIP' | 'COMPANY' | 'TRUST';
  status: string;
  businessName: string | null;
  abn: string | null;
  acn: string | null;
  data: Record<string, unknown> | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string | null; email: string };
};

export type FormationDecisionInput = {
  decision: FormationDecision;
  /** Required for REQUEST_INFO and REJECT: what is missing, or why. */
  note?: string;
  /** Required for APPROVE. */
  registrationNumber?: string;
  abn?: string;
  acn?: string;
  /** Required for COMPLETE. */
  certificateUrl?: string;
};

export const adminFormationApi = {
  /** The registrations waiting on a person; a status narrows to one stage. */
  queue: (status?: FormationQueueStatus) =>
    api.get('/admin/formation', { params: status ? { status } : undefined }),

  /**
   * Record a decision. A rejection refunds the fee first and fails the whole
   * call if the refund does not go through, so nobody is refused and left out
   * of pocket in the same click.
   */
  decide: (id: string, input: FormationDecisionInput) =>
    api.post(`/admin/formation/${id}/decision`, input),

  /** Give the fee back without recording a refusal. Idempotent. */
  refund: (id: string, note: string) => api.post(`/admin/formation/${id}/refund`, { note }),
};
