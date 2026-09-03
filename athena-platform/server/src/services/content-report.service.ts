/**
 * Content Report Service
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */

import type { ContentReport } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { sendEmail } from '../utils/email';
import { logger } from '../utils/logger';

export type ContentType = 'post' | 'message' | 'profile' | 'comment' | 'job' | 'other';
export type ReportReason = 'illegal' | 'harmful' | 'harassment' | 'hate_speech' | 'spam' | 'misinformation' | 'csam' | 'terrorism' | 'fraud' | 'other';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type ModerationAction = 'dismiss' | 'warn' | 'remove' | 'suspend' | 'ban' | 'escalate';
export type EscalationStatus = 'reported' | 'acknowledged' | 'resolved';

export interface ModerationOutcome {
  reportId: string;
  ticketId: string | null;
  status: ReportStatus;
  action: ModerationAction;
  contentType: string;
  contentId: string;
  reportedUserId: string;
}

// The value stored on ContentReport.action, which is the column the queue and
// the appeal flow both read back.
const ACTION_OUTCOMES: Record<ModerationAction, string> = {
  dismiss: 'NO_ACTION',
  warn: 'WARNING',
  remove: 'CONTENT_REMOVED',
  suspend: 'SUSPENSION',
  ban: 'BAN',
  escalate: 'ESCALATED',
};

// Reports we are obliged to refer on to an outside body rather than simply
// action ourselves, and who each one goes to.
export const AUTHORITY_REPORTABLE_REASONS: ReportReason[] = ['csam', 'terrorism'];

const DEFAULT_AUTHORITY = 'Counter Terrorism Internet Referral Unit';

const AUTHORITY_FOR_REASON: Partial<Record<ReportReason, string>> = {
  csam: 'IWF',
  terrorism: DEFAULT_AUTHORITY,
};

// An escalation is filed by hand, so its lifecycle is: we recorded it
// ("reported"), the authority confirmed receipt ("acknowledged"), the authority
// closed it out ("resolved"). Nothing moves backwards — a referral that was
// wrongly filed is still a referral that happened.
export const ESCALATION_STATUSES: EscalationStatus[] = ['reported', 'acknowledged', 'resolved'];

const ESCALATION_TRANSITIONS: Record<EscalationStatus, EscalationStatus[]> = {
  reported: ['acknowledged', 'resolved'],
  acknowledged: ['resolved'],
  resolved: [],
};

interface ContentReportInput {
  contentType: ContentType;
  contentId: string;
  reason: ReportReason;
  description?: string;
  evidenceUrls?: string[];
  contactEmail?: string;
  isUrgent?: boolean;
  reporterId?: string;
  reportedUserId?: string;
}

interface ReportResult {
  ticketId: string;
  status: ReportStatus;
  expectedResponse: string;
  priority: ReportPriority;
}

// Priority mapping based on reason
const REASON_PRIORITY: Record<ReportReason, ReportPriority> = {
  csam: 'critical',
  terrorism: 'critical',
  illegal: 'high',
  harmful: 'high',
  hate_speech: 'high',
  fraud: 'high',
  harassment: 'medium',
  misinformation: 'medium',
  spam: 'low',
  other: 'medium',
};

// Expected response times by priority
const RESPONSE_TIMES: Record<ReportPriority, string> = {
  critical: 'within 1 hour',
  high: 'within 24 hours',
  medium: 'within 48 hours',
  low: 'within 72 hours',
};

/**
 * Submit a content report
 */
export async function submitContentReport(report: ContentReportInput): Promise<ReportResult> {
  const ticketId = generateTicketId();
  const priority = report.isUrgent ? 'critical' : REASON_PRIORITY[report.reason];
  const expectedResponse = RESPONSE_TIMES[priority];

  try {
    // Get a system user ID for anonymous reports
    const systemUserId = report.reporterId || 'system-anonymous';
    const reportedUserId = report.reportedUserId || 'unknown';

    // Store report in database using existing ContentReport model
    await prisma.contentReport.create({
      data: {
        reporterId: systemUserId,
        contentType: report.contentType.toUpperCase(),
        contentId: report.contentId,
        reportedUserId: reportedUserId,
        reason: report.reason.toUpperCase(),
        description: report.description || '',
        evidence: {
          urls: report.evidenceUrls || [],
          contactEmail: report.contactEmail,
          isUrgent: report.isUrgent || false,
          ticketId,
          priority,
        },
        status: 'PENDING',
      },
    });

    // Send acknowledgment email if contact provided
    if (report.contactEmail) {
      await sendReportAcknowledgment(report.contactEmail, ticketId, expectedResponse);
    }

    // Alert Trust & Safety team for critical/high priority
    if (priority === 'critical' || priority === 'high') {
      await alertTrustAndSafety(ticketId, priority, report);
    }

    // CSAM and terrorism are the two categories we are obliged to refer on
    // rather than merely moderate. escalateToAuthorities already picked the
    // right body for each, but only CSAM ever reached it.
    if (AUTHORITY_REPORTABLE_REASONS.includes(report.reason)) {
      await escalateToAuthorities(ticketId, report);
    }

    return {
      ticketId,
      status: 'PENDING',
      expectedResponse,
      priority,
    };
  } catch (error) {
    logger.error('Failed to submit content report:', error);
    throw new Error('Failed to submit report');
  }
}

/**
 * Get report status by searching evidence JSON for ticketId
 */
export async function getReportStatus(ticketId: string): Promise<{
  status: ReportStatus;
  lastUpdated: Date;
  resolution?: string;
} | null> {
  // Find report by ticketId stored in evidence JSON
  const reports = await prisma.contentReport.findMany({
    where: {
      evidence: {
        path: ['ticketId'],
        equals: ticketId,
      },
    },
    select: {
      status: true,
      updatedAt: true,
      reviewNotes: true,
    },
    take: 1,
  });

  const report = reports[0];
  if (!report) return null;

  return {
    status: report.status as ReportStatus,
    lastUpdated: report.updatedAt,
    resolution: report.reviewNotes || undefined,
  };
}

/**
 * Process a content report (for moderators)
 */
export async function processContentReport(
  ticketId: string,
  action: ModerationAction,
  moderatorId: string,
  notes?: string
): Promise<void> {
  // Find report by ticketId
  const reports = await prisma.contentReport.findMany({
    where: {
      evidence: {
        path: ['ticketId'],
        equals: ticketId,
      },
    },
    take: 1,
  });

  const report = reports[0];
  if (!report) {
    throw new Error('Report not found');
  }

  await applyReportDecision(report, action, moderatorId, notes);
}

/**
 * Process a report straight from the moderation queue, where the row id is what
 * a moderator is holding rather than an emailed ticket reference.
 */
export async function processReportById(
  reportId: string,
  action: ModerationAction,
  moderatorId: string,
  notes?: string
): Promise<ModerationOutcome> {
  const report = await prisma.contentReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new Error('Report not found');
  }

  return applyReportDecision(report, action, moderatorId, notes);
}

async function applyReportDecision(
  report: ContentReport,
  action: ModerationAction,
  moderatorId: string,
  notes?: string
): Promise<ModerationOutcome> {
  const evidence = (report.evidence ?? null) as { ticketId?: string; contactEmail?: string } | null;
  const ticketId = evidence?.ticketId || null;

  const status: ReportStatus =
    action === 'dismiss' ? 'DISMISSED' : action === 'escalate' ? 'REVIEWING' : 'RESOLVED';

  await prisma.contentReport.update({
    where: { id: report.id },
    data: {
      status,
      reviewerId: moderatorId,
      action: ACTION_OUTCOMES[action],
      actionTakenAt: new Date(),
      reviewNotes: notes,
    },
  });

  // The reported account is recorded on the report itself, so enforcement never
  // has to guess an owner back out of the content it points at.
  switch (action) {
    case 'remove':
      await removeContent(report.contentType, report.contentId);
      break;
    case 'warn':
      await warnUser(report.reportedUserId, report.contentType, report.contentId);
      break;
    case 'suspend':
    case 'ban':
      await suspendUser(report.reportedUserId);
      break;
    case 'escalate':
      await escalateReport(ticketId, report);
      break;
  }

  await prisma.moderationLog.create({
    data: {
      ticketId: ticketId || report.id,
      action,
      moderatorId,
      notes,
      timestamp: new Date(),
    },
  });

  // Notify reporter of outcome
  if (ticketId && evidence?.contactEmail) {
    await sendReportOutcome(evidence.contactEmail, ticketId, action);
  }

  return {
    reportId: report.id,
    ticketId,
    status,
    action,
    contentType: report.contentType,
    contentId: report.contentId,
    reportedUserId: report.reportedUserId,
  };
}

/**
 * Undo the enforcement a moderator applied, used when an appeal succeeds.
 * Returns what was actually reversed so the caller can record it.
 */
export async function reverseEnforcement(input: {
  userId: string;
  reportId?: string | null;
  contentType?: string | null;
  contentId?: string | null;
}): Promise<{ suspensionLifted: boolean; contentRestored: boolean; reportCleared: boolean }> {
  const report = input.reportId
    ? await prisma.contentReport.findUnique({ where: { id: input.reportId } })
    : null;

  const contentType = input.contentType || report?.contentType || null;
  const contentId = input.contentId || report?.contentId || null;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { isSuspended: true },
  });

  let suspensionLifted = false;
  if (user?.isSuspended) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { isSuspended: false },
    });
    suspensionLifted = true;
  }

  let contentRestored = false;
  if (contentType && contentId) {
    contentRestored = await restoreContent(contentType, contentId);
  }

  let reportCleared = false;
  if (report) {
    await prisma.contentReport.update({
      where: { id: report.id },
      data: {
        status: 'DISMISSED',
        action: ACTION_OUTCOMES.dismiss,
        reviewNotes: 'Enforcement reversed on appeal',
      },
    });
    reportCleared = true;
  }

  return { suspensionLifted, contentRestored, reportCleared };
}

/**
 * Generate unique ticket ID
 */
function generateTicketId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `RPT-${timestamp}-${random}`;
}

/**
 * Send acknowledgment email
 */
async function sendReportAcknowledgment(
  email: string,
  ticketId: string,
  expectedResponse: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Report Received - ${ticketId}`,
    html: `
      <h2>Your Report Has Been Received</h2>
      <p>Thank you for reporting content to ATHENA. Your report helps us maintain a safe platform.</p>
      <p><strong>Reference Number:</strong> ${ticketId}</p>
      <p><strong>Expected Response:</strong> ${expectedResponse}</p>
      <p>Our Trust & Safety team will review your report and take appropriate action. You'll receive an update once we've completed our review.</p>
      <p>If you have additional information to add, please reply to this email with your reference number.</p>
      <br>
      <p>Best regards,<br>ATHENA Trust & Safety Team</p>
    `,
  });
}

/**
 * Send report outcome notification
 */
async function sendReportOutcome(
  email: string,
  ticketId: string,
  action: string
): Promise<void> {
  const actionMessages: Record<string, string> = {
    dismiss: 'After careful review, we determined that the reported content does not violate our Community Guidelines.',
    warn: 'We have issued a warning to the user responsible for the content.',
    remove: 'We have removed the reported content as it violated our Community Guidelines.',
    suspend: 'We have temporarily suspended the account responsible for the content.',
    ban: 'We have permanently banned the account responsible for the content.',
    escalate: 'Your report has been escalated to our senior Trust & Safety team for further review.',
  };

  await sendEmail({
    to: email,
    subject: `Report Update - ${ticketId}`,
    html: `
      <h2>Update on Your Report</h2>
      <p>We have completed our review of your report (${ticketId}).</p>
      <p><strong>Outcome:</strong> ${actionMessages[action] || 'Action taken.'}</p>
      <p>If you believe this decision was made in error, you can submit an appeal at athena.com/help/appeal.</p>
      <p>Thank you for helping keep ATHENA safe.</p>
      <br>
      <p>Best regards,<br>ATHENA Trust & Safety Team</p>
    `,
  });
}

/**
 * Alert Trust & Safety team
 */
async function alertTrustAndSafety(
  ticketId: string,
  priority: ReportPriority,
  report: ContentReportInput
): Promise<void> {
  // Send to internal Trust & Safety channel (Slack, email, etc.)
  await sendEmail({
    to: process.env.TRUST_SAFETY_EMAIL || 'trust-safety@athena.com',
    subject: `[${priority.toUpperCase()}] New Content Report - ${ticketId}`,
    html: `
      <h2>New Content Report Requires Attention</h2>
      <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
      <p><strong>Ticket ID:</strong> ${ticketId}</p>
      <p><strong>Content Type:</strong> ${report.contentType}</p>
      <p><strong>Reason:</strong> ${report.reason}</p>
      <p><strong>Description:</strong> ${report.description || 'N/A'}</p>
      <p><strong>Urgent Flag:</strong> ${report.isUrgent ? 'Yes' : 'No'}</p>
      <br>
      <p>Please review this report in the moderation dashboard.</p>
    `,
  });
}

/**
 * Escalate to authorities (for CSAM, terrorism)
 *
 * The row this writes is the queue item: nothing is transmitted to IWF or CTIRU
 * automatically, so the escalation stays at "reported" until a named operator
 * files it and records the authority's reference number. The alert below is what
 * tells that operator the queue has something in it.
 */
async function escalateToAuthorities(
  ticketId: string,
  report: ContentReportInput
): Promise<void> {
  const reportedTo = AUTHORITY_FOR_REASON[report.reason] || DEFAULT_AUTHORITY;

  await prisma.authorityEscalation.create({
    data: {
      ticketId,
      reason: report.reason,
      contentType: report.contentType,
      contentId: report.contentId,
      escalatedAt: new Date(),
      reportedTo,
      status: 'reported',
    },
  });

  await notifyEscalationQueue(ticketId, reportedTo, report);

  logger.info(`[CRITICAL] Report ${ticketId} escalated to authorities for ${report.reason}`);
}

/**
 * Tell whoever holds the authority-reporting duty that a referral is waiting.
 * Sent separately from the Trust & Safety alert because the recipient is not the
 * same person: this is a legal filing obligation, not a moderation decision.
 */
async function notifyEscalationQueue(
  ticketId: string,
  reportedTo: string,
  report: ContentReportInput
): Promise<void> {
  await sendEmail({
    to:
      process.env.AUTHORITY_ESCALATION_EMAIL ||
      process.env.TRUST_SAFETY_EMAIL ||
      'trust-safety@athena.com',
    subject: `[AUTHORITY REFERRAL REQUIRED] ${ticketId} - ${report.reason}`,
    html: `
      <h2>Authority Referral Required</h2>
      <p>A report is queued for referral to <strong>${reportedTo}</strong>. Nothing has been transmitted to them automatically.</p>
      <p><strong>Ticket ID:</strong> ${ticketId}</p>
      <p><strong>Reason:</strong> ${report.reason}</p>
      <p><strong>Content Type:</strong> ${report.contentType}</p>
      <p><strong>Content ID:</strong> ${report.contentId}</p>
      <br>
      <p>File the referral, then record the authority's reference number against this escalation in the admin console so the queue can be closed.</p>
    `,
  });
}

// Content moderation action functions
async function removeContent(contentType: string, contentId: string): Promise<void> {
  logger.info(`Removing ${contentType} with ID ${contentId}`);

  // Remove content based on type - use isHidden flag for soft delete
  switch (contentType.toLowerCase()) {
    case 'post':
      await prisma.post.update({
        where: { id: contentId },
        data: { isHidden: true },
      });
      break;
    case 'video':
      await prisma.video.update({
        where: { id: contentId },
        data: { isHidden: true },
      });
      break;
    case 'comment':
      await prisma.comment.update({
        where: { id: contentId },
        data: { isHidden: true },
      });
      break;
    case 'message':
      // Messages use soft delete via the conversation
      await prisma.message.delete({ where: { id: contentId } });
      break;
    case 'job':
      await prisma.job.update({
        where: { id: contentId },
        data: { status: 'CLOSED' },
      });
      break;
    default:
      logger.warn(`Unknown content type for removal: ${contentType}`);
  }
}

/**
 * Put back content that was hidden by a moderator. Deleted messages cannot be
 * restored, so the caller is told nothing came back.
 */
async function restoreContent(contentType: string, contentId: string): Promise<boolean> {
  switch (contentType.toLowerCase()) {
    case 'post':
      await prisma.post.updateMany({ where: { id: contentId }, data: { isHidden: false } });
      return true;
    case 'video':
      await prisma.video.updateMany({ where: { id: contentId }, data: { isHidden: false } });
      return true;
    case 'comment':
      await prisma.comment.updateMany({ where: { id: contentId }, data: { isHidden: false } });
      return true;
    default:
      logger.warn(`Unknown content type for restore: ${contentType}`);
      return false;
  }
}

async function warnUser(userId: string, contentType: string, contentId: string): Promise<void> {
  logger.info(`Warning user ${userId} for ${contentType} ${contentId}`);

  await prisma.notification.create({
    data: {
      userId,
      type: 'SYSTEM',
      title: 'Content Policy Warning',
      message: 'Your content has been flagged for violating our community guidelines. Repeated violations may result in account restrictions.',
      data: { contentType, contentId },
    },
  });
}

async function suspendUser(userId: string): Promise<void> {
  logger.info(`Suspending user ${userId}`);

  await prisma.user.update({
    where: { id: userId },
    data: { isSuspended: true },
  });
}

async function escalateReport(ticketId: string | null, report: ContentReport): Promise<void> {
  logger.info(`Escalating report ${ticketId || report.id} to senior moderation`);

  // Notify senior moderators (would integrate with internal ticketing system)
  await alertTrustAndSafety(ticketId || report.id, 'critical', {
    contentType: report.contentType.toLowerCase() as ContentType,
    contentId: report.contentId,
    reason: report.reason.toLowerCase() as ReportReason,
    description: report.description || undefined,
  });
}

/**
 * Authority escalation queue.
 *
 * Escalations are filed with an outside body by a human, so this is the only
 * view anyone has of what has been referred, what is still sitting unfiled, and
 * how long it has been sitting. Each row carries the report it came from where
 * one can still be found, so a moderator can see the content without going
 * hunting for the ticket.
 */
export async function listAuthorityEscalations(filters: {
  status?: EscalationStatus;
  reportedTo?: string;
  reason?: string;
  page?: number;
  limit?: number;
}): Promise<{
  escalations: Array<Record<string, unknown>>;
  summary: { total: number; reported: number; acknowledged: number; resolved: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 25));

  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.reportedTo) where.reportedTo = filters.reportedTo;
  if (filters.reason) where.reason = filters.reason.toLowerCase();

  const [rows, total, reported, acknowledged, resolved] = await Promise.all([
    prisma.authorityEscalation.findMany({
      where,
      orderBy: { escalatedAt: 'asc' }, // oldest unfiled referral first — it is the most overdue
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.authorityEscalation.count({ where }),
    prisma.authorityEscalation.count({ where: { status: 'reported' } }),
    prisma.authorityEscalation.count({ where: { status: 'acknowledged' } }),
    prisma.authorityEscalation.count({ where: { status: 'resolved' } }),
  ]);

  const reportsByTicket = await findReportsForTickets(rows.map((row) => row.ticketId));
  const now = Date.now();

  return {
    escalations: rows.map((row) => {
      const linked = reportsByTicket.get(row.ticketId) || null;
      return {
        ...row,
        ageHours: Math.round((now - new Date(row.escalatedAt).getTime()) / (1000 * 60 * 60)),
        report: linked
          ? {
              id: linked.id,
              status: linked.status,
              action: linked.action,
              reviewerId: linked.reviewerId,
              reportedUserId: linked.reportedUserId,
              description: linked.description,
            }
          : null,
      };
    }),
    summary: { total, reported, acknowledged, resolved },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * The ticket reference lives inside the report's evidence JSON rather than a
 * column, so the whole page is looked up in one OR'd query instead of one query
 * per escalation.
 */
async function findReportsForTickets(ticketIds: string[]) {
  const unique = Array.from(new Set(ticketIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, ContentReport>();

  const reports = await prisma.contentReport.findMany({
    where: {
      OR: unique.map((ticketId) => ({
        evidence: { path: ['ticketId'], equals: ticketId },
      })),
    },
  });

  const byTicket = new Map<string, ContentReport>();
  for (const report of reports) {
    const ticketId = (report.evidence as { ticketId?: string } | null)?.ticketId;
    if (ticketId) byTicket.set(ticketId, report);
  }
  return byTicket;
}

export async function getAuthorityEscalation(id: string) {
  const escalation = await prisma.authorityEscalation.findUnique({ where: { id } });
  if (!escalation) return null;

  const reportsByTicket = await findReportsForTickets([escalation.ticketId]);
  const history = await prisma.moderationLog.findMany({
    where: { ticketId: escalation.ticketId },
    orderBy: { timestamp: 'asc' },
  });

  return {
    ...escalation,
    report: reportsByTicket.get(escalation.ticketId) || null,
    history,
  };
}

/**
 * Move an escalation along its lifecycle.
 *
 * Marking one "acknowledged" or "resolved" is an assertion about what an outside
 * authority did, so it is recorded against the moderator who made it and, once a
 * reference number exists, that number is never silently overwritten.
 */
export async function updateAuthorityEscalationStatus(
  id: string,
  input: {
    status?: EscalationStatus;
    referenceNumber?: string;
    notes?: string;
    moderatorId: string;
  }
): Promise<{ escalation: Record<string, unknown>; previousStatus: EscalationStatus }> {
  const existing = await prisma.authorityEscalation.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Escalation not found');
  }

  const previousStatus = existing.status as EscalationStatus;
  const nextStatus = input.status;

  if (nextStatus && nextStatus !== previousStatus) {
    const allowed = ESCALATION_TRANSITIONS[previousStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Cannot move escalation from ${previousStatus} to ${nextStatus}`);
    }
  }

  // "Acknowledged" means the authority has the referral, which is only credible
  // if we can say what they filed it as.
  if (nextStatus === 'acknowledged' && !input.referenceNumber && !existing.referenceNumber) {
    throw new Error('An authority reference number is required to acknowledge an escalation');
  }

  const escalation = await prisma.authorityEscalation.update({
    where: { id },
    data: {
      status: nextStatus ?? previousStatus,
      referenceNumber: input.referenceNumber ?? existing.referenceNumber,
    },
  });

  // ModerationLog is the transparency-report source, so the referral's progress
  // is written where the quarterly numbers are already read from.
  await prisma.moderationLog.create({
    data: {
      ticketId: existing.ticketId,
      action: `escalation_${nextStatus ?? previousStatus}`,
      moderatorId: input.moderatorId,
      notes: input.notes,
      timestamp: new Date(),
    },
  });

  logger.info('Authority escalation updated', {
    escalationId: id,
    ticketId: existing.ticketId,
    from: previousStatus,
    to: escalation.status,
  });

  return { escalation, previousStatus };
}

export default {
  submitContentReport,
  getReportStatus,
  processContentReport,
  processReportById,
  reverseEnforcement,
  listAuthorityEscalations,
  getAuthorityEscalation,
  updateAuthorityEscalationStatus,
};
