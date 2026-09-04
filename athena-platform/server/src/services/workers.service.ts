/**
 * BullMQ Workers
 * ==============
 * Background job processors for all queues.
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import {
  QUEUE_NAMES,
  SCHEDULED_TASKS,
  VideoProcessingJob,
  EmailJob,
  PushNotificationJob,
  SearchIndexingJob,
  MLInferenceJob,
  DataExportJob,
  AnalyticsJob,
  ScheduledTaskJob,
  registerRecurringJobs,
} from '../utils/queue';
import { dataRetentionService } from '../scripts/data-retention';
import { indexDocument, deleteDocument, isOpenSearchEnabled } from '../utils/opensearch';
import { mlService } from './ml.service';
import { sendEmail } from '../utils/email';
import { resolveWorkerRedisUrl } from '../utils/worker-config';
import { processVideo } from './video-pipeline.service';

const isProductionRuntime =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER_ENV === 'production';
const VIDEO_PROCESSOR_URL = process.env.VIDEO_PROCESSOR_URL;
const PUSH_NOTIFICATION_PROVIDER_URL = process.env.PUSH_NOTIFICATION_PROVIDER_URL;
const DATA_EXPORT_PROCESSOR_URL = process.env.DATA_EXPORT_PROCESSOR_URL;
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

async function callPushProvider<T>(payload: Record<string, any>): Promise<T> {
  return postJson<T>(PUSH_NOTIFICATION_PROVIDER_URL, '/send', payload, 'Push notification provider');
}

async function callDataExportProcessor<T>(payload: Record<string, any>): Promise<T> {
  return postJson<T>(DATA_EXPORT_PROCESSOR_URL, '/export', payload, 'Data export processor');
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
// EMAIL WORKER
// ===========================================

export const emailWorker = new Worker<EmailJob>(
  QUEUE_NAMES.EMAIL_NOTIFICATIONS,
  async (job: Job<EmailJob>) => {
    const { to, templateId, variables, type } = job.data;
    logger.info('Sending email', { jobId: job.id, to, templateId, type });

    try {
      // Build email content from template/variables
      // In production, use a proper template engine
      const subject = variables?.subject || `ATHENA Notification: ${type}`;
      const html = variables?.html || `<p>${variables?.body || 'You have a new notification from ATHENA.'}</p>`;
      
      const sent = await sendEmail({
        to,
        subject,
        html,
      });

      if (!sent) {
        throw new Error('Email provider did not accept the message');
      }

      logger.info('Email sent successfully', { jobId: job.id, to });
      return { success: true, sentAt: new Date().toISOString() };
    } catch (error: any) {
      logger.error('Email sending failed', { jobId: job.id, to, error: error.message });
      throw error;
    }
  },
  workerOptions
);

// ===========================================
// PUSH NOTIFICATION WORKER
// ===========================================

export const pushWorker = new Worker<PushNotificationJob>(
  QUEUE_NAMES.PUSH_NOTIFICATIONS,
  async (job: Job<PushNotificationJob>) => {
    const { userId, title, body, data, deviceTokens } = job.data;
    logger.info('Sending push notification', { jobId: job.id, userId });

    try {
      if (!canSimulateWorker('PUSH_NOTIFICATION')) {
        const result = await callPushProvider<{
          sentCount?: number;
          failureCount?: number;
          providerMessageId?: string;
        }>({
          jobId: job.id,
          userId,
          title,
          body,
          data,
          deviceTokens,
        });

        logger.info('Push notification sent by provider', {
          jobId: job.id,
          userId,
          sentCount: result.sentCount,
          failureCount: result.failureCount,
        });
        return { success: true, sentAt: new Date().toISOString(), ...result };
      }

      logger.info('Push notification simulated', { jobId: job.id, userId, title });
      return { success: true, simulated: true, sentAt: new Date().toISOString() };
    } catch (error: any) {
      logger.error('Push notification failed', { jobId: job.id, userId, error: error.message });
      throw error;
    }
  },
  workerOptions
);

// ===========================================
// SEARCH INDEXING WORKER
// ===========================================

export const searchIndexingWorker = new Worker<SearchIndexingJob>(
  QUEUE_NAMES.SEARCH_INDEXING,
  async (job: Job<SearchIndexingJob>) => {
    const { operation, indexName, documentId, document } = job.data;
    logger.debug('Search indexing job', { jobId: job.id, operation, indexName, documentId });

    try {
      if (!isOpenSearchEnabled()) {
        logger.debug('Search indexing skipped because OpenSearch is disabled', {
          jobId: job.id,
          operation,
          indexName,
          documentId,
        });
        return { success: true, skipped: true, reason: 'opensearch_disabled', operation, documentId };
      }

      let indexed = false;
      switch (operation) {
        case 'index':
        case 'update':
          if (document) {
            indexed = await indexDocument(indexName, documentId, document);
          }
          break;
        case 'delete':
          indexed = await deleteDocument(indexName, documentId);
          break;
      }

      if (!indexed) {
        throw new Error('OpenSearch is enabled but the document was not indexed');
      }

      return { success: true, operation, documentId };
    } catch (error: any) {
      logger.error('Search indexing failed', { jobId: job.id, operation, documentId, error: error.message });
      throw error;
    }
  },
  { ...workerOptions, concurrency: 10 } // Higher concurrency for fast operations
);

// ===========================================
// ML INFERENCE WORKER
// ===========================================

export const mlInferenceWorker = new Worker<MLInferenceJob>(
  QUEUE_NAMES.ML_INFERENCE,
  async (job: Job<MLInferenceJob>) => {
    const { algorithm, userId, input, callbackUrl } = job.data;
    logger.info('ML inference job', { jobId: job.id, algorithm, userId });

    try {
      let result: any;
      // Cast input as any since the full profile is expected in job.data.input
      const profileInput = { user_id: userId, ...input } as any;

      switch (algorithm) {
        case 'career_compass':
          result = await mlService.predictCareerGrowth(profileInput);
          break;
        case 'safety_score':
          result = await mlService.calculateSafetyScore(profileInput);
          break;
        case 'mentor_match':
          result = await mlService.findMentorMatches(profileInput);
          break;
        default:
          throw new Error(`Unknown algorithm: ${algorithm}`);
      }

      // If callback URL provided, POST result
      if (callbackUrl) {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id, result }),
        });
      }

      logger.info('ML inference completed', { jobId: job.id, algorithm });
      return { success: true, result };
    } catch (error: any) {
      logger.error('ML inference failed', { jobId: job.id, algorithm, error: error.message });
      throw error;
    }
  },
  { ...workerOptions, concurrency: 3 }
);

// ===========================================
// DATA EXPORT WORKER
// ===========================================

export const dataExportWorker = new Worker<DataExportJob>(
  QUEUE_NAMES.DATA_EXPORT,
  async (job: Job<DataExportJob>) => {
    const { userId, exportType, format } = job.data;
    logger.info('Data export job', { jobId: job.id, userId, exportType });

    try {
      await job.updateProgress(10);

      if (!canSimulateWorker('DATA_EXPORT')) {
        const result = await callDataExportProcessor<{ exportUrl: string; expiresAt?: string }>({
          jobId: job.id,
          userId,
          exportType,
          format,
        });

        if (!result.exportUrl) {
          throw new Error('Data export processor completed without an exportUrl');
        }

        await job.updateProgress(100);
        logger.info('Data export completed by processor', { jobId: job.id, userId, exportUrl: result.exportUrl });
        return { success: true, exportUrl: result.exportUrl, expiresAt: result.expiresAt };
      }

      await simulateProcessing(5000);
      await job.updateProgress(80);

      const exportUrl = `https://exports.athena.com/${userId}/${exportType}-${Date.now()}.${format}`;

      await job.updateProgress(100);
      logger.info('Data export simulated', { jobId: job.id, userId, exportUrl });

      return { success: true, simulated: true, exportUrl };
    } catch (error: any) {
      logger.error('Data export failed', { jobId: job.id, userId, error: error.message });
      throw error;
    }
  },
  { ...workerOptions, concurrency: 2 }
);

// ===========================================
// ANALYTICS WORKER
// ===========================================

export const analyticsWorker = new Worker<AnalyticsJob>(
  QUEUE_NAMES.ANALYTICS,
  async (job: Job<AnalyticsJob>) => {
    const { eventType, userId, properties, timestamp } = job.data;

    try {
      // In production, this would send to analytics service (Mixpanel, Amplitude, etc.)
      // For now, just log
      logger.debug('Analytics event', { eventType, userId, properties });
      return { success: true };
    } catch (error: any) {
      // Don't throw for analytics failures - they're not critical
      logger.warn('Analytics event failed', { eventType, error: error.message });
      return { success: false, error: error.message };
    }
  },
  { ...workerOptions, concurrency: 20 } // High concurrency for analytics
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
      default:
        // Unreachable while ScheduledTaskName is exhaustive, but a job left in
        // Redis by an older deploy can carry a task this build never knew.
        throw new Error(`Unknown scheduled task: ${task}`);
    }
  },
  {
    ...workerOptions,
    // Retention work is serialised: two overlapping sweeps would race on the
    // same hard-delete transactions for no throughput gain.
    concurrency: 1,
    lockDuration: SCHEDULED_TASK_LOCK_MS,
  }
);

// ===========================================
// WORKER EVENT HANDLERS
// ===========================================

const workers = [
  videoWorker,
  emailWorker,
  pushWorker,
  searchIndexingWorker,
  mlInferenceWorker,
  dataExportWorker,
  analyticsWorker,
  scheduledTasksWorker,
];

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
// HELPERS
// ===========================================

function simulateProcessing(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  logger.info(`All ${workers.length} workers started successfully`);
}

/**
 * Stop all workers gracefully
 */
export async function stopAllWorkers(): Promise<void> {
  logger.info('Stopping all workers...');
  await Promise.all(workers.map((w) => w.close()));
  await redisConnection.quit();
  logger.info('All workers stopped');
}

// Alias for backward compatibility
export const closeAllWorkers = stopAllWorkers;

