/**
 * Scheduled posts.
 *
 * A post scheduled for later is stored hidden with scheduledFor set, so every
 * feed, search and profile query that already filters isHidden keeps it out
 * without knowing scheduling exists. Once a minute this publishes what has
 * come due: it clears the schedule, stamps createdAt with now (so the post
 * lands at the top of the feed rather than buried at the time it was
 * written) and shows it. Moderation-hidden posts have no scheduledFor and
 * are never touched.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { runExclusively } from '../utils/redis';
import { bestEffort } from '../utils/best-effort';
import { recordPublishedPost } from './engagement.service';

export const SCHEDULE_MIN_MINUTES = 5;
export const SCHEDULE_MAX_DAYS = 30;

export function parseScheduledFor(raw: unknown, now = new Date()): Date | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new Error('scheduledFor must be a valid date');
  }
  const minutesAhead = (date.getTime() - now.getTime()) / 60000;
  if (minutesAhead < SCHEDULE_MIN_MINUTES) {
    throw new Error(`Schedule a post at least ${SCHEDULE_MIN_MINUTES} minutes ahead`);
  }
  if (minutesAhead > SCHEDULE_MAX_DAYS * 24 * 60) {
    throw new Error(`A post can be scheduled up to ${SCHEDULE_MAX_DAYS} days ahead`);
  }
  return date;
}

/**
 * Publishes what has come due and counts it for its author.
 *
 * A post that went out on schedule used to be invisible to engagement: the
 * posting streak and the content badges advance in recordPublishedPost, which
 * post creation calls for a post that goes out at once, and nothing called it
 * here. A member who queued her week's posts on Sunday broke her streak every
 * day they went out. Counting happens after the post is live, and a failure
 * there is logged rather than allowed to stop the rest of the batch going out.
 *
 * Each post is released with a conditional update, so one that was deleted, or
 * published by another path, between the read and the write is skipped rather
 * than throwing and leaving every post after it in the batch unpublished.
 */
export async function publishDuePosts(now = new Date()): Promise<number> {
  const due = await prisma.post.findMany({
    where: { scheduledFor: { lte: now }, isHidden: true },
    select: { id: true, authorId: true },
    take: 200,
  });
  if (due.length === 0) return 0;

  let published = 0;
  for (const post of due) {
    const released = await prisma.post.updateMany({
      where: { id: post.id, isHidden: true, scheduledFor: { not: null } },
      data: { isHidden: false, scheduledFor: null, createdAt: now },
    });
    if (released.count === 0) continue;
    published += 1;
    await bestEffort('scheduled-posts.achievements', () => recordPublishedPost(post.authorId));
  }
  logger.info('Scheduled posts published', { count: published });
  return published;
}

export function startScheduledPostPublisher(intervalMs = 60_000): () => void {
  const run = () =>
    runExclusively('scheduled-posts', () => publishDuePosts(), 5 * 60 * 1000).catch((error) => {
      logger.error('Publishing scheduled posts failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();
  return () => clearInterval(timer);
}
