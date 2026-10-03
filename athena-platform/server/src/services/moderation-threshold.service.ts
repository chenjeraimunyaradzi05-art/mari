/**
 * Reports add up. Once enough different members have reported the same post,
 * comment or reel, it is hidden while the moderation queue looks at it,
 * rather than staying up until someone gets to the report. The author is
 * told plainly; an admin can put it back. For the ordinary reasons a single
 * reporter can never hide anything, and neither can one member reporting many
 * times.
 *
 * The four reasons in IMMEDIATE_HIDE_REASONS are the exception: an intimate
 * image shared without consent, a threat to hurt someone, child sexual abuse
 * material and terrorism. Waiting for three women to find the same image is
 * three women having seen it, and the person it is of is very often the only
 * one who will ever report it, so for these one report from a signed-in member
 * hides the content at once. It is hidden, not deleted: reversible by a
 * moderator or an appeal, and dismissing the report puts it back (see
 * content-report.service), so a false report costs the author a few hours and
 * not her post. What one report does not do is suspend or ban anyone, and a
 * report from no account does not hide alone, because a form open to anyone
 * with no limit on who is behind it is not a way to take things down.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';

/** The ModerationLog action that records content hidden on one report; not a decision, so no transparency bucket counts it. */
export const IMMEDIATE_HIDE_ACTION = 'auto_hide_on_report';

export const AUTO_HIDE_REPORTERS = 3;

/**
 * Reasons for which one report hides the content at once. Lower case, as the
 * intake stores them.
 */
export const IMMEDIATE_HIDE_REASONS: ReadonlySet<string> = new Set(['intimate_image', 'threat', 'csam', 'terrorism']);

export function hidesOnOneReport(reason: unknown): boolean {
  return typeof reason === 'string' && IMMEDIATE_HIDE_REASONS.has(reason.trim().toLowerCase());
}

export interface ReviewOptions {
  /** What the newest report says it is about; the reasons above hide on one report. */
  reason?: string;
  /** True when the report came from no account; those never hide alone. */
  anonymous?: boolean;
  /** The reference of the report that tipped it, written to the moderation log so a dismissal can put the content back. */
  ticketId?: string | null;
}

export type ReportableContent = 'post' | 'comment' | 'video';

async function distinctReporters(contentType: ReportableContent, contentId: string): Promise<number> {
  const rows = await prisma.contentReport.findMany({
    where: { contentType: contentType.toUpperCase(), contentId },
    select: { reporterId: true },
    distinct: ['reporterId'],
  });
  return rows.length;
}

/**
 * Reports filed without an account are SafetyIncident rows, because a
 * ContentReport names a member on both sides. They carry no reporter identity,
 * so counting them one by one would hand a single person the power to hide
 * anything by reporting it three times signed out. The whole anonymous cohort
 * therefore counts as one voice: never enough on its own, enough to tip content
 * that identified members have also reported.
 */
async function anonymousVoice(contentType: ReportableContent, contentId: string): Promise<number> {
  const anonymous = await prisma.safetyIncident.count({
    where: {
      type: 'USER_REPORT',
      contentType: contentType.toUpperCase(),
      contentId,
      resolvedAt: null,
      metadata: { path: ['anonymous'], equals: true },
    },
  });
  return anonymous > 0 ? 1 : 0;
}

const SERIOUS_NOTICE: Record<ReportableContent, string> = {
  post: 'One of your posts was hidden straight away while our team reviews a serious report about it. It will be restored if it is found to follow the community guidelines.',
  comment: 'One of your comments was hidden straight away while our team reviews a serious report about it. It will be restored if it is found to follow the community guidelines.',
  video: 'One of your reels was hidden straight away while our team reviews a serious report about it. It will be restored if it is found to follow the community guidelines.',
};

const NOTICE: Record<ReportableContent, string> = {
  post: 'One of your posts was hidden while our team reviews reports about it. It will be restored if it is found to follow the community guidelines.',
  comment: 'One of your comments was hidden while our team reviews reports about it. It will be restored if it is found to follow the community guidelines.',
  video: 'One of your reels was hidden while our team reviews reports about it. It will be restored if it is found to follow the community guidelines.',
};

/**
 * Called after a report is recorded. Returns true when this report tipped
 * the content into review.
 */
export async function reviewReportedContent(
  contentType: ReportableContent,
  contentId: string,
  options: ReviewOptions = {}
): Promise<boolean> {
  try {
    const immediate = hidesOnOneReport(options.reason) && !options.anonymous;
    if (!immediate) {
      const [named, anonymous] = await Promise.all([
        distinctReporters(contentType, contentId),
        anonymousVoice(contentType, contentId),
      ]);
      const reporters = named + anonymous;
      if (reporters < AUTO_HIDE_REPORTERS) return false;
    }

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

    // Which report hid it, so that dismissing that report can put it back. Only
    // for the immediate hide: the content was hidden because of this one report,
    // not because enough of them added up. Best effort, after the hide: the
    // content is already down, and what is lost without the row is only the
    // automatic restore.
    if (immediate && options.ticketId) {
      await bestEffort('moderation-threshold.record-immediate-hide', () =>
        prisma.moderationLog.create({
          data: {
            ticketId: options.ticketId as string,
            action: IMMEDIATE_HIDE_ACTION,
            moderatorId: 'system',
            notes: `${contentType}:${contentId}`,
            timestamp: new Date(),
          },
        })
      );
    }

    if (authorId) {
      await prisma.notification.create({
        data: {
          userId: authorId,
          type: 'SYSTEM',
          title: 'Content under review',
          message: (immediate ? SERIOUS_NOTICE : NOTICE)[contentType],
          link: '/dashboard/safety',
          data: { contentType, contentId, reason: immediate ? 'serious_report' : 'reports' },
        },
      });
    }

    logger.info('Content hidden pending review', { contentType, contentId, immediate });
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
