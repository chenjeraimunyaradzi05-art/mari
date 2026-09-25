/**
 * Who may move a job application, and where to.
 *
 * There are two employer-side handlers that write `JobApplication.status` —
 * `PATCH /api/jobs/:jobId/applications/:applicationId` and
 * `PATCH /api/employer/applications/:applicationId/status` — and until this
 * module existed neither of them had a transition rule of any kind. Both took
 * whatever the express-validator allowlist let through and wrote it. The
 * candidate side, `PATCH /api/jobs/me/applications/:applicationId`, has had a
 * transition map since it was written, which is what made the asymmetry
 * obvious: the woman applying could only make the two moves that are hers,
 * while the employer could make every move including hers.
 *
 * Two things went wrong because of that.
 *
 * The first is WITHDRAWN. It was on the employer's allowlist, so an employer
 * could record that a candidate had pulled out of a process she was still in.
 * The author had already taken ACCEPTED off that list with a comment saying
 * accepting an offer is the candidate's move — WITHDRAWN is the same move in
 * the other direction and was simply missed. A withdrawal is a statement about
 * what the candidate decided; nobody else gets to make it on her behalf.
 *
 * The second is that with no state machine the kanban's drag-and-drop allowed
 * every combination: an application could jump from PENDING, which means
 * nobody has opened it, straight to OFFERED, and an application the candidate
 * had already accepted or withdrawn from could be dragged back into INTERVIEW,
 * overwriting her decision with the employer's.
 *
 * So: the employer may move an application around the stages she runs, may
 * reject at any point, and may reconsider a rejection by putting the candidate
 * back into the pipeline — but she may never write a stage that belongs to the
 * candidate, and she may never touch an application the candidate has already
 * closed.
 */

import { ApplicationStatus } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';

/**
 * The stages an employer is allowed to set, keyed by the target stage and
 * listing the stages it may be reached from.
 *
 * ACCEPTED and WITHDRAWN are absent as targets on purpose: both are the
 * candidate's to write, through the candidate route's own transition map.
 *
 * OFFERED cannot be reached from PENDING. An offer is a commitment, and
 * PENDING means the application has not been opened yet — if an employer
 * genuinely wants to offer on sight she marks it REVIEWED first, which is a
 * true statement about what she did.
 */
const EMPLOYER_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  PENDING: [ApplicationStatus.REVIEWED, ApplicationStatus.SHORTLISTED],
  REVIEWED: [
    ApplicationStatus.PENDING,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
  ],
  SHORTLISTED: [
    ApplicationStatus.PENDING,
    ApplicationStatus.REVIEWED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
  ],
  INTERVIEW: [
    ApplicationStatus.PENDING,
    ApplicationStatus.REVIEWED,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.OFFERED,
  ],
  OFFERED: [
    ApplicationStatus.REVIEWED,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW,
  ],
  REJECTED: [
    ApplicationStatus.PENDING,
    ApplicationStatus.REVIEWED,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFERED,
  ],
};

/** Every stage an employer-side route may accept in its request body. */
export const EMPLOYER_SETTABLE_STATUSES = Object.keys(EMPLOYER_TRANSITIONS) as ApplicationStatus[];

/**
 * The two stages the candidate writes about her own intent. Once she has
 * written one, the application is closed to the employer: she has either taken
 * the job or walked away, and no drag on a kanban board may say otherwise.
 */
const CANDIDATE_OWNED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.WITHDRAWN,
];

export interface EmployerStatusMove {
  /** False when the application is already at the requested stage. */
  changed: boolean;
}

/**
 * Throws unless the employer may move this application from `current` to
 * `next`. Returns `{ changed: false }` when the two are the same, which the
 * kanban produces routinely by dropping a card back into the column it came
 * from; the caller should answer that without writing a row or sending the
 * candidate a second notification about a stage she is already at.
 */
export function assertEmployerStatusMove(
  current: ApplicationStatus,
  next: ApplicationStatus,
): EmployerStatusMove {
  if (current === next) {
    return { changed: false };
  }

  if (CANDIDATE_OWNED_STATUSES.includes(current)) {
    throw new ApiError(
      409,
      current === ApplicationStatus.ACCEPTED
        ? 'This candidate has accepted the offer. Only she can change that.'
        : 'This candidate has withdrawn her application. Only she can change that.',
    );
  }

  const allowedFrom = EMPLOYER_TRANSITIONS[next];
  if (!allowedFrom) {
    throw new ApiError(400, 'That is not a stage an employer can set');
  }

  if (!allowedFrom.includes(current)) {
    throw new ApiError(400, `An application at ${current} cannot be moved straight to ${next}`);
  }

  return { changed: true };
}
