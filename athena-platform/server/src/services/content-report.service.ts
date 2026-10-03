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
// Report text is written by whoever filed it, including people with no
// account, and it lands in staff inboxes. Interpolated raw, a reporter could
// put a link or a fake "sign in again" form into the Trust & Safety mailbox
// dressed as ATHENA's own alert. Everything a reporter typed is escaped.
import { escapeHtml } from './email.service';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { recordFailure } from '../utils/ops-metrics';
import { AU_ONLINE_SAFETY_CONFIG, resolveContactEmail } from '../config/region.config';
import { notifyAdmins } from './admin-notify.service';
import { recordBannedIdentity } from './banned-identity.service';
import { sessionService } from './session.service';
import { takenDownByStaff, withStaffTakedown, withoutStaffTakedown } from './housing-supply.service';
import { setReviewHidden } from './wellness/health-review.service';
import { captureMessageForEvidence } from './report-context.service';
import { IMMEDIATE_HIDE_ACTION } from './moderation-threshold.service';

export type ContentType = 'post' | 'message' | 'profile' | 'comment' | 'job' | 'other';
export type ReportReason = 'illegal' | 'harmful' | 'harassment' | 'hate_speech' | 'spam' | 'misinformation' | 'csam' | 'terrorism' | 'fraud' | 'intimate_image' | 'threat' | 'other';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
/** The priority as ContentReport.priority stores it, which the queue sorts and filters on. */
export type ReportPriorityLevel = 'URGENT' | 'HIGH' | 'NORMAL';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type ModerationAction = 'dismiss' | 'warn' | 'remove' | 'suspend' | 'ban' | 'escalate';
export type EscalationStatus = 'reported' | 'acknowledged' | 'resolved';

/** The report statuses that are still waiting on a person. */
export const OPEN_REPORT_STATUSES = ['PENDING', 'REVIEWING'];

export interface ModerationOutcome {
  reportId: string;
  ticketId: string | null;
  status: ReportStatus;
  action: ModerationAction;
  contentType: string;
  contentId: string;
  reportedUserId: string;
  /**
   * Set on a ban only: whether the person was also barred from registering
   * again. False means the account is locked but the door is not closed, which
   * the moderator is told rather than left to assume.
   */
  banIdentityRecorded?: boolean;
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
//
// An intimate image shared without consent is on the list for a different reason
// from the other two. ATHENA has no statutory duty to refer it, but the
// Commissioner is the body with the power to order the image taken down
// wherever it has spread and to act against the person who shared it, and a
// woman reporting it is often reporting it nowhere else. The row is the queue
// item that has staff help her do that, and keep what the Commissioner will ask
// for, as the Trust & Safety runbook sets out.
export const AUTHORITY_REPORTABLE_REASONS: ReportReason[] = ['csam', 'terrorism', 'intimate_image'];

/**
 * Who a referral is filed with.
 *
 * These named the Internet Watch Foundation and the UK Counter Terrorism
 * Internet Referral Unit, the bodies a British host would use. ATHENA is a
 * Queensland company, and the duty it actually carries is Australian: the
 * Criminal Code Act 1995 (Cth) requires a content host that becomes aware its
 * service can be used to reach child abuse material (s 474.25), or abhorrent
 * violent material recording conduct in Australia (s 474.33), to refer the
 * details to the Australian Federal Police within a reasonable time. Child
 * exploitation reports reach the AFP through the ACCCE, the centre it runs for
 * them. The referral screen tells the operator where to file from this value,
 * so a queue that named a UK body would have sent an Australian filing to the
 * wrong country. Referrals already queued keep the body they were queued for.
 */
export const REFERRAL_AUTHORITY = {
  childAbuse: 'Australian Federal Police (ACCCE)',
  violentExtremism: 'Australian Federal Police',
  imageAbuse: 'eSafety Commissioner',
} as const;

const DEFAULT_AUTHORITY = REFERRAL_AUTHORITY.violentExtremism;

const AUTHORITY_FOR_REASON: Partial<Record<ReportReason, string>> = {
  csam: REFERRAL_AUTHORITY.childAbuse,
  terrorism: REFERRAL_AUTHORITY.violentExtremism,
  intimate_image: REFERRAL_AUTHORITY.imageAbuse,
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
  // The two a woman is most likely to be filing about herself, and the two that
  // had no name on any door: she had to guess "sexual content" or "violence",
  // and either ran at high on the harmful-content clock. An intimate image
  // shared without consent and a threat to hurt someone are critical on the
  // illegal-content clock, hidden at once (moderation-threshold.service), and
  // seen by a person within CRITICAL_FIRST_LOOK_HOURS.
  intimate_image: 'critical',
  threat: 'critical',
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
const ILLEGAL_CONTENT_REASONS: ReadonlySet<string> = new Set(['illegal', 'csam', 'terrorism', 'intimate_image', 'threat']);

/**
 * ATHENA's own target for a person to open a critical report, inside the 24
 * hours the reporter is promised. The promise is the ceiling; this is the
 * aim, and it is what the alert to Trust & Safety names and what the overdue
 * sweep holds the queue to. A woman whose intimate image is in front of people
 * is not helped by an answer on the afternoon of the next day.
 */
export const CRITICAL_FIRST_LOOK_HOURS = 4;

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
 * The priority in the three words ContentReport.priority holds. Alerting keeps
 * its four levels; the queue needs only to know what is urgent, what is high,
 * and what can wait its turn, and low and medium are both the last of those.
 */
export function priorityLevelFor(priority: ReportPriority): ReportPriorityLevel {
  return priority === 'critical' ? 'URGENT' : priority === 'high' ? 'HIGH' : 'NORMAL';
}

const PRIORITY_LEVELS: ReadonlySet<string> = new Set<ReportPriorityLevel>(['URGENT', 'HIGH', 'NORMAL']);

export function isReportPriorityLevel(value: unknown): value is ReportPriorityLevel {
  return typeof value === 'string' && PRIORITY_LEVELS.has(value);
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
 * reviewDeadline and priorityLevel into the ContentReport columns of the same
 * names, and then hands the same numbers to runReportIntakeConsequences.
 */
export function openReportIntake(input: { reason: string; isUrgent?: boolean; now?: Date }): {
  ticketId: string;
  priority: ReportPriority;
  /** What ContentReport.priority stores. */
  priorityLevel: ReportPriorityLevel;
  reviewHours: number;
  reviewDeadline: Date;
} {
  const now = input.now ?? new Date();
  const reviewHours = reviewHoursFor(input.reason, input.isUrgent);
  const priority = reportPriorityFor(input.reason, input.isUrgent);
  return {
    ticketId: generateTicketId(),
    priority,
    priorityLevel: priorityLevelFor(priority),
    reviewHours,
    reviewDeadline: new Date(now.getTime() + reviewHours * 60 * 60 * 1000),
  };
}

/**
 * When a named report is due, reading the column first.
 *
 * reviewDeadline is the column the queue sorts on and what the reporter was
 * told. A row can still lack it — one filed by a door that does not stamp it
 * yet, or an old row whose evidence held a malformed date the migration left
 * alone — and then the deadline is worked out from the evidence and the clock
 * its reason runs on, exactly as the queue always has.
 */
export function namedReportDeadline(report: {
  createdAt: Date;
  reason: string | null;
  reviewDeadline?: Date | null;
  evidence?: unknown;
}): Date {
  if (report.reviewDeadline) return report.reviewDeadline;
  const evidence = evidenceObject(report.evidence);
  return reviewDeadlineFor({
    createdAt: report.createdAt,
    reason: report.reason,
    stamped: evidence.reviewDeadline,
    isUrgent: evidence.isUrgent,
  });
}

/** The priority a named report is worked at, reading the column first. */
export function namedReportPriority(report: {
  reason: string | null;
  priority?: string | null;
  evidence?: unknown;
}): ReportPriorityLevel {
  if (isReportPriorityLevel(report.priority)) return report.priority;
  const evidence = evidenceObject(report.evidence);
  // The public form wrote its four-level priority into the evidence before the
  // column existed. The migration copied across only the values already in the
  // column's words, so a 'critical' report would otherwise be re-derived here
  // and could come out lower than the reporter was promised.
  const stamped = typeof evidence.priority === 'string' ? evidence.priority.toLowerCase() : null;
  if (stamped === 'critical' || stamped === 'high' || stamped === 'medium' || stamped === 'low') {
    return priorityLevelFor(stamped);
  }
  return priorityLevelFor(reportPriorityFor(report.reason ?? 'other', evidence.isUrgent === true));
}

function evidenceObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** How many unstamped open reports one pass will stamp. */
const STAMP_BATCH = 200;

/**
 * Give every open report a deadline and a priority in the columns.
 *
 * The public form stamps both when it writes the row. The in-app dialog and
 * the other doors did not, and a report with no deadline in the column cannot
 * be put in its place by a database sort: it would sit at the end of the queue
 * however late it was. So before the queue is read, and before the overdue
 * sweep runs, any open report still missing either is given the deadline the
 * queue already showed for it — arrival plus the clock its reason runs on —
 * and from then on the column is the single answer. Bounded, and a no-op once
 * every door stamps its own rows.
 */
export async function stampMissingReviewClocks(): Promise<number> {
  const unstamped = await prisma.contentReport.findMany({
    where: {
      status: { in: OPEN_REPORT_STATUSES },
      OR: [{ reviewDeadline: null }, { priority: null }],
    },
    select: { id: true, createdAt: true, reason: true, reviewDeadline: true, priority: true, evidence: true },
    orderBy: { createdAt: 'asc' },
    take: STAMP_BATCH,
  });

  for (const report of unstamped) {
    await prisma.contentReport.update({
      where: { id: report.id },
      data: {
        reviewDeadline: namedReportDeadline(report),
        priority: namedReportPriority(report),
      },
    });
  }

  return unstamped.length;
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
  let banIdentityRecorded: boolean | undefined;
  const enforcementReason = decisionReason(notes, report.contentType, report.reason);
  switch (action) {
    case 'remove':
      await keepMessageEvidence(report);
      await removeContent(report.contentType, report.contentId, { moderatorId, reason: enforcementReason });
      await tellAuthorOfRemoval(report, ticketId);
      break;
    case 'dismiss':
      await restoreWhatThisReportHid(report, ticketId);
      break;
    case 'warn':
      await warnUser(report.reportedUserId, report.contentType, report.contentId);
      break;
    case 'suspend':
      await suspendAccount(report.reportedUserId, { moderatorId, reason: enforcementReason });
      break;
    case 'ban':
      banIdentityRecorded = await banAccount(report.reportedUserId, {
        moderatorId,
        reason: enforcementReason,
        reportId: report.id,
      });
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
    ...(banIdentityRecorded === undefined ? {} : { banIdentityRecorded }),
  };
}

/**
 * Undo the enforcement a moderator applied, used when an appeal succeeds.
 * Returns what was actually reversed so the caller can record it.
 *
 * A ban is lifted only when the caller says the decision was about the ban
 * itself (liftBan) — an upheld appeal against the account's suspension. An
 * appeal about a single post does not reopen a banned account on the way past:
 * the ban was a separate decision about the person, and on this platform the
 * person may be someone a member is hiding from. When a ban is lifted, the
 * record that stops the address registering again goes with it, because the
 * decision it recorded has been overturned.
 */
export async function reverseEnforcement(input: {
  userId: string;
  reportId?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  liftBan?: boolean;
}): Promise<{
  suspensionLifted: boolean;
  banLifted: boolean;
  /** True when the account is banned and this appeal was not about the ban, so it stays locked. */
  banKept: boolean;
  contentRestored: boolean;
  reportCleared: boolean;
}> {
  const report = input.reportId
    ? await prisma.contentReport.findUnique({ where: { id: input.reportId } })
    : null;

  const contentType = input.contentType || report?.contentType || null;
  const contentId = input.contentId || report?.contentId || null;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { isSuspended: true, bannedAt: true },
  });

  let suspensionLifted = false;
  let banLifted = false;
  const banned = Boolean(user?.bannedAt);
  const banKept = banned && !input.liftBan;

  if (user?.isSuspended && !banKept) {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
        suspendedById: null,
        ...(banned ? { bannedAt: null, banReason: null, bannedById: null } : {}),
      },
    });
    suspensionLifted = true;
    if (banned) {
      await prisma.bannedIdentity.deleteMany({ where: { userId: input.userId } });
      banLifted = true;
    }
  }

  let contentRestored = false;
  if (contentType && contentId) {
    contentRestored = await restoreContent(contentType, contentId);
  }

  let reportCleared = false;
  // The report that recorded a ban stays as it is while the ban stands, or the
  // queue would describe as reversed a decision that is still in force.
  if (report && !(banKept && report.action === ACTION_OUTCOMES.ban)) {
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

  return { suspensionLifted, banLifted, banKept, contentRestored, reportCleared };
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

/** When a critical report filed now should have been opened, in Brisbane time. */
function firstLookBy(now: Date = new Date()): string {
  return new Date(now.getTime() + CRITICAL_FIRST_LOOK_HOURS * 60 * 60 * 1000).toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
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
      <p><strong>Ticket ID:</strong> ${escapeHtml(ticketId)}</p>
      <p><strong>Content Type:</strong> ${escapeHtml(String(report.contentType))}</p>
      <p><strong>Reason:</strong> ${escapeHtml(String(report.reason))}</p>
      <p><strong>Description:</strong> ${report.description ? escapeHtml(report.description) : 'N/A'}</p>
      <p><strong>Urgent Flag:</strong> ${report.isUrgent ? 'Yes' : 'No'}</p>
      ${priority === 'critical' ? `<p><strong>Target:</strong> a person opens this within ${CRITICAL_FIRST_LOOK_HOURS} hours of it being filed (by ${escapeHtml(firstLookBy())}). The reporter has been promised an answer within 24 hours.</p>` : ''}
      <br>
      <p>Please review this report in the moderation dashboard.</p>
    `,
  });
}

/**
 * Escalate to authorities (for CSAM, terrorism)
 *
 * The row this writes is the queue item: nothing is transmitted to the AFP
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
      <p>A report is queued for referral to <strong>${escapeHtml(reportedTo)}</strong>. Nothing has been transmitted to them automatically.</p>
      <p><strong>Ticket ID:</strong> ${escapeHtml(ticketId)}</p>
      <p><strong>Reason:</strong> ${escapeHtml(String(report.reason))}</p>
      <p><strong>Content Type:</strong> ${escapeHtml(String(report.contentType))}</p>
      <p><strong>Content ID:</strong> ${escapeHtml(String(report.contentId))}</p>
      <br>
      ${
        report.reason === 'intimate_image'
          ? `<p>This is an intimate image reported as shared without consent. ATHENA has hidden what it can at once; the steps for the rest, including how the Commissioner is told, what is kept as evidence, and what to do if it sends ATHENA a removal notice, are in the Trust &amp; Safety runbook under intimate images. Record the Commissioner's reference number against this referral on the Authority referrals screen once there is one. Do not open, copy or forward the image itself.</p>`
          : `<p>File the referral, then record the authority's reference number against it on the Authority referrals screen of the admin console, so the referral can be followed to its end. Do not open, copy or forward the reported content.</p>`
      }
    `,
  });
}

/**
 * Before a reported message is deleted, make sure the report holds its words.
 *
 * Reports filed since the intake started copying the message already do, and
 * this does nothing for them. A report filed before that has only a message id,
 * and removing the message would leave a moderator's decision pointing at
 * nothing: the record of what was said, and the thing an appeal is read
 * against, would be the one row the decision itself had just deleted. Those get
 * the copy taken now, while the row is still there. Never throws: the decision
 * is recorded either way, and a copy that could not be taken is logged.
 */
async function keepMessageEvidence(report: ContentReport): Promise<void> {
  if (report.contentType.toLowerCase() !== 'message') return;
  const evidence = evidenceObject(report.evidence);
  if (evidence.messageContext) return;
  try {
    const context = await captureMessageForEvidence(report.contentId);
    if (!context) return;
    await prisma.contentReport.update({
      where: { id: report.id },
      data: { evidence: { ...evidence, messageContext: context } as unknown as Prisma.InputJsonObject },
    });
  } catch (error) {
    logger.error('The reported message could not be copied before removal', {
      reportId: report.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Content moderation action functions.
//
// Every type the report intake accepts has a branch here. It did not: a report
// about a reel comment, a story, a channel message or a group post reached the
// queue, a moderator chose "remove", and the only thing that happened was a
// warning line in the log while the content stayed up. Models that carry an
// isHidden flag are hidden, because hiding can be undone on appeal; the ones
// that do not are deleted, which restoreContent is honest about.
async function removeContent(
  contentType: string,
  contentId: string,
  context?: { moderatorId: string; reason: string }
): Promise<void> {
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
      // deleteMany, not delete: the sender may have unsent it, a disappearing
      // thread may have swept it, or a second moderator may have removed it
      // first, and none of those should turn a decision already recorded into
      // an error. The words are not lost with the row — the report kept its own
      // copy when it was filed (keepMessageEvidence covers the older ones).
      await prisma.message.deleteMany({ where: { id: contentId } });
      break;
    case 'live_message': {
      // A line of live chat. The host may have deleted it already, which is
      // the common case; the report holds the words either way.
      const { removeChatMessageAsStaff } = await import('./livestream.service');
      await removeChatMessageAsStaff(contentId);
      break;
    }
    case 'livestream': {
      // Ends the stream and suspends it, so it cannot be restarted or listed,
      // and tells the room and the host. Reversible on appeal.
      if (!context) {
        logger.warn(`A live stream was ordered removed with no moderator to record: ${contentId}`);
        break;
      }
      const { suspendStream } = await import('./livestream.service');
      try {
        await suspendStream(contentId, context.moderatorId, context.reason);
      } catch (error) {
        // The stream is gone (its host's erasure took it with her): there is
        // nothing left to end, and the decision is already recorded, so a missing
        // row must not turn it into an error, as for a message already unsent.
        if ((error as { statusCode?: number })?.statusCode !== 404) throw error;
        logger.warn(`The live stream ordered removed no longer exists: ${contentId}`);
      }
      break;
    }
    case 'group':
      // Hidden, not deleted: its members and posts stay, and an appeal can
      // bring it back. A hidden group is already what the group routes treat
      // as invisible to everyone but an administrator.
      await prisma.group.updateMany({ where: { id: contentId }, data: { isHidden: true } });
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
    case 'event':
      // Hidden, not deleted: it comes off the list and its page answers 404 to
      // everyone but its host and staff, and an upheld appeal can bring it back.
      // A report of an event could be filed, and decided "remove", and nothing
      // happened to the event, because this switch had no branch for it.
      await prisma.event.updateMany({ where: { id: contentId }, data: { isHidden: true } });
      break;
    case 'housing_listing': {
      // Off the list, and the safety check with it: a listing a moderator took
      // down for a report must not be put back live by its lister with
      // "Checked by ATHENA staff" still on it. And marked as staff's, because a
      // listing's status is a switch its lister can press: an ordinary listing
      // has no check to go back through, so without the mark she could put a
      // listing a moderator had removed straight back on the list.
      const listing = await prisma.housingListing.findUnique({ where: { id: contentId }, select: { features: true } });
      await prisma.housingListing.updateMany({
        where: { id: contentId },
        data: {
          status: 'WITHDRAWN',
          safetyVerified: false,
          ...(listing ? { features: withStaffTakedown(listing.features) } : {}),
        },
      });
      break;
    }
    case 'wellness_post':
      // A mental health forum post. Hidden, not deleted, like every other model that
      // carries a flag: the thread keeps its replies, the author still sees her own
      // post marked as hidden with the reason, and an appeal can bring it back. A
      // report of one, decided "remove", used to log "Unknown content type for
      // removal" and leave the post up.
      await prisma.wellnessPost.updateMany({ where: { id: contentId }, data: { isHidden: true, hiddenReason: 'Removed by a moderator' } });
      break;
    case 'wellness_reply':
      await prisma.wellnessReply.updateMany({ where: { id: contentId }, data: { isHidden: true } });
      break;
    case 'health_review':
      // A review of a practitioner. Hidden, and the practitioner's average and
      // count brought level with what still shows, which is the same pair of
      // writes a moderator's Hide makes on the practitioner's page. A review
      // already gone (the visit it came from was erased) is not an error.
      await setReviewHidden(contentId, true);
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
    case 'group':
      await prisma.group.updateMany({ where: { id: contentId }, data: { isHidden: false } });
      return true;
    case 'wellness_post':
      await prisma.wellnessPost.updateMany({ where: { id: contentId }, data: { isHidden: false, hiddenReason: null } });
      return true;
    case 'wellness_reply':
      await prisma.wellnessReply.updateMany({ where: { id: contentId }, data: { isHidden: false } });
      return true;
    case 'health_review':
      return (await setReviewHidden(contentId, false)) !== null;
    case 'event':
      await prisma.event.updateMany({ where: { id: contentId }, data: { isHidden: false } });
      return true;
    case 'livestream': {
      // The broadcast is over, so what comes back is that the stream is listed
      // and open to view again, and its key may push; the host starts afresh.
      const { liftStreamSuspension } = await import('./livestream.service');
      try {
        await liftStreamSuspension(contentId);
      } catch (error) {
        // Nothing to put back if the stream no longer exists; an appeal upheld
        // against it must still be recorded.
        if ((error as { statusCode?: number })?.statusCode !== 404) throw error;
        return false;
      }
      return true;
    }
    case 'housing_listing': {
      // Not put back automatically: its safety check ended when it came down, so
      // a confidential one returns only through the staff check, which records
      // who looked. What an upheld appeal does undo is the mark that stops its
      // lister putting it back herself, so she can; the answer stays "not
      // restored", because the listing is still off the list until she does.
      const listing = await prisma.housingListing.findUnique({ where: { id: contentId }, select: { features: true } });
      if (listing && takenDownByStaff(listing.features)) {
        await prisma.housingListing.updateMany({ where: { id: contentId }, data: { features: withoutStaffTakedown(listing.features) } });
      }
      return false;
    }
    default:
      logger.warn(`Unknown content type for restore: ${contentType}`);
      return false;
  }
}

/**
 * Puts back what one report hid, when a moderator finds nothing wrong with it.
 *
 * A report of an intimate image, a threat, child abuse material or terrorism
 * hides the content the moment it is filed (moderation-threshold.service), and
 * writes down which report did it. That is only a safe thing to do if the
 * report being wrong costs the author a few hours and not her post, so the
 * dismissal is what undoes it. It puts the content back only when a report
 * about it did hide it at once (three reporters adding up are not undone by
 * one of them being wrong), no other report about the same content is still
 * waiting for a person, and no person has upheld another report about it.
 *
 * That last condition is what keeps a removal a removal. Two women report the
 * same image; a moderator removes it on the second report and dismisses the
 * first, the one that hid it, as a duplicate. Putting the post back because
 * the first report was dismissed would undo the removal the moderator had just
 * made, so any decision against the content (a removal, a warning, a
 * suspension, a ban: everything but a dismissal) leaves it as it is.
 *
 * The hiding report need not be the one dismissed last: if it was dismissed
 * while another was still open, the content stayed down, and it is the last
 * report to be dismissed that finds nothing left to wait for and puts it back.
 * Best effort: the decision is recorded either way, and a moderator can still
 * unhide from the content screen, which is where she is pointed.
 */
async function restoreWhatThisReportHid(report: ContentReport, ticketId: string | null): Promise<void> {
  const type = report.contentType.toLowerCase();
  if (!ticketId || (type !== 'post' && type !== 'comment' && type !== 'video')) return;

  await bestEffort('content-report.restore-after-dismissal', async () => {
    const siblings = await prisma.contentReport.findMany({
      where: { contentType: report.contentType, contentId: report.contentId, id: { not: report.id } },
      select: { status: true, evidence: true },
    });
    if (siblings.some((other) => OPEN_REPORT_STATUSES.includes(other.status))) return;
    if (siblings.some((other) => other.status === 'RESOLVED')) return;

    const tickets = [ticketId];
    for (const other of siblings) {
      const reference = evidenceObject(other.evidence).ticketId;
      if (typeof reference === 'string' && reference) tickets.push(reference);
    }
    const hid = await prisma.moderationLog.findFirst({
      where: { ticketId: { in: tickets }, action: IMMEDIATE_HIDE_ACTION },
      select: { id: true },
    });
    if (!hid) return;

    if (await restoreContent(type, report.contentId)) {
      await prisma.notification.create({
        data: {
          userId: report.reportedUserId,
          type: 'SYSTEM',
          title: 'Your content is back',
          message: `After a review we put your ${REMOVED_THING[type] ?? 'content'} back: it follows our community guidelines.`,
          link: '/dashboard/safety',
          data: { reportId: report.id, contentType: report.contentType, action: 'restored' },
        },
      });
    }
  });
}

/** What the member is told was removed, in the words she would use for it. */
const REMOVED_THING: Record<string, string> = {
  post: 'post',
  comment: 'comment',
  video: 'reel',
  video_comment: 'comment',
  message: 'message',
  live_message: 'chat message',
  channel_message: 'message',
  group: 'group',
  group_post: 'group post',
  status: 'story',
  job: 'job listing',
  event: 'event',
  housing_listing: 'housing listing',
  wellness_post: 'forum post',
  wellness_reply: 'forum reply',
  health_review: 'review of a practitioner',
};

/**
 * Tell the member whose content was removed that it was, and how to appeal.
 *
 * The decision told the reporter and nobody else. The member whose post, reel or
 * listing came down heard nothing, so the appeal the platform offers — which asks
 * for the reference "from your email", an email only the reporter was ever sent —
 * was one she could not know she had cause to make, and could not name. This is
 * the notice: what was removed, that she can appeal, and the reference to quote.
 *
 * What it does not say matters as much. It does not say who reported, or that
 * anyone did; it carries none of the report's text; and it is an in-app notice,
 * not an email, because an email to a shared address can tell the wrong reader
 * what she posted. A live stream is not covered, because ending one already tells
 * its host (livestream.service suspendStream), and a profile is not covered
 * because nothing of it was removed. A notice that cannot be written does not
 * undo a decision already made; it is logged.
 */
async function tellAuthorOfRemoval(report: ContentReport, ticketId: string | null): Promise<void> {
  const thing = REMOVED_THING[report.contentType.toLowerCase()];
  if (!thing) return;

  const reference = ticketId || report.id;
  await bestEffort('content-report.author-removal-notice', () =>
    prisma.notification.create({
      data: {
        userId: report.reportedUserId,
        type: 'SYSTEM',
        title: 'Something you shared was removed',
        message: `After a review we removed your ${thing}, because it did not meet our community guidelines. If you think we got this wrong you can appeal. Your reference is ${reference}.`,
        link: '/help/appeal?type=content_removal',
        data: { reportId: report.id, reference, contentType: report.contentType, action: 'remove' },
      },
    })
  );
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

/**
 * What an enforcement is recorded as having been for.
 *
 * The moderator's notes when she wrote any, because that is the reason an
 * appeal has to answer. Otherwise the report it was decided on, so the account
 * never carries a lock with no explanation at all — which is what isSuspended
 * on its own used to be.
 */
function decisionReason(notes: string | undefined, contentType: string, reason: string | null): string {
  const written = typeof notes === 'string' ? notes.trim() : '';
  if (written) return written.slice(0, 1000);
  return `Decided on a ${contentType.toLowerCase()} report for ${(reason ?? 'other').toLowerCase()}, with no notes`;
}

/**
 * Ends every session of an account that has just been closed, and with them
 * the live connections on those sessions.
 *
 * Closing an account only set a flag. The REST API reads the flag on every
 * request and refuses the account, but the session rows stayed live and a
 * socket authenticates once, at the handshake, so a member who had just been
 * suspended for threatening someone went on holding open connections that kept
 * delivering and accepting direct messages and live chat until they dropped.
 * Revoking the sessions announces it, and the socket service closes every
 * connection that belonged to them.
 *
 * Best effort on purpose: the lock has already been applied and is what
 * refuses her, so a failure here must not make the moderator's decision read as
 * failed, but it is logged under its own label.
 */
async function endSessionsOfClosedAccount(userId: string, reason: 'suspended' | 'banned'): Promise<void> {
  await bestEffort(`end the sessions of an account after ${reason}`, () =>
    sessionService.revokeAllUserSessions(userId, { reason })
  );
}

/**
 * Lock an account, and say why, when and by whom.
 *
 * isSuspended alone recorded that an account was shut and nothing else, so an
 * appeal had nothing to answer and a reviewer could not tell a cooling-off from
 * a lock for threatening a member.
 */
export async function suspendAccount(userId: string, context: { moderatorId: string; reason: string }): Promise<void> {
  logger.info(`Suspending user ${userId}`);

  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspensionReason: context.reason,
      suspendedAt: new Date(),
      suspendedById: context.moderatorId,
    },
  });

  await endSessionsOfClosedAccount(userId, 'suspended');
}

/**
 * Ban an account, and the person behind it.
 *
 * A ban used to be the same lock as a suspension and nothing more: the person
 * banned for threatening a member could register again the same afternoon with
 * the same address. The account is now locked and marked banned, and the
 * address is recorded so that every registration path refuses it.
 *
 * Returns whether the address was recorded. The lock is applied first and is
 * never undone by a failure after it; if the address cannot be recorded — no
 * hash key configured, or the write refused — the ban still stands on the
 * account, the failure is counted where the operations screen shows it, and
 * the moderator is told, rather than the decision reading as complete when the
 * door is still open.
 */
export async function banAccount(
  userId: string,
  context: { moderatorId: string; reason: string; reportId: string | null }
): Promise<boolean> {
  logger.info(`Banning user ${userId}`);

  const now = new Date();
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspensionReason: context.reason,
      suspendedAt: now,
      suspendedById: context.moderatorId,
      bannedAt: now,
      banReason: context.reason,
      bannedById: context.moderatorId,
    },
    select: { email: true },
  });

  // Before the address is recorded: the lock is already on, and nothing that
  // can go wrong writing the ban list should leave her connections open.
  await endSessionsOfClosedAccount(userId, 'banned');

  try {
    await recordBannedIdentity({
      email: user.email,
      userId,
      reportId: context.reportId,
      createdById: context.moderatorId,
      reason: context.reason,
    });
    return true;
  } catch (error) {
    logger.error('A banned account was locked but its address could not be barred from registering again', {
      userId,
      reportId: context.reportId,
      error: error instanceof Error ? error.message : String(error),
    });
    recordFailure('moderation.ban_identity', error);
    return false;
  }
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

  let banIdentityRecorded: boolean | undefined;
  const enforcementReason = decisionReason(notes, contentType, incident.reason);
  switch (action) {
    case 'remove':
      if (contentId) await removeContent(contentType, contentId, { moderatorId, reason: enforcementReason });
      break;
    case 'warn':
      await warnUser(incident.userId, contentType, contentId);
      break;
    case 'suspend':
      await suspendAccount(incident.userId, { moderatorId, reason: enforcementReason });
      break;
    case 'ban':
      // BannedIdentity.reportId names a ContentReport, and an anonymous report
      // is a SafetyIncident, so the incident is carried in the reason instead.
      banIdentityRecorded = await banAccount(incident.userId, {
        moderatorId,
        reason: `${enforcementReason} (anonymous report ${incident.id})`,
        reportId: null,
      });
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
    ...(banIdentityRecorded === undefined ? {} : { banIdentityRecorded }),
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

  const reportsByTicket = await findReportOrigins(rows.map((row) => row.ticketId));
  const now = Date.now();

  return {
    escalations: rows.map((row) => ({
      ...row,
      ageHours: Math.round((now - new Date(row.escalatedAt).getTime()) / (1000 * 60 * 60)),
      report: reportsByTicket.get(row.ticketId) ?? null,
    })),
    summary: { total, reported, acknowledged, resolved },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * The report a referral came from, in one shape whichever door it came through.
 *
 * Only named reports used to be found. A report filed on the public form
 * without an account is a SafetyIncident, not a ContentReport, and its
 * reference sits in the incident's metadata rather than the report's evidence,
 * so a CSAM referral raised from the anonymous form showed no report at all —
 * and the anonymous form is the door a frightened reporter is most likely to
 * use. Both are looked up now, and each says which it is.
 *
 * The reported content itself is never part of this. For child abuse material
 * above all, the referral carries the reference and the authority takes it from
 * there; a console that rendered the material would be the platform
 * redistributing it.
 */
export interface ReferralOrigin {
  /** 'named' is a ContentReport; 'anonymous' was filed on the public form without an account. */
  source: 'named' | 'anonymous';
  id: string;
  status: string;
  action: string | null;
  reviewerId: string | null;
  reportedUserId: string | null;
  description: string | null;
  createdAt: Date;
}

/**
 * The ticket reference lives inside JSON rather than a column on both tables,
 * so the whole page is looked up in one OR'd query per table instead of one
 * query per escalation.
 */
async function findReportOrigins(ticketIds: string[]): Promise<Map<string, ReferralOrigin>> {
  const unique = Array.from(new Set(ticketIds.filter(Boolean)));
  const byTicket = new Map<string, ReferralOrigin>();
  if (unique.length === 0) return byTicket;

  const [named, anonymous] = await Promise.all([
    prisma.contentReport.findMany({
      where: {
        OR: unique.map((ticketId) => ({
          evidence: { path: ['ticketId'], equals: ticketId },
        })),
      },
    }),
    prisma.safetyIncident.findMany({
      where: {
        ...ANONYMOUS_REPORT_WHERE,
        OR: unique.map((ticketId) => ({
          metadata: { path: ['ticketId'], equals: ticketId },
        })),
      },
    }),
  ]);

  for (const report of named) {
    const ticketId = (report.evidence as { ticketId?: string } | null)?.ticketId;
    if (!ticketId) continue;
    byTicket.set(ticketId, {
      source: 'named',
      id: report.id,
      status: report.status,
      action: report.action,
      reviewerId: report.reviewerId,
      reportedUserId: report.reportedUserId,
      description: report.description,
      createdAt: report.createdAt,
    });
  }

  for (const incident of anonymous) {
    const ticketId = metadataString(incidentMetadata(incident.metadata), 'ticketId');
    if (!ticketId || byTicket.has(ticketId)) continue;
    const view = toAnonymousReportView(incident, null);
    byTicket.set(ticketId, {
      source: 'anonymous',
      id: view.id,
      status: view.status,
      action: view.action,
      reviewerId: view.reviewerId,
      reportedUserId: incident.userId,
      description: view.description,
      createdAt: view.createdAt,
    });
  }

  return byTicket;
}

/**
 * The names staff will recognise, for ids written into logs.
 *
 * A referral's history is who filed it, who recorded the authority's
 * reference and who closed it. As bare ids the record answered none of those
 * for the person reading it.
 */
async function staffNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id) => id && id !== 'system')));
  if (unique.length === 0) return new Map();

  const people = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
  });

  return new Map(
    people.map((person) => [
      person.id,
      person.displayName?.trim() ||
        [person.firstName, person.lastName].filter(Boolean).join(' ').trim() ||
        person.email,
    ])
  );
}

export async function getAuthorityEscalation(id: string) {
  const escalation = await prisma.authorityEscalation.findUnique({ where: { id } });
  if (!escalation) return null;

  const [reportsByTicket, history] = await Promise.all([
    findReportOrigins([escalation.ticketId]),
    prisma.moderationLog.findMany({
      where: { ticketId: escalation.ticketId },
      orderBy: { timestamp: 'asc' },
    }),
  ]);
  const names = await staffNames(history.map((entry) => entry.moderatorId));

  return {
    ...escalation,
    report: reportsByTicket.get(escalation.ticketId) ?? null,
    history: history.map((entry) => ({
      ...entry,
      moderatorName: entry.moderatorId === 'system' ? 'ATHENA' : names.get(entry.moderatorId) ?? null,
    })),
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
  // Any open report another door filed without a deadline gets one first, so
  // the sweep below can ask the column alone. A failure here is counted and the
  // sweep still runs: the unstamped rows are caught by the null branch below.
  try {
    await stampMissingReviewClocks();
  } catch (error) {
    logger.error('Open reports could not be given a review deadline before the overdue sweep', {
      error: error instanceof Error ? error.message : String(error),
    });
    recordFailure('content-report.stamp-review-clock', error);
  }

  const [namedLate, namedUnstamped, namedLateTotal, anonymous, criticalUnopened] = await Promise.all([
    prisma.contentReport.findMany({
      where: { status: { in: OPEN_REPORT_STATUSES }, reviewDeadline: { lt: now } },
      select: { id: true, createdAt: true, reason: true, reviewDeadline: true, evidence: true },
      orderBy: { reviewDeadline: 'asc' },
      take: DEADLINE_SORT_WINDOW,
    }),
    prisma.contentReport.findMany({
      where: { status: { in: OPEN_REPORT_STATUSES }, reviewDeadline: null },
      select: { id: true, createdAt: true, reason: true, reviewDeadline: true, evidence: true },
      orderBy: { createdAt: 'asc' },
      take: DEADLINE_SORT_WINDOW,
    }),
    prisma.contentReport.count({
      where: { status: { in: OPEN_REPORT_STATUSES }, reviewDeadline: { lt: now } },
    }),
    prisma.safetyIncident.findMany({
      where: { ...ANONYMOUS_REPORT_WHERE, resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      take: DEADLINE_SORT_WINDOW,
    }),
    // Critical reports nobody has opened yet, past ATHENA's own first-look
    // target but still inside the 24 hours the reporter was given: the
    // deadline column would not call them late for another twenty hours.
    //
    // "Nobody has opened it" is that no person has taken it (reviewerId is set
    // by a moderator claiming or deciding it), not that its status is still
    // PENDING. The report that hides a post, comment or reel at once also moves
    // every pending report on it to REVIEWING (moderation-threshold.service),
    // with no moderator behind that, so keying on PENDING would have left out
    // exactly the intimate-image and threat reports that were hidden on the
    // spot, which are the ones this target is for.
    prisma.contentReport.findMany({
      where: {
        status: { in: OPEN_REPORT_STATUSES },
        reviewerId: null,
        priority: 'URGENT',
        createdAt: { lt: new Date(now.getTime() - CRITICAL_FIRST_LOOK_HOURS * 60 * 60 * 1000) },
        reviewDeadline: { gte: now },
      },
      select: { id: true, createdAt: true, reason: true, reviewDeadline: true, evidence: true },
      orderBy: { createdAt: 'asc' },
      take: DEADLINE_SORT_WINDOW,
    }),
  ]);

  const late: Array<{ reference: string; reason: string; due: Date; anonymous: boolean; firstLook?: true }> = [];
  for (const report of criticalUnopened ?? []) {
    const ticketId = evidenceObject(report.evidence).ticketId;
    late.push({
      reference: typeof ticketId === 'string' ? ticketId : report.id,
      reason: report.reason,
      due: new Date(report.createdAt.getTime() + CRITICAL_FIRST_LOOK_HOURS * 60 * 60 * 1000),
      anonymous: false,
      firstLook: true,
    });
  }
  // Overdue named reports beyond the window are still counted, though only the
  // oldest are listed: an alert that under-reported the backlog would be worse
  // than no alert.
  const uncountedNamed = Math.max(0, namedLateTotal - namedLate.length);
  for (const report of [...namedLate, ...namedUnstamped]) {
    const due = namedReportDeadline(report);
    if (due.getTime() < now.getTime()) {
      const ticketId = evidenceObject(report.evidence).ticketId;
      late.push({
        reference: typeof ticketId === 'string' ? ticketId : report.id,
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

  const overdue = late.length + uncountedNamed;
  if (overdue === 0) return { overdue: 0, alerted: false };

  late.sort((a, b) => a.due.getTime() - b.due.getTime());
  const hoursLate = (due: Date) => Math.max(1, Math.round((now.getTime() - due.getTime()) / (60 * 60 * 1000)));
  const oldest = late.slice(0, 10);

  const to = trustAndSafetyMailbox();
  let alerted = false;
  if (!to) {
    reportAlertUndeliverable('overdue-reports', `${overdue} overdue`);
  } else {
    try {
      await sendEmail({
        to,
        subject: `[OVERDUE] ${overdue} report${overdue === 1 ? '' : 's'} past the review deadline`,
        html: `
          <h2>${overdue} report${overdue === 1 ? ' is' : 's are'} past the review deadline</h2>
          <p>Reporters were told 24 hours for illegal content and 48 hours for everything else. A critical report is also listed here once it has sat unopened for ${CRITICAL_FIRST_LOOK_HOURS} hours, which is ATHENA's own target. The oldest:</p>
          <ul>
            ${oldest
              .map(
                (item) =>
                  `<li>${escapeHtml(item.reference)} — ${escapeHtml(String(item.reason))}${item.anonymous ? ' (filed without an account)' : ''}${item.firstLook ? ' (critical, not yet opened)' : ''} — ${hoursLate(item.due)} hours late</li>`
              )
              .join('')}
          </ul>
          <p>Work them from the report queue in the admin console, soonest due first.</p>
        `,
      });
      alerted = true;
    } catch (error) {
      logger.error('Overdue-report alert could not be sent', {
        overdue,
        error: error instanceof Error ? error.message : String(error),
      });
      recordFailure('content-report.overdue-alert', error);
    }
  }

  await notifyAdmins({
    title: `${overdue} report${overdue === 1 ? '' : 's'} past the review deadline`,
    message: `The oldest is ${hoursLate(oldest[0].due)} hours late.`,
    link: '/admin/moderation',
    data: { overdue },
  });

  return { overdue, alerted };
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
  // Image-based abuse and a threat to hurt someone are offences, so they count
  // as illegal content in the published categories, which are fixed.
  intimate_image: 'illegal',
  threat: 'illegal',
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
