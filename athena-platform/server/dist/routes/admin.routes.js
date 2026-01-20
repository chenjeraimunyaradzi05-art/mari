"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../utils/audit");
const router = (0, express_1.Router)();
// All admin routes require authentication and ADMIN role
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)('ADMIN'));
// ============================================================================
// DASHBOARD STATS
// ============================================================================
/**
 * GET /admin/stats
 * Get platform-wide statistics for admin dashboard
 */
router.get('/stats', async (_req, res, next) => {
    try {
        const [totalUsers, newUsersThisMonth, totalJobs, activeJobs, totalPosts, totalCourses, totalMentors, totalSubscriptions, proSubscriptions, businessSubscriptions,] = await Promise.all([
            prisma_1.prisma.user.count(),
            prisma_1.prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setDate(1)), // First day of current month
                    },
                },
            }),
            prisma_1.prisma.job.count(),
            prisma_1.prisma.job.count({ where: { status: 'ACTIVE' } }),
            prisma_1.prisma.post.count(),
            prisma_1.prisma.course.count(),
            prisma_1.prisma.mentorProfile.count({ where: { isAvailable: true } }),
            prisma_1.prisma.subscription.count(),
            prisma_1.prisma.subscription.count({ where: { tier: 'PREMIUM_PROFESSIONAL', status: 'ACTIVE' } }),
            prisma_1.prisma.subscription.count({ where: { tier: 'ENTERPRISE', status: 'ACTIVE' } }),
        ]);
        // User growth over past 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const userGrowth = await prisma_1.prisma.user.groupBy({
            by: ['createdAt'],
            _count: true,
            where: {
                createdAt: {
                    gte: sixMonthsAgo,
                },
            },
        });
        // Count by persona
        const usersByPersona = await prisma_1.prisma.user.groupBy({
            by: ['persona'],
            _count: true,
        });
        // Count by role
        const usersByRole = await prisma_1.prisma.user.groupBy({
            by: ['role'],
            _count: true,
        });
        res.json({
            overview: {
                totalUsers,
                newUsersThisMonth,
                totalJobs,
                activeJobs,
                totalPosts,
                totalCourses,
                totalMentors,
            },
            subscriptions: {
                total: totalSubscriptions,
                pro: proSubscriptions,
                business: businessSubscriptions,
            },
            userBreakdown: {
                byPersona: usersByPersona,
                byRole: usersByRole,
            },
            growth: userGrowth,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// USER MANAGEMENT
// ============================================================================
/**
 * GET /admin/users
 * List all users with pagination and filters
 */
router.get('/users', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', search = '', role, persona, status, sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (role) {
            where.role = role;
        }
        if (persona) {
            where.persona = persona;
        }
        if (status === 'suspended') {
            where.isSuspended = true;
        }
        else if (status === 'active') {
            where.isSuspended = false;
        }
        const [users, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    role: true,
                    persona: true,
                    emailVerified: true,
                    isSuspended: true,
                    createdAt: true,
                    lastLoginAt: true,
                    _count: {
                        select: {
                            posts: true,
                            applications: true,
                        },
                    },
                },
                skip,
                take: limitNum,
                orderBy: { [sortBy]: sortOrder },
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        res.json({
            users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /admin/users/:id
 * Get detailed user information
 */
router.get('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            include: {
                profile: true,
                subscription: true,
                posts: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                },
                applications: {
                    take: 5,
                    orderBy: { appliedAt: 'desc' },
                    include: {
                        job: {
                            select: { id: true, title: true },
                        },
                    },
                },
                mentorProfile: true,
                _count: {
                    select: {
                        posts: true,
                        comments: true,
                        applications: true,
                        courseEnrollments: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/users/:id
 * Update user (role, suspension, verification)
 */
router.patch('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, isSuspended, emailVerified, suspensionReason } = req.body;
        const updateData = {};
        if (role !== undefined) {
            updateData.role = role;
        }
        if (isSuspended !== undefined) {
            updateData.isSuspended = isSuspended;
            if (isSuspended && suspensionReason) {
                // Store suspension reason in metadata or log
                console.log(`User ${id} suspended. Reason: ${suspensionReason}`);
            }
        }
        if (emailVerified !== undefined) {
            updateData.emailVerified = emailVerified;
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                emailVerified: true,
                isSuspended: true,
            },
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_USER_UPDATE',
            actorUserId: req.user?.id ?? null,
            targetUserId: id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
                updatedFields: Object.keys(updateData),
                role,
                isSuspended,
                emailVerified,
                suspensionReason,
            },
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /admin/users/:id
 * Delete a user (soft delete or hard delete)
 */
router.delete('/users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { hard = false } = req.query;
        if (hard === 'true') {
            // Hard delete - remove all user data
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.comment.deleteMany({ where: { authorId: id } }),
                prisma_1.prisma.like.deleteMany({ where: { userId: id } }),
                prisma_1.prisma.post.deleteMany({ where: { authorId: id } }),
                prisma_1.prisma.notification.deleteMany({ where: { userId: id } }),
                prisma_1.prisma.jobApplication.deleteMany({ where: { userId: id } }),
                prisma_1.prisma.savedJob.deleteMany({ where: { userId: id } }),
                prisma_1.prisma.user.delete({ where: { id } }),
            ]);
        }
        else {
            // Soft delete - suspend and anonymize
            await prisma_1.prisma.user.update({
                where: { id },
                data: {
                    isSuspended: true,
                    email: `deleted_${id}@athena.local`,
                    firstName: 'Deleted',
                    lastName: 'User',
                },
            });
        }
        await (0, audit_1.logAudit)({
            action: 'ADMIN_USER_DELETE',
            actorUserId: req.user?.id ?? null,
            targetUserId: id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
                hard: hard === 'true',
            },
        });
        res.json({ success: true, message: hard ? 'User permanently deleted' : 'User suspended and anonymized' });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CONTENT MODERATION
// ============================================================================
/**
 * GET /admin/content/posts
 * List posts with moderation info
 */
router.get('/content/posts', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', reported = 'false', sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (reported === 'true') {
            where.reportCount = { gt: 0 };
        }
        const [posts, total] = await Promise.all([
            prisma_1.prisma.post.findMany({
                where,
                select: {
                    id: true,
                    content: true,
                    type: true,
                    mediaUrls: true,
                    likeCount: true,
                    commentCount: true,
                    reportCount: true,
                    isHidden: true,
                    createdAt: true,
                    author: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                },
                skip,
                take: limitNum,
                orderBy: { [sortBy]: sortOrder },
            }),
            prisma_1.prisma.post.count({ where }),
        ]);
        res.json({
            posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/content/posts/:id
 * Moderate a post (hide, delete, clear reports)
 */
router.patch('/content/posts/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;
        let result;
        switch (action) {
            case 'hide':
                result = await prisma_1.prisma.post.update({
                    where: { id },
                    data: { isHidden: true },
                });
                break;
            case 'unhide':
                result = await prisma_1.prisma.post.update({
                    where: { id },
                    data: { isHidden: false },
                });
                break;
            case 'clearReports':
                result = await prisma_1.prisma.post.update({
                    where: { id },
                    data: { reportCount: 0 },
                });
                break;
            case 'delete':
                await prisma_1.prisma.$transaction([
                    prisma_1.prisma.comment.deleteMany({ where: { postId: id } }),
                    prisma_1.prisma.like.deleteMany({ where: { postId: id } }),
                    prisma_1.prisma.post.delete({ where: { id } }),
                ]);
                result = { deleted: true };
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        const auditAction = action === 'hide'
            ? 'ADMIN_POST_HIDE'
            : action === 'unhide'
                ? 'ADMIN_POST_UNHIDE'
                : action === 'clearReports'
                    ? 'ADMIN_POST_CLEAR_REPORTS'
                    : action === 'delete'
                        ? 'ADMIN_POST_DELETE'
                        : null;
        if (auditAction) {
            await (0, audit_1.logAudit)({
                action: auditAction,
                actorUserId: req.user?.id ?? null,
                ipAddress: req.ip,
                userAgent: req.get('user-agent') || undefined,
                metadata: { postId: id, reason },
            });
        }
        console.log(`Admin moderation: Post ${id} - ${action}. Reason: ${reason || 'None provided'}`);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /admin/content/comments
 * List comments with moderation info
 */
router.get('/content/comments', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', reported = 'false', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (reported === 'true') {
            where.reportCount = { gt: 0 };
        }
        const [comments, total] = await Promise.all([
            prisma_1.prisma.comment.findMany({
                where,
                select: {
                    id: true,
                    content: true,
                    reportCount: true,
                    isHidden: true,
                    createdAt: true,
                    author: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    post: {
                        select: {
                            id: true,
                            content: true,
                        },
                    },
                },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.comment.count({ where }),
        ]);
        res.json({
            comments,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /admin/content/comments/:id
 * Delete a comment
 */
router.delete('/content/comments/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.comment.delete({ where: { id } });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_COMMENT_DELETE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { commentId: id },
        });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// AUDIT LOGS (Compliance)
// ============================================================================
/**
 * GET /admin/audit-logs
 * List compliance audit log entries
 */
router.get('/audit-logs', async (req, res, next) => {
    try {
        const { page = '1', limit = '50', action, actorUserId, targetUserId } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (action)
            where.action = action;
        if (actorUserId)
            where.actorUserId = actorUserId;
        if (targetUserId)
            where.targetUserId = targetUserId;
        const [logs, total] = await Promise.all([
            prisma_1.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: {
                    actorUser: { select: { id: true, email: true, firstName: true, lastName: true } },
                    targetUser: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
            }),
            prisma_1.prisma.auditLog.count({ where }),
        ]);
        res.json({
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GDPR / UK COMPLIANCE TOOLING
// ============================================================================
/**
 * GET /admin/gdpr/summary
 * Summary stats for GDPR/UK compliance tracking
 */
router.get('/gdpr/summary', async (req, res, next) => {
    try {
        const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
        const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [totalUsers, ukUsers, euUsers, consentMarketing, consentDataProcessing, consentCookies, consentDoNotSell, consentUpdatesLastWindow, dsarExportsLastWindow, accountDeletesLastWindow,] = await Promise.all([
            prisma_1.prisma.user.count(),
            prisma_1.prisma.user.count({ where: { region: 'UK' } }),
            prisma_1.prisma.user.count({ where: { region: 'EU' } }),
            prisma_1.prisma.user.count({ where: { consentMarketing: true } }),
            prisma_1.prisma.user.count({ where: { consentDataProcessing: true } }),
            prisma_1.prisma.user.count({ where: { consentCookies: true } }),
            prisma_1.prisma.user.count({ where: { consentDoNotSell: true } }),
            prisma_1.prisma.user.count({ where: { consentUpdatedAt: { gte: windowStart } } }),
            prisma_1.prisma.auditLog.count({
                where: { action: 'DSAR_EXPORT', createdAt: { gte: windowStart } },
            }),
            prisma_1.prisma.auditLog.count({
                where: { action: 'ACCOUNT_DELETE', createdAt: { gte: windowStart } },
            }),
        ]);
        res.json({
            totalUsers,
            ukUsers,
            euUsers,
            dsarExportsLastWindow,
            accountDeletesLastWindow,
            consentUpdatesLastWindow,
            lastWindowDays: days,
            consentCounts: {
                consentMarketing,
                consentDataProcessing,
                consentCookies,
                consentDoNotSell,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /admin/gdpr/consents
 * List user consents for auditing
 */
router.get('/gdpr/consents', async (req, res, next) => {
    try {
        const { page = '1', limit = '25', region } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (region)
            where.region = region;
        const [users, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    region: true,
                    preferredLocale: true,
                    preferredCurrency: true,
                    consentMarketing: true,
                    consentDataProcessing: true,
                    consentCookies: true,
                    consentDoNotSell: true,
                    consentUpdatedAt: true,
                },
                orderBy: { consentUpdatedAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        res.json({
            users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// JOB MANAGEMENT
// ============================================================================
/**
 * GET /admin/jobs
 * List all jobs for admin review
 */
router.get('/jobs', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', status, search = '', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { organization: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const [jobs, total] = await Promise.all([
            prisma_1.prisma.job.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    organization: { select: { name: true } },
                    city: true,
                    state: true,
                    type: true,
                    status: true,
                    viewCount: true,
                    applicationCount: true,
                    createdAt: true,
                    postedBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.job.count({ where }),
        ]);
        res.json({
            jobs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/jobs/:id
 * Update job status (approve, reject, feature)
 */
router.patch('/jobs/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, isSponsored, isFeatured } = req.body;
        const updateData = {};
        if (status !== undefined) {
            updateData.status = status;
        }
        if (isSponsored !== undefined) {
            updateData.isSponsored = isSponsored;
        }
        if (isFeatured !== undefined) {
            updateData.isFeatured = isFeatured;
        }
        const job = await prisma_1.prisma.job.update({
            where: { id },
            data: updateData,
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_JOB_UPDATE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { jobId: id, updatedFields: Object.keys(updateData) },
        });
        res.json(job);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================
/**
 * GET /admin/subscriptions
 * List all subscriptions
 */
router.get('/subscriptions', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', tier, status, } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (tier) {
            where.tier = tier;
        }
        if (status) {
            where.status = status;
        }
        const [subscriptions, total] = await Promise.all([
            prisma_1.prisma.subscription.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.subscription.count({ where }),
        ]);
        res.json({
            subscriptions,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/subscriptions/:id
 * Update subscription (grant premium, extend, cancel)
 */
router.patch('/subscriptions/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tier, status, periodEnd } = req.body;
        const updateData = {};
        if (tier !== undefined) {
            updateData.tier = tier;
        }
        if (status !== undefined) {
            updateData.status = status;
        }
        if (periodEnd !== undefined) {
            updateData.periodEnd = new Date(periodEnd);
        }
        const subscription = await prisma_1.prisma.subscription.update({
            where: { id },
            data: updateData,
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_SUBSCRIPTION_UPDATE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { subscriptionId: id, updatedFields: Object.keys(updateData) },
        });
        res.json(subscription);
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /admin/subscriptions/grant
 * Grant a subscription to a user
 */
router.post('/subscriptions/grant', async (req, res, next) => {
    try {
        const { userId, tier, durationDays = 30 } = req.body;
        if (!userId || !tier) {
            return res.status(400).json({ error: 'userId and tier are required' });
        }
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + durationDays);
        const subscription = await prisma_1.prisma.subscription.upsert({
            where: { userId },
            update: {
                tier,
                status: 'ACTIVE',
                currentPeriodEnd: periodEnd,
            },
            create: {
                userId,
                tier,
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: periodEnd,
            },
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_SUBSCRIPTION_GRANT',
            actorUserId: req.user?.id ?? null,
            targetUserId: userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { tier, durationDays },
        });
        res.json(subscription);
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ANALYTICS
// ============================================================================
/**
 * GET /admin/analytics/engagement
 * Get engagement metrics
 */
router.get('/analytics/engagement', async (req, res, next) => {
    try {
        const daysParam = Number.parseInt(String(req.query?.days ?? '30'), 10);
        const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const endDate = new Date();
        const [newPosts, newComments, newLikes, newApplications, activeUsers,] = await Promise.all([
            prisma_1.prisma.post.count({
                where: { createdAt: { gte: startDate } },
            }),
            prisma_1.prisma.comment.count({
                where: { createdAt: { gte: startDate } },
            }),
            prisma_1.prisma.like.count({
                where: { createdAt: { gte: startDate } },
            }),
            prisma_1.prisma.jobApplication.count({
                where: { appliedAt: { gte: startDate } },
            }),
            prisma_1.prisma.user.count({
                where: { lastLoginAt: { gte: startDate } },
            }),
        ]);
        res.json({
            period: {
                label: `${days} days`,
                days,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            metrics: {
                newPosts,
                newComments,
                newLikes,
                newApplications,
                activeUsers,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /admin/analytics/revenue
 * Get revenue metrics (based on subscriptions)
 */
router.get('/analytics/revenue', async (_req, res, next) => {
    try {
        // Count active subscriptions by tier
        const subscriptionsByTier = await prisma_1.prisma.subscription.groupBy({
            by: ['tier'],
            where: { status: 'ACTIVE' },
            _count: true,
        });
        // Pricing (you'd want this in a config)
        const pricing = {
            FREE: 0,
            PRO: 29,
            BUSINESS: 99,
        };
        // Calculate MRR
        let mrr = 0;
        const breakdown = {};
        for (const sub of subscriptionsByTier) {
            const price = pricing[sub.tier] || 0;
            const revenue = sub._count * price;
            mrr += revenue;
            breakdown[sub.tier] = {
                count: sub._count,
                revenue,
            };
        }
        res.json({
            mrr,
            arr: mrr * 12,
            breakdown,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// GROUPS & EVENTS (ADMIN CRUD / MODERATION)
// ============================================================================
function normalizeGroupPrivacy(input) {
    const v = String(input ?? '').toLowerCase();
    if (v === 'private')
        return 'PRIVATE';
    if (v === 'public')
        return 'PUBLIC';
    if (v === 'PRIVATE')
        return 'PRIVATE';
    if (v === 'PUBLIC')
        return 'PUBLIC';
    return null;
}
function normalizeGroupRole(input) {
    const v = String(input ?? '').toLowerCase();
    if (v === 'admin')
        return 'ADMIN';
    if (v === 'moderator')
        return 'MODERATOR';
    if (v === 'member')
        return 'MEMBER';
    if (v === 'ADMIN')
        return 'ADMIN';
    if (v === 'MODERATOR')
        return 'MODERATOR';
    if (v === 'MEMBER')
        return 'MEMBER';
    return null;
}
function normalizeEventType(input) {
    const v = String(input ?? '').toLowerCase();
    switch (v) {
        case 'webinar':
            return 'WEBINAR';
        case 'workshop':
            return 'WORKSHOP';
        case 'networking':
            return 'NETWORKING';
        case 'conference':
            return 'CONFERENCE';
        case 'meetup':
            return 'MEETUP';
        case 'WEBINAR':
        case 'WORKSHOP':
        case 'NETWORKING':
        case 'CONFERENCE':
        case 'MEETUP':
            return v.toUpperCase();
        default:
            return null;
    }
}
function normalizeEventFormat(input) {
    const v = String(input ?? '').toLowerCase();
    if (v === 'virtual' || v === 'VIRTUAL')
        return 'VIRTUAL';
    if (v === 'in-person' || v === 'in_person' || v === 'IN_PERSON')
        return 'IN_PERSON';
    if (v === 'hybrid' || v === 'HYBRID')
        return 'HYBRID';
    return null;
}
/**
 * GET /admin/groups
 */
router.get('/groups', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', search = '', privacy, featured, pinned, hidden, sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const dbPrivacy = privacy ? normalizeGroupPrivacy(privacy) : null;
        if (privacy && !dbPrivacy)
            return res.status(400).json({ error: 'Invalid privacy filter' });
        if (dbPrivacy)
            where.privacy = dbPrivacy;
        if (featured !== undefined)
            where.isFeatured = String(featured) === 'true';
        if (pinned !== undefined)
            where.isPinned = String(pinned) === 'true';
        if (hidden !== undefined)
            where.isHidden = String(hidden) === 'true';
        const [groups, total] = await Promise.all([
            prisma_1.prisma.group.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    privacy: true,
                    isFeatured: true,
                    isPinned: true,
                    isHidden: true,
                    createdById: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: { select: { members: true, posts: true } },
                },
            }),
            prisma_1.prisma.group.count({ where }),
        ]);
        res.json({
            groups,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /admin/groups
 */
router.post('/groups', async (req, res, next) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const privacy = normalizeGroupPrivacy(req.body?.privacy ?? 'public') ?? 'PUBLIC';
        const createdById = typeof req.body?.createdById === 'string' ? req.body.createdById : req.user.id;
        if (!name || name.length < 3)
            return res.status(400).json({ error: 'Group name is required' });
        if (!description)
            return res.status(400).json({ error: 'Group description is required' });
        const { group } = await prisma_1.prisma.$transaction(async (tx) => {
            const group = await tx.group.create({
                data: {
                    name,
                    description,
                    privacy,
                    createdBy: { connect: { id: createdById } },
                    isFeatured: !!req.body?.isFeatured,
                    isPinned: !!req.body?.isPinned,
                    isHidden: !!req.body?.isHidden,
                },
            });
            await tx.groupMember.upsert({
                where: { groupId_userId: { groupId: group.id, userId: createdById } },
                update: { role: 'ADMIN' },
                create: { groupId: group.id, userId: createdById, role: 'ADMIN' },
            });
            return { group };
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_GROUP_CREATE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
                groupId: group.id,
                createdById,
                privacy,
                isFeatured: !!req.body?.isFeatured,
                isPinned: !!req.body?.isPinned,
                isHidden: !!req.body?.isHidden,
            },
        });
        res.status(201).json(group);
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/groups/:id
 */
router.patch('/groups/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.group.findUnique({ where: { id }, select: { id: true } });
        if (!existing)
            return res.status(404).json({ error: 'Group not found' });
        const data = {};
        if (typeof req.body?.name === 'string')
            data.name = req.body.name.trim();
        if (typeof req.body?.description === 'string')
            data.description = req.body.description.trim();
        if (req.body?.privacy !== undefined) {
            const p = normalizeGroupPrivacy(req.body.privacy);
            if (!p)
                return res.status(400).json({ error: 'Invalid privacy' });
            data.privacy = p;
        }
        if (req.body?.isFeatured !== undefined)
            data.isFeatured = !!req.body.isFeatured;
        if (req.body?.isPinned !== undefined)
            data.isPinned = !!req.body.isPinned;
        if (req.body?.isHidden !== undefined)
            data.isHidden = !!req.body.isHidden;
        const group = await prisma_1.prisma.group.update({ where: { id }, data });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_GROUP_UPDATE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { groupId: id, updatedFields: Object.keys(data) },
        });
        res.json(group);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /admin/groups/:id
 */
router.delete('/groups/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.group.delete({ where: { id } });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_GROUP_DELETE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { groupId: id },
        });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/groups/:id/members/:userId
 * Set member role (admin/moderator/member)
 */
router.patch('/groups/:id/members/:userId', async (req, res, next) => {
    try {
        const { id: groupId, userId } = req.params;
        const role = normalizeGroupRole(req.body?.role);
        if (!role)
            return res.status(400).json({ error: 'Invalid role' });
        const existing = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId, userId } },
            select: { role: true },
        });
        if (existing?.role === 'ADMIN' && role !== 'ADMIN') {
            const adminCount = await prisma_1.prisma.groupMember.count({ where: { groupId, role: 'ADMIN' } });
            if (adminCount <= 1)
                return res.status(400).json({ error: 'Group must have at least one admin' });
        }
        const member = await prisma_1.prisma.groupMember.upsert({
            where: { groupId_userId: { groupId, userId } },
            update: { role },
            create: { groupId, userId, role },
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_GROUP_MEMBER_ROLE_UPDATE',
            actorUserId: req.user?.id ?? null,
            targetUserId: userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { groupId, role },
        });
        res.json(member);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /admin/groups/:id/posts/:postId
 */
router.delete('/groups/:id/posts/:postId', async (req, res, next) => {
    try {
        const { id: groupId, postId } = req.params;
        const post = await prisma_1.prisma.groupPost.findUnique({ where: { id: postId }, select: { id: true, groupId: true } });
        if (!post || post.groupId !== groupId)
            return res.status(404).json({ error: 'Post not found' });
        await prisma_1.prisma.groupPost.delete({ where: { id: postId } });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_GROUP_POST_DELETE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { groupId, postId },
        });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /admin/events
 */
router.get('/events', async (req, res, next) => {
    try {
        const { page = '1', limit = '20', search = '', type, format, featured, pinned, hidden, sortBy = 'date', sortOrder = 'asc', } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (type !== undefined) {
            const t = normalizeEventType(type);
            if (!t)
                return res.status(400).json({ error: 'Invalid type filter' });
            where.type = t;
        }
        if (format !== undefined) {
            const f = normalizeEventFormat(format);
            if (!f)
                return res.status(400).json({ error: 'Invalid format filter' });
            where.format = f;
        }
        if (featured !== undefined)
            where.isFeatured = String(featured) === 'true';
        if (pinned !== undefined)
            where.isPinned = String(pinned) === 'true';
        if (hidden !== undefined)
            where.isHidden = String(hidden) === 'true';
        const [events, total] = await Promise.all([
            prisma_1.prisma.event.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { [sortBy]: sortOrder },
            }),
            prisma_1.prisma.event.count({ where }),
        ]);
        res.json({
            events,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /admin/events
 */
router.post('/events', async (req, res, next) => {
    try {
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const type = normalizeEventType(req.body?.type);
        const format = normalizeEventFormat(req.body?.format);
        const dateValue = req.body?.date;
        const date = new Date(dateValue);
        const startTime = typeof req.body?.startTime === 'string' ? req.body.startTime.trim() : '';
        const endTime = typeof req.body?.endTime === 'string' ? req.body.endTime.trim() : '';
        const image = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
        const hostName = typeof req.body?.hostName === 'string' ? req.body.hostName.trim() : req.body?.host?.name;
        const hostTitle = typeof req.body?.hostTitle === 'string' ? req.body.hostTitle.trim() : req.body?.host?.title;
        const hostAvatar = typeof req.body?.hostAvatar === 'string' ? req.body.hostAvatar.trim() : req.body?.host?.avatar;
        if (!title)
            return res.status(400).json({ error: 'Title is required' });
        if (!description)
            return res.status(400).json({ error: 'Description is required' });
        if (!type)
            return res.status(400).json({ error: 'Invalid type' });
        if (!format)
            return res.status(400).json({ error: 'Invalid format' });
        if (Number.isNaN(date.getTime()))
            return res.status(400).json({ error: 'Invalid date' });
        if (!startTime || !endTime)
            return res.status(400).json({ error: 'Start/end time is required' });
        if (!image)
            return res.status(400).json({ error: 'Image is required' });
        if (!hostName || !hostTitle || !hostAvatar)
            return res.status(400).json({ error: 'Host is required' });
        const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter((t) => typeof t === 'string') : [];
        const event = await prisma_1.prisma.event.create({
            data: {
                title,
                description,
                type,
                format,
                isFeatured: !!req.body?.isFeatured,
                isPinned: !!req.body?.isPinned,
                isHidden: !!req.body?.isHidden,
                date,
                startTime,
                endTime,
                location: typeof req.body?.location === 'string' ? req.body.location.trim() : null,
                link: typeof req.body?.link === 'string' ? req.body.link.trim() : null,
                image,
                hostName,
                hostTitle,
                hostAvatar,
                baseAttendees: typeof req.body?.baseAttendees === 'number' ? req.body.baseAttendees : 0,
                maxAttendees: typeof req.body?.maxAttendees === 'number' ? req.body.maxAttendees : null,
                price: typeof req.body?.price === 'number' ? req.body.price : 0,
                tags,
            },
        });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_EVENT_CREATE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: {
                eventId: event.id,
                type,
                format,
                isFeatured: !!req.body?.isFeatured,
                isPinned: !!req.body?.isPinned,
                isHidden: !!req.body?.isHidden,
            },
        });
        res.status(201).json(event);
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /admin/events/:id
 */
router.patch('/events/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.event.findUnique({ where: { id }, select: { id: true } });
        if (!existing)
            return res.status(404).json({ error: 'Event not found' });
        const data = {};
        if (typeof req.body?.title === 'string')
            data.title = req.body.title.trim();
        if (typeof req.body?.description === 'string')
            data.description = req.body.description.trim();
        if (req.body?.type !== undefined) {
            const t = normalizeEventType(req.body.type);
            if (!t)
                return res.status(400).json({ error: 'Invalid type' });
            data.type = t;
        }
        if (req.body?.format !== undefined) {
            const f = normalizeEventFormat(req.body.format);
            if (!f)
                return res.status(400).json({ error: 'Invalid format' });
            data.format = f;
        }
        if (req.body?.date !== undefined) {
            const d = new Date(req.body.date);
            if (Number.isNaN(d.getTime()))
                return res.status(400).json({ error: 'Invalid date' });
            data.date = d;
        }
        if (typeof req.body?.startTime === 'string')
            data.startTime = req.body.startTime.trim();
        if (typeof req.body?.endTime === 'string')
            data.endTime = req.body.endTime.trim();
        if (req.body?.location !== undefined)
            data.location = typeof req.body.location === 'string' ? req.body.location.trim() : null;
        if (req.body?.link !== undefined)
            data.link = typeof req.body.link === 'string' ? req.body.link.trim() : null;
        if (typeof req.body?.image === 'string')
            data.image = req.body.image.trim();
        if (req.body?.host !== undefined || req.body?.hostName !== undefined) {
            const hostName = typeof req.body?.hostName === 'string' ? req.body.hostName.trim() : req.body?.host?.name;
            const hostTitle = typeof req.body?.hostTitle === 'string' ? req.body.hostTitle.trim() : req.body?.host?.title;
            const hostAvatar = typeof req.body?.hostAvatar === 'string' ? req.body.hostAvatar.trim() : req.body?.host?.avatar;
            if (hostName !== undefined)
                data.hostName = hostName;
            if (hostTitle !== undefined)
                data.hostTitle = hostTitle;
            if (hostAvatar !== undefined)
                data.hostAvatar = hostAvatar;
        }
        if (req.body?.baseAttendees !== undefined)
            data.baseAttendees = req.body.baseAttendees;
        if (req.body?.maxAttendees !== undefined)
            data.maxAttendees = req.body.maxAttendees;
        if (req.body?.price !== undefined)
            data.price = req.body.price;
        if (req.body?.tags !== undefined) {
            data.tags = Array.isArray(req.body.tags) ? req.body.tags.filter((t) => typeof t === 'string') : [];
        }
        if (req.body?.isFeatured !== undefined)
            data.isFeatured = !!req.body.isFeatured;
        if (req.body?.isPinned !== undefined)
            data.isPinned = !!req.body.isPinned;
        if (req.body?.isHidden !== undefined)
            data.isHidden = !!req.body.isHidden;
        const event = await prisma_1.prisma.event.update({ where: { id }, data });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_EVENT_UPDATE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { eventId: id, updatedFields: Object.keys(data) },
        });
        res.json(event);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /admin/events/:id
 */
router.delete('/events/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.event.delete({ where: { id } });
        await (0, audit_1.logAudit)({
            action: 'ADMIN_EVENT_DELETE',
            actorUserId: req.user?.id ?? null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || undefined,
            metadata: { eventId: id },
        });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map