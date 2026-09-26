import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Reports filed without an account are SafetyIncident rows, and nothing read
// them back: no route, no page, no worker. These tests hold the reader and the
// decision path that closed that, because the surface they cover is the one the
// Online Safety Act cares most about.

jest.mock('../../utils/prisma', () => ({
  prisma: {
    safetyIncident: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(),
      count: jest.fn(async () => 0),
      update: jest.fn(),
    },
    user: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null), update: jest.fn() },
    post: { update: jest.fn() },
    moderationLog: { create: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { sendEmail as sendEmailTyped } from '../../utils/email';
import {
  listAnonymousReports,
  getAnonymousReport,
  resolveAnonymousReport,
} from '../content-report.service';

const prisma: any = prismaTyped;
const sendEmail = sendEmailTyped as unknown as jest.Mock<(...args: any[]) => Promise<boolean>>;

const REPORTED = 'reported-user-1';
const MODERATOR = 'moderator-1';

const incident = (overrides: Record<string, unknown> = {}) => ({
  id: 'inc-1',
  userId: REPORTED,
  type: 'USER_REPORT',
  severity: 'HIGH',
  reason: 'HARASSMENT',
  reporterId: null,
  contentId: 'post-1',
  contentType: 'POST',
  verified: false,
  resolvedAt: null,
  resolvedById: null,
  metadata: {
    description: 'He posted my address',
    reviewDeadline: '2026-09-25T00:00:00.000Z',
    source: 'ONLINE_SAFETY_REPORT',
    anonymous: true,
  },
  createdAt: new Date('2026-09-23T01:00:00.000Z'),
  updatedAt: new Date('2026-09-23T01:00:00.000Z'),
  ...overrides,
});

describe('Anonymous reports reach a moderator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.safetyIncident.findMany.mockResolvedValue([incident()]);
    prisma.safetyIncident.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      {
        id: REPORTED,
        firstName: 'Ada',
        lastName: 'Rowe',
        displayName: 'Ada',
        email: 'ada@athena.com',
        isSuspended: false,
      },
    ]);
  });

  it('lists only anonymous reports, with the account they are about', async () => {
    const result = await listAnonymousReports({ status: 'PENDING' });

    const where = prisma.safetyIncident.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      type: 'USER_REPORT',
      metadata: { path: ['anonymous'], equals: true },
      resolvedAt: null,
    });
    // The open queue is read oldest first and then put in deadline order.
    expect(prisma.safetyIncident.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' });

    expect(result.reports[0]).toMatchObject({
      id: 'inc-1',
      anonymous: true,
      status: 'PENDING',
      contentType: 'POST',
      description: 'He posted my address',
      reviewDeadline: '2026-09-25T00:00:00.000Z',
      reportedUser: { id: REPORTED, email: 'ada@athena.com' },
    });
    expect(result.openCount).toBe(1);
  });

  it('works the open queue by review deadline, not by arrival, and says which are late', async () => {
    // A harassment report from yesterday (48-hour clock) and a CSAM report from
    // this morning (24-hour clock, stamped): the second is due first.
    const yesterday = new Date(Date.now() - 20 * 60 * 60 * 1000);
    const thisMorning = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prisma.safetyIncident.findMany.mockResolvedValue([
      incident({ id: 'harassment', reason: 'HARASSMENT', createdAt: yesterday, metadata: { anonymous: true } }),
      incident({
        id: 'csam',
        reason: 'CSAM',
        createdAt: thisMorning,
        metadata: { anonymous: true, reviewDeadline: new Date(thisMorning.getTime() + 24 * 3600 * 1000).toISOString() },
      }),
      incident({
        id: 'late',
        reason: 'SPAM',
        createdAt: new Date(Date.now() - 72 * 3600 * 1000),
        metadata: { anonymous: true },
      }),
    ]);

    const result = await listAnonymousReports({ status: 'PENDING' });

    expect(result.reports.map((report) => report.id)).toEqual(['late', 'csam', 'harassment']);
    expect(result.reports[0].overdue).toBe(true);
    expect(result.reports[1].overdue).toBe(false);
    // A row with no stamped deadline is given the one its reason runs on.
    expect(new Date(result.reports[2].reviewDeadline!).getTime()).toBe(yesterday.getTime() + 48 * 3600 * 1000);
  });

  it('writes the outcome to an anonymous reporter who left an address', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({
        metadata: {
          anonymous: true,
          ticketId: 'RPT-ABC-1234',
          contactEmail: 'reporter@example.org',
          description: 'He posted my address',
        },
      })
    );

    const outcome = await resolveAnonymousReport('inc-1', 'remove', MODERATOR);

    const mail = sendEmail.mock.calls.map((call: any[]) => call[0]);
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toBe('reporter@example.org');
    // She is given back the reference her acknowledgment quoted.
    expect(mail[0].subject).toContain('RPT-ABC-1234');
    expect(mail[0].html).toContain('removed the reported content');
    expect(outcome.ticketId).toBe('RPT-ABC-1234');
  });

  it('never tells a reporter an account was removed for good when it was banned', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({ metadata: { anonymous: true, contactEmail: 'reporter@example.org' } })
    );

    await resolveAnonymousReport('inc-1', 'ban', MODERATOR);

    const html = String((sendEmail.mock.calls[0][0] as { html: string }).html);
    expect(html).toContain('banned the account');
    expect(html).not.toMatch(/permanent/i);
  });

  it('a bounced outcome email does not undo or fail the decision', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({ metadata: { anonymous: true, contactEmail: 'reporter@example.org' } })
    );
    sendEmail.mockRejectedValueOnce(new Error('mailbox full'));

    const outcome = await resolveAnonymousReport('inc-1', 'warn', MODERATOR);

    expect(outcome.status).toBe('RESOLVED');
    expect(prisma.safetyIncident.update).toHaveBeenCalled();
  });

  it('sends nothing when the reporter left no address', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(incident());

    await resolveAnonymousReport('inc-1', 'dismiss', MODERATOR);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('reads an actioned report back with the outcome the decision wrote', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({
        resolvedAt: new Date('2026-09-23T04:00:00.000Z'),
        resolvedById: MODERATOR,
        metadata: {
          anonymous: true,
          status: 'RESOLVED',
          action: 'CONTENT_REMOVED',
          reviewNotes: 'Address removed',
        },
      })
    );

    const report = await getAnonymousReport('inc-1');

    expect(report).toMatchObject({
      status: 'RESOLVED',
      action: 'CONTENT_REMOVED',
      reviewNotes: 'Address removed',
      reviewerId: MODERATOR,
    });
  });

  it('removing on an anonymous report hides the content and records who decided it', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(incident());

    const outcome = await resolveAnonymousReport('inc-1', 'remove', MODERATOR, 'Doxxing');

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { isHidden: true },
    });

    const update = prisma.safetyIncident.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'inc-1' });
    expect(update.data.resolvedById).toBe(MODERATOR);
    expect(update.data.resolvedAt).toBeInstanceOf(Date);
    expect(update.data.verified).toBe(true);
    expect(update.data.metadata).toMatchObject({
      status: 'RESOLVED',
      action: 'CONTENT_REMOVED',
      reviewNotes: 'Doxxing',
      moderatorId: MODERATOR,
      // The report's own details survive the decision.
      source: 'ONLINE_SAFETY_REPORT',
    });

    expect(prisma.moderationLog.create.mock.calls[0][0].data).toMatchObject({
      ticketId: 'inc-1',
      action: 'remove',
      moderatorId: MODERATOR,
    });

    expect(outcome).toMatchObject({
      reportId: 'inc-1',
      ticketId: null,
      status: 'RESOLVED',
      reportedUserId: REPORTED,
    });
  });

  it('a dismissal is not a verification', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(incident());

    await resolveAnonymousReport('inc-1', 'dismiss', MODERATOR);

    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.safetyIncident.update.mock.calls[0][0].data.verified).toBe(false);
    expect(prisma.safetyIncident.update.mock.calls[0][0].data.metadata).toMatchObject({
      status: 'DISMISSED',
      action: 'NO_ACTION',
    });
  });

  it('refuses a second decision on a report that has already been actioned', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(
      incident({ resolvedAt: new Date(), resolvedById: MODERATOR })
    );

    await expect(resolveAnonymousReport('inc-1', 'ban', 'moderator-2')).rejects.toThrow(
      'Report has already been actioned'
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('will not action an incident that is not an anonymous report', async () => {
    prisma.safetyIncident.findFirst.mockResolvedValue(null);

    await expect(resolveAnonymousReport('inc-9', 'remove', MODERATOR)).rejects.toThrow(
      'Report not found'
    );

    expect(prisma.safetyIncident.findFirst.mock.calls[0][0].where).toMatchObject({
      type: 'USER_REPORT',
      metadata: { path: ['anonymous'], equals: true },
      id: 'inc-9',
    });
  });
});
