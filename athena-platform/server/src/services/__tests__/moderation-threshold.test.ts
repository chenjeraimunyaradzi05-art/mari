import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
    safetyIncident: { count: jest.fn(async () => 0) },
    post: { findUnique: jest.fn(), update: jest.fn() },
    comment: { findUnique: jest.fn(), update: jest.fn() },
    video: { findUnique: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
    moderationLog: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import {
  reviewReportedContent,
  hidesOnOneReport,
  AUTO_HIDE_REPORTERS,
  IMMEDIATE_HIDE_ACTION,
  IMMEDIATE_HIDE_REASONS,
} from '../moderation-threshold.service';

const prisma: any = prismaTyped;
const reporters = (n: number) => Array.from({ length: n }, (_, i) => ({ reporterId: `r${i}` }));

describe('Reports adding up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.safetyIncident.count.mockResolvedValue(0);
  });

  it('does nothing below the threshold', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(AUTO_HIDE_REPORTERS - 1));
    expect(await reviewReportedContent('post', 'p1')).toBe(false);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('asks for distinct reporters, so one member cannot do it alone', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(1));
    await reviewReportedContent('post', 'p1');
    expect(prisma.contentReport.findMany.mock.calls[0][0]).toMatchObject({ distinct: ['reporterId'], where: { contentType: 'POST', contentId: 'p1' } });
  });

  it('hides a post at the threshold, moves its reports to review and tells the author', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(AUTO_HIDE_REPORTERS));
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});

    expect(await reviewReportedContent('post', 'p1')).toBe(true);

    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isHidden: true } });
    expect(prisma.contentReport.updateMany.mock.calls[0][0]).toMatchObject({ where: { contentId: 'p1', status: 'PENDING' }, data: { status: 'REVIEWING' } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'author', type: 'SYSTEM', title: 'Content under review' });
  });

  it('leaves content that is already hidden alone', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(5));
    prisma.comment.findUnique.mockResolvedValue({ authorId: 'author', isHidden: true });
    expect(await reviewReportedContent('comment', 'c1')).toBe(false);
    expect(prisma.comment.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('counts every anonymous report as one voice, so nobody can hide content alone', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(1));
    prisma.safetyIncident.count.mockResolvedValue(9);

    expect(await reviewReportedContent('post', 'p1')).toBe(false);
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.safetyIncident.count.mock.calls[0][0]).toMatchObject({
      where: { type: 'USER_REPORT', contentType: 'POST', contentId: 'p1', resolvedAt: null },
    });
  });

  it('lets anonymous reports tip content that named members have also reported', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(AUTO_HIDE_REPORTERS - 1));
    prisma.safetyIncident.count.mockResolvedValue(1);
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});

    expect(await reviewReportedContent('post', 'p1')).toBe(true);
    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isHidden: true } });
  });

  it('works for reels too', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(3));
    prisma.video.findUnique.mockResolvedValue({ authorId: 'creator', isHidden: false });
    prisma.video.update.mockResolvedValue({});
    expect(await reviewReportedContent('video', 'v1')).toBe(true);
    expect(prisma.video.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isHidden: true } });
  });
});

/**
 * Four reasons cannot wait for three women to find the same thing: an intimate
 * image shared without consent, a threat to hurt someone, child sexual abuse
 * material and terrorism. The person an image is of is very often the only one
 * who will ever report it. One report from a signed-in member hides the content
 * at once, reversibly; every other reason still needs three.
 */
describe('Reasons that hide on one report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.safetyIncident.count.mockResolvedValue(0);
    // A single reporter, who is all there is.
    prisma.contentReport.findMany.mockResolvedValue(reporters(1));
  });

  it('are the four, and no others', () => {
    expect([...IMMEDIATE_HIDE_REASONS].sort()).toEqual(['csam', 'intimate_image', 'terrorism', 'threat']);
    expect(hidesOnOneReport('INTIMATE_IMAGE')).toBe(true);
    expect(hidesOnOneReport(' threat ')).toBe(true);
    for (const reason of ['harassment', 'violence', 'sexual', 'self_harm', 'spam', 'other', '', undefined, null, 4]) {
      expect(hidesOnOneReport(reason)).toBe(false);
    }
  });

  it.each(['intimate_image', 'threat', 'csam', 'terrorism'])('hides a post on one %s report, without counting reporters at all', async (reason) => {
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});

    expect(await reviewReportedContent('post', 'p1', { reason, ticketId: 'RPT-1' })).toBe(true);

    expect(prisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isHidden: true } });
    expect(prisma.contentReport.findMany).not.toHaveBeenCalled();
    expect(prisma.safetyIncident.count).not.toHaveBeenCalled();
  });

  it('hides a comment and a reel on one report too', async () => {
    prisma.comment.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.comment.update.mockResolvedValue({});
    prisma.video.findUnique.mockResolvedValue({ authorId: 'creator', isHidden: false });
    prisma.video.update.mockResolvedValue({});

    expect(await reviewReportedContent('comment', 'c1', { reason: 'threat' })).toBe(true);
    expect(await reviewReportedContent('video', 'v1', { reason: 'intimate_image' })).toBe(true);

    expect(prisma.comment.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { isHidden: true } });
    expect(prisma.video.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isHidden: true } });
  });

  it('does not hide on one report for any other reason: three are still needed', async () => {
    for (const reason of ['harassment', 'violence', 'sexual', 'self_harm', 'hate', 'other']) {
      expect(await reviewReportedContent('post', 'p1', { reason })).toBe(false);
    }
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('does not hide on one report that came from no account, whatever it is about: the form is open to anyone', async () => {
    expect(await reviewReportedContent('post', 'p1', { reason: 'intimate_image', anonymous: true })).toBe(false);

    expect(prisma.post.update).not.toHaveBeenCalled();
    // It falls back to the rule every anonymous report gets: counted as one voice.
    expect(prisma.safetyIncident.count).toHaveBeenCalled();
  });

  it('moves the report into review, and tells the author that something serious was reported, without saying what or by whom', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});

    await reviewReportedContent('post', 'p1', { reason: 'intimate_image', ticketId: 'RPT-1' });

    expect(prisma.contentReport.updateMany.mock.calls[0][0]).toMatchObject({ where: { contentId: 'p1', status: 'PENDING' }, data: { status: 'REVIEWING' } });
    const told = prisma.notification.create.mock.calls[0][0].data;
    expect(told).toMatchObject({ userId: 'author', title: 'Content under review', data: { reason: 'serious_report' } });
    expect(told.message).toContain('hidden straight away');
    expect(told.message).toContain('restored if it is found to follow the community guidelines');
    expect(JSON.stringify(told)).not.toMatch(/intimate|threat|reported by|image/i);
  });

  it('records which report hid it, so that dismissing that report can put it back', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});

    await reviewReportedContent('post', 'p1', { reason: 'threat', ticketId: 'RPT-9' });

    expect(prisma.moderationLog.create).toHaveBeenCalledWith({
      data: { ticketId: 'RPT-9', action: IMMEDIATE_HIDE_ACTION, moderatorId: 'system', notes: 'post:p1', timestamp: expect.any(Date) },
    });
  });

  it('writes no such record for three reporters adding up, which no single report caused', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(AUTO_HIDE_REPORTERS));
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});

    await reviewReportedContent('post', 'p1', { reason: 'harassment', ticketId: 'RPT-3' });

    expect(prisma.post.update).toHaveBeenCalled();
    expect(prisma.moderationLog.create).not.toHaveBeenCalled();
  });

  it('is still hidden when the record of it cannot be written', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: false });
    prisma.post.update.mockResolvedValue({});
    prisma.moderationLog.create.mockRejectedValueOnce(new Error('log unavailable'));

    expect(await reviewReportedContent('post', 'p1', { reason: 'threat', ticketId: 'RPT-9' })).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('leaves content that is already hidden alone, and writes nothing', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: 'author', isHidden: true });

    expect(await reviewReportedContent('post', 'p1', { reason: 'intimate_image', ticketId: 'RPT-1' })).toBe(false);

    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.moderationLog.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
