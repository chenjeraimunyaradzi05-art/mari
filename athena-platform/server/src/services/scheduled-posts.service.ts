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

export async function publishDuePosts(now = new Date()): Promise<number> {
  const due = await prisma.post.findMany({
    where: { scheduledFor: { lte: now }, isHidden: true },
    select: { id: true },
    take: 200,
  });
  if (due.length === 0) return 0;

  for (const post of due) {
    await prisma.post.update({
      where: { id: post.id },
      data: { isHidden: false, scheduledFor: null, createdAt: now },
    });
  }
  logger.info('Scheduled posts published', { count: due.length });
  return due.length;
}

export function startScheduledPostPublisher(intervalMs = 60_000): () => void {
  const run = () =>
    publishDuePosts().catch((error) => {
      logger.error('Publishing scheduled posts failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();
  return () => clearInterval(timer);
}
