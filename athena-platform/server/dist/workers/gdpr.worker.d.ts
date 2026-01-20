/**
 * Simplified GDPR Compliance Worker
 * Background jobs for data export and deletion requests
 * Phase 4: UK/EU Market Launch
 *
 * Note: This is a simplified version that works with the current schema.
 * For production, consider using the full implementation with archiver package.
 */
/**
 * Process pending data export requests
 */
export declare function processExportRequests(): Promise<{
    processed: number;
    failed: number;
}>;
/**
 * Process pending deletion requests
 */
export declare function processDeletionRequests(): Promise<{
    processed: number;
    failed: number;
}>;
/**
 * Clean up expired exports
 */
export declare function cleanupExpiredExports(): Promise<number>;
export declare const gdprWorker: {
    processExportRequests: typeof processExportRequests;
    processDeletionRequests: typeof processDeletionRequests;
    cleanupExpiredExports: typeof cleanupExpiredExports;
};
//# sourceMappingURL=gdpr.worker.d.ts.map