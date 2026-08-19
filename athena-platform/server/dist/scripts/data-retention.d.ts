/**
 * Data Retention & Purge Jobs
 * Automated cleanup of data according to retention policies
 * Phase 4: GDPR Compliance - Automated Purge Jobs
 */
interface PurgeResult {
    dataType: string;
    recordsPurged: number;
    errors: string[];
    executedAt: Date;
}
interface PurgeJobSummary {
    startedAt: Date;
    completedAt: Date;
    results: PurgeResult[];
    totalPurged: number;
    errors: string[];
}
export declare class DataRetentionService {
    /**
     * Run all scheduled purge jobs
     */
    runAllPurgeJobs(): Promise<PurgeJobSummary>;
    /**
     * Purge expired verification tokens
     */
    purgeExpiredVerificationTokens(): Promise<PurgeResult>;
    /**
     * Purge expired sessions
     */
    purgeExpiredSessions(): Promise<PurgeResult>;
    /**
     * Purge old messages beyond retention period
     */
    purgeOldMessages(excludeUserIds: Set<string>, isHeld: boolean): Promise<PurgeResult>;
    /**
     * Purge old analytics events
     */
    purgeOldAnalyticsEvents(isHeld: boolean): Promise<PurgeResult>;
    /**
     * Permanently delete users who requested deletion 30+ days ago
     */
    purgeSoftDeletedUsers(excludeUserIds: Set<string>): Promise<PurgeResult>;
    /**
     * Hard delete user and all associated data
     */
    private hardDeleteUser;
    /**
     * Purge expired DSAR export files
     */
    purgeExpiredDSARExports(): Promise<PurgeResult>;
    /**
     * Purge old notifications
     */
    purgeOldNotifications(): Promise<PurgeResult>;
    /**
     * Anonymize audit logs older than active retention (keep for compliance but remove PII)
     */
    anonymizeOldAuditLogs(): Promise<PurgeResult>;
    /**
     * Log purge summary for compliance
     */
    private logPurgeSummary;
    /**
     * Get retention policies for transparency
     */
    getRetentionPolicies(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        legalBasis: import(".prisma/client").$Enums.LegalBasis;
        dataType: string;
        dataCategory: import(".prisma/client").$Enums.DataCategory;
        retentionDays: number;
        retentionReason: string;
        softDeleteFirst: boolean;
        hardDeleteAfterDays: number | null;
        anonymizeInstead: boolean;
        canBeLegalHeld: boolean;
        automatedPurge: boolean;
        purgeJobName: string | null;
        lastPurgeAt: Date | null;
        nextPurgeAt: Date | null;
    }[]>;
    /**
     * Initialize default retention policies
     */
    initializeRetentionPolicies(): Promise<void>;
}
export declare const dataRetentionService: DataRetentionService;
export {};
//# sourceMappingURL=data-retention.d.ts.map