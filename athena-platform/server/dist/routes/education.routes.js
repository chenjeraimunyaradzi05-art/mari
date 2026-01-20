"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function parseEducationApplicationStatus(value) {
    if (typeof value !== 'string' || !value)
        return undefined;
    if (Object.values(client_1.EducationApplicationStatus).includes(value)) {
        return value;
    }
    throw new errorHandler_1.ApiError(400, 'Invalid education application status');
}
const requireOrgAnalyticsAccess = async (req, _res, next) => {
    try {
        const authReq = req;
        const organizationId = req.params.organizationId;
        if (!authReq.user?.id) {
            throw new errorHandler_1.ApiError(401, 'Unauthorized');
        }
        const membership = await prisma_1.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: authReq.user.id,
                },
            },
            select: {
                role: true,
                canViewAnalytics: true,
            },
        });
        if (!membership || !membership.canViewAnalytics) {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
// ===========================================
// LIST EDUCATION PROVIDERS (TAFE/UNIVERSITY)
// ===========================================
router.get('/providers', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const type = req.query.type || ''; // 'university' | 'tafe'
        const where = {
            type: type ? type : { in: ['university', 'tafe'] },
        };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { state: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [providers, total] = await Promise.all([
            prisma_1.prisma.organization.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    logo: true,
                    website: true,
                    city: true,
                    state: true,
                    country: true,
                    type: true,
                    isVerified: true,
                },
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.organization.count({ where }),
        ]);
        res.json({
            success: true,
            data: providers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET PROVIDER DETAILS + COURSES
// ===========================================
router.get('/providers/:slug', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const provider = await prisma_1.prisma.organization.findUnique({
            where: { slug },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                logo: true,
                banner: true,
                website: true,
                city: true,
                state: true,
                country: true,
                type: true,
                isVerified: true,
            },
        });
        if (!provider || !['university', 'tafe'].includes(provider.type || '')) {
            throw new errorHandler_1.ApiError(404, 'Provider not found');
        }
        const courses = await prisma_1.prisma.course.findMany({
            where: {
                isActive: true,
                organizationId: provider.id,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({
            success: true,
            data: {
                provider,
                courses,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// MY EDUCATION APPLICATIONS
// ===========================================
router.get('/applications/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const applications = await prisma_1.prisma.educationApplication.findMany({
            where: { userId: req.user.id },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logo: true,
                        type: true,
                    },
                },
                course: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        type: true,
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json({
            success: true,
            data: applications,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE EDUCATION APPLICATION
// ===========================================
router.post('/applications', auth_1.authenticate, async (req, res, next) => {
    try {
        const { organizationId, courseId, programName, intakeDate, notes } = req.body;
        if (!organizationId) {
            throw new errorHandler_1.ApiError(400, 'organizationId is required');
        }
        const organization = await prisma_1.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, type: true },
        });
        if (!organization || !['university', 'tafe'].includes(organization.type || '')) {
            throw new errorHandler_1.ApiError(404, 'Provider not found');
        }
        if (courseId) {
            const course = await prisma_1.prisma.course.findUnique({
                where: { id: courseId },
                select: { id: true, organizationId: true, isActive: true },
            });
            if (!course || !course.isActive) {
                throw new errorHandler_1.ApiError(404, 'Course not found');
            }
            if (course.organizationId && course.organizationId !== organizationId) {
                throw new errorHandler_1.ApiError(400, 'Course does not belong to provider');
            }
        }
        const created = await prisma_1.prisma.educationApplication.create({
            data: {
                userId: req.user.id,
                organizationId,
                courseId: courseId || null,
                programName: programName || null,
                intakeDate: intakeDate ? new Date(intakeDate) : null,
                notes: notes || null,
            },
        });
        res.status(201).json({
            success: true,
            data: created,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE MY APPLICATION (STATUS/NOTES)
// ===========================================
router.patch('/applications/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const parsedStatus = parseEducationApplicationStatus(status);
        const existing = await prisma_1.prisma.educationApplication.findUnique({
            where: { id },
            select: { id: true, userId: true },
        });
        if (!existing) {
            throw new errorHandler_1.ApiError(404, 'Application not found');
        }
        if (existing.userId !== req.user.id) {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await prisma_1.prisma.educationApplication.update({
            where: { id },
            data: {
                status: parsedStatus,
                notes: typeof notes === 'string' ? notes : undefined,
            },
        });
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// PROVIDER: LIST APPLICATIONS
// ===========================================
router.get('/providers/:organizationId/applications', auth_1.authenticate, requireOrgAnalyticsAccess, async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const status = req.query.status || '';
        const parsedStatus = parseEducationApplicationStatus(status);
        const where = {
            organizationId,
            ...(parsedStatus ? { status: parsedStatus } : {}),
        };
        const applications = await prisma_1.prisma.educationApplication.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                        headline: true,
                    },
                },
                course: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        type: true,
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json({
            success: true,
            data: applications,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// PROVIDER: OUTCOMES DASHBOARD
// ===========================================
router.get('/providers/:organizationId/outcomes', auth_1.authenticate, requireOrgAnalyticsAccess, async (req, res, next) => {
    try {
        const { organizationId } = req.params;
        const [applications, courses] = await Promise.all([
            prisma_1.prisma.educationApplication.findMany({
                where: { organizationId },
                select: { status: true },
            }),
            prisma_1.prisma.course.findMany({
                where: { organizationId, isActive: true },
                select: { id: true, title: true },
            }),
        ]);
        const byStatus = applications.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
        }, {});
        const courseIds = courses.map((c) => c.id);
        const enrollments = courseIds.length
            ? await prisma_1.prisma.courseEnrollment.findMany({
                where: { courseId: { in: courseIds } },
                select: { courseId: true, progress: true },
            })
            : [];
        const totalEnrollments = enrollments.length;
        const totalCompleted = enrollments.filter((e) => e.progress >= 100).length;
        const avgProgress = totalEnrollments > 0
            ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / totalEnrollments)
            : 0;
        res.json({
            success: true,
            data: {
                applications: {
                    total: applications.length,
                    byStatus,
                },
                enrollments: {
                    total: totalEnrollments,
                    completed: totalCompleted,
                    completionRate: totalEnrollments > 0 ? Math.round((totalCompleted / totalEnrollments) * 100) : 0,
                    avgProgress,
                },
                courses: {
                    total: courses.length,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=education.routes.js.map