/**
 * Upholding a report on a message, a live-chat line, a stream or a group.
 *
 * "Remove" on a reported message used to delete the Message row, which was the
 * one place the words lived: the decision pointed at nothing, and the record an
 * appeal is read against was the thing the decision had just deleted. The
 * report now keeps its own copy of the words, and removal leaves that copy
 * alone; a report filed before copies were kept gets one taken at the moment it
 * is upheld, while the row is still there. Streams and groups, which had no
 * removal at all, are now taken down in a way an appeal can undo.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findUnique: jest.fn(), update: jest.fn() },
    moderationLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    message: { findUnique: jest.fn(), findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 1 })), delete: jest.fn() },
    group: { findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    bannedIdentity: { upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

const suspendStream = jest.fn(async (..._args: unknown[]) => ({ changed: true }));
const liftStreamSuspension = jest.fn(async (..._args: unknown[]) => ({ changed: true }));
const removeChatMessageAsStaff = jest.fn(async (..._args: unknown[]) => true);
jest.mock('../livestream.service', () => ({
  suspendStream: (...args: unknown[]) => suspendStream(...args),
  liftStreamSuspension: (...args: unknown[]) => liftStreamSuspension(...args),
  removeChatMessageAsStaff: (...args: unknown[]) => removeChatMessageAsStaff(...args),
}));

import { prisma } from '../../utils/prisma';
import { processReportById, reverseEnforcement } from '../content-report.service';

const prismaAny: any = prisma;

const REPORT = {
  id: 'report-1',
  reporterId: 'reporter-1',
  reportedUserId: 'reported-1',
  contentType: 'MESSAGE',
  contentId: 'msg-1',
  reason: 'harassment',
  description: null,
  status: 'PENDING',
  evidence: null as unknown,
};

const SNAPSHOT = {
  version: 1,
  surface: 'direct',
  conversationId: 'conv-1',
  reported: { id: 'msg-1', senderId: 'reported-1', content: 'I know where you work' },
  before: [],
};

describe('Removing a reported message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT });
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
    prismaAny.moderationLog.create.mockResolvedValue({ id: 'log-1' });
    prismaAny.notification.create.mockResolvedValue({ id: 'n-1' });
    prismaAny.user.findUnique.mockResolvedValue({ id: 'reporter-1' });
    prismaAny.message.findMany.mockResolvedValue([]);
    prismaAny.message.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('leaves the copy the report already holds exactly as it is', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, evidence: { ticketId: 'RPT-1', messageContext: SNAPSHOT } });

    await processReportById('report-1', 'remove', 'moderator-1', 'Threat');

    expect(prismaAny.message.deleteMany).toHaveBeenCalledWith({ where: { id: 'msg-1' } });
    // Nothing is read from the row that is about to go, and the evidence is not rewritten.
    expect(prismaAny.message.findUnique).not.toHaveBeenCalled();
    const writes = prismaAny.contentReport.update.mock.calls.map((call: any[]) => call[0].data);
    expect(writes.some((data: any) => 'evidence' in data)).toBe(false);
  });

  it('takes the copy now for a report filed before copies were kept, before the row is deleted', async () => {
    prismaAny.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'reported-1',
      content: 'I know where you work',
      type: 'TEXT',
      metadata: null,
      createdAt: new Date('2026-10-01T03:00:00Z'),
      editedAt: null,
      deletedAt: null,
      expiresAt: null,
      sender: { id: 'reported-1', displayName: 'Dan', firstName: 'Dan', lastName: 'R' },
    });
    prismaAny.group.findUnique.mockResolvedValue(null);
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, evidence: { ticketId: 'RPT-1' } });

    const order: string[] = [];
    prismaAny.contentReport.update.mockImplementation(async ({ data }: any) => {
      if (data.evidence) order.push('copy kept');
      return { ...REPORT };
    });
    prismaAny.message.deleteMany.mockImplementation(async () => {
      order.push('row deleted');
      return { count: 1 };
    });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(order).toEqual(['copy kept', 'row deleted']);
    const kept = prismaAny.contentReport.update.mock.calls.map((call: any[]) => call[0]).find((call: any) => call.data.evidence);
    expect(kept.where).toEqual({ id: 'report-1' });
    expect(kept.data.evidence).toMatchObject({
      ticketId: 'RPT-1',
      messageContext: { surface: 'direct', conversationId: 'conv-1', reported: { content: 'I know where you work' } },
    });
  });

  it('records the decision even when the message is already gone: unsent, swept, or removed by another moderator', async () => {
    prismaAny.message.findUnique.mockResolvedValue(null);
    prismaAny.message.deleteMany.mockResolvedValue({ count: 0 });

    const outcome = await processReportById('report-1', 'remove', 'moderator-1');

    expect(outcome).toMatchObject({ status: 'RESOLVED', action: 'remove' });
    expect(prismaAny.moderationLog.create).toHaveBeenCalled();
  });

  it('records the decision even when the copy cannot be taken', async () => {
    prismaAny.message.findUnique.mockRejectedValue(new Error('database refused'));

    const outcome = await processReportById('report-1', 'remove', 'moderator-1');

    expect(outcome.action).toBe('remove');
    expect(prismaAny.message.deleteMany).toHaveBeenCalled();
  });
});

describe('Upholding a report on live chat, a stream or a group', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
    prismaAny.moderationLog.create.mockResolvedValue({ id: 'log-1' });
    prismaAny.notification.create.mockResolvedValue({ id: 'n-1' });
    prismaAny.user.findUnique.mockResolvedValue({ id: 'reporter-1' });
  });

  it('takes a reported chat line out of the room', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'LIVE_MESSAGE', contentId: 'line-1' });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(removeChatMessageAsStaff).toHaveBeenCalledWith('line-1');
    expect(prismaAny.message.deleteMany).not.toHaveBeenCalled();
  });

  it('ends a reported stream and suspends it, in the moderator\'s name and with the reason on record', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'LIVESTREAM', contentId: 'stream-1' });

    await processReportById('report-1', 'remove', 'moderator-1', 'Threats on air');

    expect(suspendStream).toHaveBeenCalledWith('stream-1', 'moderator-1', 'Threats on air');
  });

  it('still records the decision when the stream is already gone, and fails loudly on anything else', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'LIVESTREAM', contentId: 'stream-1' });

    // Its host's erasure took the stream with her: nothing left to end.
    suspendStream.mockRejectedValueOnce(Object.assign(new Error('Stream not found'), { statusCode: 404 }));
    const outcome = await processReportById('report-1', 'remove', 'moderator-1', 'Threats on air');
    expect(outcome).toMatchObject({ action: 'remove', contentType: 'LIVESTREAM' });
    expect(prismaAny.moderationLog.create).toHaveBeenCalledTimes(1);

    // A failure that is not "it does not exist" is not swallowed.
    suspendStream.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(processReportById('report-1', 'remove', 'moderator-1', 'Threats on air')).rejects.toThrow('database unavailable');
  });

  it('hides a reported group rather than deleting it', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'GROUP', contentId: 'group-1' });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny.group.updateMany).toHaveBeenCalledWith({ where: { id: 'group-1' }, data: { isHidden: true } });
  });

  it('a successful appeal puts the stream back on the list and unhides the group', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false, bannedAt: null });

    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'LIVESTREAM', contentId: 'stream-1', status: 'RESOLVED', action: 'CONTENT_REMOVED' });
    const stream = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });
    expect(liftStreamSuspension).toHaveBeenCalledWith('stream-1');
    expect(stream.contentRestored).toBe(true);

    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'GROUP', contentId: 'group-1', status: 'RESOLVED', action: 'CONTENT_REMOVED' });
    const group = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });
    expect(prismaAny.group.updateMany).toHaveBeenCalledWith({ where: { id: 'group-1' }, data: { isHidden: false } });
    expect(group.contentRestored).toBe(true);
  });

  it('is honest that a deleted message cannot be brought back', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false, bannedAt: null });
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'MESSAGE', contentId: 'msg-1', status: 'RESOLVED', action: 'CONTENT_REMOVED' });

    const result = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });

    expect(result.contentRestored).toBe(false);
  });
});
