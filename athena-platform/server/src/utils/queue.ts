/**
 * BullMQ Job Queue Configuration
 * ===============================
 * The two kinds of background work this platform actually has:
 *
 *   - video-processing: a newly uploaded reel, when the BullMQ workers are
 *     running in the process that received it (utils/video-queue decides;
 *     otherwise the reel is processed in memory by video-pipeline.service).
 *     Redis holding the job is what lets a reel survive a restart.
 *   - scheduled-tasks: the nightly retention purge and the hourly
 *     report-deadline sweep, from registerRecurringJobs.
 *
 * There used to be six more queues here: email, push, search indexing, data
 * export, analytics and ML inference. Each had a worker, and not one of them
 * ever had a producer. Every email, push, index update and data export on the
 * platform is done directly by the service that needs it, where its failure is
 * recorded against the thing that failed; the analytics queue fed a worker
 * with no store behind it; and the ML worker POSTed its results, safety
 * scores included, to any callback URL a job named. Meanwhile the worker
 * container, the ENABLE_WORKERS flag and /health/detailed all described an
 * eight-queue pipeline that did one nightly purge, and the queue-depth check
 * reported zero for queues nothing could fill, which read as work keeping up.
 *
 * So the queues nothing fed are gone, with their workers, rather than left
 * defined "for later". Routing one of those jobs through Redis is a real
 * change with a real producer to write, and the place to start it is here:
 * add the queue, the producer, the worker in services/workers.service and a
 * case in getQueue, all in the same change.
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { logger } from './logger';

// ===========================================
// REDIS CONNECTION
// ===========================================

const isProductionRuntime =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER_ENV === 'production';

function resolveRedisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  if (isProductionRuntime) {
    throw new Error('REDIS_URL is required before BullMQ queues can be used in production');
  }

  return 'redis://localhost:6379';
}

const redisConnection = new Redis(resolveRedisUrl(), {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

redisConnection.on('error', (err) => {
  logger.error('BullMQ Redis connection error', { error: err.message });
});

// ===========================================
// QUEUE DEFINITIONS
// ===========================================

export const QUEUE_NAMES = {
  VIDEO_PROCESSING: 'video-processing',
  // There was an ML_INFERENCE queue here. Nothing ever enqueued to it, and
  // its worker POSTed each result, safety scores included, to whatever
  // callbackUrl the job named: a server-side request to any address, with a
  // member's data in the body, one producer away from being live. The ML
  // service is called directly where it is used (the feed ranker), so the
  // queue, its producer and its worker are gone rather than fenced. The
  // email, push, search-indexing, data-export and analytics queues went for
  // the plainer reason in the header: nothing ever put a job on them.
  SCHEDULED_TASKS: 'scheduled-tasks',
} as const;

// ===========================================
// QUEUE INSTANCES
// ===========================================

const defaultQueueOptions: QueueOptions = {
  // Cast to any to handle ioredis version mismatch between package and bullmq's bundled version
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

export const videoProcessingQueue = new Queue(QUEUE_NAMES.VIDEO_PROCESSING, defaultQueueOptions);
export const scheduledTasksQueue = new Queue(QUEUE_NAMES.SCHEDULED_TASKS, defaultQueueOptions);

// ===========================================
// JOB TYPES
// ===========================================

/**
 * One reel to process. processVideo reads everything else it needs (the
 * source file, a duet's original, the chosen sound) from the Video row, so
 * the id is the whole job; utils/video-queue is the producer. The optional
 * fields are what the external-transcoder branch of the worker forwards to
 * VIDEO_PROCESSOR_URL, and a reel is only ever queued when that branch is off
 * (see tryQueueVideoProcessing), so they are absent in practice.
 */
export interface VideoProcessingJob {
  videoId: string;
  userId: string;
  type?: 'transcode' | 'thumbnail' | 'caption';
  inputUrl?: string;
  options?: {
    formats?: string[];
    generateCaptions?: boolean;
    generateThumbnail?: boolean;
  };
}

export const SCHEDULED_TASKS = {
  DATA_RETENTION_PURGE: 'data-retention-purge',
  REPORT_DEADLINE_SWEEP: 'report-deadline-sweep',
  HOUSING_SAFETY_CHECK_SWEEP: 'housing-safety-check-sweep',
  PRACTITIONER_RECHECK_SWEEP: 'practitioner-recheck-sweep',
} as const;

export type ScheduledTaskName = (typeof SCHEDULED_TASKS)[keyof typeof SCHEDULED_TASKS];

/**
 * Recurring maintenance work. `task` is the discriminator the scheduled-tasks
 * worker switches on, so a task added here is a compile error until the worker
 * handles it.
 */
export interface ScheduledTaskJob {
  task: ScheduledTaskName;
}

// ===========================================
// JOB PRODUCERS (Add jobs to queues)
// ===========================================

export async function queueVideoProcessing(job: VideoProcessingJob, priority?: number) {
  return videoProcessingQueue.add('process-video', job, {
    priority: priority || 5,
    // Deliberately not keyed on the video alone. BullMQ ignores an add whose
    // id matches a job it still holds, and it holds failed jobs for a week, so
    // a reel whose first run failed could never be queued again. Duplicates of
    // a reel that is already waiting are avoided by the caller instead: the
    // restart sweep asks videoIdsWithLiveJobs before it re-queues anything.
    jobId: `video-${job.videoId}-${Date.now()}`,
  });
}

// ===========================================
// RECURRING JOBS
// ===========================================

// Overnight in the venture's home timezone: the purge takes write locks on hot
// tables (messages, notifications), so it runs when traffic is lowest.
const DATA_RETENTION_CRON = process.env.DATA_RETENTION_CRON || '0 3 * * *';
const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'Australia/Brisbane';

// Reports carry a promised review deadline (24 hours for illegal content, 48
// for the rest). alertOverdueReports in content-report.service tells Trust &
// Safety when one has passed, and until this nothing ever ran it, so a report
// could sit past its promise with nobody told. Hourly, a quarter past, so a
// deadline missed is heard about within the hour rather than the next day,
// and clear of the retention purge on the hour.
const REPORT_DEADLINE_SWEEP_CRON = process.env.REPORT_DEADLINE_SWEEP_CRON || '15 * * * *';

// DV-safe listings whose safety check was asked for and has not been done.
// alertOverdueSafetyChecks in housing-supply.service tells the people meant
// to do it; it was built for this worker and until now nothing ran it, so a
// check could stay undone with nobody told. Hourly, at a quarter to, clear of
// the report sweep and the hour.
const HOUSING_SAFETY_CHECK_SWEEP_CRON = process.env.HOUSING_SAFETY_CHECK_SWEEP_CRON || '45 * * * *';

// Practitioner verifications are re-checked a year on. sweepPractitionerRechecks
// in wellness/practitioner-recheck.service tells the admins who is due and
// takes a lapsed listing out of the directory; daily, in the early hours, after
// the retention purge has had its window.
const PRACTITIONER_RECHECK_CRON = process.env.PRACTITIONER_RECHECK_CRON || '30 4 * * *';

// Deliberately absent: an auto-save job for SavingsGoal.autoSaveEnabled /
// autoSaveAmount. Savings contributions are a self-reported ledger and the
// platform holds no stored mandate or payment method to debit off-session
// (payments-orchestration's getStripeCustomerId returns null and every charge
// path needs a paymentMethodId supplied by the request). A scheduled job here
// could only write SavingsContribution rows for money that never moved, which
// would be fabricated financial data. The toggle needs disabling at the API,
// not a job pretending to honour it.

/**
 * Register every recurring job on the scheduled-tasks queue.
 *
 * `upsertJobScheduler` is keyed by the scheduler id, so this is safe to call on
 * every boot and from every replica: a redeploy re-points the existing schedule
 * (picking up a changed cron) instead of stacking a second one, and BullMQ still
 * produces exactly one job per interval however many callers upserted it.
 */
export async function registerRecurringJobs(): Promise<void> {
  await scheduledTasksQueue.upsertJobScheduler(
    SCHEDULED_TASKS.DATA_RETENTION_PURGE,
    { pattern: DATA_RETENTION_CRON, tz: SCHEDULER_TIMEZONE },
    {
      name: SCHEDULED_TASKS.DATA_RETENTION_PURGE,
      data: { task: SCHEDULED_TASKS.DATA_RETENTION_PURGE } as ScheduledTaskJob,
      opts: {
        // A failed sweep waits for the next night rather than retrying with
        // backoff, which would land it in morning traffic. Nothing is lost:
        // every purge re-derives its cutoffs from the clock, so the next run
        // picks up whatever this one missed.
        attempts: 1,
        removeOnComplete: { count: 60 },
        removeOnFail: { count: 60 },
      },
    }
  );

  await scheduledTasksQueue.upsertJobScheduler(
    SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP,
    { pattern: REPORT_DEADLINE_SWEEP_CRON, tz: SCHEDULER_TIMEZONE },
    {
      name: SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP,
      data: { task: SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP } as ScheduledTaskJob,
      opts: {
        // The next hour is the retry. The sweep reads the clock afresh each
        // run, so a report missed by a failed run is caught by the next one,
        // and a backoff retry would only send the same alert twice.
        attempts: 1,
        removeOnComplete: { count: 48 },
        removeOnFail: { count: 48 },
      },
    }
  );

  // Both sweeps re-read the records each run, so a failed run is simply
  // caught up by the next one; a backoff retry would only repeat the alerts.
  await scheduledTasksQueue.upsertJobScheduler(
    SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP,
    { pattern: HOUSING_SAFETY_CHECK_SWEEP_CRON, tz: SCHEDULER_TIMEZONE },
    {
      name: SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP,
      data: { task: SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP } as ScheduledTaskJob,
      opts: { attempts: 1, removeOnComplete: { count: 48 }, removeOnFail: { count: 48 } },
    }
  );

  await scheduledTasksQueue.upsertJobScheduler(
    SCHEDULED_TASKS.PRACTITIONER_RECHECK_SWEEP,
    { pattern: PRACTITIONER_RECHECK_CRON, tz: SCHEDULER_TIMEZONE },
    {
      name: SCHEDULED_TASKS.PRACTITIONER_RECHECK_SWEEP,
      data: { task: SCHEDULED_TASKS.PRACTITIONER_RECHECK_SWEEP } as ScheduledTaskJob,
      opts: { attempts: 1, removeOnComplete: { count: 60 }, removeOnFail: { count: 60 } },
    }
  );

  logger.info('Recurring jobs registered', {
    dataRetentionPurge: { pattern: DATA_RETENTION_CRON, timezone: SCHEDULER_TIMEZONE },
    reportDeadlineSweep: { pattern: REPORT_DEADLINE_SWEEP_CRON, timezone: SCHEDULER_TIMEZONE },
    housingSafetyCheckSweep: { pattern: HOUSING_SAFETY_CHECK_SWEEP_CRON, timezone: SCHEDULER_TIMEZONE },
    practitionerRecheckSweep: { pattern: PRACTITIONER_RECHECK_CRON, timezone: SCHEDULER_TIMEZONE },
  });
}

// ===========================================
// QUEUE STATS
// ===========================================

export async function getQueueStats(queueName: string) {
  const queue = getQueue(queueName);
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

export async function getAllQueueStats() {
  const stats: Record<string, any> = {};

  for (const name of Object.values(QUEUE_NAMES)) {
    stats[name] = await getQueueStats(name);
  }

  return stats;
}

function getQueue(name: string): Queue | null {
  switch (name) {
    case QUEUE_NAMES.VIDEO_PROCESSING:
      return videoProcessingQueue;
    // Omitting this case made getAllQueueStats report null for scheduled tasks,
    // which is exactly where a stalled retention purge would show up.
    case QUEUE_NAMES.SCHEDULED_TASKS:
      return scheduledTasksQueue;
    default:
      return null;
  }
}

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

export async function closeAllQueues() {
  await Promise.all([
    videoProcessingQueue.close(),
    scheduledTasksQueue.close(),
  ]);
  await redisConnection.quit();
  logger.info('All BullMQ queues closed');
}
