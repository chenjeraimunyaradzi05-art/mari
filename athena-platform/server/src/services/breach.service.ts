/**
 * Breach Notification Service
 *
 * Two regimes, because ATHENA is an Australian company that also holds data on
 * UK and EU members, and they do not agree on anything that matters here.
 *
 * Australia's Notifiable Data Breaches scheme (Privacy Act 1988, Part IIIC) is
 * the home regime and the default for every incident. A suspicion of an
 * eligible data breach starts a 30-day window to complete a reasonable
 * assessment; the window opens at intake, from the moment of awareness. The
 * threshold is that serious harm is likely, remedial action that prevents that
 * harm removes the obligation to notify at all, and the regulator is the OAIC,
 * which takes a four-part statement (s 26WK) rather than a free-text
 * notification.
 *
 * GDPR Articles 33 and 34 apply to breaches that touch UK or EU members:
 * notify the supervisory authority within 72 hours of becoming aware, unless
 * the breach is unlikely to result in a risk.
 *
 * The 72-hour clock does not apply to the Australian path and must not be
 * shown against it. Everything that measures the clock asks
 * seventyTwoHourClockApplies() first, and the NDB helpers are separate.
 */

import { BreachSeverity, BreachStatus, DataCategory, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { sendEmail } from './email.service';
import { sendNotification as sendInAppNotification } from './socket.service';

/** Which regime a breach is handled under. A breach can touch more than one. */
export type BreachJurisdiction = 'AU' | 'UK' | 'EU';

export const BREACH_JURISDICTIONS: readonly BreachJurisdiction[] = ['AU', 'UK', 'EU'];

export const isBreachJurisdiction = (value: unknown): value is BreachJurisdiction =>
  BREACH_JURISDICTIONS.includes(value as BreachJurisdiction);

interface BreachReport {
  title: string;
  description: string;
  detectedBy: string;
  severity: BreachSeverity;
  dataCategories: DataCategory[];
  affectedRecords?: number;
  affectedUsers?: number;
  occurredAt?: Date;
  /** Defaults to ['AU']: the entity is Australian, so the NDB scheme always applies unless told otherwise. */
  jurisdictions?: BreachJurisdiction[];
}

/**
 * The four parts of an eligible data breach statement, Privacy Act 1988
 * s 26WK(3): the entity's identity and contact details, a description of the
 * breach, the kinds of information concerned, and recommendations about the
 * steps individuals should take.
 */
export interface NdbStatement {
  entityContact: string;
  description: string;
  informationKinds: string[];
  recommendedSteps: string;
}

interface RegulatoryNotification {
  breachId: string;
  regulatorName: string;
  regulatorEmail: string;
  /** Which regime this notification discharges. Defaults to the breach's first recorded regime. */
  jurisdiction?: BreachJurisdiction;
  /** The free-text notification for the UK/EU (Article 33) path. */
  notificationContent?: string;
  /** The four-part statement for the Australian path. */
  statement?: NdbStatement;
}

type JurisdictionFields = {
  jurisdiction?: string | null;
  jurisdictions?: string[] | null;
};

const unique = (values: BreachJurisdiction[]): BreachJurisdiction[] => Array.from(new Set(values));

/**
 * The regimes a breach is handled under. Rows recorded before the list column
 * existed carry a single `jurisdiction`, which is read when the list is empty.
 */
export function jurisdictionsOf(breach: JurisdictionFields): BreachJurisdiction[] {
  if (breach.jurisdictions && breach.jurisdictions.length > 0) {
    return breach.jurisdictions.filter(isBreachJurisdiction);
  }
  return isBreachJurisdiction(breach.jurisdiction) ? [breach.jurisdiction] : [];
}

/** True when the Notifiable Data Breaches scheme applies to this breach. */
export const ndbApplies = (breach: JurisdictionFields): boolean =>
  jurisdictionsOf(breach).includes('AU');

/**
 * True unless the breach is handled under Australian law alone. A row with no
 * regime recorded at all predates the list and keeps the clock, so nothing that
 * was being watched goes quiet because a column was added.
 */
export function seventyTwoHourClockApplies(breach: JurisdictionFields): boolean {
  const regimes = jurisdictionsOf(breach);
  return regimes.length === 0 || regimes.some((regime) => regime !== 'AU');
}

/**
 * The same rule as seventyTwoHourClockApplies(), as a where clause, so the
 * 72-hour monitor never loads Australian-only rows only to drop them.
 */
const SEVENTY_TWO_HOUR_CLOCK_WHERE: Prisma.DataBreachWhereInput = {
  OR: [
    { jurisdictions: { hasSome: ['UK', 'EU'] } },
    {
      jurisdictions: { isEmpty: true },
      // Prisma's `not` excludes nulls, so the legacy null case is spelled out.
      OR: [{ jurisdiction: null }, { jurisdiction: { not: 'AU' } }],
    },
  ],
};

/** Rows the NDB scheme applies to, including legacy rows that only set the old column. */
const NDB_WHERE: Prisma.DataBreachWhereInput = {
  OR: [{ jurisdictions: { has: 'AU' } }, { jurisdiction: 'AU' }],
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const paragraphs = (value: string): string =>
  value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

/**
 * The page a breach notification points a member at.
 *
 * This read process.env.APP_URL, which is the API host in .env.example and is
 * commented out there, so the one link in a breach email either pointed at the
 * API or, far more likely, rendered as "undefined/help/security". Members are
 * being told their data was exposed; the link they are given to find out more
 * has to work. CLIENT_URL is the web app, and it is what every other member
 * email on this server already uses.
 *
 * The path was /help/security, which the web app has never had a page at, so
 * the link still led nowhere. The security settings are where she can change
 * her password and sign other devices out, which is what the notice asks of
 * her; signed out, she is sent to sign in and brought back.
 */
function securitySupportUrl(): string {
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  return `${base}/dashboard/settings/security`;
}

// ===========================================
// Telling the people affected, safely
// ===========================================

/**
 * What a breach notice does for members whose safety depends on it not being
 * seen. All of it is off by default: the default for these members is the app
 * only, no email.
 */
export interface SafetyNoticeOptions {
  /** Email these members as well as telling them in the app. Needs counselConsulted and neutralSubject. */
  emailSafetyMembers?: boolean;
  /** Privacy counsel has approved the wording and sending email to members who use Safe Mode. */
  counselConsulted?: boolean;
  /** The subject counsel approved for that email. It must not say what the notice is about. */
  neutralSubject?: string;
  /** What these members read, when it should differ from the general notice. Used for the app notice and any email. */
  safetyNotificationContent?: string;
}

export interface NoticeAudienceCounts {
  requested: number;
  /** The ids that matched an account. */
  found: number;
  /** Members who will be told in the app and not emailed. */
  safetyMembers: number;
  /** Members who will be emailed. */
  ordinaryMembers: number;
}

export interface NoticeOutcome {
  requested: number;
  found: number;
  /** Emails that were accepted for delivery. */
  emailed: number;
  /** Members told in the app. */
  inApp: number;
  safetyMembers: number;
  /** Safety-group members who were told in the app and not emailed. */
  safetyMembersInAppOnly: number;
  /** What the breach record now says: EMAIL, IN_APP or EMAIL+IN_APP. */
  method: 'EMAIL' | 'IN_APP' | 'EMAIL+IN_APP' | null;
  /** Members no notice reached, by id, so the send can be repeated for them alone. */
  failedUserIds: string[];
}

const NOTICE_BATCH_SIZE = 100;
const NEUTRAL_NOTICE_TITLE = 'Account security update';

/**
 * What counts as a safety report. A member who has made one has told us about
 * someone who may be a danger to her, which is what makes an email that names
 * a breach worth holding back. Anonymous reports have no reporter to find.
 *
 * The reasons are the ones content-report.service accepts that are about a
 * person or a harm rather than about spam, fraud or misinformation, in both
 * vocabularies it lists (the public form says hate_speech, the in-app dialog
 * says hate and violence). The two doors also spell them differently: the in-app
 * route (POST /api/safety/reports) stores them in lower case and the public form
 * (POST /api/compliance/reports) in upper case, and a text column matches case
 * for case. Matching only the upper-case spelling missed every member who
 * reported from inside the app, which is the member most likely to be emailed.
 */
const SAFETY_REPORT_REASONS = [
  'harassment',
  'hate_speech',
  'hate',
  'harmful',
  'self_harm',
  'illegal',
  'violence',
  'sexual',
  'impersonation',
  'unsafe',
  'csam',
  'terrorism',
  // The two a woman is most likely to be filing about herself or about someone
  // she is afraid of: an intimate image shared without her consent, and a
  // threat to hurt someone. She has told us about a person who may be a danger
  // to her, which is what this list is for, and she is the member least able to
  // have an email about her data land in an inbox he can read.
  'intimate_image',
  'threat',
].flatMap((reason) => [reason, reason.toUpperCase()]);

/**
 * Whether a DV page row shows that she has set anything protective up. A field
 * the query did not return reads as "not set": only a switch that is plainly on
 * (or a messages switch plainly off) counts.
 */
function usesDvProtections(
  profile:
    | {
        isSafeMode?: boolean | null;
        notificationsSafe?: boolean | null;
        hideFromSearch?: boolean | null;
        allowMessages?: boolean | null;
        safeExitEnabled?: boolean | null;
        panicButtonEnabled?: boolean | null;
        blockedUserIds?: string[] | null;
        emergencyContacts?: unknown;
      }
    | null
    | undefined
): boolean {
  if (!profile) return false;
  return Boolean(
    profile.isSafeMode ||
      profile.notificationsSafe ||
      profile.hideFromSearch ||
      profile.allowMessages === false ||
      profile.safeExitEnabled ||
      profile.panicButtonEnabled ||
      (Array.isArray(profile.blockedUserIds) && profile.blockedUserIds.length > 0) ||
      (Array.isArray(profile.emergencyContacts) && profile.emergencyContacts.length > 0)
  );
}

/** Wording that would tell a reader why the member is being contacted. */
const REVEALING_WORDING = /\b(domestic|violence|abus\w*|safe\s*mode|safety\s+(report|plan)|panic|refuge|stalk\w*|coercive)\b/i;

/**
 * Who is who, from one look at the database. A member is in the safety group
 * when she is in Safe Mode (from the Safety Centre or the DV page), has asked
 * for private notifications, has set up any of the DV page's protections (a
 * closed inbox, hidden from search, the quick exit or the safety alert, a block
 * she made there, an emergency contact), or has filed a safety report.
 *
 * The DV page's own row used to be enough on its own, because its private
 * notifications column defaulted to on. It now defaults to off, so that a row
 * made by simply opening a page no longer silences every notification on the
 * platform; a woman who has deliberately set the page up, without turning on
 * either of those two switches, is therefore recognised by what she set.
 *
 * If this throws, nothing has been sent and the caller must not send: with no
 * answer to "who is safe to email", the only safe answer is none of them.
 */
async function resolveNoticeAudience(userIds: string[]): Promise<{
  members: Array<{ id: string; email: string; firstName: string }>;
  safetyMemberIds: Set<string>;
}> {
  const [users, reporters, incidentReporters] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        dvSafetyProfile: {
          select: {
            isSafeMode: true,
            notificationsSafe: true,
            // What the DV page holds beyond those two switches.
            hideFromSearch: true,
            allowMessages: true,
            safeExitEnabled: true,
            panicButtonEnabled: true,
            blockedUserIds: true,
            emergencyContacts: true,
          },
        },
        // The Safety Centre's own Safe Mode switch, which is not on the DV profile at all.
        profile: { select: { isSafeMode: true } },
      },
    }),
    prisma.contentReport.findMany({
      where: { reporterId: { in: userIds }, reason: { in: SAFETY_REPORT_REASONS } },
      select: { reporterId: true },
      distinct: ['reporterId'],
    }),
    // The incident a signed-in report also records against the member it is
    // about (safety-score.service handleUserReport) carries the reporter and is
    // typed REPORT. USER_REPORT is the anonymous kind, which has no reporter.
    prisma.safetyIncident.findMany({
      where: { reporterId: { in: userIds }, type: 'REPORT', reason: { in: SAFETY_REPORT_REASONS } },
      select: { reporterId: true },
      distinct: ['reporterId'],
    }),
  ]);

  const safetyMemberIds = new Set<string>();
  for (const user of users) {
    if (usesDvProtections(user.dvSafetyProfile) || user.profile?.isSafeMode) safetyMemberIds.add(user.id);
  }
  for (const row of reporters) safetyMemberIds.add(row.reporterId);
  for (const row of incidentReporters) if (row.reporterId) safetyMemberIds.add(row.reporterId);

  return {
    members: users.map(({ id, email, firstName }) => ({ id, email, firstName })),
    safetyMemberIds,
  };
}

/**
 * The rule that keeps an email from reaching a member who may share an inbox:
 * it needs counsel's sign-off, said out loud, and a subject that gives nothing
 * away. Refused here, in the service, so no caller can skip it.
 */
function assertSafetyEmailAllowed(options: SafetyNoticeOptions): void {
  if (!options.emailSafetyMembers) return;

  if (options.counselConsulted !== true) {
    throw new ApiError(
      400,
      'Members who use Safe Mode or have filed a safety report are told in the app, not by email, because an email can be read by the person they are protecting themselves from. Emailing them needs privacy counsel to have approved the wording and the send first: confirm counselConsulted.'
    );
  }

  const subject = options.neutralSubject?.trim();
  if (!subject) {
    throw new ApiError(400, 'Give the neutral subject counsel approved for the email to these members, for example "Account security update".');
  }
  if (subject.length > 120) {
    throw new ApiError(400, 'The subject for these members must be 120 characters or fewer.');
  }
  if (REVEALING_WORDING.test(subject) || /breach|exposed|leak|hack/i.test(subject)) {
    throw new ApiError(
      400,
      'The subject of an email to these members must not say what it is about: anyone who can see their inbox can read it. Use a neutral subject such as "Account security update".'
    );
  }
}

function noticeMethod(emailed: boolean, inApp: boolean): NoticeOutcome['method'] {
  if (emailed && inApp) return 'EMAIL+IN_APP';
  if (emailed) return 'EMAIL';
  if (inApp) return 'IN_APP';
  return null;
}

export class BreachNotificationService {
  // 72-hour deadline in milliseconds
  private readonly NOTIFICATION_DEADLINE_MS = 72 * 60 * 60 * 1000;

  /**
   * The NDB scheme allows 30 days to complete a reasonable assessment of a
   * suspected eligible data breach. It is an outer limit, not a target: the
   * scheme says an assessment must be reasonable and expeditious.
   */
  private readonly NDB_ASSESSMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

  /** When the NDB assessment falls due, counted from awareness. */
  ndbAssessmentDueFrom(awareOf: Date): Date {
    return new Date(awareOf.getTime() + this.NDB_ASSESSMENT_WINDOW_MS);
  }

  /**
   * Report a new data breach.
   *
   * The regimes decide which clock starts. Under the NDB scheme the duty is
   * triggered by suspicion and the thirty days run from awareness, so the
   * assessment window opens here, at intake, rather than when somebody later
   * finds a button. Under the GDPR the severity heuristic decides whether the
   * 72-hour clock is live.
   */
  async reportBreach(report: BreachReport): Promise<any> {
    const jurisdictions = unique(
      report.jurisdictions && report.jurisdictions.length > 0 ? report.jurisdictions : ['AU']
    );
    const underNdb = jurisdictions.includes('AU');
    const underGdpr = jurisdictions.some((regime) => regime !== 'AU');
    const detectedAt = new Date();

    const breach = await prisma.dataBreach.create({
      data: {
        title: report.title,
        description: report.description,
        detectedAt,
        detectedBy: report.detectedBy,
        severity: report.severity,
        status: BreachStatus.DETECTED,
        dataCategories: report.dataCategories,
        affectedRecords: report.affectedRecords,
        affectedUsers: report.affectedUsers,
        occurredAt: report.occurredAt,
        riskToIndividuals: this.assessRiskToIndividuals(report),
        jurisdictions,
        jurisdiction: jurisdictions[0],
        ...(underNdb
          ? { assessmentDueAt: this.ndbAssessmentDueFrom(detectedAt), assessmentComplete: false }
          : {}),
        // The severity heuristic is Article 33's "unlikely to result in a
        // risk" test. Under the NDB scheme nothing is notifiable until the
        // assessment says so, so an Australian-only breach starts at false and
        // completeNdbAssessment() is what turns it on.
        notificationRequired: underGdpr ? this.isNotificationRequired(report) : false,
      },
    });

    // Alert incident response team immediately
    await this.alertIncidentTeam(breach);

    // Log the breach report
    await prisma.privacyAuditLog.create({
      data: {
        action: 'BREACH_REPORTED',
        resourceType: 'DataBreach',
        resourceId: breach.id,
        details: {
          severity: report.severity,
          dataCategories: report.dataCategories,
          jurisdictions,
          notificationRequired: breach.notificationRequired,
          assessmentDueAt: breach.assessmentDueAt,
        },
      },
    });

    if (underNdb) {
      await prisma.privacyAuditLog.create({
        data: {
          action: 'NDB_ASSESSMENT_STARTED',
          resourceType: 'DataBreach',
          resourceId: breach.id,
          details: { assessmentDueAt: breach.assessmentDueAt, startedAtIntake: true },
        },
      });
    }

    return breach;
  }

  /**
   * Start the Australian assessment clock on a breach.
   *
   * Intake already does this for any breach recorded as Australian. This is
   * for the other cases: a breach recorded under the GDPR alone that turns out
   * to touch Australian members, or a row from before intake opened the window.
   * Australia is added to the regimes rather than replacing them.
   */
  async beginNdbAssessment(breachId: string, awareOf = new Date()): Promise<any> {
    const existing = await prisma.dataBreach.findUnique({ where: { id: breachId } });
    if (!existing) {
      throw new Error('Breach not found');
    }

    const jurisdictions = unique([...jurisdictionsOf(existing), 'AU']);

    const breach = await prisma.dataBreach.update({
      where: { id: breachId },
      data: {
        jurisdictions,
        jurisdiction: jurisdictions[0],
        assessmentDueAt: this.ndbAssessmentDueFrom(awareOf),
        assessmentComplete: false,
      },
    });

    await prisma.privacyAuditLog.create({
      data: {
        action: 'NDB_ASSESSMENT_STARTED',
        resourceType: 'DataBreach',
        resourceId: breachId,
        details: { assessmentDueAt: breach.assessmentDueAt },
      },
    });

    return breach;
  }

  /**
   * Record the outcome of an NDB assessment.
   *
   * Two things decide whether anyone has to be told: whether serious harm is
   * likely, and whether remedial action prevented it. Remedial action that
   * works removes the obligation entirely, which is why it is recorded
   * separately rather than folded into the harm judgement.
   */
  async completeNdbAssessment(
    breachId: string,
    outcome: { seriousHarmLikely: boolean; remediedBeforeHarm?: boolean; reasoning: string }
  ): Promise<any> {
    const existing = await prisma.dataBreach.findUnique({ where: { id: breachId } });
    if (!existing) {
      throw new Error('Breach not found');
    }

    const notifiable = outcome.seriousHarmLikely && !outcome.remediedBeforeHarm;
    const jurisdictions = unique([...jurisdictionsOf(existing), 'AU']);

    // A breach that also touches UK or EU members keeps whatever the GDPR
    // heuristic decided: the NDB outcome cannot switch off an Article 33 duty.
    const stillUnderGdpr = jurisdictions.some((regime) => regime !== 'AU');
    const notificationRequired =
      notifiable || (stillUnderGdpr && existing.notificationRequired === true);

    const breach = await prisma.dataBreach.update({
      where: { id: breachId },
      data: {
        jurisdictions,
        jurisdiction: jurisdictions[0],
        assessmentComplete: true,
        seriousHarmLikely: outcome.seriousHarmLikely,
        remediedBeforeHarm: outcome.remediedBeforeHarm ?? false,
        notificationRequired,
        likelyConsequences: outcome.reasoning,
      },
    });

    await prisma.privacyAuditLog.create({
      data: {
        action: 'NDB_ASSESSMENT_COMPLETED',
        resourceType: 'DataBreach',
        resourceId: breachId,
        details: {
          seriousHarmLikely: outcome.seriousHarmLikely,
          remediedBeforeHarm: outcome.remediedBeforeHarm ?? false,
          notifiableUnderNdb: notifiable,
          notificationRequired,
        },
      },
    });

    return breach;
  }

  /**
   * Suspected eligible breaches whose 30-day assessment window is running out.
   *
   * Overdue is reported rather than hidden: the scheme expects the assessment
   * to be finished, and an unfinished one is the thing somebody has to act on.
   */
  async getNdbAssessmentsDue(withinDays = 7, now = new Date()): Promise<any[]> {
    return prisma.dataBreach.findMany({
      where: {
        ...NDB_WHERE,
        assessmentComplete: false,
        assessmentDueAt: { lte: new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000) },
      },
      orderBy: { assessmentDueAt: 'asc' },
    });
  }

  /**
   * Assess risk to individuals based on breach characteristics
   */
  private assessRiskToIndividuals(report: BreachReport): string {
    const highRiskCategories: DataCategory[] = [
      DataCategory.SENSITIVE,
      DataCategory.FINANCIAL,
      DataCategory.BIOMETRIC,
    ];

    const hasHighRiskData = report.dataCategories.some(cat =>
      highRiskCategories.includes(cat)
    );

    if (report.severity === BreachSeverity.CRITICAL || hasHighRiskData) {
      return 'HIGH: Breach involves sensitive personal data that could result in significant harm including identity theft, financial loss, or discrimination.';
    }

    if (report.severity === BreachSeverity.HIGH) {
      return 'MEDIUM: Breach involves personal data that could result in harm to individuals including unwanted contact or reputational damage.';
    }

    if (report.severity === BreachSeverity.MEDIUM) {
      return 'LOW-MEDIUM: Breach involves limited personal data with moderate potential for harm.';
    }

    return 'LOW: Breach involves minimal personal data with low potential for harm to individuals.';
  }

  /**
   * Determine if regulatory notification is required under the GDPR.
   *
   * This is Article 33's test and nothing else: it is only consulted for
   * breaches that touch UK or EU members. The Australian answer comes from the
   * NDB assessment, never from severity.
   */
  private isNotificationRequired(report: BreachReport): boolean {
    // Under GDPR, notification is required unless breach is unlikely to result in risk
    if (report.severity === BreachSeverity.LOW) {
      return false;
    }

    // Always notify for high/critical severity
    if (
      report.severity === BreachSeverity.HIGH ||
      report.severity === BreachSeverity.CRITICAL
    ) {
      return true;
    }

    // Notify if sensitive data involved
    const sensitiveCategories: DataCategory[] = [
      DataCategory.SENSITIVE,
      DataCategory.FINANCIAL,
      DataCategory.BIOMETRIC,
    ];

    return report.dataCategories.some(cat => sensitiveCategories.includes(cat));
  }

  /**
   * The clocks that actually apply to a breach, one line each, for the
   * incident team. An Australian-only breach never sees a 72-hour line: an
   * operator who reads one will either panic-notify the OAIC before the
   * assessment the scheme requires, or learn to ignore the alert.
   */
  applicableClocks(breach: {
    detectedAt: Date;
    jurisdiction?: string | null;
    jurisdictions?: string[] | null;
    assessmentDueAt?: Date | null;
  }): string[] {
    const clocks: string[] = [];

    if (ndbApplies(breach)) {
      const dueAt = breach.assessmentDueAt ?? this.ndbAssessmentDueFrom(breach.detectedAt);
      clocks.push(
        `30-day NDB assessment due ${dueAt.toISOString()} (Privacy Act 1988 Part IIIC). ` +
          'Notify the OAIC only if the assessment finds serious harm likely and not remedied.'
      );
    }

    if (seventyTwoHourClockApplies(breach)) {
      const deadline = new Date(breach.detectedAt.getTime() + this.NOTIFICATION_DEADLINE_MS);
      clocks.push(
        `72-hour regulator notification due ${deadline.toISOString()} (GDPR Article 33, UK/EU members).`
      );
    }

    return clocks;
  }

  /**
   * Alert incident response team
   */
  private async alertIncidentTeam(breach: any): Promise<void> {
    const incidentTeamEmails = process.env.INCIDENT_TEAM_EMAILS?.split(',') || [];
    if (incidentTeamEmails.length === 0) return;

    const clocks = this.applicableClocks(breach);
    const clockList = clocks.map((clock) => `<li>${clock}</li>`).join('');

    for (const email of incidentTeamEmails) {
      await sendEmail({
        to: email.trim(),
        subject: `[URGENT] Data Breach Detected - ${breach.severity} Severity`,
        html: `
          <h1>Data Breach Alert</h1>
          <p><strong>Breach ID:</strong> ${breach.id}</p>
          <p><strong>Title:</strong> ${escapeHtml(String(breach.title))}</p>
          <p><strong>Severity:</strong> ${breach.severity}</p>
          <p><strong>Detected At:</strong> ${breach.detectedAt.toISOString()}</p>
          <p><strong>Regimes:</strong> ${jurisdictionsOf(breach).join(', ') || 'not recorded'}</p>
          <p><strong>Applicable clock:</strong></p>
          <ul>${clockList}</ul>
          <p><strong>Description:</strong> ${escapeHtml(String(breach.description ?? '')).replace(/\n/g, '<br>')}</p>
          <p>Please take immediate action.</p>
        `,
      });
    }
  }

  /**
   * Update breach status and containment actions
   */
  async updateBreachStatus(
    breachId: string,
    updates: {
      status?: BreachStatus;
      containmentActions?: string[];
      remediationActions?: string[];
      rootCause?: string;
    }
  ): Promise<any> {
    const updateData: any = { ...updates };

    if (updates.status === BreachStatus.CONTAINED) {
      updateData.containedAt = new Date();
    }

    if (updates.status === BreachStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    const breach = await prisma.dataBreach.update({
      where: { id: breachId },
      data: updateData,
    });

    await prisma.privacyAuditLog.create({
      data: {
        action: 'BREACH_STATUS_UPDATED',
        resourceType: 'DataBreach',
        resourceId: breachId,
        details: updates,
      },
    });

    return breach;
  }

  /**
   * Why an Australian breach cannot be notified to the OAIC yet, or null when
   * it can. Exposed so the route can answer with the right status before the
   * service refuses.
   */
  ndbNotificationBlocker(breach: {
    assessmentComplete: boolean;
    seriousHarmLikely: boolean | null;
    remediedBeforeHarm: boolean;
  }): string | null {
    if (!breach.assessmentComplete) {
      return 'The NDB assessment has not been completed. An unassessed breach cannot be notified to the OAIC; record the assessment first.';
    }
    if (!breach.seriousHarmLikely) {
      return 'The assessment found serious harm is not likely, so this is not an eligible data breach and there is nothing to notify the OAIC of.';
    }
    if (breach.remediedBeforeHarm) {
      return 'The assessment found remedial action prevented the harm, which removes the obligation to notify the OAIC.';
    }
    return null;
  }

  /** The statement with each part trimmed, or the name of the first part that is missing. */
  validateNdbStatement(
    statement: Partial<NdbStatement> | undefined
  ): { statement: NdbStatement } | { missing: keyof NdbStatement } {
    const entityContact = statement?.entityContact?.trim() ?? '';
    if (!entityContact) return { missing: 'entityContact' };

    const description = statement?.description?.trim() ?? '';
    if (!description) return { missing: 'description' };

    const informationKinds = (Array.isArray(statement?.informationKinds) ? statement.informationKinds : [])
      .map((kind) => String(kind).trim())
      .filter((kind) => kind.length > 0);
    if (informationKinds.length === 0) return { missing: 'informationKinds' };

    const recommendedSteps = statement?.recommendedSteps?.trim() ?? '';
    if (!recommendedSteps) return { missing: 'recommendedSteps' };

    return { statement: { entityContact, description, informationKinds, recommendedSteps } };
  }

  /**
   * Notify the regulator.
   *
   * Two paths. For Australia the OAIC is sent an eligible data breach
   * statement with the four parts s 26WK requires, the parts are stored on
   * the row, and the timing recorded is the assessment's, not a 72-hour
   * count. The OAIC takes the statement through its web form, so the email is
   * the record copy. For the UK and EU the Article 33 notification goes to the
   * ICO or the relevant DPA and is measured against the 72-hour clock.
   */
  async notifyRegulator(notification: RegulatoryNotification): Promise<any> {
    const breach = await prisma.dataBreach.findUnique({
      where: { id: notification.breachId },
    });

    if (!breach) {
      throw new Error('Breach not found');
    }

    const regime: BreachJurisdiction =
      notification.jurisdiction ?? jurisdictionsOf(breach)[0] ?? 'UK';

    if (regime === 'AU') {
      return this.lodgeNdbStatement(breach, notification);
    }

    const notificationContent = notification.notificationContent?.trim();
    if (!notificationContent) {
      throw new Error('notificationContent is required for a UK/EU notification');
    }

    // Check if within 72-hour window
    const hoursSinceDetection =
      (Date.now() - breach.detectedAt.getTime()) / (1000 * 60 * 60);

    // Send notification to regulator
    await sendEmail({
      to: notification.regulatorEmail,
      subject: `Data Breach Notification - ${breach.title}`,
      html: `
        <h1>Data Breach Notification</h1>
        <p><strong>Organization:</strong> ATHENA Platform</p>
        <p><strong>Breach Title:</strong> ${escapeHtml(breach.title)}</p>
        <p><strong>Detected At:</strong> ${breach.detectedAt.toISOString()}</p>
        <p><strong>Hours Since Detection:</strong> ${hoursSinceDetection.toFixed(1)}</p>
        <p><strong>Submitted Within 72 Hours:</strong> ${hoursSinceDetection <= 72 ? 'Yes' : 'No'}</p>
        <h2>Notification Content</h2>
        ${paragraphs(notificationContent)}
      `,
    });

    // Update breach record
    const updatedBreach = await prisma.dataBreach.update({
      where: { id: notification.breachId },
      data: {
        status: BreachStatus.NOTIFIED,
        regulatorNotifiedAt: new Date(),
      },
    });

    await prisma.privacyAuditLog.create({
      data: {
        action: 'REGULATOR_NOTIFIED',
        resourceType: 'DataBreach',
        resourceId: notification.breachId,
        details: {
          regulator: notification.regulatorName,
          regime,
          hoursSinceDetection,
          within72Hours: hoursSinceDetection <= 72,
        },
      },
    });

    return updatedBreach;
  }

  private async lodgeNdbStatement(
    breach: {
      id: string;
      title: string;
      detectedAt: Date;
      assessmentDueAt: Date | null;
      assessmentComplete: boolean;
      seriousHarmLikely: boolean | null;
      remediedBeforeHarm: boolean;
    },
    notification: RegulatoryNotification
  ): Promise<any> {
    const blocker = this.ndbNotificationBlocker(breach);
    if (blocker) {
      throw new Error(blocker);
    }

    const validated = this.validateNdbStatement(notification.statement);
    if ('missing' in validated) {
      throw new Error(`The eligible data breach statement is missing its ${validated.missing}`);
    }
    const { statement } = validated;

    const completion = await prisma.privacyAuditLog.findFirst({
      where: { resourceType: 'DataBreach', resourceId: breach.id, action: 'NDB_ASSESSMENT_COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
    const lodgedAt = new Date();

    await sendEmail({
      to: notification.regulatorEmail,
      subject: `Eligible data breach statement - ${breach.title}`,
      html: `
        <h1>Eligible data breach statement</h1>
        <p>Privacy Act 1988 (Cth), section 26WK. Record copy of the statement lodged with the ${escapeHtml(notification.regulatorName)}.</p>
        <p><strong>Breach:</strong> ${escapeHtml(breach.title)}</p>
        <p><strong>Became aware:</strong> ${breach.detectedAt.toISOString()}</p>
        <p><strong>Assessment due:</strong> ${breach.assessmentDueAt ? breach.assessmentDueAt.toISOString() : 'not recorded'}</p>
        <p><strong>Assessment completed:</strong> ${completion ? completion.createdAt.toISOString() : 'not recorded'}</p>
        <p><strong>Statement recorded:</strong> ${lodgedAt.toISOString()}</p>
        <h2>1. Identity and contact details of the entity</h2>
        ${paragraphs(statement.entityContact)}
        <h2>2. Description of the eligible data breach</h2>
        ${paragraphs(statement.description)}
        <h2>3. Kinds of information concerned</h2>
        <ul>${statement.informationKinds.map((kind) => `<li>${escapeHtml(kind)}</li>`).join('')}</ul>
        <h2>4. Recommended steps for individuals</h2>
        ${paragraphs(statement.recommendedSteps)}
      `,
    });

    const updatedBreach = await prisma.dataBreach.update({
      where: { id: breach.id },
      data: {
        status: BreachStatus.NOTIFIED,
        regulatorNotifiedAt: lodgedAt,
        statementLodgedAt: lodgedAt,
        statementEntityContact: statement.entityContact,
        statementDescription: statement.description,
        statementInformationKinds: statement.informationKinds,
        statementRecommendedSteps: statement.recommendedSteps,
      },
    });

    await prisma.privacyAuditLog.create({
      data: {
        action: 'REGULATOR_NOTIFIED',
        resourceType: 'DataBreach',
        resourceId: breach.id,
        details: {
          regulator: notification.regulatorName,
          regime: 'AU',
          assessmentDueAt: breach.assessmentDueAt,
          assessmentCompletedAt: completion?.createdAt ?? null,
          statementLodgedAt: lodgedAt,
          informationKinds: statement.informationKinds,
        },
      },
    });

    return updatedBreach;
  }

  /**
   * Which of these members must not be told by email, and how many there are.
   *
   * Used by the admin page before anything is sent, so the person about to
   * press the button sees how many members will be told in the app only. It
   * reads, and sends nothing.
   */
  async previewNoticeAudience(userIds: string[]): Promise<NoticeAudienceCounts> {
    const audience = await resolveNoticeAudience(userIds);
    return {
      requested: userIds.length,
      found: audience.members.length,
      safetyMembers: audience.members.filter((member) => audience.safetyMemberIds.has(member.id)).length,
      ordinaryMembers: audience.members.filter((member) => !audience.safetyMemberIds.has(member.id)).length,
    };
  }

  /**
   * Notify affected users.
   *
   * Under s 26WL the people affected are told the same things the Commissioner
   * was, including what they can do about it, so an Australian breach needs a
   * "What you can do" section: the statement's recommended steps, or steps
   * supplied here. For other breaches the section is included when supplied.
   *
   * A member who uses Safe Mode or has filed a safety report may share a device
   * or an inbox with the person she is protecting herself from, so an email
   * saying "your data was exposed" can do the harm the breach is being reported
   * to prevent. Those members are told in the app, under a neutral title, and
   * are not emailed. They are emailed only when the operator says privacy
   * counsel has approved the wording and the send (counselConsulted) and gives
   * the neutral subject counsel approved; see docs/security/incident-response.md.
   * Everyone else is emailed as before.
   *
   * The people who cannot be reached are returned, by id, rather than thrown:
   * a failure halfway through a list of thousands must not hide who has been
   * told and who has not.
   */
  async notifyAffectedUsers(
    breachId: string,
    userIds: string[],
    notificationContent: string,
    recommendedSteps?: string,
    options: SafetyNoticeOptions = {}
  ): Promise<NoticeOutcome> {
    const breach = await prisma.dataBreach.findUnique({
      where: { id: breachId },
    });

    if (!breach) {
      throw new Error('Breach not found');
    }

    const steps = recommendedSteps?.trim() || breach.statementRecommendedSteps || null;
    if (ndbApplies(breach) && !steps) {
      throw new Error(
        'People affected by an Australian breach must be told what they can do (Privacy Act 1988 s 26WL). Record the statement, or supply recommendedSteps.'
      );
    }

    assertSafetyEmailAllowed(options);

    // One look at who is who, before a single notice goes out. If it fails
    // nothing is sent: guessing who is safe to email is the failure to avoid.
    const { members, safetyMemberIds } = await resolveNoticeAudience(userIds);
    const safetyMembers = members.filter((member) => safetyMemberIds.has(member.id));
    const ordinaryMembers = members.filter((member) => !safetyMemberIds.has(member.id));

    if (userIds.length > 0 && members.length === 0) {
      throw new ApiError(400, 'None of those member ids matches an account, so nobody was notified and nothing has been recorded.');
    }

    const safetyContent = (options.safetyNotificationContent?.trim() || notificationContent).trim();
    if (safetyMembers.length > 0 && REVEALING_WORDING.test(`${safetyContent}\n${steps ?? ''}`)) {
      throw new ApiError(
        400,
        'The wording these members will read mentions Safe Mode, safety reports or violence, and anyone who can see their phone or inbox could read it. Write neutral wording for them in safetyNotificationContent (see docs/security/templates/safety-breach-notice.md).'
      );
    }

    const stepsSection = steps ? `<h2>What you can do</h2>${paragraphs(steps)}` : '';
    const failedUserIds: string[] = [];
    let emailed = 0;
    let inApp = 0;
    let safetyEmailed = 0;
    let safetyInAppOnly = 0;

    // The general notice, by email, in batches. Unchanged for members who are
    // not in the safety group.
    for (let i = 0; i < ordinaryMembers.length; i += NOTICE_BATCH_SIZE) {
      const batch = ordinaryMembers.slice(i, i + NOTICE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((user) =>
          sendEmail({
            to: user.email,
            subject: 'Important Security Notice from ATHENA',
            html: `
              <h1>Important Security Notice</h1>
              <p>Dear ${escapeHtml(user.firstName ?? '')},</p>
              ${paragraphs(notificationContent)}
              ${stepsSection}
              <p>For more information, please visit your <a href="${securitySupportUrl()}">security settings</a>.</p>
              <p>Best regards,<br>The ATHENA Security Team</p>
            `,
          })
        )
      );
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) emailed += 1;
        else failedUserIds.push(batch[index].id);
      });
    }

    // The safety group, in the app. Written straight to the member's
    // notifications rather than through the preference-aware dispatcher: a
    // legally required notice is not something a muted category may swallow.
    const inAppMessage = steps ? `${safetyContent}\n\nWhat you can do: ${steps}` : safetyContent;
    for (let i = 0; i < safetyMembers.length; i += NOTICE_BATCH_SIZE) {
      const batch = safetyMembers.slice(i, i + NOTICE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((user) =>
          sendInAppNotification({
            userId: user.id,
            type: 'SYSTEM',
            title: NEUTRAL_NOTICE_TITLE,
            message: inAppMessage,
            link: '/dashboard/settings/security',
            data: { kind: 'account-security-notice' },
          })
        )
      );

      const told: typeof batch = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          inApp += 1;
          told.push(batch[index]);
        } else {
          failedUserIds.push(batch[index].id);
        }
      });

      if (!options.emailSafetyMembers || told.length === 0) {
        safetyInAppOnly += told.length;
        continue;
      }

      // Counsel has approved an email too: neutral subject, neutral body, no
      // mention of why this member is getting it in the app as well. She has
      // been told in the app either way, so an email that does not go is not a
      // failure to notify her.
      const subject = options.neutralSubject!.trim();
      const emailResults = await Promise.allSettled(
        told.map((user) =>
          sendEmail({
            to: user.email,
            subject,
            html: `
              <h1>${escapeHtml(subject)}</h1>
              ${paragraphs(safetyContent)}
              ${stepsSection}
              <p>The ATHENA team</p>
            `,
          })
        )
      );
      const sent = emailResults.filter((result) => result.status === 'fulfilled' && result.value).length;
      safetyEmailed += sent;
      safetyInAppOnly += told.length - sent;
    }

    const method = noticeMethod(emailed + safetyEmailed > 0, inApp > 0);
    const reached = emailed + inApp;

    if (members.length > 0 && reached === 0) {
      // Nothing went, so nothing is stamped: the breach must not read as "people
      // notified" on the strength of a send that reached nobody.
      throw new ApiError(502, 'No notice could be delivered, so nothing has been recorded as sent. Check the email and notification services and try again.');
    }

    // Update breach record
    if (reached > 0) {
      await prisma.dataBreach.update({
        where: { id: breachId },
        data: {
          usersNotifiedAt: new Date(),
          notificationMethod: method,
          ...(steps && !breach.statementRecommendedSteps ? { statementRecommendedSteps: steps } : {}),
        },
      });
    }

    // Counts only, never ids: this row is read by people who must not be able to
    // tell from it who among the members is in the safety group.
    await prisma.privacyAuditLog.create({
      data: {
        action: 'USERS_NOTIFIED_OF_BREACH',
        resourceType: 'DataBreach',
        resourceId: breachId,
        details: {
          usersNotified: reached,
          method,
          channels: { email: emailed + safetyEmailed, inApp },
          safetyMembers: safetyMembers.length,
          safetyMembersInAppOnly: safetyInAppOnly,
          safetyMembersEmailed: safetyEmailed,
          counselConsulted: options.counselConsulted === true,
          ...(options.emailSafetyMembers ? { neutralSubject: options.neutralSubject!.trim() } : {}),
          notNotified: failedUserIds.length,
          recommendedStepsIncluded: Boolean(steps),
        },
      },
    });

    return {
      requested: userIds.length,
      found: members.length,
      emailed: emailed + safetyEmailed,
      inApp,
      safetyMembers: safetyMembers.length,
      safetyMembersInAppOnly: safetyInAppOnly,
      method,
      failedUserIds,
    };
  }

  /**
   * Breaches still owing a 72-hour regulator notification.
   *
   * Australian-only breaches are excluded at the query: their duty is the NDB
   * assessment, which getNdbAssessmentsDue() watches. Rows with no regime
   * recorded still count, so nothing legacy is dropped silently.
   */
  async getBreachesRequiringNotification(): Promise<any[]> {
    return prisma.dataBreach.findMany({
      where: {
        ...SEVENTY_TWO_HOUR_CLOCK_WHERE,
        notificationRequired: true,
        regulatorNotifiedAt: null,
        status: {
          in: [BreachStatus.DETECTED, BreachStatus.INVESTIGATING, BreachStatus.CONTAINED],
        },
      },
      orderBy: { detectedAt: 'asc' },
    });
  }

  /**
   * Get all breaches for audit dashboard
   */
  async getAllBreaches(filters?: {
    status?: BreachStatus;
    severity?: BreachSeverity;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.startDate || filters?.endDate) {
      where.detectedAt = {};
      if (filters.startDate) where.detectedAt.gte = filters.startDate;
      if (filters.endDate) where.detectedAt.lte = filters.endDate;
    }

    return prisma.dataBreach.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
    });
  }

  /**
   * Generate breach report for compliance.
   *
   * The compliance block answers for whichever regime applies and says null
   * for the other, so a report on an Australian breach never carries a
   * "notified within 72 hours: false" that a reader could mistake for a miss.
   */
  async generateBreachReport(breachId: string): Promise<object> {
    const breach = await prisma.dataBreach.findUnique({
      where: { id: breachId },
    });

    if (!breach) {
      throw new Error('Breach not found');
    }

    const auditLogs = await prisma.privacyAuditLog.findMany({
      where: {
        resourceType: 'DataBreach',
        resourceId: breachId,
      },
      orderBy: { createdAt: 'asc' },
    });

    const clockApplies = seventyTwoHourClockApplies(breach);
    const underNdb = ndbApplies(breach);
    const assessmentCompletedAt =
      [...auditLogs].reverse().find((log) => log.action === 'NDB_ASSESSMENT_COMPLETED')?.createdAt ??
      null;

    return {
      breach,
      timeline: auditLogs.map(log => ({
        action: log.action,
        timestamp: log.createdAt,
        details: log.details,
      })),
      compliance: {
        seventyTwoHourClockApplies: clockApplies,
        notifiedWithin72Hours:
          clockApplies && breach.regulatorNotifiedAt
            ? (breach.regulatorNotifiedAt.getTime() - breach.detectedAt.getTime()) /
                (1000 * 60 * 60) <=
              72
            : null,
        ndbApplies: underNdb,
        assessedWithin30Days:
          underNdb && breach.assessmentComplete && breach.assessmentDueAt && assessmentCompletedAt
            ? assessmentCompletedAt.getTime() <= breach.assessmentDueAt.getTime()
            : null,
        notifiableUnderNdb:
          underNdb && breach.assessmentComplete
            ? Boolean(breach.seriousHarmLikely) && !breach.remediedBeforeHarm
            : null,
        oaicNotified: Boolean(breach.statementLodgedAt),
        usersNotified: !!breach.usersNotifiedAt,
        documentationComplete:
          !!breach.rootCause &&
          breach.containmentActions.length > 0 &&
          breach.remediationActions.length > 0,
      },
      generatedAt: new Date(),
    };
  }
}

export const breachNotificationService = new BreachNotificationService();
