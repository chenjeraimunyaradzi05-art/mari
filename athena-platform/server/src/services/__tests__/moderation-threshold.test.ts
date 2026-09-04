import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
    post: { findUnique: jest.fn(), update: jest.fn() },
    comment: { findUnique: jest.fn(), update: jest.fn() },
    video: { findUnique: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { reviewReportedContent, AUTO_HIDE_REPORTERS } from '../moderation-threshold.service';

const prisma: any = prismaTyped;
const reporters = (n: number) => Array.from({ length: n }, (_, i) => ({ reporterId: `r${i}` }));

describe('Reports adding up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('works for reels too', async () => {
    prisma.contentReport.findMany.mockResolvedValue(reporters(3));
    prisma.video.findUnique.mockResolvedValue({ authorId: 'creator', isHidden: false });
    prisma.video.update.mockResolvedValue({});
    expect(await reviewReportedContent('video', 'v1')).toBe(true);
    expect(prisma.video.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { isHidden: true } });
  });
});
