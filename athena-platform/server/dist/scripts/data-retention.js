"use strict";
/**
 * Data Retention & Purge Jobs
 * Automated cleanup of data according to retention policies
 * Phase 4: GDPR Compliance - Automated Purge Jobs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataRetentionService = exports.DataRetentionService = void 0;
const client_1 = require("@prisma/client");
const queue_1 = require("../utils/queue");
const prisma = new client_1.PrismaClient();
// Default retention periods (in days)
const DEFAULT_RETENTION_PERIODS = {
    messages: 1095, // 3 years
    audit_logs: 2555, // 7 years (legal requirement)
    payment_records: 2555, // 7 years (legal requirement)
    marketing_data: 730, // 2 years
    analytics_events: 395, // 13 months
    session_data: 30, // 30 days
    verification_tokens: 1, // 1 day
    password_reset_tokens: 1, // 1 day
    soft_deleted_users: 30, // 30 days after deletion request
    inactive_accounts: 730, // 2 years of inactivity
};
class DataRetentionService {
    /**
     * Run all scheduled purge jobs
     */
    async runAllPurgeJobs() {
        const startedAt = new Date();
        const results = [];
        const errors = [];
        console.log('[DataRetention] Starting purge jobs...');
        // Check for legal holds first
        const activeHolds = await prisma.legalHold.findMany({
            where: { isActive: true },
        });
        const heldUserIds = new Set();
        const heldDataTypes = new Set();
        for (const hold of activeHolds) {
            hold.affectedUserIds.forEach(id => heldUserIds.add(id));
            hold.affectedDataTypes.forEach(type => heldDataTypes.add(type));
        }
        // Run each purge job
        const jobs = [
            () => this.purgeExpiredVerificationTokens(),
            () => this.purgeExpiredSessions(),
            () => this.purgeOldMessages(heldUserIds, heldDataTypes.has('messages')),
            () => this.purgeOldAnalyticsEvents(heldDataTypes.has('analytics')),
            () => this.purgeSoftDeletedUsers(heldUserIds),
            () => this.purgeExpiredDSARExports(),
            () => this.purgeOldNotifications(),
            () => this.anonymizeOldAuditLogs(),
        ];
        for (const job of jobs) {
            try {
                const result = await job();
                results.push(result);
            }
            catch (error) {
                errors.push(error.message);
                console.error('[DataRetention] Job failed:', error);
            }
        }
        const completedAt = new Date();
        const totalPurged = results.reduce((sum, r) => sum + r.recordsPurged, 0);
        // Log the purge summary
        await this.logPurgeSummary({
            startedAt,
            completedAt,
            results,
            totalPurged,
            errors,
        });
        console.log(`[DataRetention] Completed. Purged ${totalPurged} records.`);
        return {
            startedAt,
            completedAt,
            results,
            totalPurged,
            errors,
        };
    }
    /**
     * Purge expired verification tokens
     */
    async purgeExpiredVerificationTokens() {
        const result = await prisma.verificationToken.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
        return {
            dataType: 'verification_tokens',
            recordsPurged: result.count,
            errors: [],
            executedAt: new Date(),
        };
    }
    /**
     * Purge expired sessions
     */
    async purgeExpiredSessions() {
        const result = await prisma.session.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
        return {
            dataType: 'sessions',
            recordsPurged: result.count,
            errors: [],
            executedAt: new Date(),
        };
    }
    /**
     * Purge old messages beyond retention period
     */
    async purgeOldMessages(excludeUserIds, isHeld) {
        if (isHeld) {
            return {
                dataType: 'messages',
                recordsPurged: 0,
                errors: ['Skipped: Legal hold active'],
                executedAt: new Date(),
            };
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_PERIODS.messages);
        const whereClause = {
            createdAt: { lt: cutoffDate },
        };
        if (excludeUserIds.size > 0) {
            whereClause.AND = [
                { senderId: { notIn: Array.from(excludeUserIds) } },
                { receiverId: { notIn: Array.from(excludeUserIds) } },
            ];
        }
        const result = await prisma.message.deleteMany({ where: whereClause });
        return {
            dataType: 'messages',
            recordsPurged: result.count,
            errors: [],
            executedAt: new Date(),
        };
    }
    /**
     * Purge old analytics events
     */
    async purgeOldAnalyticsEvents(isHeld) {
        if (isHeld) {
            return {
                dataType: 'analytics_events',
                recordsPurged: 0,
                errors: ['Skipped: Legal hold active'],
                executedAt: new Date(),
            };
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_PERIODS.analytics_events);
        try {
            await (0, queue_1.queueAnalyticsEvent)({
                eventType: 'analytics.purge.requested',
                properties: {
                    cutoffDate: cutoffDate.toISOString(),
                    reason: 'retention_policy',
                },
                timestamp: new Date(),
            });
            return {
                dataType: 'analytics_events',
                recordsPurged: 0,
                errors: [],
                executedAt: new Date(),
            };
        }
        catch (error) {
            return {
                dataType: 'analytics_events',
                recordsPurged: 0,
                errors: [`Failed to enqueue analytics purge: ${error?.message || 'unknown error'}`],
                executedAt: new Date(),
            };
        }
    }
    /**
     * Permanently delete users who requested deletion 30+ days ago
     */
    async purgeSoftDeletedUsers(excludeUserIds) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_PERIODS.soft_deleted_users);
        // Find completed deletion DSARs older than retention period
        const pendingDeletions = await prisma.dSARRequest.findMany({
            where: {
                type: 'DELETION',
                status: 'COMPLETED',
                completedAt: { lt: cutoffDate },
                userId: { notIn: Array.from(excludeUserIds) },
            },
            select: { userId: true },
        });
        let purgedCount = 0;
        const errors = [];
        for (const deletion of pendingDeletions) {
            try {
                // Hard delete user and all related data
                await this.hardDeleteUser(deletion.userId);
                purgedCount++;
            }
            catch (error) {
                errors.push(`Failed to delete user ${deletion.userId}: ${error.message}`);
            }
        }
        return {
            dataType: 'soft_deleted_users',
            recordsPurged: purgedCount,
            errors,
            executedAt: new Date(),
        };
    }
    /**
     * Hard delete user and all associated data
     */
    async hardDeleteUser(userId) {
        await prisma.$transaction(async (tx) => {
            // Delete in order of dependencies
            await tx.comment.deleteMany({ where: { authorId: userId } });
            await tx.like.deleteMany({ where: { userId } });
            await tx.post.deleteMany({ where: { authorId: userId } });
            await tx.message.deleteMany({
                where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            });
            await tx.follow.deleteMany({
                where: { OR: [{ followerId: userId }, { followingId: userId }] },
            });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.groupMember.deleteMany({ where: { userId } });
            await tx.eventRegistration.deleteMany({ where: { userId } });
            await tx.jobApplication.deleteMany({ where: { userId } });
            await tx.savedJob.deleteMany({ where: { userId } });
            await tx.courseEnrollment.deleteMany({ where: { userId } });
            await tx.consentRecord.deleteMany({ where: { userId } });
            await tx.dSARRequest.deleteMany({ where: { userId } });
            await tx.session.deleteMany({ where: { userId } });
            await tx.verificationToken.deleteMany({ where: { userId } });
            await tx.profile.deleteMany({ where: { userId } });
            await tx.subscription.deleteMany({ where: { userId } });
            await tx.user.delete({ where: { id: userId } });
        });
    }
    /**
     * Purge expired DSAR export files
     */
    async purgeExpiredDSARExports() {
        const result = await prisma.dSARRequest.updateMany({
            where: {
                type: 'EXPORT',
                status: 'COMPLETED',
                exportExpiresAt: { lt: new Date() },
                exportUrl: { not: null },
            },
            data: {
                exportUrl: null,
            },
        });
        // In production, also delete the actual files from S3/storage
        return {
            dataType: 'dsar_exports',
            recordsPurged: result.count,
            errors: [],
            executedAt: new Date(),
        };
    }
    /**
     * Purge old notifications
     */
    async purgeOldNotifications() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days
        const result = await prisma.notification.deleteMany({
            where: {
                createdAt: { lt: cutoffDate },
                isRead: true,
            },
        });
        return {
            dataType: 'notifications',
            recordsPurged: result.count,
            errors: [],
            executedAt: new Date(),
        };
    }
    /**
     * Anonymize audit logs older than active retention (keep for compliance but remove PII)
     */
    async anonymizeOldAuditLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 365); // Anonymize after 1 year, keep 7 years total
        const result = await prisma.auditLog.updateMany({
            where: {
                createdAt: { lt: cutoffDate },
                metadata: {
                    path: ['anonymized'],
                    equals: undefined,
                },
            },
            data: {
                metadata: { anonymized: true, anonymizedAt: new Date().toISOString() },
            },
        });
        return {
            dataType: 'audit_logs_anonymized',
            recordsPurged: result.count,
            errors: [],
            executedAt: new Date(),
        };
    }
    /**
     * Log purge summary for compliance
     */
    async logPurgeSummary(summary) {
        await prisma.privacyAuditLog.create({
            data: {
                systemProcess: 'DATA_RETENTION_JOB',
                action: 'AUTOMATED_PURGE',
                resourceType: 'System',
                details: JSON.parse(JSON.stringify({
                    startedAt: summary.startedAt,
                    completedAt: summary.completedAt,
                    totalPurged: summary.totalPurged,
                    results: summary.results,
                    errors: summary.errors,
                })),
            },
        });
    }
    /**
     * Get retention policies for transparency
     */
    async getRetentionPolicies() {
        return prisma.retentionPolicy.findMany({
            orderBy: { dataType: 'asc' },
        });
    }
    /**
     * Initialize default retention policies
     */
    async initializeRetentionPolicies() {
        const policies = [
            {
                dataType: 'user_messages',
                description: 'Direct messages between users',
                dataCategory: client_1.DataCategory.UGC,
                retentionDays: 1095,
                retentionReason: 'Business requirement for dispute resolution',
                legalBasis: client_1.LegalBasis.LEGITIMATE_INTERESTS,
                automatedPurge: true,
                purgeJobName: 'purgeOldMessages',
            },
            {
                dataType: 'audit_logs',
                description: 'System and admin audit logs',
                dataCategory: client_1.DataCategory.TECHNICAL,
                retentionDays: 2555,
                retentionReason: 'Legal compliance requirement',
                legalBasis: client_1.LegalBasis.LEGAL_OBLIGATION,
                automatedPurge: false,
                purgeJobName: 'anonymizeOldAuditLogs',
            },
            {
                dataType: 'payment_records',
                description: 'Payment and billing records',
                dataCategory: client_1.DataCategory.FINANCIAL,
                retentionDays: 2555,
                retentionReason: 'Tax and financial compliance',
                legalBasis: client_1.LegalBasis.LEGAL_OBLIGATION,
                automatedPurge: false,
            },
            {
                dataType: 'session_data',
                description: 'User login sessions',
                dataCategory: client_1.DataCategory.TECHNICAL,
                retentionDays: 30,
                retentionReason: 'Security and authentication',
                legalBasis: client_1.LegalBasis.CONTRACT,
                automatedPurge: true,
                purgeJobName: 'purgeExpiredSessions',
            },
            {
                dataType: 'notifications',
                description: 'User notifications',
                dataCategory: client_1.DataCategory.UGC,
                retentionDays: 90,
                retentionReason: 'User experience',
                legalBasis: client_1.LegalBasis.LEGITIMATE_INTERESTS,
                automatedPurge: true,
                purgeJobName: 'purgeOldNotifications',
            },
        ];
        for (const policy of policies) {
            await prisma.retentionPolicy.upsert({
                where: { dataType: policy.dataType },
                update: policy,
                create: policy,
            });
        }
    }
}
exports.DataRetentionService = DataRetentionService;
exports.dataRetentionService = new DataRetentionService();
// CLI entry point for cron job
if (require.main === module) {
    exports.dataRetentionService.runAllPurgeJobs()
        .then((summary) => {
        console.log('Purge job completed:', JSON.stringify(summary, null, 2));
        process.exit(0);
    })
        .catch((error) => {
        console.error('Purge job failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=data-retention.js.map