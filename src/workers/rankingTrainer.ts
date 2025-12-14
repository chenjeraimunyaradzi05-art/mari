import { Worker } from 'bullmq';
import { prisma } from '@/lib/db';
import { connection } from '@/lib/queue/connection';
import { rankingQueue, RANKING_QUEUE_NAME } from '@/lib/queue/rankingQueue';
import { logger } from '@/lib/logger';

const JOB_ID = 'weekly-retrain';

async function scheduleWeeklyRetrain() {
  try {
    await rankingQueue.add(
      JOB_ID,
      {},
      { jobId: JOB_ID, repeat: { pattern: '0 3 * * 0' } }
    );
    logger.info('Scheduled weekly bandit retrain job');
  } catch (error) {
    logger.warn('Failed to schedule bandit retrain job', { error: (error as Error).message });
  }
}

scheduleWeeklyRetrain();

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

async function runRetrain() {
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const rewardByPost = await prisma.rankingFeedback.groupBy({
    by: ['postId'],
    where: { createdAt: { gte: windowStart } },
    _sum: { reward: true },
    _count: { _all: true },
  });

  const impressionsByPost = await prisma.rankingFeedback.groupBy({
    by: ['postId'],
    where: { action: 'impression', createdAt: { gte: windowStart } },
    _count: { _all: true },
  });

  const impressionMap = new Map(impressionsByPost.map((row) => [row.postId, row._count._all]));

  await prisma.$transaction(
    rewardByPost.map((row) => {
      const impressions = impressionMap.get(row.postId) ?? row._count._all;
      const reward = row._sum.reward ?? 0;
      const successes = clamp(reward + 1, 1, Number.MAX_SAFE_INTEGER);
      const failures = clamp(impressions - reward + 1, 1, Number.MAX_SAFE_INTEGER);

      return prisma.banditArm.upsert({
        where: { contentId: row.postId },
        create: {
          contentId: row.postId,
          alpha: successes,
          beta: failures,
          impressions,
          clicks: Math.max(0, Math.round(reward)),
        },
        update: {
          alpha: successes,
          beta: failures,
          impressions,
          clicks: Math.max(0, Math.round(reward)),
        },
      });
    })
  );

  logger.info('Bandit retrain completed', {
    armsUpdated: rewardByPost.length,
    windowStart: windowStart.toISOString(),
  });
}

export const rankingTrainer = new Worker(
  RANKING_QUEUE_NAME,
  async (job) => {
    if (job.name === JOB_ID) {
      await runRetrain();
      return { updated: true };
    }
    return {};
  },
  { connection, concurrency: 1 }
);

rankingTrainer.on('failed', (job, err) => {
  logger.error('Ranking trainer job failed', err, { jobId: job?.id });
});
