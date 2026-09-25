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
import { sendEmail } from './email.service';

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
 */
function securitySupportUrl(): string {
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  return `${base}/help/security`;
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
          <p><strong>Title:</strong> ${breach.title}</p>
          <p><strong>Severity:</strong> ${breach.severity}</p>
          <p><strong>Detected At:</strong> ${breach.detectedAt.toISOString()}</p>
          <p><strong>Regimes:</strong> ${jurisdictionsOf(breach).join(', ') || 'not recorded'}</p>
          <p><strong>Applicable clock:</strong></p>
          <ul>${clockList}</ul>
          <p><strong>Description:</strong> ${breach.description}</p>
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
        <p><strong>Breach Title:</strong> ${breach.title}</p>
        <p><strong>Detected At:</strong> ${breach.detectedAt.toISOString()}</p>
        <p><strong>Hours Since Detection:</strong> ${hoursSinceDetection.toFixed(1)}</p>
        <p><strong>Submitted Within 72 Hours:</strong> ${hoursSinceDetection <= 72 ? 'Yes' : 'No'}</p>
        <h2>Notification Content</h2>
        <p>${notificationContent}</p>
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
   * Notify affected users.
   *
   * Under s 26WL the people affected are told the same things the Commissioner
   * was, including what they can do about it, so an Australian breach needs a
   * "What you can do" section: the statement's recommended steps, or steps
   * supplied here. For other breaches the section is included when supplied.
   */
  async notifyAffectedUsers(
    breachId: string,
    userIds: string[],
    notificationContent: string,
    recommendedSteps?: string
  ): Promise<void> {
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

    // Get affected users' emails
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true },
    });

    const stepsSection = steps ? `<h2>What you can do</h2>${paragraphs(steps)}` : '';

    // Send notifications in batches
    const batchSize = 100;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map(user =>
          sendEmail({
            to: user.email,
            subject: 'Important Security Notice from ATHENA',
            html: `
              <h1>Important Security Notice</h1>
              <p>Dear ${user.firstName},</p>
              <p>${notificationContent}</p>
              ${stepsSection}
              <p>For more information, please visit our <a href="${securitySupportUrl()}">security support page</a>.</p>
              <p>Best regards,<br>The ATHENA Security Team</p>
            `,
          })
        )
      );
    }

    // Update breach record
    await prisma.dataBreach.update({
      where: { id: breachId },
      data: {
        usersNotifiedAt: new Date(),
        notificationMethod: 'EMAIL',
        ...(steps && !breach.statementRecommendedSteps ? { statementRecommendedSteps: steps } : {}),
      },
    });

    await prisma.privacyAuditLog.create({
      data: {
        action: 'USERS_NOTIFIED_OF_BREACH',
        resourceType: 'DataBreach',
        resourceId: breachId,
        details: {
          usersNotified: users.length,
          method: 'EMAIL',
          recommendedStepsIncluded: Boolean(steps),
        },
      },
    });
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
