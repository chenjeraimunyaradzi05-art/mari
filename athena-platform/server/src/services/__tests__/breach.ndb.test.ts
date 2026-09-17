jest.mock('../../utils/prisma', () => ({
  prisma: {
    dataBreach: {
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'breach-1', ...data })),
      findMany: jest.fn(async () => []),
    },
    privacyAuditLog: {
      create: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../email.service', () => ({
  sendEmail: jest.fn(async () => true),
}));

import { prisma } from '../../utils/prisma';
import { breachNotificationService } from '../breach.service';

const prismaAny: any = prisma;

const AWARE_AT = new Date('2026-09-17T00:00:00.000Z');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The data passed to the last dataBreach.update call. */
const lastUpdate = () => prismaAny.dataBreach.update.mock.calls.at(-1)[0].data;

describe('Notifiable Data Breaches scheme', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gives thirty days from awareness to finish the assessment', async () => {
    await breachNotificationService.beginNdbAssessment('breach-1', AWARE_AT);

    const data = lastUpdate();
    expect(data.jurisdiction).toBe('AU');
    expect(data.assessmentComplete).toBe(false);
    expect((data.assessmentDueAt as Date).getTime()).toBe(AWARE_AT.getTime() + THIRTY_DAYS_MS);
  });

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

  it('looks only at Australian assessments that are still open', async () => {
    await breachNotificationService.getNdbAssessmentsDue(7, AWARE_AT);

    const where = prismaAny.dataBreach.findMany.mock.calls.at(-1)[0].where;
    expect(where.jurisdiction).toBe('AU');
    expect(where.assessmentComplete).toBe(false);
    expect(where.assessmentDueAt.lte.getTime()).toBe(AWARE_AT.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
});
