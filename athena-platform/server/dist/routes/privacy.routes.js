"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ===========================================
// PRIVACY (Week 11)
// ===========================================
/**
 * GET /privacy/me/export
 * Export a user's data as JSON (DSAR-style export)
 */
router.get('/me/export', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.ApiError(401, 'Authentication required');
        }
        const user = await prisma_1.prisma.user.findUnique({
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
                profile: true,
                subscription: true,
                skills: {
                    include: {
                        skill: true,
                    },
                },
                education: true,
                experience: true,
                posts: true,
                comments: true,
                likes: true,
                jobsPosted: true,
                applications: true,
                savedJobs: true,
                sentMessages: true,
                receivedMessages: true,
                followers: true,
                following: true,
                notifications: true,
                creatorProfile: true,
                mentorProfile: true,
                mentorSessions: true,
                courseEnrollments: true,
                educationApplications: true,
                organizationMemberships: true,
                referralsMade: true,
                referredBy: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.ApiError(404, 'User not found');
        }
        const exportedAt = new Date().toISOString();
        const safeDate = exportedAt.slice(0, 10);
        const filename = `athena-export-${safeDate}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(JSON.stringify({
            exportedAt,
            userId,
            data: user,
        }, null, 2));
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /privacy/me
 * Permanently delete the authenticated user's account.
 */
router.delete('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandler_1.ApiError(401, 'Authentication required');
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            // Remove records that may block User deletion (e.g., Job.postedBy relation)
            await tx.job.deleteMany({ where: { postedById: userId } });
            // Explicitly remove user-scoped data (many are cascaded, but this is safer)
            await tx.message.deleteMany({
                where: {
                    OR: [{ senderId: userId }, { receiverId: userId }],
                },
            });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.follow.deleteMany({
                where: {
                    OR: [{ followerId: userId }, { followingId: userId }],
                },
            });
            await tx.referral.deleteMany({
                where: {
                    OR: [{ referrerId: userId }, { referredId: userId }],
                },
            });
            await tx.organizationMember.deleteMany({ where: { userId } });
            await tx.mentorSession.deleteMany({ where: { menteeId: userId } });
            await tx.courseEnrollment.deleteMany({ where: { userId } });
            await tx.educationApplication.deleteMany({ where: { userId } });
            await tx.jobApplication.deleteMany({ where: { userId } });
            await tx.savedJob.deleteMany({ where: { userId } });
            await tx.comment.deleteMany({ where: { authorId: userId } });
            await tx.like.deleteMany({ where: { userId } });
            await tx.post.deleteMany({ where: { authorId: userId } });
            // These are cascaded from User in schema, but safe to delete explicitly
            await tx.session.deleteMany({ where: { userId } });
            await tx.verificationToken.deleteMany({ where: { userId } });
            await tx.subscription.deleteMany({ where: { userId } });
            await tx.profile.deleteMany({ where: { userId } });
            await tx.userSkill.deleteMany({ where: { userId } });
            await tx.education.deleteMany({ where: { userId } });
            await tx.workExperience.deleteMany({ where: { userId } });
            await tx.creatorProfile.deleteMany({ where: { userId } });
            await tx.mentorProfile.deleteMany({ where: { userId } });
            await tx.user.delete({ where: { id: userId } });
        });
        res.json({ success: true, message: 'Account deleted' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=privacy.routes.js.map