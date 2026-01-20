/**
 * BullMQ Job Queue Configuration
 * ===============================
 * Background job processing for heavy tasks.
 */
import { Queue, Job } from 'bullmq';
export declare const QUEUE_NAMES: {
    readonly VIDEO_PROCESSING: "video-processing";
    readonly EMAIL_NOTIFICATIONS: "email-notifications";
    readonly PUSH_NOTIFICATIONS: "push-notifications";
    readonly SEARCH_INDEXING: "search-indexing";
    readonly ML_INFERENCE: "ml-inference";
    readonly DATA_EXPORT: "data-export";
    readonly ANALYTICS: "analytics";
    readonly SCHEDULED_TASKS: "scheduled-tasks";
};
export declare const videoProcessingQueue: Queue<any, any, string, any, any, string>;
export declare const emailQueue: Queue<any, any, string, any, any, string>;
export declare const pushQueue: Queue<any, any, string, any, any, string>;
export declare const searchIndexingQueue: Queue<any, any, string, any, any, string>;
export declare const mlInferenceQueue: Queue<any, any, string, any, any, string>;
export declare const dataExportQueue: Queue<any, any, string, any, any, string>;
export declare const analyticsQueue: Queue<any, any, string, any, any, string>;
export declare const scheduledTasksQueue: Queue<any, any, string, any, any, string>;
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
export declare function queueVideoProcessing(job: VideoProcessingJob, priority?: number): Promise<Job<any, any, string>>;
export declare function queueEmail(job: EmailJob, delay?: number): Promise<Job<any, any, string>>;
export declare function queuePushNotification(job: PushNotificationJob): Promise<Job<any, any, string>>;
export declare function queueSearchIndexing(job: SearchIndexingJob): Promise<Job<any, any, string>>;
export declare function queueMLInference(job: MLInferenceJob, priority?: number): Promise<Job<any, any, string>>;
export declare function queueDataExport(job: DataExportJob): Promise<Job<any, any, string>>;
export declare function queueAnalyticsEvent(job: AnalyticsJob): Promise<Job<any, any, string>>;
export declare function getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
} | null>;
export declare function getAllQueueStats(): Promise<Record<string, any>>;
export declare function closeAllQueues(): Promise<void>;
//# sourceMappingURL=queue.d.ts.map