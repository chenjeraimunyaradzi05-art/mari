"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ============================================================================
// MIDDLEWARE: Check organization membership
// ============================================================================
async function requireOrgAccess(req, res, next) {
    const orgId = req.params.orgId || req.body.organizationId;
    const userId = req.user.id;
    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
    }
    const membership = await prisma_1.prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: { organizationId: orgId, userId },
        },
    });
    if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' });
    }
    req.membership = membership;
    next();
}
// ============================================================================
// GET MY ORGANIZATIONS
// ============================================================================
/**
 * GET /employer/organizations
 * Get all organizations the user is a member of
 */
router.get('/organizations', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const memberships = await prisma_1.prisma.organizationMember.findMany({
            where: { userId },
            include: {
                organization: {
                    include: {
                        _count: {
                            select: {
                                jobs: true,
                                members: true,
                            },
                        },
                    },
                },
            },
        });
        res.json({
            success: true,
            data: memberships.map(m => ({
                ...m.organization,
                role: m.role,
                canPostJobs: m.canPostJobs,
                canManageTeam: m.canManageTeam,
                jobCount: m.organization._count.jobs,
                memberCount: m.organization._count.members,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// CREATE ORGANIZATION (Employer signup)
// ============================================================================
/**
 * POST /employer/organizations
 * Create a new organization and become the owner
 */
router.post('/organizations', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().trim().withMessage('Company name is required'),
    (0, express_validator_1.body)('type').isIn(['company', 'university', 'tafe', 'government', 'ngo']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const userId = req.user.id;
        const { name, type, description, website, city, state, country, industry, size, logo, brandColor } = req.body;
        // Generate slug
        const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let slug = baseSlug;
        let counter = 1;
        while (await prisma_1.prisma.organization.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        // Create organization with owner membership in a transaction
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({
                data: {
                    name,
                    slug,
                    type,
                    description,
                    website,
                    city,
                    state,
                    country: country || 'Australia',
                    industry,
                    size,
                    logo,
                    brandColor,
                },
            });
            // Create owner membership
            await tx.organizationMember.create({
                data: {
                    organizationId: organization.id,
                    userId,
                    role: 'OWNER',
                    canPostJobs: true,
                    canManageTeam: true,
                    canViewAnalytics: true,
                    acceptedAt: new Date(),
                },
            });
            return organization;
        });
        res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ORGANIZATION DASHBOARD
// ============================================================================
/**
 * GET /employer/organizations/:orgId/dashboard
 * Get organization dashboard with stats
 */
router.get('/organizations/:orgId/dashboard', auth_1.authenticate, requireOrgAccess, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [organization, activeJobs, totalApplications, recentApplications, applicationsByStatus, jobViews,] = await Promise.all([
            prisma_1.prisma.organization.findUnique({
                where: { id: orgId },
                include: { _count: { select: { jobs: true, members: true } } },
            }),
            prisma_1.prisma.job.count({
                where: { organizationId: orgId, status: 'ACTIVE' },
            }),
            prisma_1.prisma.jobApplication.count({
                where: { job: { organizationId: orgId } },
            }),
            prisma_1.prisma.jobApplication.count({
                where: {
                    job: { organizationId: orgId },
                    appliedAt: { gte: thirtyDaysAgo },
                },
            }),
            prisma_1.prisma.jobApplication.groupBy({
                by: ['status'],
                where: { job: { organizationId: orgId } },
                _count: true,
            }),
            prisma_1.prisma.job.aggregate({
                where: { organizationId: orgId },
                _sum: { viewCount: true },
            }),
        ]);
        res.json({
            success: true,
            data: {
                organization,
                stats: {
                    activeJobs,
                    totalJobs: organization?._count.jobs || 0,
                    teamMembers: organization?._count.members || 0,
                    totalApplications,
                    recentApplications,
                    totalViews: jobViews._sum.viewCount || 0,
                    applicationsByStatus: applicationsByStatus.reduce((acc, item) => {
                        acc[item.status] = item._count;
                        return acc;
                    }, {}),
                },
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
 * GET /employer/organizations/:orgId/jobs
 * Get all jobs for an organization
 */
router.get('/organizations/:orgId/jobs', auth_1.authenticate, requireOrgAccess, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const status = req.query.status;
        const where = { organizationId: orgId };
        if (status)
            where.status = status;
        const jobs = await prisma_1.prisma.job.findMany({
            where,
            include: {
                _count: { select: { applications: true } },
                skills: { include: { skill: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: jobs.map(job => ({
                ...job,
                applicationCount: job._count.applications,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /employer/organizations/:orgId/jobs
 * Create a new job posting
 */
router.post('/organizations/:orgId/jobs', auth_1.authenticate, requireOrgAccess, [
    (0, express_validator_1.body)('title').notEmpty().trim().withMessage('Job title is required'),
    (0, express_validator_1.body)('description').notEmpty().withMessage('Job description is required'),
    (0, express_validator_1.body)('type').isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'CASUAL']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const membership = req.membership;
        if (!membership.canPostJobs && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'You do not have permission to post jobs');
        }
        const { orgId } = req.params;
        const userId = req.user.id;
        const { title, description, type, city, state, country, isRemote, salaryMin, salaryMax, salaryType, showSalary, experienceMin, experienceMax, skills, status, } = req.body;
        // Generate slug
        const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let slug = baseSlug;
        let counter = 1;
        while (await prisma_1.prisma.job.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        const job = await prisma_1.prisma.job.create({
            data: {
                title,
                slug,
                description,
                type,
                status: status || 'DRAFT',
                organizationId: orgId,
                postedById: userId,
                city,
                state,
                country: country || 'Australia',
                isRemote: isRemote || false,
                salaryMin,
                salaryMax,
                salaryType,
                showSalary: showSalary ?? true,
                experienceMin,
                experienceMax,
                publishedAt: status === 'ACTIVE' ? new Date() : null,
            },
        });
        // Add skills if provided
        if (skills && Array.isArray(skills)) {
            for (const skillName of skills) {
                let skill = await prisma_1.prisma.skill.findFirst({
                    where: { name: { equals: skillName, mode: 'insensitive' } },
                });
                if (!skill) {
                    skill = await prisma_1.prisma.skill.create({ data: { name: skillName } });
                }
                await prisma_1.prisma.jobSkill.create({
                    data: { jobId: job.id, skillId: skill.id },
                });
            }
        }
        res.status(201).json({
            success: true,
            message: 'Job created successfully',
            data: job,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /employer/jobs/:jobId
 * Update a job posting
 */
router.patch('/jobs/:jobId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.id;
        // Check ownership
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: jobId },
            include: { organization: true },
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        // Check if user has access to this job's organization
        if (job.organizationId) {
            const membership = await prisma_1.prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: { organizationId: job.organizationId, userId },
                },
            });
            if (!membership) {
                throw new errorHandler_1.ApiError(403, 'Access denied');
            }
        }
        else if (job.postedById !== userId) {
            throw new errorHandler_1.ApiError(403, 'Access denied');
        }
        const allowedFields = [
            'title', 'description', 'type', 'status', 'city', 'state', 'country',
            'isRemote', 'salaryMin', 'salaryMax', 'salaryType', 'showSalary',
            'experienceMin', 'experienceMax', 'benefits', 'applicationUrl', 'applicationEmail',
        ];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }
        // Set publishedAt if status changes to ACTIVE
        if (updateData.status === 'ACTIVE' && job.status !== 'ACTIVE') {
            updateData.publishedAt = new Date();
        }
        const updatedJob = await prisma_1.prisma.job.update({
            where: { id: jobId },
            data: updateData,
        });
        res.json({
            success: true,
            message: 'Job updated successfully',
            data: updatedJob,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// APPLICATION MANAGEMENT
// ============================================================================
/**
 * GET /employer/organizations/:orgId/applications
 * Get all applications for organization's jobs
 */
router.get('/organizations/:orgId/applications', auth_1.authenticate, requireOrgAccess, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { jobId, status, page = '1', limit = '20' } = req.query;
        const where = { job: { organizationId: orgId } };
        if (jobId)
            where.jobId = jobId;
        if (status)
            where.status = status;
        const [applications, total] = await Promise.all([
            prisma_1.prisma.jobApplication.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    job: {
                        select: { id: true, title: true, slug: true },
                    },
                },
                orderBy: { appliedAt: 'desc' },
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
            }),
            prisma_1.prisma.jobApplication.count({ where }),
        ]);
        res.json({
            success: true,
            data: applications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /employer/applications/:applicationId/status
 * Update application status
 */
router.patch('/applications/:applicationId/status', auth_1.authenticate, [
    (0, express_validator_1.body)('status').isIn(['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN']),
], async (req, res, next) => {
    try {
        const { applicationId } = req.params;
        const { status, notes } = req.body;
        const userId = req.user.id;
        // Get application with job and org
        const application = await prisma_1.prisma.jobApplication.findUnique({
            where: { id: applicationId },
            include: { job: true },
        });
        if (!application) {
            throw new errorHandler_1.ApiError(404, 'Application not found');
        }
        // Check access
        if (application.job.organizationId) {
            const membership = await prisma_1.prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: { organizationId: application.job.organizationId, userId },
                },
            });
            if (!membership) {
                throw new errorHandler_1.ApiError(403, 'Access denied');
            }
        }
        const updatedApplication = await prisma_1.prisma.jobApplication.update({
            where: { id: applicationId },
            data: { status },
        });
        // Send notification to applicant
        await prisma_1.prisma.notification.create({
            data: {
                userId: application.userId,
                type: 'JOB_MATCH',
                title: `Application ${status === 'SHORTLISTED' ? 'Shortlisted! 🎉' : status === 'REJECTED' ? 'Update' : 'Status Updated'}`,
                message: `Your application for ${application.job.title} has been updated to: ${status}`,
                link: `/dashboard/applications`,
            },
        });
        res.json({
            success: true,
            message: 'Application status updated',
            data: updatedApplication,
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// TEAM MANAGEMENT
// ============================================================================
/**
 * GET /employer/organizations/:orgId/team
 * Get organization team members
 */
router.get('/organizations/:orgId/team', auth_1.authenticate, requireOrgAccess, async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const members = await prisma_1.prisma.organizationMember.findMany({
            where: { organizationId: orgId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { invitedAt: 'asc' },
        });
        res.json({
            success: true,
            data: members,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /employer/organizations/:orgId/team/invite
 * Invite a team member
 */
router.post('/organizations/:orgId/team/invite', auth_1.authenticate, requireOrgAccess, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email required'),
    (0, express_validator_1.body)('role').isIn(['ADMIN', 'RECRUITER', 'VIEWER']),
], async (req, res, next) => {
    try {
        const membership = req.membership;
        if (!membership.canManageTeam && membership.role !== 'OWNER') {
            throw new errorHandler_1.ApiError(403, 'You do not have permission to manage team');
        }
        const { orgId } = req.params;
        const { email, role, canPostJobs, canManageTeam, canViewAnalytics } = req.body;
        // Find user by email
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found. They must have an ATHENA account first.');
        }
        // Check if already a member
        const existing = await prisma_1.prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
        });
        if (existing) {
            throw new errorHandler_1.ApiError(400, 'User is already a member');
        }
        const member = await prisma_1.prisma.organizationMember.create({
            data: {
                organizationId: orgId,
                userId: user.id,
                role,
                canPostJobs: canPostJobs ?? (role === 'ADMIN' || role === 'RECRUITER'),
                canManageTeam: canManageTeam ?? (role === 'ADMIN'),
                canViewAnalytics: canViewAnalytics ?? true,
            },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });
        // Notify the invited user
        await prisma_1.prisma.notification.create({
            data: {
                userId: user.id,
                type: 'SYSTEM',
                title: 'You\'ve been invited to a team!',
                message: `You've been added to an organization. View your employer dashboard.`,
                link: '/employer',
            },
        });
        res.status(201).json({
            success: true,
            message: 'Team member invited',
            data: member,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /employer/organizations/:orgId/team/:memberId
 * Remove a team member
 */
router.delete('/organizations/:orgId/team/:memberId', auth_1.authenticate, requireOrgAccess, async (req, res, next) => {
    try {
        const membership = req.membership;
        if (!membership.canManageTeam && membership.role !== 'OWNER') {
            throw new errorHandler_1.ApiError(403, 'You do not have permission to manage team');
        }
        const { orgId, memberId } = req.params;
        // Cannot remove owner
        const targetMember = await prisma_1.prisma.organizationMember.findUnique({
            where: { id: memberId },
        });
        if (!targetMember) {
            throw new errorHandler_1.ApiError(404, 'Member not found');
        }
        if (targetMember.role === 'OWNER') {
            throw new errorHandler_1.ApiError(400, 'Cannot remove organization owner');
        }
        await prisma_1.prisma.organizationMember.delete({
            where: { id: memberId },
        });
        res.json({
            success: true,
            message: 'Team member removed',
        });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// ANALYTICS
// ============================================================================
/**
 * GET /employer/organizations/:orgId/analytics
 * Get detailed analytics for an organization
 */
router.get('/organizations/:orgId/analytics', auth_1.authenticate, requireOrgAccess, async (req, res, next) => {
    try {
        const membership = req.membership;
        if (!membership.canViewAnalytics) {
            throw new errorHandler_1.ApiError(403, 'You do not have permission to view analytics');
        }
        const { orgId } = req.params;
        const { days = '30' } = req.query;
        const daysNum = parseInt(days);
        const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
        // Get application trends by date
        const applications = await prisma_1.prisma.jobApplication.findMany({
            where: {
                job: { organizationId: orgId },
                appliedAt: { gte: startDate },
            },
            select: { appliedAt: true, status: true },
        });
        // Group by date
        const applicationsByDate = {};
        applications.forEach((app) => {
            const date = app.appliedAt.toISOString().split('T')[0];
            applicationsByDate[date] = (applicationsByDate[date] || 0) + 1;
        });
        // Top performing jobs
        const topJobs = await prisma_1.prisma.job.findMany({
            where: { organizationId: orgId },
            select: {
                id: true,
                title: true,
                viewCount: true,
                applicationCount: true,
            },
            orderBy: { viewCount: 'desc' },
            take: 5,
        });
        // Conversion funnel
        const funnel = await prisma_1.prisma.jobApplication.groupBy({
            by: ['status'],
            where: { job: { organizationId: orgId } },
            _count: true,
        });
        res.json({
            success: true,
            data: {
                period: { days: daysNum, startDate, endDate: new Date() },
                applicationTrend: Object.entries(applicationsByDate)
                    .map(([date, count]) => ({ date, count }))
                    .sort((a, b) => a.date.localeCompare(b.date)),
                topJobs: topJobs.map(job => ({
                    id: job.id,
                    title: job.title,
                    views: job.viewCount,
                    applications: job.applicationCount,
                    conversionRate: job.viewCount > 0
                        ? ((job.applicationCount / job.viewCount) * 100).toFixed(1) + '%'
                        : '0%',
                })),
                funnel: funnel.reduce((acc, item) => {
                    acc[item.status] = item._count;
                    return acc;
                }, {}),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=employer.routes.js.map