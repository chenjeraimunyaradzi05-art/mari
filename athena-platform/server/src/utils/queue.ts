/**
 * BullMQ Job Queue Configuration
 * ===============================
 * Background job processing for heavy tasks.
 */

import { Queue, Worker, Job, QueueEvents, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { logger } from './logger';

// ===========================================
// REDIS CONNECTION
// ===========================================

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  logger.error('BullMQ Redis connection error', { error: err.message });
});

// ===========================================
// QUEUE DEFINITIONS
// ===========================================

export const QUEUE_NAMES = {
  VIDEO_PROCESSING: 'video-processing',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  PUSH_NOTIFICATIONS: 'push-notifications',
  SEARCH_INDEXING: 'search-indexing',
  ML_INFERENCE: 'ml-inference',
  DATA_EXPORT: 'data-export',
  ANALYTICS: 'analytics',
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
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL_NOTIFICATIONS, defaultQueueOptions);
export const pushQueue = new Queue(QUEUE_NAMES.PUSH_NOTIFICATIONS, defaultQueueOptions);
export const searchIndexingQueue = new Queue(QUEUE_NAMES.SEARCH_INDEXING, defaultQueueOptions);
export const mlInferenceQueue = new Queue(QUEUE_NAMES.ML_INFERENCE, defaultQueueOptions);
export const dataExportQueue = new Queue(QUEUE_NAMES.DATA_EXPORT, defaultQueueOptions);
export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, defaultQueueOptions);
export const scheduledTasksQueue = new Queue(QUEUE_NAMES.SCHEDULED_TASKS, defaultQueueOptions);

// ===========================================
// JOB TYPES
// ===========================================

export interface VideoProcessingJob {
  type: 'transcode' | 'thumbnail' | 'caption';
  videoId: string;
  userId: string;
  inputUrl: string;
  options: {
    formats?: string[];
    generateCaptions?: boolean;
    generateThumbnail?: boolean;
  };
}

export interface EmailJob {
  type: 'transactional' | 'marketing' | 'digest';
  to: string;
  templateId: string;
  variables: Record<string, any>;
  userId?: string;
}

export interface PushNotificationJob {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  deviceTokens?: string[];
}

export interface SearchIndexingJob {
  operation: 'index' | 'update' | 'delete';
  indexName: string;
  documentId: string;
  document?: Record<string, any>;
}

export interface MLInferenceJob {
  algorithm: 'career_compass' | 'mentor_match' | 'safety_score' | 'ranker' | 'feed';
  userId: string;
  input: Record<string, any>;
  callbackUrl?: string;
}

export interface DataExportJob {
  userId: string;
  exportType: 'gdpr' | 'analytics' | 'full';
  format: 'json' | 'csv' | 'zip';
  callbackUrl?: string;
}

export interface AnalyticsJob {
  eventType: string;
  userId?: string;
  properties: Record<string, any>;
  timestamp: Date;
}

// ===========================================
// JOB PRODUCERS (Add jobs to queues)
// ===========================================

export async function queueVideoProcessing(job: VideoProcessingJob, priority?: number) {
  return videoProcessingQueue.add('process-video', job, {
    priority: priority || 5,
    jobId: `video-${job.videoId}-${Date.now()}`,
  });
}

export async function queueEmail(job: EmailJob, delay?: number) {
  return emailQueue.add('send-email', job, {
    delay,
    jobId: `email-${job.to}-${Date.now()}`,
  });
}

export async function queuePushNotification(job: PushNotificationJob) {
  return pushQueue.add('send-push', job, {
    jobId: `push-${job.userId}-${Date.now()}`,
  });
}

export async function queueSearchIndexing(job: SearchIndexingJob) {
  return searchIndexingQueue.add('index-document', job, {
    // Dedupe by document ID - only latest update matters
    jobId: `${job.indexName}-${job.documentId}`,
  });
}

export async function queueMLInference(job: MLInferenceJob, priority?: number) {
  return mlInferenceQueue.add('ml-inference', job, {
    priority: priority || 5,
    jobId: `ml-${job.algorithm}-${job.userId}-${Date.now()}`,
  });
}

export async function queueDataExport(job: DataExportJob) {
  return dataExportQueue.add('export-data', job, {
    jobId: `export-${job.userId}-${job.exportType}`,
    attempts: 1, // Don't retry exports
  });
}

export async function queueAnalyticsEvent(job: AnalyticsJob) {
  return analyticsQueue.add('track-event', job, {
    removeOnComplete: true,
    removeOnFail: { age: 3600 }, // Keep failed for 1 hour only
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
    case QUEUE_NAMES.EMAIL_NOTIFICATIONS:
      return emailQueue;
    case QUEUE_NAMES.PUSH_NOTIFICATIONS:
      return pushQueue;
    case QUEUE_NAMES.SEARCH_INDEXING:
      return searchIndexingQueue;
    case QUEUE_NAMES.ML_INFERENCE:
      return mlInferenceQueue;
    case QUEUE_NAMES.DATA_EXPORT:
      return dataExportQueue;
    case QUEUE_NAMES.ANALYTICS:
      return analyticsQueue;
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
    emailQueue.close(),
    pushQueue.close(),
    searchIndexingQueue.close(),
    mlInferenceQueue.close(),
    dataExportQueue.close(),
    analyticsQueue.close(),
    scheduledTasksQueue.close(),
  ]);
  await redisConnection.quit();
  logger.info('All BullMQ queues closed');
}
