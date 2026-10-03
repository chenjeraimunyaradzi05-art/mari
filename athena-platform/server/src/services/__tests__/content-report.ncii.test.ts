/**
 * An intimate image shared without consent, and a threat to hurt someone.
 *
 * Neither had a name on either door into the report queue, so a woman reporting
 * one had to guess "sexual content" or "violence" and was filed at high priority
 * on the 48-hour clock. They are critical on the 24-hour illegal-content clock
 * now, a person is asked to open them within four hours, an intimate image is
 * queued for the eSafety Commissioner, and the published transparency report
 * counts them as illegal content. Hiding the content on one report is in
 * moderation-threshold.test.ts; the doors that file them are in
 * compliance.report-severe.test.ts and safety.reports-incidents.test.ts.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    authorityEscalation: { create: jest.fn() },
    contentReport: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
    safetyIncident: { findMany: jest.fn() },
    moderationLog: { findFirst: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    post: { updateMany: jest.fn() },
    video: { updateMany: jest.fn() },
    comment: { updateMany: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));
jest.mock('../admin-notify.service', () => ({ notifyAdmins: jest.fn(async () => 1) }));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { notifyAdmins } from '../admin-notify.service';
import {
  AUTHORITY_REPORTABLE_REASONS,
  CRITICAL_FIRST_LOOK_HOURS,
  alertOverdueReports,
  compileTransparencyReport,
  isReportableReason,
  openReportIntake,
  processReportById,
  reportPriorityFor,
  reviewHoursFor,
  runReportIntakeConsequences,
} from '../content-report.service';
import { IMMEDIATE_HIDE_ACTION } from '../moderation-threshold.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as jest.Mock;
const HOUR = 60 * 60 * 1000;

describe.each(['intimate_image', 'threat'])('%s as a reason', (reason) => {
  it('is one a report may be filed under', () => {
    expect(isReportableReason(reason)).toBe(true);
    expect(isReportableReason(reason.toUpperCase())).toBe(true);
  });

  it('is critical, however it is filed', () => {
    expect(reportPriorityFor(reason)).toBe('critical');
    expect(reportPriorityFor(reason, true)).toBe('critical');
  });

  it('runs on the 24-hour illegal-content clock, not the 48-hour one for harmful content', () => {
    expect(reviewHoursFor(reason)).toBe(24);
    expect(reviewHoursFor('harassment')).toBe(48);
  });

  it('stamps a deadline 24 hours out, and a queue priority of URGENT', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');

    const intake = openReportIntake({ reason, now });

    expect(intake.priority).toBe('critical');
    expect(intake.priorityLevel).toBe('URGENT');
    expect(intake.reviewHours).toBe(24);
    expect(intake.reviewDeadline.toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });
});

describe('the intake consequences of a critical report', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.authorityEscalation.create.mockResolvedValue({ id: 'esc-1' });
    process.env.TRUST_SAFETY_EMAIL = 'trust-safety@athena.test';
    process.env.AUTHORITY_ESCALATION_EMAIL = 'referrals@athena.test';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  const file = (reason: string) => {
    const intake = openReportIntake({ reason });
    return runReportIntakeConsequences({
      ticketId: intake.ticketId,
      reason,
      priority: intake.priority,
      reviewHours: intake.reviewHours,
      contentType: 'POST',
      contentId: 'post-1',
      description: 'It is a picture of me',
    });
  };

  it('names the four-hour target in the alert to Trust & Safety, inside the 24 hours the reporter was given', async () => {
    await file('intimate_image');

    const alert = sendEmailMock.mock.calls.map((call) => call[0]).find((mail) => mail.to === 'trust-safety@athena.test');
    expect(alert.subject).toContain('[CRITICAL]');
    expect(alert.html).toContain(`within ${CRITICAL_FIRST_LOOK_HOURS} hours of it being filed`);
    expect(alert.html).toContain('24 hours');
  });

  it('does not set the four-hour target on a report that is high but not critical', async () => {
    await file('illegal');

    const alert = sendEmailMock.mock.calls.map((call) => call[0]).find((mail) => mail.to === 'trust-safety@athena.test');
    expect(alert.subject).toContain('[HIGH]');
    expect(alert.html).not.toContain('hours of it being filed');
  });

  it('queues an intimate image for the eSafety Commissioner, and tells the referral desk what is different about it', async () => {
    expect(AUTHORITY_REPORTABLE_REASONS).toContain('intimate_image');

    await file('intimate_image');

    expect(prismaAny.authorityEscalation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'intimate_image', reportedTo: 'eSafety Commissioner', status: 'reported' }),
    });
    const desk = sendEmailMock.mock.calls.map((call) => call[0]).find((mail) => mail.to === 'referrals@athena.test');
    expect(desk.subject).toContain('[AUTHORITY REFERRAL REQUIRED]');
    expect(desk.html).toContain('eSafety Commissioner');
    expect(desk.html).toContain('intimate image reported as shared without consent');
    expect(desk.html).toContain('Do not open, copy or forward the image itself');
  });

  it('does not queue a referral for every threat: whether one is credible is for a person to decide, under the runbook', async () => {
    await file('threat');

    expect(prismaAny.authorityEscalation.create).not.toHaveBeenCalled();
  });

  it('still alerts Trust & Safety about a threat, as a critical report', async () => {
    await file('threat');

    const alert = sendEmailMock.mock.calls.map((call) => call[0]).find((mail) => mail.to === 'trust-safety@athena.test');
    expect(alert.subject).toContain('[CRITICAL]');
  });
});

describe('the sweep holds a critical report to the four-hour target, not only to its deadline', () => {
  const NOW = new Date('2026-10-01T12:00:00.000Z');
  const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRUST_SAFETY_EMAIL = 'trust-safety@athena.test';
    prismaAny.contentReport.update.mockResolvedValue({});
    prismaAny.contentReport.count.mockResolvedValue(0);
    prismaAny.safetyIncident.findMany.mockResolvedValue([]);
  });

  const answers = (unopened: unknown[]) =>
    prismaAny.contentReport.findMany.mockImplementation(async (args: any) => {
      if (args.where?.priority === 'URGENT') return unopened;
      return [];
    });

  it('asks for critical reports still waiting for a person after four hours, inside their 24', async () => {
    answers([]);

    await alertOverdueReports(NOW);

    const asked = prismaAny.contentReport.findMany.mock.calls.find((call: any[]) => call[0].where?.priority === 'URGENT')[0];
    expect(asked.where).toEqual({
      // Not only PENDING: a report that hid its post at once is REVIEWING with no
      // moderator behind it, and is the one the target is for.
      status: { in: ['PENDING', 'REVIEWING'] },
      reviewerId: null,
      priority: 'URGENT',
      createdAt: { lt: new Date(NOW.getTime() - CRITICAL_FIRST_LOOK_HOURS * HOUR) },
      reviewDeadline: { gte: NOW },
    });
  });

  it('alerts when one has sat unopened past four hours, saying so, though its 24 hours have not run out', async () => {
    answers([{ id: 'r1', createdAt: ago(6), reason: 'intimate_image', reviewDeadline: new Date(NOW.getTime() + 18 * HOUR), evidence: { ticketId: 'RPT-IMG' } }]);

    const result = await alertOverdueReports(NOW);

    expect(result).toEqual({ overdue: 1, alerted: true });
    const mail = sendEmailMock.mock.calls[0][0];
    expect(mail.html).toContain('RPT-IMG');
    expect(mail.html).toContain('critical, not yet opened');
    expect(mail.html).toContain('2 hours late');
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ link: '/admin/moderation' }));
  });

  it('stays quiet when no critical report is waiting', async () => {
    answers([]);

    await expect(alertOverdueReports(NOW)).resolves.toEqual({ overdue: 0, alerted: false });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

/**
 * Content hidden on one report is only safe to hide on one report if the report
 * being wrong costs the author a few hours and not her post. The dismissal is
 * what puts it back.
 */
describe('dismissing the report that hid something', () => {
  const REPORT = {
    id: 'report-1',
    reporterId: 'reporter-1',
    reportedUserId: 'author-1',
    contentType: 'POST',
    contentId: 'post-1',
    reason: 'intimate_image',
    description: null,
    status: 'REVIEWING',
    evidence: { ticketId: 'RPT-HID' } as unknown,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT });
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
    prismaAny.contentReport.count.mockResolvedValue(0);
    // The other reports about the same content: none, until a test adds one.
    prismaAny.contentReport.findMany.mockResolvedValue([]);
    prismaAny.moderationLog.create.mockResolvedValue({ id: 'log-1' });
    prismaAny.moderationLog.findFirst.mockResolvedValue({ id: 'hid-1' });
    prismaAny.notification.create.mockResolvedValue({ id: 'n-1' });
    prismaAny.user.findUnique.mockResolvedValue({ id: 'reporter-1' });
    prismaAny.post.updateMany.mockResolvedValue({ count: 1 });
    prismaAny.video.updateMany.mockResolvedValue({ count: 1 });
    prismaAny.comment.updateMany.mockResolvedValue({ count: 1 });
  });

  it('puts the post back, and tells its author, when this report is the one that hid it and nothing else is waiting', async () => {
    await processReportById('report-1', 'dismiss', 'moderator-1', 'Not what was reported');

    expect(prismaAny.moderationLog.findFirst).toHaveBeenCalledWith({
      where: { ticketId: { in: ['RPT-HID'] }, action: IMMEDIATE_HIDE_ACTION },
      select: { id: true },
    });
    expect(prismaAny.post.updateMany).toHaveBeenCalledWith({ where: { id: 'post-1' }, data: { isHidden: false } });
    const told = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data).find((data: any) => data.userId === 'author-1');
    expect(told).toMatchObject({ type: 'SYSTEM', title: 'Your content is back' });
    expect(told.message).toContain('put your post back');
    expect(JSON.stringify(told)).not.toContain('reporter-1');
  });

  it.each([
    ['VIDEO', 'video', 'reel'],
    ['COMMENT', 'comment', 'comment'],
  ])('puts a %s back the same way', async (type, model, noun) => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: type, contentId: 'c-1' });

    await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(prismaAny[model].updateMany).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { isHidden: false } });
    const told = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data).find((data: any) => data.userId === 'author-1');
    expect(told.message).toContain(noun);
  });

  it('leaves it hidden when another report about the same content is still waiting for a person', async () => {
    prismaAny.contentReport.findMany.mockResolvedValue([{ status: 'REVIEWING', evidence: { ticketId: 'RPT-OTHER' } }]);

    await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(prismaAny.contentReport.findMany).toHaveBeenCalledWith({
      where: { contentType: 'POST', contentId: 'post-1', id: { not: 'report-1' } },
      select: { status: true, evidence: true },
    });
    expect(prismaAny.post.updateMany).not.toHaveBeenCalled();
  });

  it.each(['RESOLVED'])(
    'leaves it removed when a moderator has already decided against it on another report: dismissing the duplicate that hid it must not undo the removal (%s)',
    async (status) => {
      prismaAny.contentReport.findMany.mockResolvedValue([{ status, evidence: { ticketId: 'RPT-SECOND' } }]);

      await processReportById('report-1', 'dismiss', 'moderator-1', 'Duplicate of the other report');

      expect(prismaAny.post.updateMany).not.toHaveBeenCalled();
      // The dismissal itself is still recorded and the reporter still told.
      expect(prismaAny.moderationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'dismiss' }) })
      );
    }
  );

  it('puts it back when the report that hid it was dismissed first, while another was open, and the last of them is dismissed now', async () => {
    // This report did not hide anything; an earlier one did, and was dismissed.
    prismaAny.contentReport.findMany.mockResolvedValue([{ status: 'DISMISSED', evidence: { ticketId: 'RPT-EARLIER' } }]);
    prismaAny.moderationLog.findFirst.mockResolvedValue({ id: 'hid-earlier' });

    await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(prismaAny.moderationLog.findFirst).toHaveBeenCalledWith({
      where: { ticketId: { in: ['RPT-HID', 'RPT-EARLIER'] }, action: IMMEDIATE_HIDE_ACTION },
      select: { id: true },
    });
    expect(prismaAny.post.updateMany).toHaveBeenCalledWith({ where: { id: 'post-1' }, data: { isHidden: false } });
  });

  it('leaves it hidden when this report did not hide it: an earlier removal, or three reporters adding up, are not undone by a different report being wrong', async () => {
    prismaAny.moderationLog.findFirst.mockResolvedValue(null);

    await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(prismaAny.post.updateMany).not.toHaveBeenCalled();
  });

  it('does not put anything back on a decision that is not a dismissal', async () => {
    await processReportById('report-1', 'warn', 'moderator-1');

    expect(prismaAny.moderationLog.findFirst).not.toHaveBeenCalled();
    expect(prismaAny.post.updateMany).not.toHaveBeenCalled();
  });

  it('still records the dismissal when the restore cannot be made', async () => {
    prismaAny.post.updateMany.mockRejectedValue(new Error('database unavailable'));

    const outcome = await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(outcome).toMatchObject({ status: 'DISMISSED', action: 'dismiss' });
    expect(prismaAny.moderationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'dismiss' }) })
    );
  });

  it('does nothing about a report with no reference, or about content that was never hidden by a report', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, evidence: null });
    await processReportById('report-1', 'dismiss', 'moderator-1');
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'MESSAGE' });
    await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(prismaAny.moderationLog.findFirst).not.toHaveBeenCalled();
    expect(prismaAny.post.updateMany).not.toHaveBeenCalled();
  });
});

describe('the published transparency report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts both as illegal content, so the published categories stay the ones the page has labels for and the totals still add up', async () => {
    const inQuarter = new Date('2026-08-01T00:00:00.000Z');
    prismaAny.contentReport.findMany.mockResolvedValue([
      { reason: 'intimate_image', createdAt: inQuarter, actionTakenAt: null },
      { reason: 'THREAT', createdAt: inQuarter, actionTakenAt: null },
      { reason: 'illegal', createdAt: inQuarter, actionTakenAt: null },
      { reason: 'harassment', createdAt: inQuarter, actionTakenAt: null },
    ]);
    prismaAny.safetyIncident.findMany.mockResolvedValue([]);
    prismaAny.moderationLog.groupBy = jest.fn(async () => []);
    prismaAny.appeal = { groupBy: jest.fn(async () => []) };

    const report = await compileTransparencyReport('Q3_2026', new Date('2026-10-02T00:00:00.000Z'));

    expect(report.reportsByCategory.illegal).toBe(3);
    expect(report.reportsByCategory.harassment).toBe(1);
    expect(report.reportsByCategory).not.toHaveProperty('intimate_image');
    expect(report.reportsByCategory).not.toHaveProperty('threat');
    expect(Object.values(report.reportsByCategory).reduce((sum, n) => sum + n, 0)).toBe(report.totalReports);
  });
});
