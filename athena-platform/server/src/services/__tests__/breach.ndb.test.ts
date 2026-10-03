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
    contentReport: {
      findMany: jest.fn(async () => []),
    },
    safetyIncident: {
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock('../email.service', () => ({
  sendEmail: jest.fn(async () => true),
}));

// The member's own notifications, which is where the safety group is told.
jest.mock('../socket.service', () => ({
  sendNotification: jest.fn(async () => ({})),
}));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../email.service';
import { sendNotification } from '../socket.service';
import {
  breachNotificationService,
  jurisdictionsOf,
  seventyTwoHourClockApplies,
} from '../breach.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as unknown as jest.Mock;
const sendNotificationMock = sendNotification as unknown as jest.Mock;

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

  describe('telling members whose safety depends on it not being seen', () => {
    // A woman using Safe Mode may share her phone and her inbox with the person
    // she is protecting herself from, so an email saying her data was exposed
    // can be the harm. These members are told in the app, under a neutral
    // title, and are emailed only when privacy counsel has said so.
    const ordinary = { id: 'user-ordinary', email: 'ordinary@example.test', firstName: 'Priya', dvSafetyProfile: null };
    const safeMode = {
      id: 'user-safe',
      email: 'safe@example.test',
      firstName: 'Rachel',
      dvSafetyProfile: { isSafeMode: true, notificationsSafe: true },
    };
    const ids = [ordinary.id, safeMode.id];
    const body = 'Some account details were readable for six hours. We have fixed it.';

    beforeEach(() => {
      prismaAny.dataBreach.findUnique.mockResolvedValue(auRow({ statementRecommendedSteps: statement.recommendedSteps }));
      prismaAny.user.findMany.mockResolvedValue([ordinary, safeMode]);
      prismaAny.contentReport.findMany.mockResolvedValue([]);
      prismaAny.safetyIncident.findMany.mockResolvedValue([]);
      sendEmailMock.mockResolvedValue(true);
      sendNotificationMock.mockResolvedValue({});
    });

    const emailedTo = () => sendEmailMock.mock.calls.map((call: any[]) => call[0].to);
    const lastAudit = () => prismaAny.privacyAuditLog.create.mock.calls.at(-1)[0].data;

    it('emails an ordinary member and tells a Safe Mode member in the app only', async () => {
      const outcome = await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);

      expect(emailedTo()).toEqual(['ordinary@example.test']);
      expect(sendNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendNotificationMock.mock.calls[0][0]).toMatchObject({
        userId: 'user-safe',
        type: 'SYSTEM',
        title: 'Account security update',
        link: '/dashboard/settings/security',
      });
      expect(outcome).toMatchObject({
        requested: 2,
        found: 2,
        emailed: 1,
        inApp: 1,
        safetyMembers: 1,
        safetyMembersInAppOnly: 1,
        method: 'EMAIL+IN_APP',
        failedUserIds: [],
      });
    });

    it('puts the same what-you-can-do steps in the app notice, and nothing that names the breach or the member', async () => {
      await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);

      const sent = sendNotificationMock.mock.calls[0][0];
      expect(sent.message).toContain(body);
      expect(sent.message).toContain('What you can do');
      expect(sent.message).toContain('unexpected recruiter contact');
      // The notification row is stored: nothing in it says which breach, or why she is getting it this way.
      expect(JSON.stringify(sent.data)).toBe('{"kind":"account-security-notice"}');
      expect(JSON.stringify(sent)).not.toContain('breach-1');
    });

    it('goes straight to her notifications: a muted category cannot swallow a legally required notice', async () => {
      await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);

      // sendNotification writes the row; the preference-aware dispatcher is not involved.
      expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    });

    it('treats a member who has filed a safety report, by content report or by incident, the same way', async () => {
      prismaAny.user.findMany.mockResolvedValue([ordinary, { ...ordinary, id: 'user-reporter', email: 'reporter@example.test' }, { ...ordinary, id: 'user-incident', email: 'incident@example.test' }]);
      prismaAny.contentReport.findMany.mockResolvedValue([{ reporterId: 'user-reporter' }]);
      prismaAny.safetyIncident.findMany.mockResolvedValue([{ reporterId: 'user-incident' }, { reporterId: null }]);

      await breachNotificationService.notifyAffectedUsers('breach-1', ['user-ordinary', 'user-reporter', 'user-incident'], body);

      expect(emailedTo()).toEqual(['ordinary@example.test']);
      expect(sendNotificationMock.mock.calls.map((call: any[]) => call[0].userId).sort()).toEqual(['user-incident', 'user-reporter']);

      // Only reports about harm to a person count, and only reports she filed.
      expect(prismaAny.contentReport.findMany.mock.calls[0][0].where.reason.in).toEqual(
        expect.arrayContaining(['HARASSMENT', 'HATE_SPEECH'])
      );
      expect(prismaAny.contentReport.findMany.mock.calls[0][0].where.reporterId).toEqual({ in: ['user-ordinary', 'user-reporter', 'user-incident'] });
      // The incident a signed-in report records is typed REPORT; USER_REPORT is the anonymous kind and has no reporter.
      expect(prismaAny.safetyIncident.findMany.mock.calls[0][0].where).toMatchObject({
        reporterId: { in: ['user-ordinary', 'user-reporter', 'user-incident'] },
        type: 'REPORT',
      });
    });

    describe('which reports count, as the two doors actually store them', () => {
      // The in-app route stores the reason in lower case ('harassment') and the
      // public form in upper case ('HARASSMENT'); a text column matches case for
      // case. The stand-in database below answers the way Postgres would, so a
      // list that names only one spelling fails here.
      const stored = [
        { reporterId: 'user-inapp', reason: 'harassment' },
        { reporterId: 'user-form', reason: 'HARASSMENT' },
        { reporterId: 'user-dialog', reason: 'violence' },
        { reporterId: 'user-impersonation', reason: 'impersonation' },
        { reporterId: 'user-spam', reason: 'spam' },
        { reporterId: 'user-fraud', reason: 'FRAUD' },
        // The two named reasons a woman files about an intimate image of her or a
        // threat, from the app (lower case) and from the public form (upper).
        { reporterId: 'user-image', reason: 'intimate_image' },
        { reporterId: 'user-threat', reason: 'THREAT' },
      ];
      const everyone = stored.map((row) => row.reporterId);

      beforeEach(() => {
        prismaAny.user.findMany.mockResolvedValue(everyone.map((id) => ({ ...ordinary, id, email: `${id}@example.test` })));
        const answer = async ({ where }: any) =>
          stored.filter((row) => where.reporterId.in.includes(row.reporterId) && where.reason.in.includes(row.reason)).map(({ reporterId }) => ({ reporterId }));
        prismaAny.contentReport.findMany.mockImplementation(answer);
        prismaAny.safetyIncident.findMany.mockImplementation(answer);
      });

      it('tells a member who reported from the app, the form or the dialog in the app, and emails the rest', async () => {
        await breachNotificationService.notifyAffectedUsers('breach-1', everyone, body);

        expect(sendNotificationMock.mock.calls.map((call: any[]) => call[0].userId).sort()).toEqual([
          'user-dialog',
          'user-form',
          'user-image',
          'user-impersonation',
          'user-inapp',
          'user-threat',
        ]);
        expect(emailedTo().sort()).toEqual(['user-fraud@example.test', 'user-spam@example.test']);
      });
    });

    it('asks the database about Safe Mode once, through the member query, not once per member', async () => {
      await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);

      expect(prismaAny.user.findMany).toHaveBeenCalledTimes(1);
      expect(prismaAny.user.findMany.mock.calls[0][0].select.dvSafetyProfile.select).toMatchObject({
        isSafeMode: true,
        notificationsSafe: true,
      });
      // The Safety Centre's switch is on the member profile, not the DV one.
      expect(prismaAny.user.findMany.mock.calls[0][0].select.profile).toEqual({ select: { isSafeMode: true } });
    });

    it('a member who turned Safe Mode on in the Safety Centre is in the group though she has no DV page row', async () => {
      prismaAny.user.findMany.mockResolvedValue([{ ...safeMode, dvSafetyProfile: null, profile: { isSafeMode: true } }]);

      await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], body);

      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an emergency contact', { emergencyContacts: [{ name: 'Sam', phone: '0400000000' }] }],
      ['a block she made on the DV page', { blockedUserIds: ['user-x'] }],
      ['closed messages', { allowMessages: false }],
      ['the safety alert button', { panicButtonEnabled: true }],
      ['the quick exit', { safeExitEnabled: true }],
      ['hidden from search', { hideFromSearch: true }],
    ])(
      'a DV page row with %s is enough, though neither Safe Mode nor private notifications is on: the row used to default to private notifications, and no longer does',
      async (_label, extra) => {
        prismaAny.user.findMany.mockResolvedValue([
          { ...safeMode, dvSafetyProfile: { isSafeMode: false, notificationsSafe: false, ...extra } },
        ]);

        await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], body);

        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
      }
    );

    it('a DV page row that holds only defaults is an ordinary member, which is what the page now makes of a member who has only opened it', async () => {
      prismaAny.user.findMany.mockResolvedValue([
        {
          ...safeMode,
          dvSafetyProfile: {
            isSafeMode: false,
            notificationsSafe: false,
            hideFromSearch: false,
            allowMessages: true,
            safeExitEnabled: false,
            panicButtonEnabled: false,
            blockedUserIds: [],
            emergencyContacts: [],
          },
          profile: { isSafeMode: false },
        },
      ]);

      await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], body);

      expect(emailedTo()).toEqual(['safe@example.test']);
      expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it('a profile with Safe Mode and private notifications both off is an ordinary member: she chose that', async () => {
      prismaAny.user.findMany.mockResolvedValue([{ ...safeMode, dvSafetyProfile: { isSafeMode: false, notificationsSafe: false } }]);

      await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], body);

      expect(emailedTo()).toEqual(['safe@example.test']);
      expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it('a profile with private notifications on is enough', async () => {
      prismaAny.user.findMany.mockResolvedValue([{ ...safeMode, dvSafetyProfile: { isSafeMode: false, notificationsSafe: true } }]);

      await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], body);

      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    });

    describe('emailing them as well', () => {
      const approved = { emailSafetyMembers: true, counselConsulted: true, neutralSubject: 'Account security update' };

      it('is refused without counsel, and nothing at all is sent, not even to the ordinary member', async () => {
        await expect(
          breachNotificationService.notifyAffectedUsers('breach-1', ids, body, undefined, { emailSafetyMembers: true })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/counselConsulted/) });

        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(sendNotificationMock).not.toHaveBeenCalled();
        expect(prismaAny.dataBreach.update).not.toHaveBeenCalled();
      });

      it('is refused when counsel is "consulted" in anything but a plain yes, and when no subject is given', async () => {
        await expect(
          breachNotificationService.notifyAffectedUsers('breach-1', ids, body, undefined, { emailSafetyMembers: true, counselConsulted: 'yes' as any, neutralSubject: 'Account security update' })
        ).rejects.toMatchObject({ statusCode: 400 });
        await expect(
          breachNotificationService.notifyAffectedUsers('breach-1', ids, body, undefined, { emailSafetyMembers: true, counselConsulted: true })
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/neutral subject/) });
        expect(sendEmailMock).not.toHaveBeenCalled();
      });

      it('is refused when the subject gives the game away', async () => {
        for (const neutralSubject of ['Your Safe Mode data was exposed', 'Domestic violence service breach', 'Data breach notice', 'Your details were leaked']) {
          await expect(
            breachNotificationService.notifyAffectedUsers('breach-1', ids, body, undefined, { ...approved, neutralSubject })
          ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/must not say what it is about/) });
        }
        expect(sendEmailMock).not.toHaveBeenCalled();
      });

      it('with counsel’s word, sends a neutral email under the approved subject, as well as the app notice', async () => {
        const outcome = await breachNotificationService.notifyAffectedUsers('breach-1', ids, body, undefined, approved);

        const toSafe = sendEmailMock.mock.calls.map((call: any[]) => call[0]).find((mail: any) => mail.to === 'safe@example.test');
        expect(toSafe.subject).toBe('Account security update');
        expect(toSafe.html).not.toContain('Security Team');
        expect(toSafe.html).not.toContain('Dear Rachel');
        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
        // The ordinary member's email is the general one.
        const toOrdinary = sendEmailMock.mock.calls.map((call: any[]) => call[0]).find((mail: any) => mail.to === 'ordinary@example.test');
        expect(toOrdinary.subject).toBe('Important Security Notice from ATHENA');
        expect(outcome).toMatchObject({ emailed: 2, inApp: 1, safetyMembersInAppOnly: 0, method: 'EMAIL+IN_APP' });
        expect(lastAudit().details).toMatchObject({ counselConsulted: true, neutralSubject: 'Account security update', safetyMembersEmailed: 1 });
      });

      it('escapes what it is given, so wording pasted in cannot become markup', async () => {
        prismaAny.user.findMany.mockResolvedValue([safeMode]);

        await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], '<script>x</script> details', undefined, approved);

        const mail = sendEmailMock.mock.calls[0][0];
        expect(mail.html).not.toContain('<script>');
        expect(mail.html).toContain('&lt;script&gt;');
      });

      it('an email that does not go to her is not a failure to tell her: she was told in the app', async () => {
        sendEmailMock.mockImplementation(async (mail: any) => mail.to !== 'safe@example.test');

        const outcome = await breachNotificationService.notifyAffectedUsers('breach-1', ids, body, undefined, approved);

        expect(outcome.failedUserIds).toEqual([]);
        expect(outcome).toMatchObject({ inApp: 1, safetyMembersInAppOnly: 1, emailed: 1 });
      });
    });

    describe('the words these members read', () => {
      it('are refused when they name Safe Mode, safety reports or violence, and the operator is told to write neutral ones', async () => {
        await expect(
          breachNotificationService.notifyAffectedUsers('breach-1', ids, 'Your Safe Mode settings were exposed.')
        ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/safetyNotificationContent/) });
        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(sendNotificationMock).not.toHaveBeenCalled();
      });

      it('can be written separately for them, and the general notice keeps its own wording', async () => {
        await breachNotificationService.notifyAffectedUsers('breach-1', ids, 'Your Safe Mode settings and reports were exposed.', undefined, {
          safetyNotificationContent: 'Some account details were readable for six hours. Please review your sign-in details.',
        });

        expect(sendNotificationMock.mock.calls[0][0].message).toContain('Please review your sign-in details');
        expect(sendNotificationMock.mock.calls[0][0].message).not.toContain('Safe Mode');
        expect(sendEmailMock.mock.calls[0][0].html).toContain('Safe Mode settings and reports');
      });

      it('are not checked when nobody in the list is in the safety group', async () => {
        prismaAny.user.findMany.mockResolvedValue([ordinary]);

        await breachNotificationService.notifyAffectedUsers('breach-1', ['user-ordinary'], 'Your Safe Mode settings were exposed.');

        expect(sendEmailMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('what is recorded', () => {
      it('says which channels were used, as EMAIL, IN_APP or both', async () => {
        await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);
        expect(lastUpdate().notificationMethod).toBe('EMAIL+IN_APP');
        expect(lastUpdate().usersNotifiedAt).toBeInstanceOf(Date);

        prismaAny.user.findMany.mockResolvedValue([safeMode]);
        await breachNotificationService.notifyAffectedUsers('breach-1', ['user-safe'], body);
        expect(lastUpdate().notificationMethod).toBe('IN_APP');

        prismaAny.user.findMany.mockResolvedValue([ordinary]);
        await breachNotificationService.notifyAffectedUsers('breach-1', ['user-ordinary'], body);
        expect(lastUpdate().notificationMethod).toBe('EMAIL');
      });

      it('writes counts to the privacy log and never a member id', async () => {
        await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);

        const log = lastAudit();
        expect(log.action).toBe('USERS_NOTIFIED_OF_BREACH');
        expect(log.details).toMatchObject({
          usersNotified: 2,
          method: 'EMAIL+IN_APP',
          channels: { email: 1, inApp: 1 },
          safetyMembers: 1,
          safetyMembersInAppOnly: 1,
          safetyMembersEmailed: 0,
          counselConsulted: false,
          notNotified: 0,
          recommendedStepsIncluded: true,
        });
        const written = JSON.stringify(log);
        expect(written).not.toContain('user-safe');
        expect(written).not.toContain('user-ordinary');
        expect(written).not.toContain('@example.test');
      });
    });

    describe('when something goes wrong', () => {
      it('sends nothing at all if it cannot tell who is in the safety group', async () => {
        prismaAny.contentReport.findMany.mockRejectedValue(new Error('connection reset'));

        await expect(breachNotificationService.notifyAffectedUsers('breach-1', ids, body)).rejects.toThrow('connection reset');

        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(sendNotificationMock).not.toHaveBeenCalled();
        expect(prismaAny.dataBreach.update).not.toHaveBeenCalled();
      });

      it('names the members it could not reach, by id, and still records those it did', async () => {
        sendEmailMock.mockImplementation(async (mail: any) => mail.to !== 'ordinary@example.test');
        prismaAny.user.findMany.mockResolvedValue([ordinary, safeMode, { ...safeMode, id: 'user-safe-2', email: 'safe2@example.test' }]);
        sendNotificationMock.mockImplementation(async (note: any) => {
          if (note.userId === 'user-safe-2') throw new Error('notification write failed');
          return {};
        });

        const outcome = await breachNotificationService.notifyAffectedUsers('breach-1', ['user-ordinary', 'user-safe', 'user-safe-2'], body);

        expect(outcome.failedUserIds.sort()).toEqual(['user-ordinary', 'user-safe-2']);
        expect(outcome).toMatchObject({ emailed: 0, inApp: 1, method: 'IN_APP' });
        expect(lastUpdate().notificationMethod).toBe('IN_APP');
        expect(lastAudit().details).toMatchObject({ usersNotified: 1, notNotified: 2 });
      });

      it('records nothing as sent when nobody could be reached', async () => {
        sendEmailMock.mockResolvedValue(false);
        prismaAny.user.findMany.mockResolvedValue([ordinary]);

        await expect(breachNotificationService.notifyAffectedUsers('breach-1', ['user-ordinary'], body)).rejects.toMatchObject({ statusCode: 502 });

        expect(prismaAny.dataBreach.update).not.toHaveBeenCalled();
        expect(prismaAny.privacyAuditLog.create).not.toHaveBeenCalled();
      });

      it('refuses ids that match no account, rather than reporting a notice that went to nobody', async () => {
        prismaAny.user.findMany.mockResolvedValue([]);

        await expect(breachNotificationService.notifyAffectedUsers('breach-1', ['nobody'], body)).rejects.toMatchObject({ statusCode: 400 });

        expect(prismaAny.dataBreach.update).not.toHaveBeenCalled();
      });
    });

    describe('the preview an operator sees first', () => {
      it('counts who will be emailed and who will be told in the app only, and sends nothing', async () => {
        const counts = await breachNotificationService.previewNoticeAudience([...ids, 'not-a-member']);

        expect(counts).toEqual({ requested: 3, found: 2, safetyMembers: 1, ordinaryMembers: 1 });
        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(sendNotificationMock).not.toHaveBeenCalled();
        expect(prismaAny.dataBreach.update).not.toHaveBeenCalled();
        expect(prismaAny.privacyAuditLog.create).not.toHaveBeenCalled();
      });
    });

    it('the link in the general email goes to a page that exists', async () => {
      process.env.CLIENT_URL = 'https://app.example.test/';
      await breachNotificationService.notifyAffectedUsers('breach-1', ids, body);

      expect(sendEmailMock.mock.calls[0][0].html).toContain('href="https://app.example.test/dashboard/settings/security"');
      delete process.env.CLIENT_URL;
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
