/**
 * BullMQ Workers
 * ==============
 * One worker per queue in utils/queue: the video pipeline for queued reels,
 * and the scheduled tasks (the retention purge and the report-deadline
 * sweep). The email, push, search-indexing, data-export, analytics and ML
 * workers that used to sit beside them are gone with their queues, because
 * nothing ever gave them a job; the header of utils/queue says why, and what
 * adding one back involves.
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import {
  QUEUE_NAMES,
  SCHEDULED_TASKS,
  VideoProcessingJob,
  ScheduledTaskJob,
  registerRecurringJobs,
} from '../utils/queue';
import { dataRetentionService } from '../scripts/data-retention';
import { markWorkersRunning, resolveWorkerRedisUrl } from '../utils/worker-config';
import { processVideo } from './video-pipeline.service';
import { alertOverdueReports } from './content-report.service';
import { alertOverdueSafetyChecks } from './housing-supply.service';
import { sweepProviderChecks } from './housing-provider.service';
import { sweepPractitionerRechecks } from './wellness/practitioner-recheck.service';

const isProductionRuntime =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER_ENV === 'production';
const VIDEO_PROCESSOR_URL = process.env.VIDEO_PROCESSOR_URL;
const WORKER_STARTUP_TIMEOUT_MS = parseInt(process.env.WORKER_STARTUP_TIMEOUT_MS || '10000', 10);
// A full retention sweep walks every table with a cutoff and can hard-delete
// users one transaction at a time, so it comfortably outlives BullMQ's 30s
// default lock. Without a longer lock the job is declared stalled mid-sweep and
// redelivered on top of the run that is still going.
const SCHEDULED_TASK_LOCK_MS = parseInt(process.env.SCHEDULED_TASK_LOCK_MS || '1800000', 10);

function canSimulateWorker(feature: string): boolean {
  if (!isProductionRuntime) return true;
  return process.env.WORKER_ALLOW_SIMULATION === 'true' || process.env[`${feature}_ALLOW_SIMULATION`] === 'true';
}

async function postJson<T>(baseUrl: string | undefined, path: string, payload: Record<string, any>, serviceName: string): Promise<T> {
  if (!baseUrl) {
    throw new Error(`${serviceName} URL is required for production worker processing`);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${serviceName} request failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
  }

  return response.json() as Promise<T>;
}

async function callVideoProcessor<T>(path: string, payload: Record<string, any>): Promise<T> {
  return postJson<T>(VIDEO_PROCESSOR_URL, path, payload, 'Video processor');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ===========================================
// REDIS CONNECTION FOR WORKERS
// ===========================================

const redisConnection = new Redis(resolveWorkerRedisUrl(), {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Cast to any to avoid version mismatch between ioredis and bullmq's bundled ioredis
const workerOptions = {
  connection: redisConnection as any,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
};

// ===========================================
// VIDEO PROCESSING WORKER
// ===========================================

export const videoWorker = new Worker<VideoProcessingJob>(
  QUEUE_NAMES.VIDEO_PROCESSING,
  async (job: Job<VideoProcessingJob>) => {
    const { videoId, userId, inputUrl, options } = job.data;
    logger.info('Processing video', { jobId: job.id, videoId });

    try {
      // The same rule as videoWorkerRunsPipelineInProcess in utils/worker-config,
      // which is what utils/video-queue asks before queueing a reel. It queues
      // only when this branch is not taken, because nothing here applies the
      // outputs an external transcoder sends back.
      if (!canSimulateWorker('VIDEO_PROCESSING')) {
        const result = await callVideoProcessor<{ outputs: Record<string, string> }>('/process', {
          jobId: job.id,
          videoId,
          userId,
          inputUrl,
          options,
        });
        await job.updateProgress(100);
        logger.info('Video processing completed by external processor', {
          jobId: job.id,
          videoId,
          outputs: result.outputs,
        });
        return { success: true, outputs: result.outputs };
      }

      // No external processor: run the ffmpeg pipeline on this worker. It
      // publishes the reel itself and never throws.
      await job.updateProgress(10);
      await processVideo(videoId);
      await job.updateProgress(100);
      logger.info('Video processing completed', { jobId: job.id, videoId });

      return { success: true };
    } catch (error: any) {
      logger.error('Video processing failed', { jobId: job.id, videoId, error: error.message });
      throw error;
    }
  },
  { ...workerOptions, concurrency: 2 } // Lower concurrency for heavy tasks
);

// ===========================================
// SCHEDULED TASKS WORKER
// ===========================================

export const scheduledTasksWorker = new Worker<ScheduledTaskJob>(
  QUEUE_NAMES.SCHEDULED_TASKS,
  async (job: Job<ScheduledTaskJob>) => {
    const { task } = job.data;
    logger.info('Scheduled task starting', { jobId: job.id, task });

    switch (task) {
      case SCHEDULED_TASKS.DATA_RETENTION_PURGE: {
        const summary = await dataRetentionService.runAllPurgeJobs();

        // The per-type breakdown is the operational record that the retention
        // promises in the privacy policy were actually kept, so it is logged at
        // info even when nothing was purged.
        logger.info('Data retention purge finished', {
          jobId: job.id,
          totalPurged: summary.totalPurged,
          skipped: summary.skipped,
          durationMs: summary.completedAt.getTime() - summary.startedAt.getTime(),
          purgedByType: summary.results.reduce<Record<string, number>>((acc, result) => {
            acc[result.dataType] = result.recordsPurged;
            return acc;
          }, {}),
          errors: summary.errors,
        });

        return { success: summary.errors.length === 0, totalPurged: summary.totalPurged };
      }
      case SCHEDULED_TASKS.REPORT_DEADLINE_SWEEP: {
        // Reports past the review deadline promised to the person who filed
        // them. alertOverdueReports never throws on a failed send; the count
        // it returns is the truth either way, so it is logged at info even
        // when nothing is late, as the record that the sweep ran.
        const { overdue, alerted } = await alertOverdueReports();
        logger.info('Report deadline sweep finished', { jobId: job.id, overdue, alerted });
        return { success: true, overdue, alerted };
      }
      case SCHEDULED_TASKS.HOUSING_SAFETY_CHECK_SWEEP: {
        // DV-safe listings whose safety check was asked for and is still not
        // done. Like the report sweep it never throws on a failed send, and
        // the counts are logged at info as the record that it ran.
        const { waiting, overdue, notified } = await alertOverdueSafetyChecks();
        logger.info('Housing safety-check sweep finished', { jobId: job.id, waiting, overdue, notified });
        // The same hour keeps the badge honest: a provider check that has run
        // out is marked, and the confidential listings that rested on it come
        // off the list and back into the queue. Never throws.
        const providerChecks = await sweepProviderChecks();
        logger.info('Housing provider-check sweep finished', { jobId: job.id, ...providerChecks });
        return { success: true, waiting, overdue, notified, providerChecks };
      }
      case SCHEDULED_TASKS.PRACTITIONER_RECHECK_SWEEP: {
        // Practitioner verifications a year on: the admins hear who is due,
        // and a lapsed listing comes out of the directory. Never throws; a
        // failure is logged and shown on the operations screen by the service.
        const result = await sweepPractitionerRechecks();
        logger.info('Practitioner re-check sweep finished', { jobId: job.id, ...result });
        return { success: true, ...result };
      }
      default:
        // Unreachable while ScheduledTaskName is exhaustive, but a job left in
        // Redis by an older deploy can carry a task this build never knew.
        throw new Error(`Unknown scheduled task: ${task}`);
    }
  },
  {
    ...workerOptions,
    // Retention work is serialised: two overlapping sweeps would race on the
    // same hard-delete transactions for no throughput gain. The cost is that
    // the hourly report-deadline sweep waits behind a long overnight purge;
    // it runs as soon as the purge finishes, reading the clock then.
    concurrency: 1,
    lockDuration: SCHEDULED_TASK_LOCK_MS,
  }
);

// ===========================================
// WORKER EVENT HANDLERS
// ===========================================

const workers = [videoWorker, scheduledTasksWorker];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    logger.debug('Job completed', { queue: worker.name, jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { queue: worker.name, jobId: job?.id, error: err.message });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { queue: worker.name, error: err.message });
  });
});

// ===========================================
// WORKER LIFECYCLE
// ===========================================

/**
 * Start all workers - they begin processing jobs immediately
 */
export async function startAllWorkers(): Promise<void> {
  logger.info('Starting all background workers...');
  
  await withTimeout(
    Promise.all(workers.map((worker) => worker.waitUntilReady())).then(() => undefined),
    WORKER_STARTUP_TIMEOUT_MS,
    'Background worker startup'
  );

  workers.forEach((worker) => {
    logger.info(`Worker started: ${worker.name}`);
  });

  // Registered only after the workers are ready, so a schedule is never armed
  // in a process that cannot consume it. The upsert is idempotent across
  // replicas, so every instance calling this still yields one schedule.
  await registerRecurringJobs();

  // From here a new reel may go on the video queue (utils/video-queue); before
  // it, and in any process where this never ran, reels are processed in memory.
  markWorkersRunning(true);

  logger.info(`All ${workers.length} workers started successfully`);
}

/**
 * Stop all workers gracefully
 */
export async function stopAllWorkers(): Promise<void> {
  logger.info('Stopping all workers...');
  // First, so an upload that lands during shutdown is processed in memory
  // rather than queued behind workers that are closing.
  markWorkersRunning(false);
  await Promise.all(workers.map((w) => w.close()));
  await redisConnection.quit();
  logger.info('All workers stopped');
}

// Alias for backward compatibility
export const closeAllWorkers = stopAllWorkers;

