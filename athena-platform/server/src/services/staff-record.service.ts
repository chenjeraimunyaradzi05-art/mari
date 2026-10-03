/**
 * The audit row for staff work on housing supply, impact reports and the
 * disability-friendly employer list.
 *
 * Those three surfaces had no staff writer at all until now — listings came
 * only from members typing them in, and the two impact tables had readers and
 * nothing else — so there was nothing to record. Now staff can put a partner's
 * housing on the platform, publish a period's outcomes and vouch for an
 * employer, and each of those is a claim ATHENA makes to women in its own
 * name. "Which member of staff said this, and when" has to have an answer.
 *
 * The row is the same shape recordAdminAction in admin-audit.service writes:
 * filed under ADMIN_CONTENT_UPDATE, with the precise verb in
 * metadata.adminAction and the resource beside it, so the audit-log viewer
 * lists and filters these rows exactly as it does every other staff edit.
 * The verbs live here rather than in that module's table only because that
 * table is kept by another part of the codebase; adding these nine names to
 * it lets this file become a one-line call to recordAdminAction with no
 * change to a single row already written.
 */

import { AuditAction, Prisma } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import type { AdminAuditDetail } from './admin-audit.service';
import { auditAfterCommit } from './admin-audit.service';

export const STAFF_RECORD_VERBS = [
  // Housing supply: a listing staff put up for a partner, a batch from a
  // partner's spreadsheet, and the outcome of the DV-safe check.
  'HOUSING_LISTING_CREATED',
  'HOUSING_LISTINGS_IMPORTED',
  'HOUSING_LISTING_SAFETY_CHECKED',
  // The check on the person offering a confidential place: approved with what
  // staff checked, or refused with the reason.
  'HOUSING_PROVIDER_CHECKED',
  // The host employer safety attestation an apprenticeship host sends before it
  // may place apprentices: approved with what staff did, or refused with the reason.
  'HOST_SAFETY_ATTESTATION_DECIDED',
  // Impact reports: published for a period, corrected, or withdrawn.
  'IMPACT_REPORT_PUBLISHED',
  'IMPACT_REPORT_CORRECTED',
  'IMPACT_REPORT_WITHDRAWN',
  // The disability-friendly employer list.
  'DISABILITY_EMPLOYER_LISTED',
  'DISABILITY_EMPLOYER_UPDATED',
  'DISABILITY_EMPLOYER_RETIRED',
] as const;

export type StaffRecordVerb = (typeof STAFF_RECORD_VERBS)[number];

/**
 * What staff can read that is written down when they do. These are reads, not
 * changes, so they are filed under DATA_ACCESS (the enum value that means "a
 * person looked at data"), not ADMIN_CONTENT_UPDATE, and a privacy officer who
 * asks for data-access events is handed these and not a list of edits. The
 * verb in metadata.adminAction says which, so the audit-log viewer finds them
 * by adminAction=HOUSING_DV_SAFE_VIEWED as it finds every other verb.
 */
export const STAFF_READ_VERBS = [
  // A member of staff opened DV-safe, emergency or transitional housing data
  // that members are not shown: the check queue, or a confidential listing's
  // street address, or an inquiry thread on one.
  'HOUSING_DV_SAFE_VIEWED',
] as const;

export type StaffReadVerb = (typeof STAFF_READ_VERBS)[number];

/**
 * Write the row for a change that has already committed. Best effort, for the
 * reason recordAdminAction gives: the change is saved, so a failed audit
 * insert must not tell staff their work failed — but it goes in the log under
 * the verb it was for, rather than disappearing.
 */
export async function recordStaffAction(req: AuthRequest, verb: StaffRecordVerb, detail: AdminAuditDetail): Promise<void> {
  const { resourceType, resourceId, targetUserId, ...rest } = detail;
  await auditAfterCommit({
    action: AuditAction.ADMIN_CONTENT_UPDATE,
    actorUserId: req.user?.id ?? null,
    targetUserId: targetUserId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') || null,
    metadata: {
      adminAction: verb,
      resourceType,
      ...(resourceId ? { resourceId } : {}),
      ...rest,
    } as Prisma.InputJsonValue,
  });
}

/**
 * Write the row for a read of data members are promised staff see only on a
 * need-to-know basis. Called once the answer has been built and before it is
 * sent, so the row says what the response held, never what was merely asked.
 *
 * Best effort, as recordStaffAction is: a failed insert is logged under the
 * verb it was for (auditAfterCommit) and the page still opens. That is a choice
 * and it is written in docs/security/privacy-impact-assessment.md as one: the
 * alternative, refusing to show the queue while the log cannot be written,
 * would also stop the safety checks the queue exists for.
 *
 * Put in `detail` only what a privacy officer needs a year from now: which
 * listings, which fields of them were in the response, and the reason the
 * member of staff gave if she gave one. Never the address, the note or a
 * name; the row says that they were shown, not what they were.
 */
export async function recordStaffRead(req: AuthRequest, verb: StaffReadVerb, detail: AdminAuditDetail): Promise<void> {
  const { resourceType, resourceId, targetUserId, ...rest } = detail;
  await auditAfterCommit({
    action: AuditAction.DATA_ACCESS,
    actorUserId: req.user?.id ?? null,
    targetUserId: targetUserId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') || null,
    metadata: {
      adminAction: verb,
      resourceType,
      ...(resourceId ? { resourceId } : {}),
      ...rest,
    } as Prisma.InputJsonValue,
  });
}
