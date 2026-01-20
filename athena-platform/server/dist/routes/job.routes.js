"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const uuid_1 = require("uuid");
const opensearch_1 = require("../utils/opensearch");
const search_service_1 = require("../services/search.service");
const notification_service_1 = require("../services/notification.service");
const router = (0, express_1.Router)();
// ===========================================
// SEARCH JOBS
// ===========================================
router.get('/', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const type = req.query.type;
        const city = req.query.city;
        const state = req.query.state;
        const remote = req.query.remote === 'true';
        const salaryMin = parseInt(req.query.salaryMin) || undefined;
        const salaryMax = parseInt(req.query.salaryMax) || undefined;
        let jobIds = null;
        let totalCount = 0;
        // 1. Try OpenSearch if there is a text query
        if (search) {
            try {
                const searchResult = await (0, search_service_1.search)({
                    query: search,
                    type: 'jobs',
                    page,
                    limit,
                    filters: {
                        jobType: type,
                        salary: { min: salaryMin, max: salaryMax },
                        remote,
                    },
                });
                jobIds = searchResult.results.map((r) => r.id);
                totalCount = searchResult.total;
            }
            catch (error) {
                // Fallback will happen in the 'else' logic usually, but here we just proceed with null jobIds
                // effectively falling back to Prisma below if we structure it right.
                console.error('Search service failed', error);
            }
        }
        // 2. Build Prisma Query
        const where = { status: 'ACTIVE' };
        if (jobIds !== null) {
            // OpenSearch path
            if (jobIds.length === 0) {
                // No results from search
                return res.json({
                    success: true,
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 },
                });
            }
            where.id = { in: jobIds };
        }
        else {
            // Prisma path (Browse or Fallback)
            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ];
            }
            if (type)
                where.type = type;
            if (city)
                where.city = { contains: city, mode: 'insensitive' };
            if (state)
                where.state = state;
            if (remote)
                where.isRemote = true;
            if (salaryMin)
                where.salaryMin = { gte: salaryMin };
            if (salaryMax)
                where.salaryMax = { lte: salaryMax };
        }
        const [jobs, total] = await Promise.all([
            prisma_1.prisma.job.findMany({
                where,
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            logo: true,
                            safetyScore: true,
                        },
                    },
                    skills: {
                        include: { skill: true },
                    },
                    _count: {
                        select: { applications: true },
                    },
                },
                skip: jobIds ? undefined : (page - 1) * limit, // Pagination handled by OS if used
                take: jobIds ? undefined : limit,
                orderBy: jobIds ? undefined : { publishedAt: 'desc' },
            }),
            jobIds ? Promise.resolve(totalCount) : prisma_1.prisma.job.count({ where }),
        ]);
        // 3. Preserve Order if using Search
        let resultJobs = jobs;
        if (jobIds) {
            const jobMap = new Map(jobs.map((j) => [j.id, j]));
            resultJobs = jobIds.map((id) => jobMap.get(id)).filter(Boolean);
        }
        // Check if user has applied to each job
        let appliedJobIds = [];
        if (req.user) {
            const applications = await prisma_1.prisma.jobApplication.findMany({
                where: {
                    userId: req.user.id,
                    jobId: { in: resultJobs.map((j) => j.id) },
                },
                select: { jobId: true },
            });
            appliedJobIds = applications.map((a) => a.jobId);
        }
        const jobsWithApplied = resultJobs.map((job) => ({
            ...job,
            hasApplied: appliedJobIds.includes(job.id),
        }));
        res.json({
            success: true,
            data: jobsWithApplied,
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
// GET JOB BY ID
// ===========================================
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const job = await prisma_1.prisma.job.findUnique({
            where: { id },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logo: true,
                        description: true,
                        website: true,
                        city: true,
                        state: true,
                        industry: true,
                        size: true,
                        safetyScore: true,
                        isVerified: true,
                    },
                },
                postedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                skills: {
                    include: { skill: true },
                },
                _count: {
                    select: { applications: true },
                },
            },
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        // Increment view count
        await prisma_1.prisma.job.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });
        // Check if user has applied
        let hasApplied = false;
        let application = null;
        if (req.user) {
            application = await prisma_1.prisma.jobApplication.findUnique({
                where: {
                    jobId_userId: {
                        jobId: id,
                        userId: req.user.id,
                    },
                },
            });
            hasApplied = !!application;
        }
        res.json({
            success: true,
            data: {
                ...job,
                hasApplied,
                application,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE JOB (Employers Only)
// ===========================================
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('EMPLOYER', 'ADMIN'), [
    (0, express_validator_1.body)('title').notEmpty().trim(),
    (0, express_validator_1.body)('description').notEmpty(),
    (0, express_validator_1.body)('type').isIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL', 'INTERNSHIP', 'APPRENTICESHIP']),
    (0, express_validator_1.body)('city').optional().trim(),
    (0, express_validator_1.body)('state').optional().trim(),
    (0, express_validator_1.body)('isRemote').optional().isBoolean(),
    (0, express_validator_1.body)('salaryMin').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('salaryMax').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('experienceMin').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('experienceMax').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('skills').optional().isArray(),
    (0, express_validator_1.body)('deadline').optional().isISO8601(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { skills, ...jobData } = req.body;
        // Generate slug
        const slug = `${jobData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(0, uuid_1.v4)().slice(0, 8)}`;
        const job = await prisma_1.prisma.job.create({
            data: {
                ...jobData,
                slug,
                postedById: req.user.id,
                status: 'DRAFT',
                deadline: jobData.deadline ? new Date(jobData.deadline) : null,
            },
        });
        // Add skills if provided
        if (skills && skills.length > 0) {
            for (const skillName of skills) {
                let skill = await prisma_1.prisma.skill.findUnique({
                    where: { name: skillName.toLowerCase() },
                });
                if (!skill) {
                    skill = await prisma_1.prisma.skill.create({
                        data: { name: skillName.toLowerCase() },
                    });
                }
                await prisma_1.prisma.jobSkill.create({
                    data: {
                        jobId: job.id,
                        skillId: skill.id,
                    },
                });
            }
        }
        // Index in OpenSearch
        await (0, opensearch_1.indexDocument)(opensearch_1.IndexNames.JOBS, job.id, {
            title: job.title,
            description: job.description,
            jobType: job.type,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            isRemote: job.isRemote,
            isDraft: true,
            companyName: null, // Need to fetch or pass this if available
            city: job.city,
            state: job.state,
            skills: skills || [],
            createdAt: job.createdAt,
        });
        res.status(201).json({
            success: true,
            message: 'Job created as draft',
            data: job,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE JOB
// ===========================================
router.patch('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check ownership
        const existingJob = await prisma_1.prisma.job.findUnique({
            where: { id },
            select: { postedById: true },
        });
        if (!existingJob) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        if (existingJob.postedById !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized to update this job');
        }
        const { skills, ...updateData } = req.body;
        const job = await prisma_1.prisma.job.update({
            where: { id },
            data: updateData,
            include: { organization: true, skills: { include: { skill: true } } }
        });
        // Update index
        await (0, opensearch_1.indexDocument)(opensearch_1.IndexNames.JOBS, job.id, {
            title: job.title,
            description: job.description,
            jobType: job.type,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            isRemote: job.isRemote,
            isDraft: job.status === 'DRAFT',
            companyName: job.organization?.name,
            city: job.city,
            state: job.state,
            skills: job.skills.map(js => js.skill.name),
            createdAt: job.createdAt,
        });
        res.json({
            success: true,
            message: 'Job updated',
            data: job,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// PUBLISH JOB
// ===========================================
router.post('/:id/publish', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const existingJob = await prisma_1.prisma.job.findUnique({
            where: { id },
        });
        if (!existingJob) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        if (existingJob.postedById !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const job = await prisma_1.prisma.job.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                publishedAt: new Date(),
            },
            include: { organization: true, skills: { include: { skill: true } } }
        });
        // Update index to mark as active
        await (0, opensearch_1.indexDocument)(opensearch_1.IndexNames.JOBS, job.id, {
            title: job.title,
            description: job.description,
            jobType: job.type,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            isRemote: job.isRemote,
            isDraft: false,
            publishedAt: job.publishedAt,
            companyName: job.organization?.name,
            city: job.city,
            state: job.state,
            skills: job.skills.map(js => js.skill.name),
            createdAt: job.createdAt,
        });
        res.json({
            success: true,
            message: 'Job published',
            data: job,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// APPLY TO JOB
// ===========================================
router.post('/:id/apply', auth_1.authenticate, [
    (0, express_validator_1.body)('coverLetter').optional().trim(),
    (0, express_validator_1.body)('resumeUrl').optional().isURL(),
], async (req, res, next) => {
    try {
        const { id } = req.params;
        const { coverLetter, resumeUrl } = req.body;
        // Check if job exists and is active
        const job = await prisma_1.prisma.job.findUnique({
            where: { id },
            include: {
                organization: { select: { name: true } },
            },
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        if (job.status !== 'ACTIVE') {
            throw new errorHandler_1.ApiError(400, 'This job is no longer accepting applications');
        }
        // Check if already applied
        const existingApplication = await prisma_1.prisma.jobApplication.findUnique({
            where: {
                jobId_userId: {
                    jobId: id,
                    userId: req.user.id,
                },
            },
        });
        if (existingApplication) {
            throw new errorHandler_1.ApiError(400, 'You have already applied to this job');
        }
        // Create application
        const application = await prisma_1.prisma.jobApplication.create({
            data: {
                jobId: id,
                userId: req.user.id,
                coverLetter,
                resumeUrl,
            },
        });
        // Update application count
        await prisma_1.prisma.job.update({
            where: { id },
            data: { applicationCount: { increment: 1 } },
        });
        // Create notification for job poster
        await prisma_1.prisma.notification.create({
            data: {
                userId: job.postedById,
                type: 'APPLICATION_UPDATE',
                title: 'New application',
                message: `Someone applied to ${job.title}`,
                link: `/jobs/${id}/applications`,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Application submitted',
            data: application,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET MY APPLICATIONS
// ===========================================
router.get('/me/applications', auth_1.authenticate, async (req, res, next) => {
    try {
        const applications = await prisma_1.prisma.jobApplication.findMany({
            where: { userId: req.user.id },
            include: {
                job: {
                    include: {
                        organization: {
                            select: {
                                name: true,
                                logo: true,
                            },
                        },
                    },
                },
            },
            orderBy: { appliedAt: 'desc' },
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
// GET JOB APPLICATIONS (For Employers)
// ===========================================
router.get('/:id/applications', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check ownership
        const job = await prisma_1.prisma.job.findUnique({
            where: { id },
            select: { postedById: true },
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        if (job.postedById !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const applications = await prisma_1.prisma.jobApplication.findMany({
            where: { jobId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        headline: true,
                        currentJobTitle: true,
                        yearsExperience: true,
                    },
                },
            },
            orderBy: { appliedAt: 'desc' },
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
// UPDATE APPLICATION STATUS (For Employers)
// ===========================================
router.patch('/:jobId/applications/:applicationId', auth_1.authenticate, [
    (0, express_validator_1.body)('status').isIn(['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED']),
], async (req, res, next) => {
    try {
        const { jobId, applicationId } = req.params;
        const { status } = req.body;
        // Verify job ownership
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: jobId },
            select: { postedById: true, title: true },
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        if (job.postedById !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const application = await prisma_1.prisma.jobApplication.update({
            where: { id: applicationId },
            data: { status },
            include: { user: { select: { id: true } } },
        });
        // Notify applicant
        await notification_service_1.notificationService.notify({
            userId: application.user.id,
            type: 'APPLICATION_UPDATE',
            title: 'Application Status Updated',
            message: `Your application for ${job.title} is now ${status}`,
            link: `/dashboard/applications`,
            channels: ['in-app', 'email'],
            emailTemplate: {
                subject: `Application Update: ${job.title}`,
                html: `
            <h2>Application Status Update</h2>
            <p>Your application for <strong>${job.title}</strong> has moved to: <strong>${status}</strong>.</p>
            <div style="margin: 20px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard/applications" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Applications</a>
            </div>
          `
            }
        });
        res.json({
            success: true,
            message: 'Application status updated',
            data: application,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SAVED JOBS
// ===========================================
router.get('/me/saved', auth_1.authenticate, async (req, res, next) => {
    try {
        const savedJobs = await prisma_1.prisma.savedJob.findMany({
            where: { userId: req.user.id },
            include: {
                job: {
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                logo: true,
                                safetyScore: true,
                            },
                        },
                        skills: {
                            include: { skill: true },
                        },
                    },
                },
            },
            orderBy: { savedAt: 'desc' },
        });
        // Flatten the response to return jobs with savedAt
        const jobs = savedJobs.map((saved) => ({
            ...saved.job,
            savedAt: saved.savedAt,
            isSaved: true,
        }));
        res.json({
            success: true,
            data: jobs,
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/save', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if job exists
        const job = await prisma_1.prisma.job.findUnique({
            where: { id },
        });
        if (!job) {
            throw new errorHandler_1.ApiError(404, 'Job not found');
        }
        // Check if already saved
        const existing = await prisma_1.prisma.savedJob.findUnique({
            where: {
                userId_jobId: {
                    userId: req.user.id,
                    jobId: id,
                },
            },
        });
        if (existing) {
            throw new errorHandler_1.ApiError(400, 'Job already saved');
        }
        await prisma_1.prisma.savedJob.create({
            data: {
                userId: req.user.id,
                jobId: id,
            },
        });
        res.json({
            success: true,
            message: 'Job saved',
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id/save', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.savedJob.deleteMany({
            where: {
                userId: req.user.id,
                jobId: id,
            },
        });
        res.json({
            success: true,
            message: 'Job removed from saved',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET RECOMMENDED JOBS
// ===========================================
router.get('/recommendations/for-me', auth_1.authenticate, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        // 1. Get IDs from OpenSearch (Selection & Ranking)
        const recommendations = await (0, search_service_1.getRecommendedJobs)(req.user.id, limit);
        if (recommendations.length === 0) {
            return res.json({ success: true, data: [] });
        }
        const jobIds = recommendations.map((r) => r.id);
        // 2. Hydrate full job details + relations
        const jobs = await prisma_1.prisma.job.findMany({
            where: { id: { in: jobIds } },
            include: {
                organization: {
                    select: { id: true, name: true, logo: true },
                },
                skills: {
                    include: { skill: true },
                },
            },
        });
        const jobMap = new Map(jobs.map((j) => [j.id, j]));
        // 3. Calculate "Visual" Match Score for UI badge
        // We already used the sophisticated scorer definition in OpenSearch for the order,
        // but the UI likes a simple "X% Skills Match" number.
        const userSkills = await prisma_1.prisma.userSkill.findMany({
            where: { userId: req.user.id },
            select: { skillId: true },
        });
        const userSkillIds = userSkills.map((s) => s.skillId);
        const orderedJobs = recommendations
            .map((rec) => {
            const job = jobMap.get(rec.id);
            if (!job)
                return null;
            const jobSkillIds = job.skills.map((js) => js.skillId);
            const matchingCount = jobSkillIds.filter((id) => userSkillIds.includes(id)).length;
            const matchScore = jobSkillIds.length > 0 ? Math.round((matchingCount / jobSkillIds.length) * 100) : 0;
            return { ...job, matchScore };
        })
            .filter(Boolean);
        res.json({
            success: true,
            data: orderedJobs,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=job.routes.js.map