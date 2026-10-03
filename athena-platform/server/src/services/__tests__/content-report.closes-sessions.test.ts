/**
 * Closing an account, from a report decision, ends its sessions.
 *
 * suspendAccount and banAccount set columns and stopped there. The REST API
 * reads those columns on every request, so she was refused on her next call;
 * but her session rows stayed live and a socket authenticates only at the
 * handshake, so a member banned for threatening someone kept the connections she
 * already had open, delivering and accepting messages, until they dropped.
 * Both now revoke every session of the account, which announces it, and the
 * socket service closes the connections on them.
 *
 * The session service and the announcement are real here; only the database is
 * stood in for.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findUnique: jest.fn(), update: jest.fn() },
    moderationLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    session: { updateMany: jest.fn() },
    bannedIdentity: { upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));

process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

import { prisma } from '../../utils/prisma';
import { sessionEvents } from '../../utils/session-events';
import { banAccount, processReportById, suspendAccount } from '../content-report.service';

const prismaAny: any = prisma;

let announced: Array<{ userId: string; reason: string }> = [];

beforeEach(() => {
  jest.clearAllMocks();
  announced = [];
  sessionEvents.removeAllListeners('revoked');
  sessionEvents.onRevoked((event) => announced.push({ userId: event.userId, reason: event.reason }));

  prismaAny.user.update.mockResolvedValue({ id: 'reported-1', email: 'reported@example.org' });
  prismaAny.session.updateMany.mockResolvedValue({ count: 2 });
  prismaAny.bannedIdentity.upsert.mockResolvedValue({ id: 'ban-1' });
});

afterEach(() => {
  sessionEvents.removeAllListeners('revoked');
});

function expectEveryLiveSessionEnded(userId: string) {
  expect(prismaAny.session.updateMany).toHaveBeenCalledTimes(1);
  const call = prismaAny.session.updateMany.mock.calls[0][0];
  expect(call.where).toEqual({ userId, revokedAt: null });
  expect(call.data.revokedAt).toBeInstanceOf(Date);
}

describe('suspendAccount', () => {
  it('locks the account, then ends every session of it and says why', async () => {
    await suspendAccount('reported-1', { moderatorId: 'moderator-1', reason: 'Repeated abuse' });

    expect(prismaAny.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: true, suspendedById: 'moderator-1' });
    expectEveryLiveSessionEnded('reported-1');
    expect(announced).toEqual([{ userId: 'reported-1', reason: 'suspended' }]);
    // The lock is written before the sessions are touched: it is what refuses her.
    expect(prismaAny.user.update.mock.invocationCallOrder[0]).toBeLessThan(
      prismaAny.session.updateMany.mock.invocationCallOrder[0]
    );
  });

  it('is not undone, and does not throw, when the sessions could not be ended', async () => {
    prismaAny.session.updateMany.mockRejectedValue(new Error('connection reset'));

    await expect(suspendAccount('reported-1', { moderatorId: 'moderator-1', reason: 'Repeated abuse' })).resolves.toBeUndefined();

    expect(prismaAny.user.update).toHaveBeenCalledTimes(1);
    expect(announced).toEqual([]);
  });
});

describe('banAccount', () => {
  it('locks and marks the account, ends every session, and bars the address', async () => {
    const recorded = await banAccount('reported-1', {
      moderatorId: 'moderator-1',
      reason: 'Stalking across accounts',
      reportId: 'report-1',
    });

    expect(recorded).toBe(true);
    expect(prismaAny.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: true });
    expect(prismaAny.user.update.mock.calls[0][0].data.bannedAt).toBeInstanceOf(Date);
    expectEveryLiveSessionEnded('reported-1');
    expect(announced).toEqual([{ userId: 'reported-1', reason: 'banned' }]);
    expect(prismaAny.bannedIdentity.upsert).toHaveBeenCalledTimes(1);
  });

  it('ends the sessions even when the address cannot be barred', async () => {
    prismaAny.bannedIdentity.upsert.mockRejectedValue(new Error('write refused'));

    const recorded = await banAccount('reported-1', {
      moderatorId: 'moderator-1',
      reason: 'Stalking across accounts',
      reportId: null,
    });

    expect(recorded).toBe(false);
    expect(announced).toEqual([{ userId: 'reported-1', reason: 'banned' }]);
  });

  it('still bars the address when the sessions could not be ended', async () => {
    prismaAny.session.updateMany.mockRejectedValue(new Error('connection reset'));

    const recorded = await banAccount('reported-1', {
      moderatorId: 'moderator-1',
      reason: 'Stalking across accounts',
      reportId: null,
    });

    expect(recorded).toBe(true);
    expect(prismaAny.bannedIdentity.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('a decision on a report', () => {
  const report = {
    id: 'report-1',
    reporterId: 'reporter-1',
    reportedUserId: 'reported-1',
    contentType: 'POST',
    contentId: 'post-1',
    reason: 'HARASSMENT',
    description: 'Threats',
    status: 'PENDING',
    evidence: null as unknown,
  };

  beforeEach(() => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...report });
    prismaAny.contentReport.update.mockResolvedValue({ ...report });
    prismaAny.moderationLog.create.mockResolvedValue({ id: 'log-1' });
    prismaAny.notification.create.mockResolvedValue({ id: 'notification-1' });
    prismaAny.user.findUnique.mockResolvedValue({ id: 'reporter-1' });
  });

  it('ends the reported member’s sessions when the moderator suspends her', async () => {
    await processReportById('report-1', 'suspend', 'moderator-1', 'Repeated abuse');

    expect(announced).toEqual([{ userId: 'reported-1', reason: 'suspended' }]);
  });

  it('ends them when the moderator bans her', async () => {
    await processReportById('report-1', 'ban', 'moderator-1', 'Stalking across accounts');

    expect(announced).toEqual([{ userId: 'reported-1', reason: 'banned' }]);
  });

  it('leaves her sessions alone for a warning, a removal or a dismissal', async () => {
    prismaAny.post = { update: jest.fn(async () => ({})) };
    await processReportById('report-1', 'warn', 'moderator-1');
    await processReportById('report-1', 'dismiss', 'moderator-1');

    expect(prismaAny.session.updateMany).not.toHaveBeenCalled();
    expect(announced).toEqual([]);
  });
});
