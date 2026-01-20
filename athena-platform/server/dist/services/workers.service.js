"use strict";
/**
 * BullMQ Workers
 * ==============
 * Background job processors for all queues.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeAllWorkers = exports.analyticsWorker = exports.dataExportWorker = exports.mlInferenceWorker = exports.searchIndexingWorker = exports.pushWorker = exports.emailWorker = exports.videoWorker = void 0;
exports.startAllWorkers = startAllWorkers;
exports.stopAllWorkers = stopAllWorkers;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const queue_1 = require("../utils/queue");
const opensearch_1 = require("../utils/opensearch");
const ml_service_1 = require("./ml.service");
const email_1 = require("../utils/email");
// ===========================================
// REDIS CONNECTION FOR WORKERS
// ===========================================
const redisConnection = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
const workerOptions = {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
};
// ===========================================
// VIDEO PROCESSING WORKER
// ===========================================
exports.videoWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.VIDEO_PROCESSING, async (job) => {
    const { videoId, userId, inputUrl, options } = job.data;
    logger_1.logger.info('Processing video', { jobId: job.id, videoId });
    try {
        // Update progress
        await job.updateProgress(10);
        // In production, this would call FFmpeg or a video processing service
        // For now, simulate processing
        await simulateProcessing(2000);
        await job.updateProgress(50);
        // Generate outputs
        const outputs = {};
        if (options.formats?.includes('720p')) {
            outputs.mp4_720p = `https://cdn.athena.com/videos/${videoId}/720p.mp4`;
        }
        if (options.formats?.includes('hls')) {
            outputs.hls = `https://cdn.athena.com/videos/${videoId}/master.m3u8`;
        }
        if (options.generateThumbnail) {
            outputs.thumbnail = `https://cdn.athena.com/videos/${videoId}/thumb.jpg`;
        }
        await job.updateProgress(100);
        logger_1.logger.info('Video processing completed', { jobId: job.id, videoId, outputs });
        return { success: true, outputs };
    }
    catch (error) {
        logger_1.logger.error('Video processing failed', { jobId: job.id, videoId, error: error.message });
        throw error;
    }
}, { ...workerOptions, concurrency: 2 } // Lower concurrency for heavy tasks
);
// ===========================================
// EMAIL WORKER
// ===========================================
exports.emailWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.EMAIL_NOTIFICATIONS, async (job) => {
    const { to, templateId, variables, type } = job.data;
    logger_1.logger.info('Sending email', { jobId: job.id, to, templateId, type });
    try {
        await (0, email_1.sendEmail)({
            to,
            templateId,
            variables,
        });
        logger_1.logger.info('Email sent successfully', { jobId: job.id, to });
        return { success: true, sentAt: new Date().toISOString() };
    }
    catch (error) {
        logger_1.logger.error('Email sending failed', { jobId: job.id, to, error: error.message });
        throw error;
    }
}, workerOptions);
// ===========================================
// PUSH NOTIFICATION WORKER
// ===========================================
exports.pushWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.PUSH_NOTIFICATIONS, async (job) => {
    const { userId, title, body, data } = job.data;
    logger_1.logger.info('Sending push notification', { jobId: job.id, userId });
    try {
        // In production, this would use Firebase FCM or similar
        // For now, just log
        logger_1.logger.info('Push notification sent', { jobId: job.id, userId, title });
        return { success: true, sentAt: new Date().toISOString() };
    }
    catch (error) {
        logger_1.logger.error('Push notification failed', { jobId: job.id, userId, error: error.message });
        throw error;
    }
}, workerOptions);
// ===========================================
// SEARCH INDEXING WORKER
// ===========================================
exports.searchIndexingWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.SEARCH_INDEXING, async (job) => {
    const { operation, indexName, documentId, document } = job.data;
    logger_1.logger.debug('Search indexing job', { jobId: job.id, operation, indexName, documentId });
    try {
        switch (operation) {
            case 'index':
            case 'update':
                if (document) {
                    await (0, opensearch_1.indexDocument)(indexName, documentId, document);
                }
                break;
            case 'delete':
                await (0, opensearch_1.deleteDocument)(indexName, documentId);
                break;
        }
        return { success: true, operation, documentId };
    }
    catch (error) {
        logger_1.logger.error('Search indexing failed', { jobId: job.id, operation, documentId, error: error.message });
        throw error;
    }
}, { ...workerOptions, concurrency: 10 } // Higher concurrency for fast operations
);
// ===========================================
// ML INFERENCE WORKER
// ===========================================
exports.mlInferenceWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.ML_INFERENCE, async (job) => {
    const { algorithm, userId, input, callbackUrl } = job.data;
    logger_1.logger.info('ML inference job', { jobId: job.id, algorithm, userId });
    try {
        let result;
        switch (algorithm) {
            case 'career_compass':
                result = await ml_service_1.mlService.predictCareerGrowth({ user_id: userId, ...input });
                break;
            case 'safety_score':
                result = await ml_service_1.mlService.calculateSafetyScore({ user_id: userId, ...input });
                break;
            case 'mentor_match':
                result = await ml_service_1.mlService.findMentorMatches({ user_id: userId, ...input });
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
        logger_1.logger.info('ML inference completed', { jobId: job.id, algorithm });
        return { success: true, result };
    }
    catch (error) {
        logger_1.logger.error('ML inference failed', { jobId: job.id, algorithm, error: error.message });
        throw error;
    }
}, { ...workerOptions, concurrency: 3 });
// ===========================================
// DATA EXPORT WORKER
// ===========================================
exports.dataExportWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.DATA_EXPORT, async (job) => {
    const { userId, exportType, format } = job.data;
    logger_1.logger.info('Data export job', { jobId: job.id, userId, exportType });
    try {
        await job.updateProgress(10);
        // In production, this would gather all user data
        // For now, simulate
        await simulateProcessing(5000);
        await job.updateProgress(80);
        const exportUrl = `https://exports.athena.com/${userId}/${exportType}-${Date.now()}.${format}`;
        await job.updateProgress(100);
        logger_1.logger.info('Data export completed', { jobId: job.id, userId, exportUrl });
        return { success: true, exportUrl };
    }
    catch (error) {
        logger_1.logger.error('Data export failed', { jobId: job.id, userId, error: error.message });
        throw error;
    }
}, { ...workerOptions, concurrency: 2 });
// ===========================================
// ANALYTICS WORKER
// ===========================================
exports.analyticsWorker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.ANALYTICS, async (job) => {
    const { eventType, userId, properties, timestamp } = job.data;
    try {
        // In production, this would send to analytics service (Mixpanel, Amplitude, etc.)
        // For now, just log
        logger_1.logger.debug('Analytics event', { eventType, userId, properties });
        return { success: true };
    }
    catch (error) {
        // Don't throw for analytics failures - they're not critical
        logger_1.logger.warn('Analytics event failed', { eventType, error: error.message });
        return { success: false, error: error.message };
    }
}, { ...workerOptions, concurrency: 20 } // High concurrency for analytics
);
// ===========================================
// WORKER EVENT HANDLERS
// ===========================================
const workers = [
    exports.videoWorker,
    exports.emailWorker,
    exports.pushWorker,
    exports.searchIndexingWorker,
    exports.mlInferenceWorker,
    exports.dataExportWorker,
    exports.analyticsWorker,
];
workers.forEach((worker) => {
    worker.on('completed', (job) => {
        logger_1.logger.debug('Job completed', { queue: worker.name, jobId: job.id });
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error('Job failed', { queue: worker.name, jobId: job?.id, error: err.message });
    });
    worker.on('error', (err) => {
        logger_1.logger.error('Worker error', { queue: worker.name, error: err.message });
    });
});
// ===========================================
// HELPERS
// ===========================================
function simulateProcessing(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ===========================================
// WORKER LIFECYCLE
// ===========================================
/**
 * Start all workers - they begin processing jobs immediately
 */
async function startAllWorkers() {
    logger_1.logger.info('Starting all background workers...');
    // Workers are already started when instantiated
    // This function serves as a formal startup point and logs status
    workers.forEach((worker) => {
        logger_1.logger.info(`Worker started: ${worker.name}`);
    });
    logger_1.logger.info(`All ${workers.length} workers started successfully`);
}
/**
 * Stop all workers gracefully
 */
async function stopAllWorkers() {
    logger_1.logger.info('Stopping all workers...');
    await Promise.all(workers.map((w) => w.close()));
    await redisConnection.quit();
    logger_1.logger.info('All workers stopped');
}
// Alias for backward compatibility
exports.closeAllWorkers = stopAllWorkers;
//# sourceMappingURL=workers.service.js.map