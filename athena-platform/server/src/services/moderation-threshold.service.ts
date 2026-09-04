/**
 * Reports add up. Once enough different members have reported the same post,
 * comment or reel, it is hidden while the moderation queue looks at it,
 * rather than staying up until someone gets to the report. The author is
 * told plainly; an admin can put it back. A single reporter can never hide
 * anything, and neither can one member reporting many times.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const AUTO_HIDE_REPORTERS = 3;

export type ReportableContent = 'post' | 'comment' | 'video';

async function distinctReporters(contentType: ReportableContent, contentId: string): Promise<number> {
  const rows = await prisma.contentReport.findMany({
    where: { contentType: contentType.toUpperCase(), contentId },
    select: { reporterId: true },
    distinct: ['reporterId'],
  });
  return rows.length;
}

const NOTICE: Record<ReportableContent, string> = {
  post: 'One of your posts was hidden while our team reviews reports about it. It will be restored if it is found to follow the community guidelines.',
  comment: 'One of your comments was hidden while our team reviews reports about it. It will be restored if it is found to follow the community guidelines.',
  video: 'One of your reels was hidden while our team reviews reports about it. It will be restored if it is found to follow the community guidelines.',
};

/**
 * Called after a report is recorded. Returns true when this report tipped
 * the content into review.
 */
export async function reviewReportedContent(contentType: ReportableContent, contentId: string): Promise<boolean> {
  try {
    const reporters = await distinctReporters(contentType, contentId);
    if (reporters < AUTO_HIDE_REPORTERS) return false;

    let authorId: string | null = null;
    if (contentType === 'post') {
      const post = await prisma.post.findUnique({ where: { id: contentId }, select: { authorId: true, isHidden: true } });
      if (!post || post.isHidden) return false;
      await prisma.post.update({ where: { id: contentId }, data: { isHidden: true } });
      authorId = post.authorId;
    } else if (contentType === 'comment') {
      const comment = await prisma.comment.findUnique({ where: { id: contentId }, select: { authorId: true, isHidden: true } });
      if (!comment || comment.isHidden) return false;
      await prisma.comment.update({ where: { id: contentId }, data: { isHidden: true } });
      authorId = comment.authorId;
    } else {
      const video = await prisma.video.findUnique({ where: { id: contentId }, select: { authorId: true, isHidden: true } });
      if (!video || video.isHidden) return false;
      await prisma.video.update({ where: { id: contentId }, data: { isHidden: true } });
      authorId = video.authorId;
    }

    await prisma.contentReport.updateMany({
      where: { contentType: contentType.toUpperCase(), contentId, status: 'PENDING' },
      data: { status: 'REVIEWING' },
    });

    if (authorId) {
      await prisma.notification.create({
        data: {
          userId: authorId,
          type: 'SYSTEM',
          title: 'Content under review',
          message: NOTICE[contentType],
          link: '/dashboard/safety',
          data: { contentType, contentId, reason: 'reports' },
        },
      });
    }

    logger.info('Content hidden pending review', { contentType, contentId, reporters });
    return true;
  } catch (error) {
    logger.warn('Report threshold check failed', {
      contentType,
      contentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
