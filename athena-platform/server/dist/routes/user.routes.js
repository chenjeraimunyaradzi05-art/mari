"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const opensearch_1 = require("../utils/opensearch");
const region_1 = require("../utils/region");
const router = (0, express_1.Router)();
const REGION_KEYS = ['ANZ', 'US', 'SEA', 'MEA', 'UK', 'EU', 'ROW'];
const CONSENT_FIELDS = [
    'consentMarketing',
    'consentDataProcessing',
    'consentCookies',
    'consentDoNotSell',
];
// Helper to sync user data to OpenSearch
const syncUserToIndex = async (userId) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                displayName: true,
                headline: true,
                bio: true,
                role: true,
                city: true,
                country: true,
                avatar: true,
                isPublic: true,
            },
        });
        if (!user)
            return;
        if (!user.isPublic) {
            // If user became private, ensure they are removed from index
            await (0, opensearch_1.deleteDocument)(opensearch_1.IndexNames.USERS, user.id);
            return;
        }
        const startSkills = await prisma_1.prisma.userSkill.findMany({
            where: { userId },
            include: { skill: true },
        });
        const doc = {
            ...user,
            skills: startSkills.map(s => s.skill.name),
        };
        await (0, opensearch_1.indexDocument)(opensearch_1.IndexNames.USERS, user.id, doc);
    }
    catch (error) {
        console.error(`Failed to sync user ${userId} to OpenSearch:`, error);
    }
};
// ===========================================
// DOWNLOAD MY DATA (DSAR Export)
// ===========================================
router.get('/me/export', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [user, profile, skills, education, experience, posts, comments, likes, followers, following, jobApplications, savedJobs, courseEnrollments, mentorSessions, educationApplications, organizationMemberships,] = await Promise.all([
            prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    emailVerified: true,
                    emailVerifiedAt: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    avatar: true,
                    bio: true,
                    headline: true,
                    role: true,
                    persona: true,
                    city: true,
                    state: true,
                    country: true,
                    preferredLocale: true,
                    preferredCurrency: true,
                    timezone: true,
                    region: true,
                    consentMarketing: true,
                    consentDataProcessing: true,
                    consentCookies: true,
                    consentDoNotSell: true,
                    consentUpdatedAt: true,
                    currentJobTitle: true,
                    currentCompany: true,
                    yearsExperience: true,
                    isPublic: true,
                    allowMessages: true,
                    isSuspended: true,
                    createdAt: true,
                    updatedAt: true,
                    lastLoginAt: true,
                    referralCode: true,
                    referralCredits: true,
                },
            }),
            prisma_1.prisma.profile.findUnique({ where: { userId } }),
            prisma_1.prisma.userSkill.findMany({
                where: { userId },
                include: { skill: true },
                orderBy: { endorsed: 'desc' },
            }),
            prisma_1.prisma.education.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
            prisma_1.prisma.workExperience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
            prisma_1.prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
            prisma_1.prisma.comment.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
            prisma_1.prisma.like.findMany({
                where: { userId },
                include: {
                    post: {
                        select: { id: true, authorId: true, content: true, createdAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.follow.findMany({
                where: { followingId: userId },
                include: {
                    follower: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.follow.findMany({
                where: { followerId: userId },
                include: {
                    following: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.jobApplication.findMany({
                where: { userId },
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            organizationId: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { appliedAt: 'desc' },
            }),
            prisma_1.prisma.savedJob.findMany({
                where: { userId },
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            organizationId: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { savedAt: 'desc' },
            }),
            prisma_1.prisma.courseEnrollment.findMany({
                where: { userId },
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            organizationId: true,
                            providerName: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.mentorSession.findMany({
                where: { menteeId: userId },
                include: {
                    mentorProfile: {
                        include: {
                            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.educationApplication.findMany({
                where: { userId },
                include: {
                    organization: { select: { id: true, name: true, slug: true, type: true } },
                    course: { select: { id: true, title: true, slug: true } },
                },
                orderBy: { submittedAt: 'desc' },
            }),
            prisma_1.prisma.organizationMember.findMany({
                where: { userId },
                include: {
                    organization: { select: { id: true, name: true, slug: true, type: true } },
                },
                orderBy: { invitedAt: 'desc' },
            }),
        ]);
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'DSAR_EXPORT',
                actorUserId: userId,
                targetUserId: userId,
                ipAddress: req.ip,
                userAgent: req.get('user-agent') || undefined,
                metadata: {
                    exportedAt: new Date().toISOString(),
                },
            },
        });
        res.json({
            success: true,
            data: {
                exportedAt: new Date().toISOString(),
                user,
                profile,
                skills,
                education,
                experience,
                posts,
                comments,
                likes,
                followers,
                following,
                jobApplications,
                savedJobs,
                courseEnrollments,
                mentorSessions,
                educationApplications,
                organizationMemberships,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// DELETE ACCOUNT (Minimal anonymization)
// ===========================================
router.delete('/me', auth_1.authenticate, [(0, express_validator_1.body)('confirm').isBoolean().custom((v) => v === true).withMessage('Confirmation required')], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const userId = req.user.id;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        // We avoid hard-deleting the User row because some models reference userId
        // with required relations (e.g. jobs posted). Instead we revoke access and
        // anonymize PII while keeping referential integrity intact.
        const tombstoneEmail = `deleted+${userId}+${Date.now()}@example.invalid`;
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.auditLog.create({
                data: {
                    action: 'ACCOUNT_DELETE',
                    actorUserId: userId,
                    targetUserId: userId,
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent') || undefined,
                    metadata: {
                        deletedAt: new Date().toISOString(),
                    },
                },
            }),
            prisma_1.prisma.session.deleteMany({ where: { userId } }),
            prisma_1.prisma.verificationToken.deleteMany({ where: { userId } }),
            prisma_1.prisma.subscription.deleteMany({ where: { userId } }),
            prisma_1.prisma.profile.deleteMany({ where: { userId } }),
            prisma_1.prisma.userSkill.deleteMany({ where: { userId } }),
            prisma_1.prisma.education.deleteMany({ where: { userId } }),
            prisma_1.prisma.workExperience.deleteMany({ where: { userId } }),
            prisma_1.prisma.courseEnrollment.deleteMany({ where: { userId } }),
            prisma_1.prisma.savedJob.deleteMany({ where: { userId } }),
            prisma_1.prisma.educationApplication.deleteMany({ where: { userId } }),
            prisma_1.prisma.jobApplication.deleteMany({ where: { userId } }),
            prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    email: tombstoneEmail,
                    passwordHash: null,
                    emailVerified: false,
                    emailVerifiedAt: null,
                    firstName: 'Deleted',
                    lastName: 'User',
                    displayName: 'Deleted User',
                    avatar: null,
                    bio: null,
                    headline: null,
                    city: null,
                    state: null,
                    currentJobTitle: null,
                    currentCompany: null,
                    yearsExperience: null,
                    isPublic: false,
                    allowMessages: false,
                    isSuspended: true,
                    lastLoginAt: null,
                    referralCode: null,
                    referralCredits: 0,
                },
            }),
        ]);
        res.json({
            success: true,
            message: 'Account deleted',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET USER PROFILE (PUBLIC)
// ===========================================
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                bio: true,
                headline: true,
                role: true,
                persona: true,
                city: true,
                state: true,
                country: true,
                currentJobTitle: true,
                currentCompany: true,
                yearsExperience: true,
                isPublic: true,
                createdAt: true,
                profile: {
                    select: {
                        aboutMe: true,
                        linkedinUrl: true,
                        websiteUrl: true,
                        openToWork: true,
                    },
                },
                skills: {
                    include: {
                        skill: true,
                    },
                },
                education: {
                    orderBy: { startDate: 'desc' },
                },
                experience: {
                    orderBy: { startDate: 'desc' },
                },
                _count: {
                    select: {
                        followers: true,
                        following: true,
                        posts: true,
                    },
                },
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        // Check if profile is private and viewer is not the owner
        if (!user.isPublic && req.user?.id !== id) {
            throw new errorHandler_1.ApiError(403, 'This profile is private');
        }
        // Check if current user follows this user
        let isFollowing = false;
        if (req.user && req.user.id !== id) {
            const follow = await prisma_1.prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: req.user.id,
                        followingId: id,
                    },
                },
            });
            isFollowing = !!follow;
        }
        res.json({
            success: true,
            data: {
                ...user,
                isFollowing,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE CURRENT USER PROFILE
// ===========================================
router.patch('/me', auth_1.authenticate, [
    (0, express_validator_1.body)('firstName').optional().trim().notEmpty(),
    (0, express_validator_1.body)('lastName').optional().trim().notEmpty(),
    (0, express_validator_1.body)('displayName').optional().trim(),
    (0, express_validator_1.body)('bio').optional().trim(),
    (0, express_validator_1.body)('headline').optional().trim(),
    (0, express_validator_1.body)('city').optional().trim(),
    (0, express_validator_1.body)('state').optional().trim(),
    (0, express_validator_1.body)('country').optional().trim(),
    (0, express_validator_1.body)('currentJobTitle').optional().trim(),
    (0, express_validator_1.body)('currentCompany').optional().trim(),
    (0, express_validator_1.body)('yearsExperience').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('persona').optional().isIn([
        'EARLY_CAREER', 'MID_CAREER', 'ENTREPRENEUR', 'CREATOR',
        'MENTOR', 'EDUCATION_PROVIDER', 'EMPLOYER', 'REAL_ESTATE', 'GOVERNMENT_NGO'
    ]),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const allowedFields = [
            'firstName', 'lastName', 'displayName', 'bio', 'headline',
            'city', 'state', 'country', 'currentJobTitle', 'currentCompany',
            'yearsExperience', 'persona', 'isPublic', 'allowMessages'
        ];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatar: true,
                bio: true,
                headline: true,
                role: true,
                persona: true,
                city: true,
                state: true,
                country: true,
                currentJobTitle: true,
                currentCompany: true,
                yearsExperience: true,
                isPublic: true,
            },
        });
        await syncUserToIndex(user.id);
        res.json({
            success: true,
            message: 'Profile updated',
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET USER PREFERENCES
// ===========================================
router.get('/me/preferences', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                preferredLocale: true,
                preferredCurrency: true,
                timezone: true,
                region: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE USER PREFERENCES
// ===========================================
router.patch('/me/preferences', auth_1.authenticate, [
    (0, express_validator_1.body)('preferredLocale').optional().isString().isLength({ min: 2, max: 15 }),
    (0, express_validator_1.body)('preferredCurrency').optional().isString().isLength({ min: 3, max: 3 }),
    (0, express_validator_1.body)('timezone').optional().isString().notEmpty(),
    (0, express_validator_1.body)('region').optional().isIn(REGION_KEYS),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const existing = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { region: true },
        });
        const regionKey = (0, region_1.normalizeRegion)(req.body.region || existing?.region || 'ANZ');
        const regionConfig = (0, region_1.getRegionConfig)(regionKey);
        if (req.body.preferredLocale && !regionConfig.supportedLocales.includes(req.body.preferredLocale)) {
            throw new errorHandler_1.ApiError(400, 'Locale not supported for selected region');
        }
        if (req.body.preferredCurrency &&
            !regionConfig.supportedCurrencies.includes(String(req.body.preferredCurrency).toUpperCase())) {
            throw new errorHandler_1.ApiError(400, 'Currency not supported for selected region');
        }
        const allowedFields = ['preferredLocale', 'preferredCurrency', 'timezone', 'region'];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }
        if (req.body.region && !req.body.preferredLocale) {
            updateData.preferredLocale = regionConfig.defaultLocale;
        }
        if (req.body.region && !req.body.preferredCurrency) {
            updateData.preferredCurrency = regionConfig.defaultCurrency;
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                preferredLocale: true,
                preferredCurrency: true,
                timezone: true,
                region: true,
            },
        });
        res.json({
            success: true,
            message: 'Preferences updated',
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET USER CONSENTS
// ===========================================
router.get('/me/consents', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                consentMarketing: true,
                consentDataProcessing: true,
                consentCookies: true,
                consentDoNotSell: true,
                consentUpdatedAt: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        res.json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE USER CONSENTS
// ===========================================
router.patch('/me/consents', auth_1.authenticate, [
    (0, express_validator_1.body)('consentMarketing').optional().isBoolean(),
    (0, express_validator_1.body)('consentDataProcessing').optional().isBoolean(),
    (0, express_validator_1.body)('consentCookies').optional().isBoolean(),
    (0, express_validator_1.body)('consentDoNotSell').optional().isBoolean(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const updateData = {};
        for (const field of CONSENT_FIELDS) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }
        if (Object.keys(updateData).length === 0) {
            throw new errorHandler_1.ApiError(400, 'No consent updates provided');
        }
        updateData.consentUpdatedAt = new Date();
        const user = await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                consentMarketing: true,
                consentDataProcessing: true,
                consentCookies: true,
                consentDoNotSell: true,
                consentUpdatedAt: true,
            },
        });
        res.json({
            success: true,
            message: 'Consents updated',
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE EXTENDED PROFILE
// ===========================================
router.patch('/me/profile', auth_1.authenticate, [
    (0, express_validator_1.body)('aboutMe').optional().trim(),
    (0, express_validator_1.body)('linkedinUrl').optional().isURL(),
    (0, express_validator_1.body)('websiteUrl').optional().isURL(),
    (0, express_validator_1.body)('twitterUrl').optional().isURL(),
    (0, express_validator_1.body)('openToWork').optional().isBoolean(),
    (0, express_validator_1.body)('salaryMin').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('salaryMax').optional().isInt({ min: 0 }),
    (0, express_validator_1.body)('remotePreference').optional().isIn(['remote', 'hybrid', 'onsite']),
], async (req, res, next) => {
    try {
        const profile = await prisma_1.prisma.profile.upsert({
            where: { userId: req.user.id },
            update: req.body,
            create: {
                userId: req.user.id,
                ...req.body,
            },
        });
        res.json({
            success: true,
            message: 'Profile updated',
            data: profile,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// ADD SKILL
// ===========================================
router.get('/me/skills', auth_1.authenticate, async (req, res, next) => {
    try {
        const skills = await prisma_1.prisma.userSkill.findMany({
            where: { userId: req.user.id },
            select: {
                id: true,
                skillId: true,
                level: true,
                endorsed: true,
                skill: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { skill: { name: 'asc' } },
        });
        res.json({
            success: true,
            data: skills.map((s) => ({
                id: s.id,
                skillId: s.skillId,
                name: s.skill.name,
                level: s.level,
                endorsed: s.endorsed,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/me/skills', auth_1.authenticate, [
    (0, express_validator_1.body)('skillName').notEmpty().trim(),
    (0, express_validator_1.body)('level').optional().isInt({ min: 1, max: 5 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { skillName, level } = req.body;
        // Find or create skill
        let skill = await prisma_1.prisma.skill.findUnique({
            where: { name: skillName.toLowerCase() },
        });
        if (!skill) {
            skill = await prisma_1.prisma.skill.create({
                data: { name: skillName.toLowerCase() },
            });
        }
        // Add to user
        const userSkill = await prisma_1.prisma.userSkill.upsert({
            where: {
                userId_skillId: {
                    userId: req.user.id,
                    skillId: skill.id,
                },
            },
            update: { level },
            create: {
                userId: req.user.id,
                skillId: skill.id,
                level,
            },
            include: { skill: true },
        });
        await syncUserToIndex(req.user.id);
        res.status(201).json({
            success: true,
            data: userSkill,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// REMOVE SKILL
// ===========================================
router.delete('/me/skills/:skillId', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma_1.prisma.userSkill.deleteMany({
            where: {
                userId: req.user.id,
                skillId: req.params.skillId,
            },
        });
        await syncUserToIndex(req.user.id);
        res.json({
            success: true,
            message: 'Skill removed',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// ADD WORK EXPERIENCE
// ===========================================
router.post('/me/experience', auth_1.authenticate, [
    (0, express_validator_1.body)('company').notEmpty().trim(),
    (0, express_validator_1.body)('title').notEmpty().trim(),
    (0, express_validator_1.body)('startDate').isISO8601(),
    (0, express_validator_1.body)('endDate').optional().isISO8601(),
    (0, express_validator_1.body)('current').optional().isBoolean(),
    (0, express_validator_1.body)('description').optional().trim(),
], async (req, res, next) => {
    try {
        const experience = await prisma_1.prisma.workExperience.create({
            data: {
                userId: req.user.id,
                ...req.body,
                startDate: new Date(req.body.startDate),
                endDate: req.body.endDate ? new Date(req.body.endDate) : null,
            },
        });
        res.status(201).json({
            success: true,
            data: experience,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// ADD EDUCATION
// ===========================================
router.post('/me/education', auth_1.authenticate, [
    (0, express_validator_1.body)('institution').notEmpty().trim(),
    (0, express_validator_1.body)('degree').optional().trim(),
    (0, express_validator_1.body)('fieldOfStudy').optional().trim(),
    (0, express_validator_1.body)('startDate').optional().isISO8601(),
    (0, express_validator_1.body)('endDate').optional().isISO8601(),
    (0, express_validator_1.body)('current').optional().isBoolean(),
], async (req, res, next) => {
    try {
        const education = await prisma_1.prisma.education.create({
            data: {
                userId: req.user.id,
                ...req.body,
                startDate: req.body.startDate ? new Date(req.body.startDate) : null,
                endDate: req.body.endDate ? new Date(req.body.endDate) : null,
            },
        });
        res.status(201).json({
            success: true,
            data: education,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// FOLLOW USER
// ===========================================
router.post('/:id/follow', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) {
            throw new errorHandler_1.ApiError(400, 'Cannot follow yourself');
        }
        // Check if user exists
        const userToFollow = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!userToFollow) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        // Check if already following
        const existingFollow = await prisma_1.prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: req.user.id,
                    followingId: id,
                },
            },
        });
        if (existingFollow) {
            throw new errorHandler_1.ApiError(400, 'Already following this user');
        }
        await prisma_1.prisma.follow.create({
            data: {
                followerId: req.user.id,
                followingId: id,
            },
        });
        // Create notification
        await prisma_1.prisma.notification.create({
            data: {
                userId: id,
                type: 'FOLLOW',
                title: 'New follower',
                message: `${req.user.email} started following you`,
                link: `/users/${req.user.id}`,
            },
        });
        res.json({
            success: true,
            message: 'Following user',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UNFOLLOW USER
// ===========================================
router.delete('/:id/follow', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.follow.deleteMany({
            where: {
                followerId: req.user.id,
                followingId: id,
            },
        });
        res.json({
            success: true,
            message: 'Unfollowed user',
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET USER'S FOLLOWERS
// ===========================================
router.get('/:id/followers', async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const followers = await prisma_1.prisma.follow.findMany({
            where: { followingId: id },
            include: {
                follower: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        avatar: true,
                        headline: true,
                    },
                },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
        const total = await prisma_1.prisma.follow.count({ where: { followingId: id } });
        res.json({
            success: true,
            data: followers.map((f) => f.follower),
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
// GET USER'S FOLLOWING
// ===========================================
router.get('/:id/following', async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const following = await prisma_1.prisma.follow.findMany({
            where: { followerId: id },
            include: {
                following: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        avatar: true,
                        headline: true,
                    },
                },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
        const total = await prisma_1.prisma.follow.count({ where: { followerId: id } });
        res.json({
            success: true,
            data: following.map((f) => f.following),
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
exports.default = router;
//# sourceMappingURL=user.routes.js.map