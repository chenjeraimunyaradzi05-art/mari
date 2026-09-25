/**
 * Content Report Service
 *
 * The reporting, review and escalation mechanism behind /report. ATHENA is a
 * Queensland company, so the home regime is the Online Safety Act 2021 (Cth)
 * and the eSafety Commissioner's Basic Online Safety Expectations; the UK
 * Online Safety Act 2023 (Ofcom) is layered on for members there. One queue
 * and one set of review targets serve both; the regimes are described for a
 * member by GET /api/compliance/online-safety.
 */

import type { ContentReport, Prisma, SafetyIncident } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { sendEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';
import { resolveContactEmail } from '../config/region.config';

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

// ============================================
// Intake, shared by every way in
// ============================================

/**
 * What happens to a report once it is written, independent of which door it
 * came through.
 *
 * There were two doors — the in-app dialog (POST /api/safety/reports) and the
 * public form the Online Safety Act requires (POST
 * /api/compliance/report-content) — and they did different things with the same
 * row. The public one, the one a woman uses when she has been targeted and
 * cannot or will not sign in, acknowledged nothing, alerted nobody, and did not
 * refer CSAM or terrorism to an authority, while the in-app one did. The
 * difference was invisible from either side. These helpers are the shared part,
 * so a new door cannot quietly get a different set of consequences again.
 */
export function reportPriorityFor(reason: string, isUrgent?: boolean): ReportPriority {
  const normalized = reason.toLowerCase() as ReportReason;
  const base = REASON_PRIORITY[normalized] ?? 'medium';
  // An urgency flag can only raise the priority. A reporter ticking the box on
  // a spam report does not make it critical, but she can pull a report forward
  // that our own reason mapping would have left at medium.
  if (!isUrgent) return base;
  return base === 'critical' ? 'critical' : base === 'high' ? 'critical' : 'high';
}

/** The response time this priority is promised, in the words the member is shown. */
export function expectedResponseFor(priority: ReportPriority): string {
  return RESPONSE_TIMES[priority];
}

/** A reference a reporter can quote back to us. */
export function newReportTicketId(): string {
  return generateTicketId();
}

export interface IntakeRecord {
  ticketId: string;
  reason: string;
  priority: ReportPriority;
  contentType: string;
  contentId: string;
  description?: string;
  contactEmail?: string;
  isUrgent?: boolean;
}

/**
 * Acknowledge, alert and refer. Each step is awaited but none of them is
 * allowed to lose the others: an acknowledgment that bounces must not stop the
 * CSAM referral being queued, which is why they are caught individually here
 * rather than by one try around the lot.
 */
export async function runReportIntakeConsequences(record: IntakeRecord): Promise<void> {
  const input: ContentReportInput = {
    contentType: record.contentType.toLowerCase() as ContentType,
    contentId: record.contentId,
    reason: record.reason.toLowerCase() as ReportReason,
    description: record.description,
    contactEmail: record.contactEmail,
    isUrgent: record.isUrgent,
  };

  if (record.contactEmail) {
    try {
      await sendReportAcknowledgment(
        record.contactEmail,
        record.ticketId,
        expectedResponseFor(record.priority)
      );
    } catch (error) {
      logger.warn('Report acknowledgment could not be sent', {
        ticketId: record.ticketId,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.acknowledgment', error);
    }
  }

  if (record.priority === 'critical' || record.priority === 'high') {
    try {
      await alertTrustAndSafety(record.ticketId, record.priority, input);
    } catch (error) {
      logger.error('Trust & Safety alert failed', {
        ticketId: record.ticketId,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.trust-safety', error);
    }
  }

  if (AUTHORITY_REPORTABLE_REASONS.includes(input.reason)) {
    try {
      await escalateToAuthorities(record.ticketId, input);
    } catch (error) {
      // A missed referral is the one failure on this path that has a statutory
      // consequence, so it is an error line and an ops failure, never a warn.
      logger.error('Authority escalation could not be recorded', {
        ticketId: record.ticketId,
        reason: input.reason,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.authority-escalation', error);
    }
  }
}

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

  await notifyReporterOfOutcome(report, ticketId, action);

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
 * Where a reporter goes to challenge a decision. It was written as the bare
 * string 'athena.com/help/appeal' — a domain the venture does not own, so the
 * one link in the email that matters pointed at somebody else's website.
 */
function appealUrl(): string {
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  return `${base}/help/appeal`;
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
 * Tell the woman who raised the alarm what happened.
 *
 * This used to be `if (ticketId && evidence?.contactEmail)`, and both of those
 * keys were only ever written by submitContentReport, the legacy path with no
 * production callers. Every report that actually exists in the database
 * therefore had neither, so the branch never ran once: a member reported
 * harassment, a moderator suspended the account, and the reporter heard
 * nothing, while the reported member got a notification. The account holder was
 * told and the person who was harmed was not.
 *
 * A signed-in reporter is told in-app, which is the only channel that always
 * exists for her. An emailed address is written on the report by the public
 * form, and that gets the email as well, because somebody reporting without an
 * account has no other way to hear back. Neither failure is allowed to leave
 * the decision half applied — the enforcement has already happened by the time
 * this runs.
 */
const OUTCOME_SUMMARY: Record<ModerationAction, string> = {
  dismiss: 'We reviewed the content you reported and did not find a breach of the community guidelines.',
  warn: 'We reviewed your report and warned the member responsible.',
  remove: 'We reviewed your report and removed the content.',
  suspend: 'We reviewed your report and suspended the account responsible.',
  ban: 'We reviewed your report and removed the account responsible.',
  escalate: 'Your report has gone to our senior Trust & Safety reviewers. We will come back to you.',
};

async function notifyReporterOfOutcome(
  report: ContentReport,
  ticketId: string | null,
  action: ModerationAction
): Promise<void> {
  const reference = ticketId || report.id;
  const evidence = (report.evidence ?? null) as { contactEmail?: string } | null;

  // reporterId is a required column, but the legacy path wrote the literal
  // 'system-anonymous' into it, so the account is looked up rather than assumed.
  const reporter = await prisma.user
    .findUnique({ where: { id: report.reporterId }, select: { id: true } })
    .catch(() => null);

  if (reporter) {
    try {
      await prisma.notification.create({
        data: {
          userId: reporter.id,
          type: 'SYSTEM',
          title: 'Update on your report',
          message: OUTCOME_SUMMARY[action],
          link: '/dashboard/safety',
          data: { reportId: report.id, reference, action },
        },
      });
    } catch (error) {
      logger.error('Could not tell a reporter the outcome of her report', {
        reportId: report.id,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.reporter-notification', error);
    }
  }

  if (evidence?.contactEmail) {
    try {
      await sendReportOutcome(evidence.contactEmail, reference, action);
    } catch (error) {
      logger.error('Could not email a reporter the outcome of her report', {
        reportId: report.id,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.reporter-outcome-email', error);
    }
  }
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
      <p>If you believe this decision was made in error, you can <a href="${appealUrl()}">submit an appeal</a>.</p>
      <p>Thank you for helping keep ATHENA safe.</p>
      <br>
      <p>Best regards,<br>ATHENA Trust & Safety Team</p>
    `,
  });
}

/**
 * Where a Trust & Safety alert goes.
 *
 * Both alert paths used to fall back to the literal 'trust-safety@athena.com'.
 * athena.com is not a domain this venture owns, so in any deployment that had
 * not set TRUST_SAFETY_EMAIL the body of a content report — the reported
 * content id, the reason, which for these two paths can be CSAM or terrorism,
 * and the reporter's free text — was posted to a stranger's mail server. The
 * fallback is now ATHENA's own support mailbox, derived the same way every
 * other published address on this server is, and null when no domain is
 * configured at all. Null means the alert is not sent: the report row and the
 * escalation row are already written, so the queue still holds the work, and
 * recordFailure puts the missing alert where the operations screen shows it.
 */
export function trustAndSafetyMailbox(): string | null {
  return process.env.TRUST_SAFETY_EMAIL?.trim() || resolveContactEmail('support');
}

/** The authority-referral desk, which falls back to Trust & Safety, never off-domain. */
export function authorityReferralMailbox(): string | null {
  return process.env.AUTHORITY_ESCALATION_EMAIL?.trim() || trustAndSafetyMailbox();
}

function reportAlertUndeliverable(kind: string, ticketId: string): void {
  const error = new Error(
    'No ATHENA mailbox is configured for safety alerts; set TRUST_SAFETY_EMAIL or CONTACT_DOMAIN'
  );
  logger.error(`${kind} alert could not be addressed`, { ticketId, error: error.message });
  recordFailure(`content-report.${kind}`, error);
}

/**
 * Alert Trust & Safety team
 */
export async function alertTrustAndSafety(
  ticketId: string,
  priority: ReportPriority,
  report: ContentReportInput
): Promise<void> {
  const to = trustAndSafetyMailbox();
  if (!to) {
    reportAlertUndeliverable('trust-safety', ticketId);
    return;
  }

  // Send to internal Trust & Safety channel (Slack, email, etc.)
  await sendEmail({
    to,
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
  const to = authorityReferralMailbox();
  if (!to) {
    reportAlertUndeliverable('authority-referral', ticketId);
    return;
  }

  await sendEmail({
    to,
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

// Content moderation action functions.
//
// Every type the report intake accepts has a branch here. It did not: a report
// about a reel comment, a story, a channel message or a group post reached the
// queue, a moderator chose "remove", and the only thing that happened was a
// warning line in the log while the content stayed up. Models that carry an
// isHidden flag are hidden, because hiding can be undone on appeal; the ones
// that do not are deleted, which restoreContent is honest about.
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
    case 'video_comment':
      await prisma.videoComment.update({
        where: { id: contentId },
        data: { isHidden: true },
      });
      break;
    case 'message':
      // Messages use soft delete via the conversation
      await prisma.message.delete({ where: { id: contentId } });
      break;
    case 'channel_message': {
      // ChannelMessage has no hidden flag, so removal is a delete. The
      // channel's counter is corrected with it, or the room shows a message
      // count that no longer matches what is in it.
      const channelMessage = await prisma.channelMessage.findUnique({
        where: { id: contentId },
        select: { channelId: true },
      });
      if (!channelMessage) break;
      await prisma.channelMessage.delete({ where: { id: contentId } });
      await prisma.channel.updateMany({
        where: { id: channelMessage.channelId, messageCount: { gt: 0 } },
        data: { messageCount: { decrement: 1 } },
      });
      break;
    }
    case 'group_post':
      await prisma.groupPost.deleteMany({ where: { id: contentId } });
      break;
    case 'status':
      // A story expires within the day anyway, so there is nothing to hide it
      // behind; removal takes it down now.
      await prisma.status.deleteMany({ where: { id: contentId } });
      break;
    case 'job':
      await prisma.job.update({
        where: { id: contentId },
        data: { status: 'CLOSED' },
      });
      break;
    case 'profile':
      // A profile is not content that can be taken down on its own. Saying so
      // here stops the decision looking as though it was carried out.
      logger.warn(`A profile cannot be removed; suspend the account instead: ${contentId}`);
      break;
    default:
      logger.warn(`Unknown content type for removal: ${contentType}`);
  }
}

/**
 * Put back content that was hidden by a moderator. Content that removal deletes
 * — messages, channel messages, group posts, stories — cannot be restored, so
 * the caller is told nothing came back rather than being told it worked.
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
    case 'video_comment':
      await prisma.videoComment.updateMany({ where: { id: contentId }, data: { isHidden: false } });
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

// Takes the fields rather than a ContentReport row, because an anonymous report
// is a SafetyIncident and escalates to exactly the same people.
async function escalateReport(
  ticketId: string | null,
  report: { id: string; contentType: string; contentId: string; reason: string; description: string | null }
): Promise<void> {
  logger.info(`Escalating report ${ticketId || report.id} to senior moderation`);

  // Notify senior moderators (would integrate with internal ticketing system)
  await alertTrustAndSafety(ticketId || report.id, 'critical', {
    contentType: report.contentType.toLowerCase() as ContentType,
    contentId: report.contentId,
    reason: report.reason.toLowerCase() as ReportReason,
    description: report.description || undefined,
  });
}

// ============================================
// Anonymous reports
// ============================================

/**
 * A ContentReport row names a member on both sides, so a report filed by
 * somebody with no account — the case the Online Safety Act 2021 (Cth) cares
 * most about, because a woman who has just been targeted may have no way to
 * sign in, and neither Act lets us insist — is filed as a SafetyIncident
 * instead. Nothing ever read those rows back: no route, no page, no worker. So
 * every anonymous report since POST /api/compliance/report-content shipped was
 * written to a table no moderator opens, behind a response promising a review
 * within 48 hours.
 *
 * These are the reader and the decision path. They are deliberately the same
 * shape as the ContentReport queue so the admin moderation router can show the
 * two together, and resolving one runs the same enforcement a named report
 * runs.
 */
export type AnonymousReportStatus = 'PENDING' | 'ACTIONED';

export interface AnonymousReportView {
  id: string;
  anonymous: true;
  contentType: string;
  contentId: string | null;
  reason: string | null;
  description: string | null;
  severity: string;
  status: ReportStatus;
  action: string | null;
  reviewNotes: string | null;
  reviewerId: string | null;
  reviewDeadline: string | null;
  actionTakenAt: Date | null;
  createdAt: Date;
  reportedUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    email: string;
    isSuspended: boolean;
  } | null;
}

// The incident table is shared with the safety-score signals, so an anonymous
// report is identified by all three of its markers rather than by type alone.
const ANONYMOUS_REPORT_WHERE: Prisma.SafetyIncidentWhereInput = {
  type: 'USER_REPORT',
  metadata: { path: ['anonymous'], equals: true },
};

function incidentMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function listAnonymousReports(filters: {
  status?: AnonymousReportStatus;
  contentType?: string;
  reason?: string;
  page?: number;
  limit?: number;
}): Promise<{
  reports: AnonymousReportView[];
  openCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));

  const where: Prisma.SafetyIncidentWhereInput = { ...ANONYMOUS_REPORT_WHERE };
  if (filters.status === 'PENDING') where.resolvedAt = null;
  if (filters.status === 'ACTIONED') where.resolvedAt = { not: null };
  if (filters.contentType) where.contentType = filters.contentType.toUpperCase();
  // Reasons arrive both as codes and as free text depending on where the report
  // was filed, so match loosely, the way the named-report queue does.
  if (filters.reason) where.reason = { contains: filters.reason, mode: 'insensitive' };

  const [incidents, total, openCount] = await Promise.all([
    prisma.safetyIncident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.safetyIncident.count({ where }),
    prisma.safetyIncident.count({ where: { ...ANONYMOUS_REPORT_WHERE, resolvedAt: null } }),
  ]);

  // SafetyIncident carries the reported member's id but has no relation to
  // User, so the page's accounts are fetched in one query rather than one each.
  const reportedUsers = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(incidents.map((incident) => incident.userId))) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      isSuspended: true,
    },
  });
  const byId = new Map(reportedUsers.map((user) => [user.id, user]));

  return {
    reports: incidents.map((incident) =>
      toAnonymousReportView(incident, byId.get(incident.userId) ?? null)
    ),
    openCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function toAnonymousReportView(
  incident: SafetyIncident,
  reportedUser: AnonymousReportView['reportedUser']
): AnonymousReportView {
  const meta = incidentMetadata(incident.metadata);
  return {
    id: incident.id,
    anonymous: true,
    contentType: incident.contentType || 'OTHER',
    contentId: incident.contentId,
    reason: incident.reason,
    description: metadataString(meta, 'description'),
    severity: incident.severity,
    // The incident table has no status column, only resolvedAt, so an actioned
    // report's outcome is read back from where the decision wrote it.
    status: (incident.resolvedAt
      ? metadataString(meta, 'status') || 'RESOLVED'
      : 'PENDING') as ReportStatus,
    action: metadataString(meta, 'action'),
    reviewNotes: metadataString(meta, 'reviewNotes'),
    reviewerId: incident.resolvedById,
    reviewDeadline: metadataString(meta, 'reviewDeadline'),
    actionTakenAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    reportedUser,
  };
}

export async function getAnonymousReport(id: string): Promise<AnonymousReportView | null> {
  const incident = await prisma.safetyIncident.findFirst({
    where: { ...ANONYMOUS_REPORT_WHERE, id },
  });
  if (!incident) return null;

  const reportedUser = await prisma.user.findUnique({
    where: { id: incident.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      isSuspended: true,
    },
  });

  return toAnonymousReportView(incident, reportedUser);
}

/**
 * Decide an anonymous report.
 *
 * The enforcement is the same as a named report's — the account the content
 * belongs to is recorded on the incident, so nothing has to be guessed back out
 * of the content — and the decision is written to ModerationLog under the
 * incident id, which is where the transparency figures are counted from. There
 * is nobody to email an outcome to, which is the one thing an anonymous report
 * cannot have.
 */
export async function resolveAnonymousReport(
  incidentId: string,
  action: ModerationAction,
  moderatorId: string,
  notes?: string
): Promise<ModerationOutcome> {
  const incident = await prisma.safetyIncident.findFirst({
    where: { ...ANONYMOUS_REPORT_WHERE, id: incidentId },
  });

  if (!incident) {
    throw new Error('Report not found');
  }

  if (incident.resolvedAt) {
    throw new Error('Report has already been actioned');
  }

  const contentType = incident.contentType || 'OTHER';
  const contentId = incident.contentId || '';
  const status: ReportStatus =
    action === 'dismiss' ? 'DISMISSED' : action === 'escalate' ? 'REVIEWING' : 'RESOLVED';

  switch (action) {
    case 'remove':
      if (contentId) await removeContent(contentType, contentId);
      break;
    case 'warn':
      await warnUser(incident.userId, contentType, contentId);
      break;
    case 'suspend':
    case 'ban':
      await suspendUser(incident.userId);
      break;
    case 'escalate':
      await escalateReport(null, {
        id: incident.id,
        contentType,
        contentId,
        reason: incident.reason || 'other',
        description: metadataString(incidentMetadata(incident.metadata), 'description'),
      });
      break;
  }

  const metadata = {
    ...incidentMetadata(incident.metadata),
    status,
    action: ACTION_OUTCOMES[action],
    reviewNotes: notes ?? null,
    moderatorId,
  } as Prisma.InputJsonObject;

  await prisma.safetyIncident.update({
    where: { id: incident.id },
    data: {
      // An escalated report is still open, so it keeps its place in the queue
      // until the senior review closes it.
      resolvedAt: action === 'escalate' ? null : new Date(),
      resolvedById: moderatorId,
      // "Verified" on an incident means a moderator looked and agreed, which a
      // dismissal is precisely not.
      verified: action !== 'dismiss',
      metadata,
    },
  });

  await prisma.moderationLog.create({
    data: {
      ticketId: incident.id,
      action,
      moderatorId,
      notes,
      timestamp: new Date(),
    },
  });

  logger.info('Anonymous report actioned', { incidentId: incident.id, action, status });

  return {
    reportId: incident.id,
    ticketId: null,
    status,
    action,
    contentType,
    contentId,
    reportedUserId: incident.userId,
  };
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
  reportPriorityFor,
  expectedResponseFor,
  newReportTicketId,
  runReportIntakeConsequences,
  getReportStatus,
  processContentReport,
  processReportById,
  reverseEnforcement,
  listAnonymousReports,
  getAnonymousReport,
  resolveAnonymousReport,
  listAuthorityEscalations,
  getAuthorityEscalation,
  updateAuthorityEscalationStatus,
};
