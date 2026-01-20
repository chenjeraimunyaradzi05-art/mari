/**
 * Data Pipeline ETL Service
 * =========================
 * Extracts interaction data for ML model training and analytics.
 */
interface ExtractionConfig {
    startDate: Date;
    endDate: Date;
    batchSize: number;
    outputFormat: 'json' | 'csv' | 'parquet';
}
interface InteractionEvent {
    eventId: string;
    userId: string;
    eventType: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, any>;
    timestamp: Date;
}
/**
 * Extract user interaction events for ML training
 */
export declare function extractInteractionEvents(config: ExtractionConfig): Promise<InteractionEvent[]>;
/**
 * Extract user profiles for ML features
 */
export declare function extractUserProfiles(config: ExtractionConfig): Promise<any[]>;
/**
 * Extract job posting data for recommendation training
 */
export declare function extractJobData(config: ExtractionConfig): Promise<any[]>;
/**
 * Run daily ETL pipeline and upload to S3
 */
export declare function runDailyETL(): Promise<{
    success: boolean;
    files: string[];
}>;
/**
 * Generate training dataset for a specific model
 */
export declare function generateTrainingDataset(modelName: string, config: ExtractionConfig): Promise<string>;
export {};
//# sourceMappingURL=etl.service.d.ts.map