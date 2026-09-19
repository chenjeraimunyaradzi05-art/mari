jest.mock('../../utils/prisma', () => ({
  prisma: {
    dataBreach: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'breach-1', ...data })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'breach-1', ...data })),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
    },
    privacyAuditLog: {
      create: jest.fn(async () => ({})),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    user: {
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock('../email.service', () => ({
  sendEmail: jest.fn(async () => true),
}));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../email.service';
import {
  breachNotificationService,
  jurisdictionsOf,
  seventyTwoHourClockApplies,
} from '../breach.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as unknown as jest.Mock;

const AWARE_AT = new Date('2026-09-17T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * DAY_MS;

/** An Australian breach as intake now records it: the window already open. */
const auRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'breach-1',
  title: 'Exported CV bucket left public',
  description: 'A storage bucket holding CV uploads was readable without credentials.',
  detectedAt: AWARE_AT,
  severity: 'HIGH',
  status: 'DETECTED',
  dataCategories: ['PII'],
  jurisdictions: ['AU'],
  jurisdiction: 'AU',
  assessmentDueAt: new Date(AWARE_AT.getTime() + THIRTY_DAYS_MS),
  assessmentComplete: false,
  seriousHarmLikely: null,
  remediedBeforeHarm: false,
  notificationRequired: false,
  regulatorNotifiedAt: null,
  statementRecommendedSteps: null,
  statementLodgedAt: null,
  containmentActions: [],
  remediationActions: [],
  rootCause: null,
  ...overrides,
});

const statement = {
  entityContact: 'ATHENA Platform Pty Ltd, Queensland, Australia. Privacy contact through the privacy centre.',
  description: 'CV uploads were readable without credentials for six hours.',
  informationKinds: ['names', 'employment history'],
  recommendedSteps: 'Watch for unexpected recruiter contact and report anything odd through the privacy centre.',
};

/** The data passed to the last dataBreach.update call. */
const lastUpdate = () => prismaAny.dataBreach.update.mock.calls.at(-1)[0].data;
const lastCreate = () => prismaAny.dataBreach.create.mock.calls.at(-1)[0].data;
const auditActions = () =>
  prismaAny.privacyAuditLog.create.mock.calls.map((call: any) => call[0].data.action);

describe('Notifiable Data Breaches scheme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.dataBreach.findUnique.mockResolvedValue(auRow());
    delete process.env.INCIDENT_TEAM_EMAILS;
  });

  describe('which clock applies', () => {
    it('reads the regime list, falling back to the single column on rows from before it existed', () => {
      expect(jurisdictionsOf({ jurisdictions: ['AU', 'UK'], jurisdiction: 'AU' })).toEqual(['AU', 'UK']);
      expect(jurisdictionsOf({ jurisdictions: [], jurisdiction: 'AU' })).toEqual(['AU']);
      expect(jurisdictionsOf({ jurisdictions: [], jurisdiction: null })).toEqual([]);
    });

    it('keeps the 72-hour clock off an Australian-only breach and on for everyone else', () => {
      expect(seventyTwoHourClockApplies({ jurisdictions: ['AU'] })).toBe(false);
      expect(seventyTwoHourClockApplies({ jurisdictions: [], jurisdiction: 'AU' })).toBe(false);
      expect(seventyTwoHourClockApplies({ jurisdictions: ['AU', 'UK'] })).toBe(true);
      expect(seventyTwoHourClockApplies({ jurisdictions: ['EU'] })).toBe(true);
      // A row with no regime recorded predates the list and is not dropped.
      expect(seventyTwoHourClockApplies({ jurisdictions: [], jurisdiction: null })).toBe(true);
    });
  });

  describe('intake', () => {
    it('defaults to Australia and opens the thirty-day window from detection', async () => {
      await breachNotificationService.reportBreach({
        title: 'Exported CV bucket left public',
        description: 'Readable without credentials.',
        detectedBy: 'admin-1',
        severity: 'CRITICAL' as any,
        dataCategories: ['PII'] as any,
      });

      const data = lastCreate();
      expect(data.jurisdictions).toEqual(['AU']);
      expect(data.jurisdiction).toBe('AU');
      expect(data.assessmentComplete).toBe(false);
      expect(data.assessmentDueAt.getTime() - data.detectedAt.getTime()).toBe(THIRTY_DAYS_MS);
      // CRITICAL would be notifiable under the GDPR heuristic. Under the
      // scheme nothing is notifiable until the assessment says so.
      expect(data.notificationRequired).toBe(false);
      expect(auditActions()).toEqual(['BREACH_REPORTED', 'NDB_ASSESSMENT_STARTED']);
    });

    it('runs the GDPR heuristic, and no assessment window, for a UK-only breach', async () => {
      await breachNotificationService.reportBreach({
        title: 'Mailing list exported',
        description: 'A CSV of newsletter subscribers left the building.',
        detectedBy: 'admin-1',
        severity: 'HIGH' as any,
        dataCategories: ['PII'] as any,
        jurisdictions: ['UK'],
      });

      const data = lastCreate();
      expect(data.jurisdictions).toEqual(['UK']);
      expect(data.notificationRequired).toBe(true);
      expect(data.assessmentDueAt).toBeUndefined();
      expect(auditActions()).toEqual(['BREACH_REPORTED']);
    });

    it('tells the incident team about the thirty-day assessment, not a 72-hour deadline, for an Australian breach', async () => {
      process.env.INCIDENT_TEAM_EMAILS = 'incident@example.test';

      await breachNotificationService.reportBreach({
        title: 'Exported CV bucket left public',
        description: 'Readable without credentials.',
        detectedBy: 'admin-1',
        severity: 'HIGH' as any,
        dataCategories: ['PII'] as any,
      });

      const html: string = sendEmailMock.mock.calls[0][0].html;
      expect(html).toContain('30-day NDB assessment due');
      expect(html).not.toContain('72-hour');
    });

    it('prints both clocks when a breach touches Australian and EU members', async () => {
      process.env.INCIDENT_TEAM_EMAILS = 'incident@example.test';

      await breachNotificationService.reportBreach({
        title: 'Shared calendar exposed',
        description: 'Event invitations were visible to a third party.',
        detectedBy: 'admin-1',
        severity: 'HIGH' as any,
        dataCategories: ['PII'] as any,
        jurisdictions: ['AU', 'EU'],
      });

      const html: string = sendEmailMock.mock.calls[0][0].html;
      expect(html).toContain('30-day NDB assessment due');
      expect(html).toContain('72-hour regulator notification due');
    });
  });

  describe('the assessment window', () => {
    it('gives thirty days from awareness to finish the assessment', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(auRow({ jurisdictions: [], jurisdiction: null, assessmentDueAt: null }));

      await breachNotificationService.beginNdbAssessment('breach-1', AWARE_AT);

      const data = lastUpdate();
      expect(data.jurisdictions).toEqual(['AU']);
      expect(data.jurisdiction).toBe('AU');
      expect(data.assessmentComplete).toBe(false);
      expect((data.assessmentDueAt as Date).getTime()).toBe(AWARE_AT.getTime() + THIRTY_DAYS_MS);
    });

    it('adds Australia to a UK breach rather than replacing the regime', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(auRow({ jurisdictions: ['UK'], jurisdiction: 'UK', assessmentDueAt: null }));

      await breachNotificationService.beginNdbAssessment('breach-1', AWARE_AT);

      const data = lastUpdate();
      expect(data.jurisdictions).toEqual(['UK', 'AU']);
      expect(data.jurisdiction).toBe('UK');
    });

    it('looks only at Australian assessments that are still open', async () => {
      await breachNotificationService.getNdbAssessmentsDue(7, AWARE_AT);

      const where = prismaAny.dataBreach.findMany.mock.calls.at(-1)[0].where;
      expect(where.OR).toEqual([{ jurisdictions: { has: 'AU' } }, { jurisdiction: 'AU' }]);
      expect(where.assessmentComplete).toBe(false);
      expect(where.assessmentDueAt.lte.getTime()).toBe(AWARE_AT.getTime() + 7 * DAY_MS);
    });
  });

  describe('the assessment outcome', () => {
    it('requires notification when serious harm is likely and nothing has fixed it', async () => {
      await breachNotificationService.completeNdbAssessment('breach-1', {
        seriousHarmLikely: true,
        reasoning: 'Identity documents were exposed.',
      });

      const data = lastUpdate();
      expect(data.seriousHarmLikely).toBe(true);
      expect(data.notificationRequired).toBe(true);
      expect(data.assessmentComplete).toBe(true);
    });

    it('does not require notification when remedial action prevented the harm', async () => {
      await breachNotificationService.completeNdbAssessment('breach-1', {
        seriousHarmLikely: true,
        remediedBeforeHarm: true,
        reasoning: 'Access was revoked before the export was opened.',
      });

      // The scheme removes the obligation entirely in this case, which is the one
      // place it departs most sharply from the GDPR path.
      const data = lastUpdate();
      expect(data.remediedBeforeHarm).toBe(true);
      expect(data.notificationRequired).toBe(false);
    });

    it('does not require notification when serious harm is not likely', async () => {
      await breachNotificationService.completeNdbAssessment('breach-1', {
        seriousHarmLikely: false,
        reasoning: 'Only already-public profile fields were involved.',
      });

      expect(lastUpdate().notificationRequired).toBe(false);
    });

    it('cannot switch off an Article 33 duty on a breach that also touches UK members', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        auRow({ jurisdictions: ['AU', 'UK'], notificationRequired: true })
      );

      await breachNotificationService.completeNdbAssessment('breach-1', {
        seriousHarmLikely: false,
        reasoning: 'No Australian member is at risk of serious harm.',
      });

      expect(lastUpdate().notificationRequired).toBe(true);
    });

    it('records the outcome in the privacy audit log', async () => {
      await breachNotificationService.completeNdbAssessment('breach-1', {
        seriousHarmLikely: true,
        reasoning: 'Contact details and dates of birth.',
      });

      expect(prismaAny.privacyAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'NDB_ASSESSMENT_COMPLETED' }),
        })
      );
    });
  });

  describe('the statement to the OAIC', () => {
    const assessed = (overrides: Record<string, unknown> = {}) =>
      auRow({ assessmentComplete: true, seriousHarmLikely: true, remediedBeforeHarm: false, notificationRequired: true, ...overrides });

    it('refuses until the assessment has been completed', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(auRow());

      await expect(
        breachNotificationService.notifyRegulator({
          breachId: 'breach-1',
          regulatorName: 'OAIC',
          regulatorEmail: 'enquiries@oaic.gov.au',
          jurisdiction: 'AU',
          statement,
        })
      ).rejects.toThrow(/assessment has not been completed/);

      expect(prismaAny.dataBreach.update).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('refuses when the assessment found no eligible data breach', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(assessed({ remediedBeforeHarm: true }));

      await expect(
        breachNotificationService.notifyRegulator({
          breachId: 'breach-1',
          regulatorName: 'OAIC',
          regulatorEmail: 'enquiries@oaic.gov.au',
          jurisdiction: 'AU',
          statement,
        })
      ).rejects.toThrow(/remedial action prevented the harm/);
    });

    it('requires all four parts section 26WK asks for', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(assessed());

      await expect(
        breachNotificationService.notifyRegulator({
          breachId: 'breach-1',
          regulatorName: 'OAIC',
          regulatorEmail: 'enquiries@oaic.gov.au',
          jurisdiction: 'AU',
          statement: { ...statement, recommendedSteps: '   ' },
        })
      ).rejects.toThrow(/missing its recommendedSteps/);
    });

    it('records the statement on the row, sends the copy and writes the assessment timing, not a 72-hour count', async () => {
      const completedAt = new Date(AWARE_AT.getTime() + 10 * DAY_MS);
      prismaAny.dataBreach.findUnique.mockResolvedValue(assessed());
      prismaAny.privacyAuditLog.findFirst.mockResolvedValue({ createdAt: completedAt });

      await breachNotificationService.notifyRegulator({
        breachId: 'breach-1',
        regulatorName: 'Office of the Australian Information Commissioner',
        regulatorEmail: 'enquiries@oaic.gov.au',
        jurisdiction: 'AU',
        statement,
      });

      const data = lastUpdate();
      expect(data.status).toBe('NOTIFIED');
      expect(data.statementEntityContact).toBe(statement.entityContact);
      expect(data.statementDescription).toBe(statement.description);
      expect(data.statementInformationKinds).toEqual(['names', 'employment history']);
      expect(data.statementRecommendedSteps).toBe(statement.recommendedSteps);
      expect(data.statementLodgedAt).toBeInstanceOf(Date);
      expect(data.regulatorNotifiedAt).toBe(data.statementLodgedAt);

      const email = sendEmailMock.mock.calls[0][0];
      expect(email.to).toBe('enquiries@oaic.gov.au');
      expect(email.subject).toContain('Eligible data breach statement');
      expect(email.html).toContain('section 26WK');
      expect(email.html).toContain('Recommended steps for individuals');
      expect(email.html).not.toContain('72 Hours');
      expect(email.html).not.toContain('Hours Since Detection');

      const audit = prismaAny.privacyAuditLog.create.mock.calls.at(-1)[0].data;
      expect(audit.action).toBe('REGULATOR_NOTIFIED');
      expect(audit.details.regime).toBe('AU');
      expect(audit.details.assessmentCompletedAt).toBe(completedAt);
      expect(audit.details.within72Hours).toBeUndefined();
      expect(audit.details.hoursSinceDetection).toBeUndefined();
    });

    it('keeps the Article 33 wording for a UK notification', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        auRow({ jurisdictions: ['UK'], jurisdiction: 'UK', assessmentDueAt: null, notificationRequired: true })
      );

      await breachNotificationService.notifyRegulator({
        breachId: 'breach-1',
        regulatorName: 'ICO',
        regulatorEmail: 'casework@ico.example',
        notificationContent: 'Full description of the breach.',
      });

      expect(sendEmailMock.mock.calls[0][0].html).toContain('Submitted Within 72 Hours');
      const audit = prismaAny.privacyAuditLog.create.mock.calls.at(-1)[0].data;
      expect(audit.details.regime).toBe('UK');
      expect(typeof audit.details.within72Hours).toBe('boolean');
    });
  });

  describe('telling the people affected', () => {
    beforeEach(() => {
      prismaAny.user.findMany.mockResolvedValue([{ id: 'user-1', email: 'member@example.test', firstName: 'Priya' }]);
    });

    it('refuses to notify Australians without telling them what they can do', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(auRow({ statementRecommendedSteps: null }));

      await expect(
        breachNotificationService.notifyAffectedUsers('breach-1', ['user-1'], 'Your CV was exposed.')
      ).rejects.toThrow(/26WL/);

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("reuses the statement's recommended steps as the What you can do section", async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        auRow({ statementRecommendedSteps: statement.recommendedSteps })
      );

      await breachNotificationService.notifyAffectedUsers('breach-1', ['user-1'], 'Your CV was exposed.');

      const html: string = sendEmailMock.mock.calls[0][0].html;
      expect(html).toContain('What you can do');
      expect(html).toContain('unexpected recruiter contact');
    });
  });

  describe('the 72-hour monitor and the report', () => {
    it('asks the database only for breaches the 72-hour clock applies to', async () => {
      await breachNotificationService.getBreachesRequiringNotification();

      const where = prismaAny.dataBreach.findMany.mock.calls.at(-1)[0].where;
      expect(where.notificationRequired).toBe(true);
      expect(where.OR).toEqual([
        { jurisdictions: { hasSome: ['UK', 'EU'] } },
        { jurisdictions: { isEmpty: true }, OR: [{ jurisdiction: null }, { jurisdiction: { not: 'AU' } }] },
      ]);
    });

    it('reports the thirty-day position for an Australian breach and says the 72-hour test does not apply', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        auRow({ assessmentComplete: true, seriousHarmLikely: true, remediedBeforeHarm: false, notificationRequired: true })
      );
      prismaAny.privacyAuditLog.findMany.mockResolvedValue([
        { action: 'BREACH_REPORTED', createdAt: AWARE_AT, details: {} },
        { action: 'NDB_ASSESSMENT_COMPLETED', createdAt: new Date(AWARE_AT.getTime() + 12 * DAY_MS), details: {} },
      ]);

      const report: any = await breachNotificationService.generateBreachReport('breach-1');

      expect(report.compliance).toMatchObject({
        seventyTwoHourClockApplies: false,
        notifiedWithin72Hours: null,
        ndbApplies: true,
        assessedWithin30Days: true,
        notifiableUnderNdb: true,
        oaicNotified: false,
      });
    });

    it('marks an assessment that ran past day thirty', async () => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(
        auRow({ assessmentComplete: true, seriousHarmLikely: false })
      );
      prismaAny.privacyAuditLog.findMany.mockResolvedValue([
        { action: 'NDB_ASSESSMENT_COMPLETED', createdAt: new Date(AWARE_AT.getTime() + 31 * DAY_MS), details: {} },
      ]);

      const report: any = await breachNotificationService.generateBreachReport('breach-1');

      expect(report.compliance.assessedWithin30Days).toBe(false);
      expect(report.compliance.notifiableUnderNdb).toBe(false);
    });
  });
});
