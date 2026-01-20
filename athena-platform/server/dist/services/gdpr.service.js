"use strict";
/**
 * GDPR Compliance Service
 * Handles DSAR requests, data export, deletion, and compliance operations
 * Phase 4: UK/EU Market Launch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gdprService = exports.GDPRService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma = new client_1.PrismaClient();
class GDPRService {
    /**
     * Get all DSAR requests for a user
     */
    async getDSARRequests(userId) {
        return prisma.dSARRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Get a single DSAR request
     */
    async getDSARRequest(requestId) {
        return prisma.dSARRequest.findUnique({
            where: { id: requestId },
        });
    }
    /**
     * Create a new DSAR request
     */
    async createDSARRequest(input) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // GDPR 30-day deadline
        const dsar = await prisma.dSARRequest.create({
            data: {
                userId: input.userId,
                type: input.type,
                status: client_1.DSARStatus.PENDING,
                requestDetails: input.requestDetails,
                dueDate,
            },
        });
        // Log the request
        await this.logPrivacyAction({
            userId: input.userId,
            action: 'DSAR_REQUEST_CREATED',
            resourceType: 'DSARRequest',
            resourceId: dsar.id,
            details: { type: input.type },
        });
        return dsar;
    }
    /**
     * Process DSAR Export Request - Gather all user data
     */
    async processExportRequest(dsarId) {
        const dsar = await prisma.dSARRequest.findUnique({
            where: { id: dsarId },
            include: { user: true },
        });
        if (!dsar)
            throw new Error('DSAR request not found');
        const userId = dsar.userId;
        // Update status to IN_PROGRESS
        await prisma.dSARRequest.update({
            where: { id: dsarId },
            data: { status: client_1.DSARStatus.IN_PROGRESS },
        });
        // Gather all user data across the platform
        const [user, posts, comments, messages, likes, followers, following, groups, events, jobs, applications, courses, mentorSessions, subscription, auditLogs, consents,] = await Promise.all([
            // Profile data
            prisma.user.findUnique({
                where: { id: userId },
                include: {
                    profile: true,
                    skills: { include: { skill: true } },
                    education: true,
                    experience: true,
                },
            }),
            // Posts
            prisma.post.findMany({ where: { authorId: userId } }),
            // Comments
            prisma.comment.findMany({ where: { authorId: userId } }),
            // Messages (sent and received)
            prisma.message.findMany({
                where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            }),
            // Likes
            prisma.like.findMany({ where: { userId } }),
            // Followers
            prisma.follow.findMany({ where: { followingId: userId } }),
            // Following
            prisma.follow.findMany({ where: { followerId: userId } }),
            // Groups
            prisma.groupMember.findMany({
                where: { userId },
                include: { group: true },
            }),
            // Events
            prisma.eventRegistration.findMany({
                where: { userId },
                include: { event: true },
            }),
            // Jobs posted
            prisma.job.findMany({ where: { postedById: userId } }),
            // Job applications
            prisma.jobApplication.findMany({ where: { userId } }),
            // Courses
            prisma.courseEnrollment.findMany({
                where: { userId },
                include: { course: true },
            }),
            // Mentor sessions
            prisma.mentorSession.findMany({ where: { menteeId: userId } }),
            // Subscription
            prisma.subscription.findFirst({ where: { userId } }),
            // Audit logs
            prisma.auditLog.findMany({ where: { actorUserId: userId } }),
            // Consent records
            prisma.consentRecord.findMany({ where: { userId } }),
        ]);
        const exportData = {
            profile: this.sanitizeForExport(user),
            posts: posts.map(p => this.sanitizeForExport(p)),
            comments: comments.map(c => this.sanitizeForExport(c)),
            messages: messages.map(m => this.sanitizeForExport(m)),
            likes: likes.map(l => this.sanitizeForExport(l)),
            follows: {
                followers: followers.length,
                following: following.length,
            },
            groups: groups.map(g => this.sanitizeForExport(g)),
            events: events.map(e => this.sanitizeForExport(e)),
            jobs: [...jobs, ...applications].map(j => this.sanitizeForExport(j)),
            courses: courses.map(c => this.sanitizeForExport(c)),
            mentorSessions: mentorSessions.map(s => this.sanitizeForExport(s)),
            subscriptions: this.sanitizeForExport(subscription),
            auditLogs: auditLogs.map(a => this.sanitizeForExport(a)),
            consents: consents.map(c => this.sanitizeForExport(c)),
            metadata: {
                exportedAt: new Date().toISOString(),
                requestId: dsarId,
                format: 'JSON',
                gdprCompliant: true,
            },
        };
        // Generate secure download URL (would integrate with S3/storage in production)
        const exportToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const exportExpiresAt = new Date();
        exportExpiresAt.setHours(exportExpiresAt.getHours() + 72); // 72 hour download window
        // Update DSAR with export URL
        await prisma.dSARRequest.update({
            where: { id: dsarId },
            data: {
                status: client_1.DSARStatus.COMPLETED,
                exportUrl: `/api/gdpr/download/${exportToken}`,
                exportExpiresAt,
                completedAt: new Date(),
            },
        });
        // Log completion
        await this.logPrivacyAction({
            userId,
            action: 'DSAR_EXPORT_COMPLETED',
            resourceType: 'DSARRequest',
            resourceId: dsarId,
        });
        return exportData;
    }
    /**
     * Process DSAR Deletion Request - Right to be Forgotten
     */
    async processDeletionRequest(dsarId) {
        const dsar = await prisma.dSARRequest.findUnique({
            where: { id: dsarId },
        });
        if (!dsar)
            throw new Error('DSAR request not found');
        const userId = dsar.userId;
        // Check for legal holds
        const legalHold = await prisma.legalHold.findFirst({
            where: {
                isActive: true,
                affectedUserIds: { has: userId },
            },
        });
        if (legalHold) {
            await prisma.dSARRequest.update({
                where: { id: dsarId },
                data: {
                    status: client_1.DSARStatus.REJECTED,
                    processingNotes: `Cannot delete: Active legal hold (${legalHold.id})`,
                },
            });
            throw new Error('Deletion blocked by legal hold');
        }
        // Update status
        await prisma.dSARRequest.update({
            where: { id: dsarId },
            data: { status: client_1.DSARStatus.IN_PROGRESS },
        });
        // Delete/anonymize user data in order of dependencies
        await prisma.$transaction(async (tx) => {
            // Delete user-generated content
            await tx.comment.deleteMany({ where: { authorId: userId } });
            await tx.like.deleteMany({ where: { userId } });
            await tx.post.deleteMany({ where: { authorId: userId } });
            await tx.message.deleteMany({
                where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            });
            // Delete social connections
            await tx.follow.deleteMany({
                where: { OR: [{ followerId: userId }, { followingId: userId }] },
            });
            // Delete group memberships
            await tx.groupMember.deleteMany({ where: { userId } });
            await tx.groupPost.deleteMany({ where: { authorId: userId } });
            // Delete job-related data
            await tx.jobApplication.deleteMany({ where: { userId } });
            await tx.savedJob.deleteMany({ where: { userId } });
            // Delete course enrollments
            await tx.courseEnrollment.deleteMany({ where: { userId } });
            // Anonymize audit logs (keep for compliance but remove PII)
            await tx.auditLog.updateMany({
                where: { actorUserId: userId },
                data: {
                    actorUserId: null,
                    metadata: { anonymized: true, originalUserId: (0, crypto_1.createHash)('sha256').update(userId).digest('hex') },
                },
            });
            // Delete consent records
            await tx.consentRecord.deleteMany({ where: { userId } });
            // Delete profile
            await tx.profile.deleteMany({ where: { userId } });
            // Finally, delete the user
            await tx.user.delete({ where: { id: userId } });
        });
        // Update DSAR
        await prisma.dSARRequest.update({
            where: { id: dsarId },
            data: {
                status: client_1.DSARStatus.COMPLETED,
                completedAt: new Date(),
            },
        });
        // Log deletion
        await this.logPrivacyAction({
            action: 'DSAR_DELETION_COMPLETED',
            resourceType: 'DSARRequest',
            resourceId: dsarId,
            details: { deletedUserId: (0, crypto_1.createHash)('sha256').update(userId).digest('hex') },
        });
    }
    /**
     * Process Rectification Request
     */
    async processRectificationRequest(dsarId, corrections) {
        const dsar = await prisma.dSARRequest.findUnique({
            where: { id: dsarId },
        });
        if (!dsar)
            throw new Error('DSAR request not found');
        const allowedFields = [
            'firstName',
            'lastName',
            'email',
            'city',
            'state',
            'country',
            'bio',
            'headline',
        ];
        const sanitizedCorrections = {};
        for (const [key, value] of Object.entries(corrections)) {
            if (allowedFields.includes(key)) {
                sanitizedCorrections[key] = value;
            }
        }
        // Get previous values for audit
        const previousUser = await prisma.user.findUnique({
            where: { id: dsar.userId },
            select: Object.fromEntries(allowedFields.map(f => [f, true])),
        });
        // Update user data
        await prisma.user.update({
            where: { id: dsar.userId },
            data: sanitizedCorrections,
        });
        // Update DSAR
        await prisma.dSARRequest.update({
            where: { id: dsarId },
            data: {
                status: client_1.DSARStatus.COMPLETED,
                completedAt: new Date(),
            },
        });
        // Log with audit trail
        await this.logPrivacyAction({
            userId: dsar.userId,
            action: 'DSAR_RECTIFICATION_COMPLETED',
            resourceType: 'User',
            resourceId: dsar.userId,
            previousValue: previousUser || undefined,
            newValue: sanitizedCorrections,
        });
    }
    // ============================================
    // Consent Management
    // ============================================
    /**
     * Record user consent
     */
    async recordConsent(userId, consentType, granted, context) {
        const status = granted ? client_1.ConsentStatus.GRANTED : client_1.ConsentStatus.DENIED;
        const consent = await prisma.consentRecord.upsert({
            where: {
                userId_consentType: { userId, consentType },
            },
            update: {
                status,
                grantedAt: granted ? new Date() : null,
                withdrawnAt: granted ? null : new Date(),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                region: context.region,
            },
            create: {
                userId,
                consentType,
                status,
                version: '1.0',
                grantedAt: granted ? new Date() : null,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                region: context.region,
            },
        });
        await this.logPrivacyAction({
            userId,
            action: granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
            resourceType: 'ConsentRecord',
            resourceId: consent.id,
            details: { consentType, status },
        });
        return consent;
    }
    /**
     * Get all consents for a user
     */
    async getUserConsents(userId) {
        return prisma.consentRecord.findMany({
            where: { userId },
            orderBy: { consentType: 'asc' },
        });
    }
    /**
     * Bulk update consents (for Privacy Center)
     */
    async bulkUpdateConsents(userId, consents, context) {
        for (const consent of consents) {
            await this.recordConsent(userId, consent.type, consent.granted, context);
        }
    }
    // ============================================
    // Cookie Consent
    // ============================================
    /**
     * Record cookie consent
     */
    async recordCookieConsent(visitorId, preferences, context) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiry
        const cookieConsent = await prisma.cookieConsent.upsert({
            where: { visitorId },
            update: {
                userId: context.userId,
                analytics: preferences.analytics,
                marketing: preferences.marketing,
                functional: preferences.functional,
                ipAddress: context.ipAddress,
                region: context.region,
                expiresAt,
            },
            create: {
                visitorId,
                userId: context.userId,
                essential: true, // Always true
                analytics: preferences.analytics,
                marketing: preferences.marketing,
                functional: preferences.functional,
                ipAddress: context.ipAddress,
                region: context.region,
                expiresAt,
            },
        });
        await this.logPrivacyAction({
            userId: context.userId,
            action: 'COOKIE_CONSENT_UPDATED',
            resourceType: 'CookieConsent',
            resourceId: cookieConsent.id,
            details: preferences,
        });
        return cookieConsent;
    }
    /**
     * Get cookie consent for visitor
     */
    async getCookieConsent(visitorId) {
        return prisma.cookieConsent.findUnique({
            where: { visitorId },
        });
    }
    // ============================================
    // Privacy Audit Logging
    // ============================================
    async logPrivacyAction(params) {
        await prisma.privacyAuditLog.create({
            data: {
                userId: params.userId,
                adminId: params.adminId,
                action: params.action,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                details: params.details,
                previousValue: params.previousValue,
                newValue: params.newValue,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                region: params.region,
            },
        });
    }
    // ============================================
    // Data Classification & RoPA
    // ============================================
    /**
     * Get data classification for export/audit
     */
    getDataClassification() {
        return {
            user_profile: [client_1.DataCategory.PII],
            user_email: [client_1.DataCategory.PII],
            user_address: [client_1.DataCategory.PII],
            user_financial: [client_1.DataCategory.FINANCIAL, client_1.DataCategory.PII],
            user_verification: [client_1.DataCategory.BIOMETRIC, client_1.DataCategory.SENSITIVE],
            user_posts: [client_1.DataCategory.UGC],
            user_messages: [client_1.DataCategory.UGC, client_1.DataCategory.PII],
            user_behavior: [client_1.DataCategory.BEHAVIORAL],
            technical_logs: [client_1.DataCategory.TECHNICAL],
        };
    }
    // ============================================
    // Utility Methods
    // ============================================
    sanitizeForExport(data) {
        if (!data)
            return {};
        // Remove internal/sensitive fields
        const { passwordHash, ...rest } = data;
        return rest;
    }
}
exports.GDPRService = GDPRService;
exports.gdprService = new GDPRService();
//# sourceMappingURL=gdpr.service.js.map