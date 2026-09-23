/**
 * The provider side of education applications.
 *
 * Until 2026-09 the only write the client knew about was
 * `educationApi.updateApplication`, which the APPLICANT calls on her own row —
 * and the server accepted any status from her, so a provider dashboard showing
 * "ACCEPTED" was showing something the applicant had typed about herself. The
 * decision now belongs to a separate, permission-gated route, and it lives in
 * its own module rather than in the shared api.ts because it is the provider
 * console's business, not the member app's.
 */

import { api } from './api';

/** The transitions an admissions decision may make. Withdrawal stays the applicant's. */
export type EducationDecision = 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED';

export const EDUCATION_DECISIONS: readonly { value: EducationDecision; label: string }[] = [
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function decideEducationApplication(
  organizationId: string,
  applicationId: string,
  status: EducationDecision
) {
  return api.patch(
    `/education/providers/${organizationId}/applications/${applicationId}`,
    { status }
  );
}
