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
    bannedIdentity: { upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));

process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';

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
    prismaAny.user.update.mockResolvedValue({ id: 'reported-1', email: 'reported@example.org' });
    prismaAny.post.update.mockResolvedValue({ id: 'post-1' });
    prismaAny.bannedIdentity.upsert.mockResolvedValue({ id: 'ban-1' });
  });

  it('records why, when and by whom an account was suspended', async () => {
    await processReportById('report-1', 'suspend', 'moderator-1', 'Repeated abuse');

    const data = prismaAny.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ isSuspended: true, suspensionReason: 'Repeated abuse', suspendedById: 'moderator-1' });
    expect(data.suspendedAt).toBeInstanceOf(Date);
    // A suspension is not a ban, and does not bar the address.
    expect(data.bannedAt).toBeUndefined();
    expect(prismaAny.bannedIdentity.upsert).not.toHaveBeenCalled();
  });

  it('gives a suspension without notes the report it was decided on as its reason', async () => {
    await processReportById('report-1', 'suspend', 'moderator-1');

    expect(prismaAny.user.update.mock.calls[0][0].data.suspensionReason).toBe(
      'Decided on a post report for harassment, with no notes'
    );
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

  // A ban locks the account, marks it banned, and bars the address from
  // registering again. It still does not remove the account, and an upheld
  // appeal can lift it, so the reporter is told no more than that. It used to
  // tell her the account had been "removed" and "permanently banned".
  it('bans the account and the address, records it as a ban, and tells the reporter no more than that', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      evidence: { ticketId: 'RPT-X-1', contactEmail: 'reporter@example.org' },
    });

    const outcome = await processReportById('report-1', 'ban', 'moderator-1', 'Stalking across accounts');

    const lock = prismaAny.user.update.mock.calls[0][0];
    expect(lock.where).toEqual({ id: 'reported-1' });
    expect(lock.data).toMatchObject({
      isSuspended: true,
      banReason: 'Stalking across accounts',
      bannedById: 'moderator-1',
      suspensionReason: 'Stalking across accounts',
    });
    expect(lock.data.bannedAt).toBeInstanceOf(Date);

    const identity = prismaAny.bannedIdentity.upsert.mock.calls[0][0];
    expect(identity.create).toMatchObject({ userId: 'reported-1', reportId: 'report-1', createdById: 'moderator-1' });
    // Kept as a keyed hash of the address, never the address itself.
    expect(JSON.stringify(identity)).not.toContain('example.org');
    expect(outcome.banIdentityRecorded).toBe(true);

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

  it('keeps the ban on the account and tells the moderator when the address could not be barred', async () => {
    prismaAny.bannedIdentity.upsert.mockRejectedValue(new Error('database refused'));

    const outcome = await processReportById('report-1', 'ban', 'moderator-1', 'Stalking across accounts');

    expect(prismaAny.user.update.mock.calls[0][0].data.bannedAt).toBeInstanceOf(Date);
    expect(outcome.banIdentityRecorded).toBe(false);
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

    expect(result).toEqual({
      suspensionLifted: true,
      banLifted: false,
      banKept: false,
      contentRestored: true,
      reportCleared: true,
    });
    expect(prismaAny.user.update).toHaveBeenCalledWith({
      where: { id: 'reported-1' },
      data: { isSuspended: false, suspensionReason: null, suspendedAt: null, suspendedById: null },
    });
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

  it('lifts a ban, and the bar on the address, only when the appeal was about the ban', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: true, bannedAt: new Date() });
    prismaAny.bannedIdentity.deleteMany.mockResolvedValue({ count: 1 });

    const kept = await reverseEnforcement({ userId: 'reported-1' });
    expect(kept).toMatchObject({ suspensionLifted: false, banLifted: false, banKept: true });
    expect(prismaAny.user.update).not.toHaveBeenCalled();

    const lifted = await reverseEnforcement({ userId: 'reported-1', liftBan: true });
    expect(lifted).toMatchObject({ suspensionLifted: true, banLifted: true, banKept: false });
    expect(prismaAny.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: false, bannedAt: null, banReason: null });
    expect(prismaAny.bannedIdentity.deleteMany).toHaveBeenCalledWith({ where: { userId: 'reported-1' } });
  });

  it('leaves the report that recorded a ban alone while the ban stands', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, status: 'RESOLVED', action: 'BAN' });
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: true, bannedAt: new Date() });

    const result = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });

    expect(result.reportCleared).toBe(false);
    expect(prismaAny.contentReport.update).not.toHaveBeenCalled();
  });

  it('says a deleted message could not be restored rather than pretending it was', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'MESSAGE', contentId: 'msg-1' });

    expect(result.contentRestored).toBe(false);
  });
});
