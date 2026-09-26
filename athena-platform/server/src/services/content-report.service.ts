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

import crypto from 'crypto';
import type { ContentReport, Prisma, SafetyIncident } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { sendEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { recordFailure } from '../utils/ops-metrics';
import { AU_ONLINE_SAFETY_CONFIG, resolveContactEmail } from '../config/region.config';
import { notifyAdmins } from './admin-notify.service';

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

/**
 * How urgent each reason is, for alerting.
 *
 * The public form and the in-app dialog grew separate vocabularies — the form
 * says hate_speech, the dialog says hate; the dialog has violence, sexual and
 * impersonation, which the form does not — and only the form's words were
 * listed here, so every report from the dialog fell through to medium. A member
 * reporting "Violence or threats" from inside the app raised no alert at all.
 * Both vocabularies are listed now, so the priority a report gets depends on
 * what it is about and never on which door it came through.
 */
const REASON_PRIORITY: Record<string, ReportPriority> = {
  // The public report form (client/src/app/report)
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
  // The in-app report dialogs (ReportDialog, ReportEventDialog)
  hate: 'high',
  violence: 'high',
  sexual: 'high',
  // Impersonation is how a controlling ex-partner gets back into a woman's
  // feed after she has blocked him, so it is not treated as a nuisance.
  impersonation: 'high',
  unsafe: 'high',
  // Somebody at risk of harming herself is the most time-critical report there
  // is, whoever it is filed by.
  self_harm: 'critical',
};

/** Every reason either door may file under, lower-case. Anything else is refused at intake. */
export const REPORTABLE_REASONS: ReadonlySet<string> = new Set(Object.keys(REASON_PRIORITY));

export function isReportableReason(reason: unknown): reason is string {
  return typeof reason === 'string' && REPORTABLE_REASONS.has(reason.trim().toLowerCase());
}

/**
 * Reasons that are about illegal content rather than harmful content, and so
 * run on the shorter of the two review clocks.
 */
const ILLEGAL_CONTENT_REASONS: ReadonlySet<string> = new Set(['illegal', 'csam', 'terrorism']);

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
  const normalized = reason.trim().toLowerCase();
  const base = REASON_PRIORITY[normalized] ?? 'medium';
  // An urgency flag can only raise the priority. A reporter ticking the box on
  // a spam report does not make it critical, but she can pull a report forward
  // that our own reason mapping would have left at medium.
  if (!isUrgent) return base;
  return base === 'critical' ? 'critical' : base === 'high' ? 'critical' : 'high';
}

/**
 * The review clock a report runs on, in hours.
 *
 * There are two, and only two: the Online Safety Act targets the platform
 * already publishes at GET /api/compliance/online-safety — 24 hours for illegal
 * content, 48 for harmful. Three different sets of numbers used to be in play.
 * The route stamped 24 hours only on a critical priority, so an "Illegal
 * content" report (priority high) was stamped 48; the acknowledgment email read
 * from a table that promised a CSAM reporter an answer within one hour and a
 * spam reporter one within 72, neither of which any clock on the server
 * measured; and the confirmation screen said 24-72. The one function below is
 * now what stamps the deadline and what the email quotes, so the two cannot
 * disagree again.
 *
 * Anything the reporter has marked urgent runs on the 24-hour clock as well,
 * which is what the report form has always told her.
 */
export function reviewHoursFor(reason: string, isUrgent?: boolean): number {
  const normalized = reason.trim().toLowerCase();
  return ILLEGAL_CONTENT_REASONS.has(normalized) || isUrgent
    ? AU_ONLINE_SAFETY_CONFIG.illegalContentRemovalHours
    : AU_ONLINE_SAFETY_CONFIG.harmfulContentReviewHours;
}

/** The review clock in the words the reporter is shown. */
export function expectedResponseFor(reviewHours: number): string {
  return `within ${reviewHours} hours`;
}

/**
 * When a report is due, for rows that carry no stamped deadline.
 *
 * Reports filed through the in-app dialog were never stamped, so the queue
 * works their deadline out from when they arrived and the clock their reason
 * runs on. A stamped deadline always wins: it is what the reporter was told.
 */
export function reviewDeadlineFor(input: {
  createdAt: Date;
  reason: string | null;
  stamped?: unknown;
  isUrgent?: unknown;
}): Date {
  if (typeof input.stamped === 'string') {
    const stamped = new Date(input.stamped);
    if (!Number.isNaN(stamped.getTime())) return stamped;
  }
  const hours = reviewHoursFor(input.reason ?? 'other', input.isUrgent === true);
  return new Date(input.createdAt.getTime() + hours * 60 * 60 * 1000);
}

/** A reference a reporter can quote back to us. */
export function newReportTicketId(): string {
  return generateTicketId();
}

/**
 * Everything a report needs stamped on it before it is written, from either
 * door: the reference, the priority, the clock and the deadline.
 *
 * The public form computed these inline and the in-app dialog never computed
 * them at all, so a report filed from inside the app had no reference, no
 * deadline and no alert. A route that files a report calls this first, writes
 * `evidence` onto the row, and then hands the same numbers to
 * runReportIntakeConsequences.
 */
export function openReportIntake(input: { reason: string; isUrgent?: boolean; now?: Date }): {
  ticketId: string;
  priority: ReportPriority;
  reviewHours: number;
  reviewDeadline: Date;
} {
  const now = input.now ?? new Date();
  const reviewHours = reviewHoursFor(input.reason, input.isUrgent);
  return {
    ticketId: generateTicketId(),
    priority: reportPriorityFor(input.reason, input.isUrgent),
    reviewHours,
    reviewDeadline: new Date(now.getTime() + reviewHours * 60 * 60 * 1000),
  };
}

export interface IntakeRecord {
  ticketId: string;
  reason: string;
  priority: ReportPriority;
  /** The clock the deadline was stamped from, so the acknowledgment quotes the same number. */
  reviewHours: number;
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
        expectedResponseFor(record.reviewHours)
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

// submitContentReport, getReportStatus and processContentReport used to live
// here: a ticket-based reporting path from before either door existed, with no
// production caller. It wrote the literal 'system-anonymous' and 'unknown' into
// the two required User foreign keys, so the first real call would have thrown,
// and the escalation tests exercised the referral through it rather than
// through the intake the routes actually run — coverage that described code
// nobody calls. The status lookup lives at GET /api/compliance/report-status and
// decisions go through processReportById and resolveAnonymousReport.

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
  // The reference now opens a public status lookup, so the suffix comes from
  // the CSPRNG rather than Math.random: a reference somebody could guess is a
  // reference somebody could use to watch another woman's report.
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
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
// What a reporter is told. A ban used to be described to her as the account
// having been "removed" and "permanently banned". Neither was true: a ban locks
// the account exactly as a suspension does, the row stays, an appeal can lift
// it, and nothing stops the same person registering again under another
// address. On a platform where the reported account may belong to a woman's
// abuser, telling her he is gone for good when he is not is the most dangerous
// sentence this file could send, so the wording says only what happened.
const OUTCOME_SUMMARY: Record<ModerationAction, string> = {
  dismiss: 'We reviewed the content you reported and did not find a breach of the community guidelines.',
  warn: 'We reviewed your report and warned the member responsible.',
  remove: 'We reviewed your report and removed the content.',
  suspend: 'We reviewed your report and suspended the account responsible. It can no longer sign in.',
  ban: 'We reviewed your report and banned the account responsible. It can no longer sign in.',
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
  // See OUTCOME_SUMMARY: "temporarily" and "permanently" were both claims no
  // clock or record on the server backed, so neither is made.
  const actionMessages: Record<string, string> = {
    dismiss: 'After careful review, we determined that the reported content does not violate our Community Guidelines.',
    warn: 'We have issued a warning to the user responsible for the content.',
    remove: 'We have removed the reported content as it violated our Community Guidelines.',
    suspend: 'We have suspended the account responsible for the content. It can no longer sign in.',
    ban: 'We have banned the account responsible for the content. It can no longer sign in.',
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

// Suspend and ban both come here, and that is deliberate rather than an
// oversight to be hidden: the schema has no ban record, no permanence and no
// way to refuse the same person a new account, so the only enforcement either
// verb can carry is the lock. What distinguishes a ban is the record —
// ContentReport.action BAN, the ModerationLog verb and the audit metadata — and
// every screen and message that describes one now says exactly that much.
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
  /** True while the report is open and its review deadline has passed. */
  overdue: boolean;
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

  // The open queue is worked in deadline order, not arrival order: a 24-hour
  // CSAM report that came in this morning is due before a 48-hour harassment
  // report from yesterday. The deadline lives in the metadata JSON, which the
  // database cannot sort on, so the open set is read oldest first and ordered
  // here. Every other view is history and stays newest first.
  const deadlineOrdered = filters.status === 'PENDING';

  const [incidents, total, openCount] = await Promise.all([
    deadlineOrdered
      ? prisma.safetyIncident
          .findMany({ where, orderBy: { createdAt: 'asc' }, take: DEADLINE_SORT_WINDOW })
          .then((rows) =>
            sortByDeadline(rows, (incident) => anonymousDeadline(incident)).slice((page - 1) * limit, page * limit)
          )
      : prisma.safetyIncident.findMany({
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

/**
 * How many open reports the queue will order by deadline in one pass. Every
 * deadline is arrival plus 24 or 48 hours, so reading the oldest first means
 * anything past this window is at most a day out of order — and an open queue
 * this long is an emergency the overdue count will already be shouting about.
 */
export const DEADLINE_SORT_WINDOW = 2000;

export function sortByDeadline<T>(rows: T[], deadlineOf: (row: T) => Date): T[] {
  return rows
    .map((row) => ({ row, due: deadlineOf(row).getTime() }))
    .sort((a, b) => a.due - b.due)
    .map((entry) => entry.row);
}

function anonymousDeadline(incident: SafetyIncident): Date {
  const meta = incidentMetadata(incident.metadata);
  return reviewDeadlineFor({
    createdAt: incident.createdAt,
    reason: incident.reason,
    stamped: meta.reviewDeadline,
    isUrgent: meta.isUrgent,
  });
}

function toAnonymousReportView(
  incident: SafetyIncident,
  reportedUser: AnonymousReportView['reportedUser']
): AnonymousReportView {
  const meta = incidentMetadata(incident.metadata);
  const deadline = anonymousDeadline(incident);
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
    reviewDeadline: deadline.toISOString(),
    overdue: !incident.resolvedAt && deadline.getTime() < Date.now(),
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
 * incident id, which is where the transparency figures are counted from.
 *
 * This used to say there was nobody to email an outcome to. There often was:
 * the public form asks for a contact address, the intake emails her an
 * acknowledgment promising "an update once we've completed our review", and the
 * address is sitting in the incident metadata this function has just read. The
 * reporter with no account is the one who has no other way to hear back, so
 * she is written to exactly as a named reporter with an address is.
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

  const originalMeta = incidentMetadata(incident.metadata);
  const ticketId = metadataString(originalMeta, 'ticketId');
  const contactEmail = metadataString(originalMeta, 'contactEmail');
  if (contactEmail) {
    // The decision is already applied; a bounced email must not undo it or
    // report it as failed, but it must not vanish either.
    try {
      await sendReportOutcome(contactEmail, ticketId || incident.id, action);
    } catch (error) {
      logger.error('Could not email an anonymous reporter the outcome of her report', {
        incidentId: incident.id,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.reporter-outcome-email', error);
    }
  }

  return {
    reportId: incident.id,
    ticketId,
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

// ============================================
// Review deadlines
// ============================================

/**
 * Tell Trust & Safety when reports have passed their review deadline.
 *
 * The platform promises reporters 24 hours for illegal content and 48 for
 * everything else, and until the queue sorted by deadline it had no way to
 * know whether it had kept either. The queue now shows it to whoever opens it;
 * this is for when nobody does. One alert per sweep, naming how many are late
 * and the oldest few, to the same mailbox the intake alerts use, plus an
 * in-app notice to the admins.
 *
 * Built to be run on a schedule by the scheduled-tasks worker. It never throws
 * on a failed send: the count it returns is the truth either way, and a
 * missing mailbox is put on the operations screen.
 */
export async function alertOverdueReports(now: Date = new Date()): Promise<{ overdue: number; alerted: boolean }> {
  const [named, anonymous] = await Promise.all([
    prisma.contentReport.findMany({
      where: { status: { in: ['PENDING', 'REVIEWING'] } },
      select: { id: true, createdAt: true, reason: true, evidence: true },
      orderBy: { createdAt: 'asc' },
      take: DEADLINE_SORT_WINDOW,
    }),
    prisma.safetyIncident.findMany({
      where: { ...ANONYMOUS_REPORT_WHERE, resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      take: DEADLINE_SORT_WINDOW,
    }),
  ]);

  const late: Array<{ reference: string; reason: string; due: Date; anonymous: boolean }> = [];
  for (const report of named) {
    const evidence = (report.evidence ?? null) as { reviewDeadline?: unknown; isUrgent?: unknown; ticketId?: unknown } | null;
    const due = reviewDeadlineFor({
      createdAt: report.createdAt,
      reason: report.reason,
      stamped: evidence?.reviewDeadline,
      isUrgent: evidence?.isUrgent,
    });
    if (due.getTime() < now.getTime()) {
      late.push({
        reference: typeof evidence?.ticketId === 'string' ? evidence.ticketId : report.id,
        reason: report.reason,
        due,
        anonymous: false,
      });
    }
  }
  for (const incident of anonymous) {
    const due = anonymousDeadline(incident);
    if (due.getTime() < now.getTime()) {
      late.push({
        reference: metadataString(incidentMetadata(incident.metadata), 'ticketId') ?? incident.id,
        reason: incident.reason ?? 'OTHER',
        due,
        anonymous: true,
      });
    }
  }

  if (late.length === 0) return { overdue: 0, alerted: false };

  late.sort((a, b) => a.due.getTime() - b.due.getTime());
  const hoursLate = (due: Date) => Math.max(1, Math.round((now.getTime() - due.getTime()) / (60 * 60 * 1000)));
  const oldest = late.slice(0, 10);

  const to = trustAndSafetyMailbox();
  let alerted = false;
  if (!to) {
    reportAlertUndeliverable('overdue-reports', `${late.length} overdue`);
  } else {
    try {
      await sendEmail({
        to,
        subject: `[OVERDUE] ${late.length} report${late.length === 1 ? '' : 's'} past the review deadline`,
        html: `
          <h2>${late.length} report${late.length === 1 ? ' is' : 's are'} past the review deadline</h2>
          <p>Reporters were told 24 hours for illegal content and 48 hours for everything else. The oldest:</p>
          <ul>
            ${oldest
              .map(
                (item) =>
                  `<li>${item.reference} — ${item.reason}${item.anonymous ? ' (filed without an account)' : ''} — ${hoursLate(item.due)} hours late</li>`
              )
              .join('')}
          </ul>
          <p>Work them from the report queue in the admin console, soonest due first.</p>
        `,
      });
      alerted = true;
    } catch (error) {
      logger.error('Overdue-report alert could not be sent', {
        overdue: late.length,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.overdue-alert', error);
    }
  }

  await notifyAdmins({
    title: `${late.length} report${late.length === 1 ? '' : 's'} past the review deadline`,
    message: `The oldest is ${hoursLate(oldest[0].due)} hours late.`,
    link: '/admin/moderation',
    data: { overdue: late.length },
  });

  return { overdue: late.length, alerted };
}

// ============================================
// Transparency reporting
// ============================================

/**
 * The public transparency report is read from TransparencyReport rows, and
 * nothing in the repository ever wrote one: no route, no job, no seed. So
 * /help/transparency-report — a page whose own header cites the Act that asks
 * an Australian service for it — could only ever show its empty state. This
 * compiles a quarter from the records the platform already keeps, so the
 * report is counted rather than typed in, and an administrator then publishes
 * it. A compiled report is a draft until publishTransparencyReport stamps it.
 */

/** 'Q3_2026' — the period key the public route and the unique index both use. */
const PERIOD_PATTERN = /^Q([1-4])_(\d{4})$/;

/**
 * Queensland keeps no daylight saving, so a quarter here is a fixed +10:00
 * offset from UTC. A report for "Q3" starts at midnight on 1 July in Brisbane,
 * which is 14:00 UTC on 30 June.
 */
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

export function transparencyPeriodBounds(period: string): { startDate: Date; endDate: Date } | null {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) return null;
  const quarter = Number(match[1]);
  const year = Number(match[2]);
  if (year < 2020 || year > 2100) return null;
  const startMonth = (quarter - 1) * 3;
  return {
    startDate: new Date(Date.UTC(year, startMonth, 1) - BRISBANE_OFFSET_MS),
    endDate: new Date(Date.UTC(year, startMonth + 3, 1) - BRISBANE_OFFSET_MS),
  };
}

/**
 * Which published category a stored reason counts under. The public form's
 * codes map to themselves; the in-app dialog's words are folded into the
 * nearest published category, and anything unrecognised is counted as other
 * rather than dropped, so the categories always add up to the total.
 */
const TRANSPARENCY_CATEGORY_FOR_REASON: Record<string, string> = {
  illegal: 'illegal',
  harmful: 'harmful',
  harassment: 'harassment',
  hate_speech: 'hate_speech',
  spam: 'spam',
  misinformation: 'misinformation',
  csam: 'csam',
  terrorism: 'terrorism',
  fraud: 'fraud',
  other: 'other',
  hate: 'hate_speech',
  violence: 'harmful',
  sexual: 'harmful',
  self_harm: 'harmful',
  unsafe: 'harmful',
  impersonation: 'other',
};

const TRANSPARENCY_ACTION_FOR_MODERATION: Record<string, string> = {
  remove: 'contentRemoved',
  suspend: 'accountsSuspended',
  ban: 'accountsBanned',
  warn: 'warnings',
  dismiss: 'noAction',
};

export interface CompiledTransparencyReport {
  period: string;
  startDate: Date;
  endDate: Date;
  totalReports: number;
  reportsByCategory: Record<string, number>;
  actionsTotal: number;
  actionsByType: Record<string, number>;
  avgResponseHours: number;
  under24Hours: number;
  under72Hours: number;
  over72Hours: number;
  totalAppeals: number;
  appealsUpheld: number;
  appealsOverturned: number;
}

/**
 * Count a quarter.
 *
 * - Reports: every named report and every report filed without an account that
 *   arrived in the quarter, by category.
 * - Actions: every moderator decision logged in the quarter, by what it did.
 *   Senior-review referrals and authority-referral progress are not actions on
 *   content or accounts and are left out of these buckets.
 * - Timing: for reports that arrived in the quarter and have been decided, how
 *   long the decision took. The three buckets — under 24 hours, 24 to 72, over
 *   72 — add up to the reports decided, not to all reports, because an
 *   undecided report has no response time yet.
 * - Appeals: appeals against moderation or a suspension lodged in the quarter;
 *   "upheld" is the original decision standing (the appeal was rejected) and
 *   "overturned" is the appeal succeeding.
 */
export async function compileTransparencyReport(period: string, now: Date = new Date()): Promise<CompiledTransparencyReport> {
  const bounds = transparencyPeriodBounds(period);
  if (!bounds) {
    throw new Error('Period must look like Q3_2026');
  }
  // A quarter still running would publish a number that is wrong by tomorrow.
  if (bounds.endDate.getTime() > now.getTime()) {
    throw new Error('That quarter has not ended yet');
  }

  const inPeriod = { gte: bounds.startDate, lt: bounds.endDate };

  const [named, anonymous, decisions, appeals] = await Promise.all([
    prisma.contentReport.findMany({
      where: { createdAt: inPeriod },
      select: { reason: true, createdAt: true, actionTakenAt: true },
    }),
    prisma.safetyIncident.findMany({
      where: { ...ANONYMOUS_REPORT_WHERE, createdAt: inPeriod },
      select: { reason: true, createdAt: true, resolvedAt: true },
    }),
    prisma.moderationLog.groupBy({
      by: ['action'],
      where: { timestamp: inPeriod },
      _count: { _all: true },
    }),
    prisma.appeal.groupBy({
      by: ['status'],
      where: { createdAt: inPeriod, type: { in: ['CONTENT_MODERATION', 'ACCOUNT_SUSPENSION'] } },
      _count: { _all: true },
    }),
  ]);

  const reportsByCategory: Record<string, number> = {};
  for (const category of new Set(Object.values(TRANSPARENCY_CATEGORY_FOR_REASON))) reportsByCategory[category] = 0;
  const responseHours: number[] = [];

  const count = (reason: string | null, createdAt: Date, decidedAt: Date | null) => {
    const category = TRANSPARENCY_CATEGORY_FOR_REASON[(reason ?? 'other').trim().toLowerCase()] ?? 'other';
    reportsByCategory[category] += 1;
    if (decidedAt) responseHours.push((decidedAt.getTime() - createdAt.getTime()) / (60 * 60 * 1000));
  };
  for (const report of named) count(report.reason, report.createdAt, report.actionTakenAt);
  for (const incident of anonymous) count(incident.reason, incident.createdAt, incident.resolvedAt);

  const actionsByType: Record<string, number> = {
    contentRemoved: 0,
    accountsSuspended: 0,
    accountsBanned: 0,
    warnings: 0,
    noAction: 0,
  };
  for (const row of decisions) {
    const bucket = TRANSPARENCY_ACTION_FOR_MODERATION[row.action];
    if (bucket) actionsByType[bucket] += row._count._all;
  }

  const appealsBy = new Map(appeals.map((row) => [row.status, row._count._all]));
  const totalAppeals = appeals.reduce((sum, row) => sum + row._count._all, 0);

  const avg = responseHours.length
    ? responseHours.reduce((sum, hours) => sum + hours, 0) / responseHours.length
    : 0;

  return {
    period,
    ...bounds,
    totalReports: named.length + anonymous.length,
    reportsByCategory,
    actionsTotal: Object.values(actionsByType).reduce((sum, n) => sum + n, 0),
    actionsByType,
    avgResponseHours: Math.round(avg * 10) / 10,
    under24Hours: responseHours.filter((hours) => hours < 24).length,
    under72Hours: responseHours.filter((hours) => hours >= 24 && hours < 72).length,
    over72Hours: responseHours.filter((hours) => hours >= 72).length,
    totalAppeals,
    appealsUpheld: appealsBy.get('REJECTED') ?? 0,
    appealsOverturned: appealsBy.get('APPROVED') ?? 0,
  };
}

export default {
  reportPriorityFor,
  reviewHoursFor,
  reviewDeadlineFor,
  expectedResponseFor,
  newReportTicketId,
  openReportIntake,
  runReportIntakeConsequences,
  processReportById,
  reverseEnforcement,
  listAnonymousReports,
  getAnonymousReport,
  resolveAnonymousReport,
  listAuthorityEscalations,
  getAuthorityEscalation,
  updateAuthorityEscalationStatus,
  transparencyPeriodBounds,
  compileTransparencyReport,
  alertOverdueReports,
};
