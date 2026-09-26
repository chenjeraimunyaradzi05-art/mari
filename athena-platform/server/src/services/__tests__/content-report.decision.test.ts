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
import { processReportById, reverseEnforcement } from '../content-report.service';

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

  // Ban runs the same lock as suspend — there is no ban record, no permanence
  // and nothing that stops a new registration — so what distinguishes it is
  // the record and what everybody is told. It used to tell the reporter the
  // account had been "removed" and "permanently banned".
  it('bans by locking the account, records it as a ban, and tells the reporter no more than that', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      evidence: { ticketId: 'RPT-X-1', contactEmail: 'reporter@example.org' },
    });

    const outcome = await processReportById('report-1', 'ban', 'moderator-1', 'Stalking across accounts');

    expect(prismaAny.user.update).toHaveBeenCalledWith({
      where: { id: 'reported-1' },
      data: { isSuspended: true },
    });
    expect(prismaAny.contentReport.update.mock.calls[0][0].data).toMatchObject({ status: 'RESOLVED', action: 'BAN' });
    expect(prismaAny.moderationLog.create.mock.calls[0][0].data).toMatchObject({ action: 'ban', ticketId: 'RPT-X-1' });
    expect(outcome.action).toBe('ban');

    const inApp = prismaAny.notification.create.mock.calls
      .map((call: any[]) => call[0].data)
      .find((data: any) => data.userId === 'reporter-1');
    expect(inApp.message).toContain('banned');
    expect(inApp.message).not.toMatch(/removed the account|permanent/i);

    const email = sendEmailMock.mock.calls.map((call: any[]) => call[0]).find((mail: any) => mail.to === 'reporter@example.org');
    expect(email.html).toContain('banned the account');
    expect(email.html).not.toMatch(/permanent/i);
  });
});

/**
 * Appeal reversal. appeal.routes.test.ts approves an appeal that is not a
 * reversible type, so the undo path itself had no test: what it lifts, what it
 * restores, and what it admits it cannot bring back.
 */
describe('Reversing enforcement on a successful appeal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.post.updateMany = jest.fn(async () => ({ count: 1 }));
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
  });

  it('lifts the suspension, restores hidden content and clears the report', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, status: 'RESOLVED', action: 'BAN' });
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: true });

    const result = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });

    expect(result).toEqual({ suspensionLifted: true, contentRestored: true, reportCleared: true });
    expect(prismaAny.user.update).toHaveBeenCalledWith({ where: { id: 'reported-1' }, data: { isSuspended: false } });
    expect(prismaAny.post.updateMany).toHaveBeenCalledWith({ where: { id: 'post-1' }, data: { isHidden: false } });
    expect(prismaAny.contentReport.update.mock.calls[0][0].data).toMatchObject({
      status: 'DISMISSED',
      action: 'NO_ACTION',
    });
  });

  it('does not claim to have lifted a suspension that was not there', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'POST', contentId: 'post-1' });

    expect(result.suspensionLifted).toBe(false);
    expect(prismaAny.user.update).not.toHaveBeenCalled();
    expect(result.contentRestored).toBe(true);
    expect(result.reportCleared).toBe(false);
  });

  it('says a deleted message could not be restored rather than pretending it was', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'MESSAGE', contentId: 'msg-1' });

    expect(result.contentRestored).toBe(false);
  });
});
