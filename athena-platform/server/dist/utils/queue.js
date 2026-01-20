"use strict";
/**
 * BullMQ Job Queue Configuration
 * ===============================
 * Background job processing for heavy tasks.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledTasksQueue = exports.analyticsQueue = exports.dataExportQueue = exports.mlInferenceQueue = exports.searchIndexingQueue = exports.pushQueue = exports.emailQueue = exports.videoProcessingQueue = exports.QUEUE_NAMES = void 0;
exports.queueVideoProcessing = queueVideoProcessing;
exports.queueEmail = queueEmail;
exports.queuePushNotification = queuePushNotification;
exports.queueSearchIndexing = queueSearchIndexing;
exports.queueMLInference = queueMLInference;
exports.queueDataExport = queueDataExport;
exports.queueAnalyticsEvent = queueAnalyticsEvent;
exports.getQueueStats = getQueueStats;
exports.getAllQueueStats = getAllQueueStats;
exports.closeAllQueues = closeAllQueues;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
// ===========================================
// REDIS CONNECTION
// ===========================================
const redisConnection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
});
redisConnection.on('error', (err) => {
    logger_1.logger.error('BullMQ Redis connection error', { error: err.message });
});
// ===========================================
// QUEUE DEFINITIONS
// ===========================================
exports.QUEUE_NAMES = {
    VIDEO_PROCESSING: 'video-processing',
    EMAIL_NOTIFICATIONS: 'email-notifications',
    PUSH_NOTIFICATIONS: 'push-notifications',
    SEARCH_INDEXING: 'search-indexing',
    ML_INFERENCE: 'ml-inference',
    DATA_EXPORT: 'data-export',
    ANALYTICS: 'analytics',
    SCHEDULED_TASKS: 'scheduled-tasks',
};
// ===========================================
// QUEUE INSTANCES
// ===========================================
const defaultQueueOptions = {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
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
exports.videoProcessingQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.VIDEO_PROCESSING, defaultQueueOptions);
exports.emailQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.EMAIL_NOTIFICATIONS, defaultQueueOptions);
exports.pushQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.PUSH_NOTIFICATIONS, defaultQueueOptions);
exports.searchIndexingQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.SEARCH_INDEXING, defaultQueueOptions);
exports.mlInferenceQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.ML_INFERENCE, defaultQueueOptions);
exports.dataExportQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.DATA_EXPORT, defaultQueueOptions);
exports.analyticsQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.ANALYTICS, defaultQueueOptions);
exports.scheduledTasksQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.SCHEDULED_TASKS, defaultQueueOptions);
// ===========================================
// JOB PRODUCERS (Add jobs to queues)
// ===========================================
async function queueVideoProcessing(job, priority) {
    return exports.videoProcessingQueue.add('process-video', job, {
        priority: priority || 5,
        jobId: `video-${job.videoId}-${Date.now()}`,
    });
}
async function queueEmail(job, delay) {
    return exports.emailQueue.add('send-email', job, {
        delay,
        jobId: `email-${job.to}-${Date.now()}`,
    });
}
async function queuePushNotification(job) {
    return exports.pushQueue.add('send-push', job, {
        jobId: `push-${job.userId}-${Date.now()}`,
    });
}
async function queueSearchIndexing(job) {
    return exports.searchIndexingQueue.add('index-document', job, {
        jobId: `search-${job.operation}-${job.documentId}`,
        // Dedupe by document ID - only latest update matters
        jobId: `${job.indexName}-${job.documentId}`,
    });
}
async function queueMLInference(job, priority) {
    return exports.mlInferenceQueue.add('ml-inference', job, {
        priority: priority || 5,
        jobId: `ml-${job.algorithm}-${job.userId}-${Date.now()}`,
    });
}
async function queueDataExport(job) {
    return exports.dataExportQueue.add('export-data', job, {
        jobId: `export-${job.userId}-${job.exportType}`,
        attempts: 1, // Don't retry exports
    });
}
async function queueAnalyticsEvent(job) {
    return exports.analyticsQueue.add('track-event', job, {
        removeOnComplete: true,
        removeOnFail: { age: 3600 }, // Keep failed for 1 hour only
    });
}
// ===========================================
// QUEUE STATS
// ===========================================
async function getQueueStats(queueName) {
    const queue = getQueue(queueName);
    if (!queue)
        return null;
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
}
async function getAllQueueStats() {
    const stats = {};
    for (const name of Object.values(exports.QUEUE_NAMES)) {
        stats[name] = await getQueueStats(name);
    }
    return stats;
}
function getQueue(name) {
    switch (name) {
        case exports.QUEUE_NAMES.VIDEO_PROCESSING:
            return exports.videoProcessingQueue;
        case exports.QUEUE_NAMES.EMAIL_NOTIFICATIONS:
            return exports.emailQueue;
        case exports.QUEUE_NAMES.PUSH_NOTIFICATIONS:
            return exports.pushQueue;
        case exports.QUEUE_NAMES.SEARCH_INDEXING:
            return exports.searchIndexingQueue;
        case exports.QUEUE_NAMES.ML_INFERENCE:
            return exports.mlInferenceQueue;
        case exports.QUEUE_NAMES.DATA_EXPORT:
            return exports.dataExportQueue;
        case exports.QUEUE_NAMES.ANALYTICS:
            return exports.analyticsQueue;
        default:
            return null;
    }
}
// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================
async function closeAllQueues() {
    await Promise.all([
        exports.videoProcessingQueue.close(),
        exports.emailQueue.close(),
        exports.pushQueue.close(),
        exports.searchIndexingQueue.close(),
        exports.mlInferenceQueue.close(),
        exports.dataExportQueue.close(),
        exports.analyticsQueue.close(),
        exports.scheduledTasksQueue.close(),
    ]);
    await redisConnection.quit();
    logger_1.logger.info('All BullMQ queues closed');
}
//# sourceMappingURL=queue.js.map