/**
 * What happens when a moderator decides a report.
 *
 * This is the code that hides content and suspends accounts, and nothing tested
 * it. The hole it was hiding: the reporter was never told anything. The outcome
 * notification sat behind `if (ticketId && evidence?.contactEmail)`, and both of
 * those keys were only ever written by submitContentReport, the legacy path with
 * no production callers — so for every report that actually exists in the
 * database the branch never ran. A woman reported harassment, a moderator
 * suspended the account, and she heard nothing, while the member she reported
 * got a notification.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findUnique: jest.fn(), update: jest.fn() },
    moderationLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    post: { update: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/ops-metrics', () => ({
  recordFailure: jest.fn(),
}));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { processReportById } from '../content-report.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as jest.Mock;

const REPORT = {
  id: 'report-1',
  reporterId: 'reporter-1',
  reportedUserId: 'reported-1',
  contentType: 'POST',
  contentId: 'post-1',
  reason: 'HARASSMENT',
  description: 'She posted my address',
  status: 'PENDING',
  evidence: null as unknown,
};

describe('Deciding a report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT });
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
    prismaAny.moderationLog.create.mockResolvedValue({ id: 'log-1' });
    prismaAny.notification.create.mockResolvedValue({ id: 'notification-1' });
    prismaAny.user.findUnique.mockResolvedValue({ id: 'reporter-1' });
    prismaAny.user.update.mockResolvedValue({ id: 'reported-1' });
    prismaAny.post.update.mockResolvedValue({ id: 'post-1' });
  });

  it('tells the reporter the outcome even though her report carries no ticket and no email', async () => {
    const outcome = await processReportById('report-1', 'suspend', 'moderator-1', 'Repeated abuse');

    expect(outcome.status).toBe('RESOLVED');
    const notified = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data);
    const toReporter = notified.find((data: any) => data.userId === 'reporter-1');
    expect(toReporter).toBeDefined();
    expect(toReporter.message).toContain('suspended');
    expect(toReporter.data.reference).toBe('report-1');
  });

  it('emails the reporter as well when she left an address, because she may have no account', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      evidence: { ticketId: 'RPT-ABC-1234', contactEmail: 'reporter@example.test' },
    });

    await processReportById('report-1', 'remove', 'moderator-1');

    const recipients = sendEmailMock.mock.calls.map((call: any[]) => call[0].to);
    expect(recipients).toContain('reporter@example.test');
    const subjects = sendEmailMock.mock.calls.map((call: any[]) => call[0].subject);
    expect(subjects.some((subject: string) => subject.includes('RPT-ABC-1234'))).toBe(true);
  });

  it('does not invent a reporter when the legacy path wrote a placeholder id', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      reporterId: 'system-anonymous',
    });
    prismaAny.user.findUnique.mockResolvedValue(null);

    await processReportById('report-1', 'dismiss', 'moderator-1');

    const notified = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data);
    expect(notified.some((data: any) => data.userId === 'system-anonymous')).toBe(false);
  });

  it('still applies the enforcement when the reporter cannot be told', async () => {
    prismaAny.notification.create.mockRejectedValue(new Error('notification table is down'));

    const outcome = await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { isHidden: true },
    });
    expect(outcome.action).toBe('remove');
  });
});
