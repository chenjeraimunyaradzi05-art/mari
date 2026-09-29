/**
 * Attribution for staff actions on the admin surfaces.
 *
 * admin.routes.ts has written to AuditLog since it was built — who changed a
 * member's role, who suspended an account, who granted a subscription. None of
 * the other admin routers did. Feature flags could be flipped, maintenance
 * mode switched on, the blog rewritten, a grant retargeted, a DV service
 * listing edited and the marketing lead table exported, and afterwards nothing
 * on the platform could say which member of staff had done any of it.
 *
 * On a platform holding domestic violence records, "an administrator did this"
 * is not an acceptable answer to a regulator, to a board, or to the woman whose
 * listing changed. This module is the one way those routers write that row, so
 * the vocabulary stays consistent and no surface is left out again.
 *
 * On the action column: AuditLog.action is the AuditAction enum. Until the enum
 * had verbs for administering the platform itself, these rows were filed under
 * DATA_ACCESS with the real verb in metadata.adminAction, so a privacy officer
 * asking for data-access events was handed blog edits and flag flips, and "who
 * changed the platform's configuration" could only be answered by reading the
 * JSON of every row. Each verb now names the enum value it is filed under —
 * ADMIN_CONFIG_UPDATE, ADMIN_CONTENT_UPDATE, or SAFETY_REPORT_DECIDED — and the
 * precise verb still rides in metadata.adminAction, because "a catalogue
 * changed" is the column's question and "which cohort, and how" is the row's.
 * Rows written before the change keep DATA_ACCESS; LEGACY_ADMIN_AUDIT_ACTION and
 * adminVerbsFiledUnder are how the audit-log viewer still finds them.
 */

import { AuditAction, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { bestEffort } from '../utils/best-effort';

/** What these rows were filed under before the enum had verbs of its own. */
export const LEGACY_ADMIN_AUDIT_ACTION: AuditAction = AuditAction.DATA_ACCESS;

// How the platform itself runs: switches, the accounts seeding mints, and the
// register of who processes member data on our behalf.
const CONFIG = AuditAction.ADMIN_CONFIG_UPDATE;
// Records and catalogues staff maintain, and staff decisions on the queues
// members file into. The precise verb in metadata says which.
const CONTENT = AuditAction.ADMIN_CONTENT_UPDATE;
// A staff decision on a safety report or a safety concern about a member.
const SAFETY = AuditAction.SAFETY_REPORT_DECIDED;

/**
 * What staff can do on these surfaces, spelled out, and the enum value each is
 * filed under.
 *
 * One table rather than a union beside a switch, so a verb cannot be added
 * without deciding where it is filed: the type below is derived from these
 * keys. Read each as RESOURCE_VERB, past tense: the row is written after the
 * change, so it records what happened rather than what was attempted.
 */
const ADMIN_AUDIT_ACTIONS = {
  // Platform configuration
  FEATURE_FLAG_CREATED: CONFIG,
  FEATURE_FLAG_UPDATED: CONFIG,
  FEATURE_FLAG_DELETED: CONFIG,
  MAINTENANCE_MODE_CHANGED: CONFIG,
  // Marketing and go-to-market
  MARKETING_CAMPAIGN_CREATED: CONTENT,
  MARKETING_CAMPAIGN_UPDATED: CONTENT,
  MARKETING_CAMPAIGN_DELETED: CONTENT,
  MARKETING_LEAD_CREATED: CONTENT,
  MARKETING_LEADS_IMPORTED: CONTENT,
  MARKETING_LEAD_UPDATED: CONTENT,
  MARKETING_LEAD_DELETED: CONTENT,
  GTM_INITIATIVE_CREATED: CONTENT,
  GTM_INITIATIVE_UPDATED: CONTENT,
  GTM_INITIATIVE_DELETED: CONTENT,
  // Editorial
  BLOG_ARTICLE_CREATED: CONTENT,
  BLOG_ARTICLE_UPDATED: CONTENT,
  BLOG_ARTICLE_DELETED: CONTENT,
  // Funding. The decisions are about a named member and move money or cover
  // towards her, so they carry targetUserId; the catalogue edits do not.
  GRANT_CREATED: CONTENT,
  GRANT_UPDATED: CONTENT,
  GRANT_APPLICATION_DECIDED: CONTENT,
  INSURANCE_APPLICATION_DECIDED: CONTENT,
  COMPANY_FORMATION_DECIDED: CONTENT,
  COMPANY_FORMATION_FEE_REFUNDED: CONTENT,
  // Catalogue
  ACCELERATOR_COHORT_CREATED: CONTENT,
  ACCELERATOR_COHORT_UPDATED: CONTENT,
  ACCELERATOR_COHORT_DELETED: CONTENT,
  ACCELERATOR_SESSION_CREATED: CONTENT,
  ACCELERATOR_SESSION_UPDATED: CONTENT,
  ACCELERATOR_SESSION_DELETED: CONTENT,
  // A member's place on a cohort, released, revoked or refunded by staff. These
  // were filed as ACCELERATOR_COHORT_UPDATED with a `change` field, the nearest
  // name there was, so a search for what happened to her place found a cohort
  // edit instead.
  ACCELERATOR_ENROLLMENT_RELEASED: CONTENT,
  ACCELERATOR_ENROLLMENT_REVOKED: CONTENT,
  ACCELERATOR_ENROLLMENT_REFUND_RECORDED: CONTENT,
  COURSE_UNPUBLISHED: CONTENT,
  INVESTOR_CREATED: CONTENT,
  INVESTOR_UPDATED: CONTENT,
  INVESTOR_DELETED: CONTENT,
  INVESTOR_INTRODUCTION_UPDATED: CONTENT,
  INSURANCE_PRODUCT_CREATED: CONTENT,
  INSURANCE_PRODUCT_UPDATED: CONTENT,
  INSURANCE_PRODUCT_DELETED: CONTENT,
  // Impact programmes, including the domestic violence service directory
  IMPACT_PROGRAM_CREATED: CONTENT,
  IMPACT_PROGRAM_UPDATED: CONTENT,
  IMPACT_PROGRAM_DELETED: CONTENT,
  IMPACT_MILESTONE_CREATED: CONTENT,
  IMPACT_MILESTONE_UPDATED: CONTENT,
  IMPACT_MILESTONE_DELETED: CONTENT,
  BRIDGING_PROGRAM_CREATED: CONTENT,
  BRIDGING_PROGRAM_UPDATED: CONTENT,
  BRIDGING_PROGRAM_DELETED: CONTENT,
  DV_SERVICE_CREATED: CONTENT,
  DV_SERVICE_UPDATED: CONTENT,
  DV_SERVICE_DELETED: CONTENT,
  IMPACT_PARTNER_CREATED: CONTENT,
  IMPACT_PARTNER_UPDATED: CONTENT,
  IMPACT_PARTNER_DELETED: CONTENT,
  INDIGENOUS_COMMUNITY_CREATED: CONTENT,
  INDIGENOUS_COMMUNITY_UPDATED: CONTENT,
  INDIGENOUS_COMMUNITY_DELETED: CONTENT,
  INDIGENOUS_RESOURCE_CREATED: CONTENT,
  INDIGENOUS_RESOURCE_UPDATED: CONTENT,
  INDIGENOUS_RESOURCE_DELETED: CONTENT,
  CREDENTIAL_ASSESSMENT_UPDATED: CONTENT,
  // Automotive: the workshop and dealership directory, listings, reviews,
  // finance enquiries, referrals, and staff decisions on a purchase. These rows
  // were written in this exact shape by a helper of the automotive router's
  // own, because this list had no car verbs; they belong here so there is one
  // place staff audit rows are written.
  CAR_WORKSHOP_UPDATED: CONTENT,
  CAR_DEALERSHIP_UPDATED: CONTENT,
  CAR_LISTING_REVIEWED: CONTENT,
  CAR_LISTING_EDITED_BY_ADMIN: CONTENT,
  CAR_REVIEW_MODERATED: CONTENT,
  CAR_WORKSHOP_REVIEW_MODERATED: CONTENT,
  CAR_FINANCE_ENQUIRY_UPDATED: CONTENT,
  CAR_REFERRAL_CREATED: CONTENT,
  CAR_REFERRAL_UPDATED: CONTENT,
  CAR_PURCHASE_RELEASED_BY_ADMIN: CONTENT,
  CAR_PURCHASE_CANCELLED_BY_ADMIN: CONTENT,
  CAR_PURCHASE_DISPUTE_RESOLVED: CONTENT,
  CAR_INSPECTION_UPDATED_BY_ADMIN: CONTENT,
  // Member-facing queues
  FEEDBACK_UPDATED: CONTENT,
  // A data-subject request taken, handed on, noted or closed by staff
  DSAR_REQUEST_UPDATED: CONTENT,
  // Public disclosures: who compiled and published the transparency report,
  // and who changed the register of providers members are pointed to
  TRANSPARENCY_REPORT_COMPILED: CONTENT,
  TRANSPARENCY_REPORT_PUBLISHED: CONTENT,
  SUBPROCESSOR_CREATED: CONFIG,
  SUBPROCESSOR_UPDATED: CONFIG,
  // Safety: a concern about a member closed, or a safety report upheld or
  // dismissed. Filed under the safety verb rather than a staff-content one,
  // because these move a member's safety score and are what an appeal answers.
  SAFETY_FLAG_RESOLVED: SAFETY,
  SAFETY_REPORT_UPHELD: SAFETY,
  SAFETY_REPORT_DISMISSED: SAFETY,
  // Seeding. Hard-blocked in production, but a demo or CI environment that
  // mints an administrator account and hands back its password should still be
  // able to say when that happened and from where.
  SEED_ADMIN_ACCOUNT_CREATED: CONFIG,
  SEED_ADMIN_PASSWORD_ROTATED: CONFIG,
  SEED_CONTENT_RUN: CONFIG,
} as const satisfies Record<string, AuditAction>;

/**
 * What staff can do on these surfaces. A union rather than a free string so the
 * vocabulary cannot drift into six spellings of the same event, which is what
 * makes the log searchable a year from now.
 */
export type AdminAuditAction = keyof typeof ADMIN_AUDIT_ACTIONS;

/** Every verb, for validating a filter the audit-log viewer is sent. */
export const ADMIN_AUDIT_ACTION_NAMES = Object.keys(ADMIN_AUDIT_ACTIONS) as AdminAuditAction[];

export function isAdminAuditAction(value: string): value is AdminAuditAction {
  return Object.prototype.hasOwnProperty.call(ADMIN_AUDIT_ACTIONS, value);
}

/** The enum value a verb is filed under. */
export function auditActionFor(action: AdminAuditAction): AuditAction {
  return ADMIN_AUDIT_ACTIONS[action];
}

/**
 * The verbs filed under this enum value today, so a filter on it can also
 * reach the rows written before it existed, which carry the same verb in
 * metadata under LEGACY_ADMIN_AUDIT_ACTION.
 */
export function adminVerbsFiledUnder(action: AuditAction): AdminAuditAction[] {
  return ADMIN_AUDIT_ACTION_NAMES.filter((verb) => ADMIN_AUDIT_ACTIONS[verb] === action);
}

export interface AdminAuditDetail {
  /** The Prisma model the row belongs to, e.g. 'FeatureFlag'. */
  resourceType: string;
  /** Which row, when there is one. A flag is identified by its key. */
  resourceId?: string | null;
  /** Set only when the action is about a particular member. */
  targetUserId?: string | null;
  /**
   * Anything else worth reading a year from now. Keep it to what changed and
   * what it changed to — never a whole request body, and never free text a
   * member wrote, which belongs on the row itself rather than in the log.
   */
  [key: string]: unknown;
}

/**
 * Write an AuditLog row for a change that has already committed.
 *
 * logAudit throws when the insert fails, and the routers that call it directly
 * — admin, appeal and the privacy routes — awaited it bare, after the write it
 * records. A failed audit insert therefore turned a finished suspension, appeal
 * decision or data export into a 500: the person was told the work had failed
 * when it had not, and the obvious next move, trying again, is the wrong one
 * for most of these. The admin hard delete made it certain rather than
 * possible, because it wrote a row pointing at the account it had just erased
 * and the foreign key refused it every time. bestEffort keeps the response true
 * to what happened and still puts the missing row in the log under the action
 * it was for.
 */
export async function auditAfterCommit(entry: Parameters<typeof logAudit>[0]): Promise<void> {
  await bestEffort(`audit ${entry.action}`, () => logAudit(entry));
}

/**
 * Record a staff action against the acting account.
 *
 * Called after the write, so the row only ever claims what actually happened.
 * The audit write itself is best effort: the change is already committed by
 * this point, so throwing here would report a failure for work that succeeded,
 * and a swallowed failure would be exactly the silence this module exists to
 * end. bestEffort keeps the response honest and puts the miss in the log.
 */
export async function recordAdminAction(
  req: AuthRequest,
  action: AdminAuditAction,
  detail: AdminAuditDetail
): Promise<void> {
  const { resourceType, resourceId, targetUserId, ...rest } = detail;

  await bestEffort(
    `admin audit ${action}`,
    logAudit({
      action: auditActionFor(action),
      actorUserId: req.user?.id ?? null,
      targetUserId: targetUserId ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') || null,
      metadata: {
        adminAction: action,
        resourceType,
        ...(resourceId ? { resourceId } : {}),
        ...rest,
      } as Prisma.InputJsonValue,
    })
  );
}
