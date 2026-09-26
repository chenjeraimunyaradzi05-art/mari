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
 * On the action column: AuditLog.action is the AuditAction enum, and the enum
 * has no verb for administering the platform itself — its ADMIN_ values all
 * name a member, a post, a group, an event, a job or a subscription. Filing a
 * marketing campaign under ADMIN_GROUP_UPDATE would corrupt the moderation
 * history that admin.routes.ts writes, so these rows carry the nearest neutral
 * value and the real verb rides in metadata.adminAction, which is the same
 * compromise REPORT_AUDIT_ACTIONS makes in admin.routes.ts for the moderation
 * outcomes. Adding ADMIN_CONFIG_UPDATE and ADMIN_CONTENT_UPDATE to the enum is
 * a schema change; when it lands, PLATFORM_ADMIN_AUDIT_ACTION below is the one
 * line to change.
 */

import { AuditAction, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { bestEffort } from '../utils/best-effort';

/** See the note above: the enum has no verb of its own for this yet. */
const PLATFORM_ADMIN_AUDIT_ACTION: AuditAction = AuditAction.DATA_ACCESS;

/**
 * What staff can do on these surfaces, spelled out.
 *
 * A union rather than a free string so the vocabulary cannot drift into six
 * spellings of the same event, which is what makes the log searchable a year
 * from now. Read it as RESOURCE_VERB, past tense: the row is written after the
 * change, so it records what happened rather than what was attempted.
 */
export type AdminAuditAction =
  // Platform configuration
  | 'FEATURE_FLAG_CREATED'
  | 'FEATURE_FLAG_UPDATED'
  | 'FEATURE_FLAG_DELETED'
  | 'MAINTENANCE_MODE_CHANGED'
  // Marketing and go-to-market
  | 'MARKETING_CAMPAIGN_CREATED'
  | 'MARKETING_CAMPAIGN_UPDATED'
  | 'MARKETING_CAMPAIGN_DELETED'
  | 'MARKETING_LEAD_CREATED'
  | 'MARKETING_LEADS_IMPORTED'
  | 'MARKETING_LEAD_UPDATED'
  | 'MARKETING_LEAD_DELETED'
  | 'GTM_INITIATIVE_CREATED'
  | 'GTM_INITIATIVE_UPDATED'
  | 'GTM_INITIATIVE_DELETED'
  // Editorial
  | 'BLOG_ARTICLE_CREATED'
  | 'BLOG_ARTICLE_UPDATED'
  | 'BLOG_ARTICLE_DELETED'
  // Funding. The decisions are about a named member and move money or cover
  // towards her, so they carry targetUserId; the catalogue edits do not.
  | 'GRANT_CREATED'
  | 'GRANT_UPDATED'
  | 'GRANT_APPLICATION_DECIDED'
  | 'INSURANCE_APPLICATION_DECIDED'
  | 'COMPANY_FORMATION_DECIDED'
  | 'COMPANY_FORMATION_FEE_REFUNDED'
  // Catalogue
  | 'ACCELERATOR_COHORT_CREATED'
  | 'ACCELERATOR_COHORT_UPDATED'
  | 'ACCELERATOR_COHORT_DELETED'
  | 'ACCELERATOR_SESSION_CREATED'
  | 'ACCELERATOR_SESSION_UPDATED'
  | 'ACCELERATOR_SESSION_DELETED'
  | 'INVESTOR_CREATED'
  | 'INVESTOR_UPDATED'
  | 'INVESTOR_DELETED'
  | 'INVESTOR_INTRODUCTION_UPDATED'
  | 'INSURANCE_PRODUCT_CREATED'
  | 'INSURANCE_PRODUCT_UPDATED'
  | 'INSURANCE_PRODUCT_DELETED'
  // Impact programmes, including the domestic violence service directory
  | 'IMPACT_PROGRAM_CREATED'
  | 'IMPACT_PROGRAM_UPDATED'
  | 'IMPACT_PROGRAM_DELETED'
  | 'IMPACT_MILESTONE_CREATED'
  | 'IMPACT_MILESTONE_UPDATED'
  | 'IMPACT_MILESTONE_DELETED'
  | 'BRIDGING_PROGRAM_CREATED'
  | 'BRIDGING_PROGRAM_UPDATED'
  | 'BRIDGING_PROGRAM_DELETED'
  | 'DV_SERVICE_CREATED'
  | 'DV_SERVICE_UPDATED'
  | 'DV_SERVICE_DELETED'
  | 'IMPACT_PARTNER_CREATED'
  | 'IMPACT_PARTNER_UPDATED'
  | 'IMPACT_PARTNER_DELETED'
  | 'INDIGENOUS_COMMUNITY_CREATED'
  | 'INDIGENOUS_COMMUNITY_UPDATED'
  | 'INDIGENOUS_COMMUNITY_DELETED'
  | 'INDIGENOUS_RESOURCE_CREATED'
  | 'INDIGENOUS_RESOURCE_UPDATED'
  | 'INDIGENOUS_RESOURCE_DELETED'
  | 'CREDENTIAL_ASSESSMENT_UPDATED'
  // Member-facing queues
  | 'FEEDBACK_UPDATED'
  // A data-subject request taken, handed on, noted or closed by staff
  | 'DSAR_REQUEST_UPDATED'
  // Public disclosures: who compiled and published the transparency report,
  // and who changed the register of providers members are pointed to
  | 'TRANSPARENCY_REPORT_COMPILED'
  | 'TRANSPARENCY_REPORT_PUBLISHED'
  | 'SUBPROCESSOR_CREATED'
  | 'SUBPROCESSOR_UPDATED'
  // Seeding. Hard-blocked in production, but a demo or CI environment that
  // mints an administrator account and hands back its password should still be
  // able to say when that happened and from where.
  | 'SEED_ADMIN_ACCOUNT_CREATED'
  | 'SEED_ADMIN_PASSWORD_ROTATED'
  | 'SEED_CONTENT_RUN';

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
      action: PLATFORM_ADMIN_AUDIT_ACTION,
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
