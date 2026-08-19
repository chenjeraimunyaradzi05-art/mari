/**
 * BullMQ Workers
 * ==============
 * Background job processors for all queues.
 */
import { Worker } from 'bullmq';
import { VideoProcessingJob, EmailJob, PushNotificationJob, SearchIndexingJob, MLInferenceJob, DataExportJob, AnalyticsJob } from '../utils/queue';
export declare const videoWorker: Worker<VideoProcessingJob, any, string>;
export declare const emailWorker: Worker<EmailJob, any, string>;
export declare const pushWorker: Worker<PushNotificationJob, any, string>;
export declare const searchIndexingWorker: Worker<SearchIndexingJob, any, string>;
export declare const mlInferenceWorker: Worker<MLInferenceJob, any, string>;
export declare const dataExportWorker: Worker<DataExportJob, any, string>;
export declare const analyticsWorker: Worker<AnalyticsJob, any, string>;
/**
 * Start all workers - they begin processing jobs immediately
 */
export declare function startAllWorkers(): Promise<void>;
/**
 * Stop all workers gracefully
 */
export declare function stopAllWorkers(): Promise<void>;
export declare const closeAllWorkers: typeof stopAllWorkers;
//# sourceMappingURL=workers.service.d.ts.map