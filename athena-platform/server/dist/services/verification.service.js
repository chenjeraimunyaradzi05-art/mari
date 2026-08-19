"use strict";
/**
 * Verification Service
 * Identity, employer, educator, mentor, and creator verification flows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVerificationRequirements = getVerificationRequirements;
exports.getUserVerifications = getUserVerifications;
exports.submitVerification = submitVerification;
exports.verifyEmailCode = verifyEmailCode;
exports.reviewVerification = reviewVerification;
exports.submitAppeal = submitAppeal;
exports.checkExpiringVerifications = checkExpiringVerifications;
exports.getBadgeInfo = getBadgeInfo;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const opaqueToken_1 = require("../utils/opaqueToken");
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
const socket_service_1 = require("./socket.service");
// Verification requirements by type
const VERIFICATION_REQUIREMENTS = {
    IDENTITY: {
        type: 'IDENTITY',
        requiredDocuments: ['government_id'],
        optionalDocuments: ['passport', 'drivers_license'],
        processingTime: '1-3 business days',
        validityPeriod: '5 years',
        trustBoost: 25,
    },
    EMPLOYER: {
        type: 'EMPLOYER',
        requiredDocuments: ['work_email'],
        optionalDocuments: ['company_letter'],
        processingTime: '1-2 business days',
        validityPeriod: '1 year',
        trustBoost: 15,
    },
    EDUCATOR: {
        type: 'EDUCATOR',
        requiredDocuments: ['edu_email'],
        optionalDocuments: ['transcript', 'certificate'],
        processingTime: '1-3 business days',
        validityPeriod: '4 years',
        trustBoost: 15,
    },
    MENTOR: {
        type: 'MENTOR',
        requiredDocuments: ['reference', 'certificate'],
        optionalDocuments: ['portfolio'],
        processingTime: '3-5 business days',
        validityPeriod: '2 years',
        trustBoost: 20,
    },
    CREATOR: {
        type: 'CREATOR',
        requiredDocuments: [], // Auto-verified based on metrics
        optionalDocuments: ['portfolio'],
        processingTime: 'Automatic (24 hours)',
        validityPeriod: 'Ongoing (requires 90-day activity)',
        trustBoost: 10,
    },
};
function getVerificationMetadata(metadata) {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata
        : {};
}
function serializeMetadata(metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return client_1.Prisma.JsonNull;
    }
    return JSON.parse(JSON.stringify(metadata));
}
function mergeVerificationMetadata(metadata, updates = {}, keysToRemove = []) {
    const nextMetadata = {
        ...getVerificationMetadata(metadata),
        ...updates,
    };
    for (const key of keysToRemove) {
        delete nextMetadata[key];
    }
    return serializeMetadata(nextMetadata);
}
function getVerificationExpiresAt(metadata) {
    const expiresAt = getVerificationMetadata(metadata).verificationExpiresAt;
    return expiresAt ? new Date(expiresAt) : undefined;
}
function getVerificationDocuments(metadata) {
    return getVerificationMetadata(metadata).documents || [];
}
function mapVerificationRequest(badge) {
    return {
        id: badge.id,
        userId: badge.userId,
        type: badge.type,
        status: badge.status,
        submittedAt: badge.submittedAt,
        reviewedAt: badge.reviewedAt || undefined,
        reviewedBy: badge.reviewedById || undefined,
        expiresAt: getVerificationExpiresAt(badge.metadata),
        documents: getVerificationDocuments(badge.metadata),
        metadata: getVerificationMetadata(badge.metadata),
        rejectionReason: badge.reason || undefined,
        appealable: badge.status === 'REJECTED',
    };
}
async function storeEmailVerificationChallenge(verificationId, challenge) {
    const verification = await prisma_1.prisma.verificationBadge.findUnique({
        where: { id: verificationId },
        select: { metadata: true },
    });
    await prisma_1.prisma.verificationBadge.update({
        where: { id: verificationId },
        data: {
            metadata: mergeVerificationMetadata(verification?.metadata, {
                emailVerification: challenge,
            }),
        },
    });
}
async function loadEmailVerificationChallenge(verificationId) {
    const verification = await prisma_1.prisma.verificationBadge.findUnique({
        where: { id: verificationId },
    });
    if (!verification) {
        return null;
    }
    const challenge = getVerificationMetadata(verification.metadata)
        .emailVerification;
    if (!challenge) {
        return null;
    }
    return { verification, challenge };
}
function removeEmailVerificationChallenge(metadata) {
    return mergeVerificationMetadata(metadata, {}, ['emailVerification']);
}
/**
 * Get verification requirements for a type
 */
function getVerificationRequirements(type) {
    return VERIFICATION_REQUIREMENTS[type];
}
/**
 * Get all user's verifications
 */
async function getUserVerifications(userId) {
    try {
        const badges = await prisma_1.prisma.verificationBadge.findMany({
            where: { userId },
            orderBy: { submittedAt: 'desc' },
        });
        return badges.map((badge) => mapVerificationRequest({
            id: badge.id,
            userId: badge.userId,
            type: badge.type,
            status: badge.status,
            submittedAt: badge.submittedAt,
            reviewedAt: badge.reviewedAt,
            reviewedById: badge.reviewedById,
            metadata: badge.metadata,
            reason: badge.reason,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to get user verifications', { error, userId });
        return [];
    }
}
/**
 * Submit verification request
 */
async function submitVerification(userId, type, documents, metadata) {
    // Check for existing pending/approved verification
    const existing = await prisma_1.prisma.verificationBadge.findFirst({
        where: {
            userId,
            type,
            status: { in: ['PENDING', 'APPROVED'] },
        },
    });
    if (existing) {
        if (existing.status === 'APPROVED') {
            throw new Error(`You already have an approved ${type} verification`);
        }
        throw new Error(`You have a pending ${type} verification request`);
    }
    // Validate required documents
    const requirements = VERIFICATION_REQUIREMENTS[type];
    const submittedTypes = documents.map(d => d.type);
    const missingDocs = requirements.requiredDocuments.filter(req => !submittedTypes.includes(req));
    if (missingDocs.length > 0 && type !== 'CREATOR') {
        throw new Error(`Missing required documents: ${missingDocs.join(', ')}`);
    }
    // Create verification request
    const verification = await prisma_1.prisma.verificationBadge.create({
        data: {
            userId,
            type,
            status: 'PENDING',
            metadata: serializeMetadata({
                ...metadata,
                documents: documents.map(d => ({
                    id: (0, crypto_1.randomBytes)(8).toString('hex'),
                    ...d,
                    verified: false,
                })),
            }),
        },
    });
    // Log audit trail
    await prisma_1.prisma.auditLog.create({
        data: {
            actorUserId: userId,
            targetUserId: userId,
            action: 'USER_VERIFICATION_SUBMIT',
            metadata: { type, documentCount: documents.length },
        },
    });
    // Start verification process based on type
    if (type === 'EMPLOYER' || type === 'EDUCATOR') {
        // Send email verification
        const email = documents.find(d => d.type === 'work_email' || d.type === 'edu_email')?.email;
        if (email) {
            await sendEmailVerification(userId, verification.id, email, type);
        }
    }
    else if (type === 'CREATOR') {
        // Auto-verify based on metrics
        await processCreatorVerification(userId, verification.id);
    }
    logger_1.logger.info('Verification submitted', { userId, type, verificationId: verification.id });
    return {
        id: verification.id,
        userId,
        type,
        status: 'PENDING',
        submittedAt: verification.submittedAt,
        documents: getVerificationDocuments(verification.metadata),
        metadata: getVerificationMetadata(verification.metadata),
        appealable: false,
    };
}
/**
 * Send email verification code
 */
async function sendEmailVerification(userId, verificationId, email, type) {
    const code = (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await storeEmailVerificationChallenge(verificationId, {
        codeHash: (0, opaqueToken_1.hashOpaqueToken)(code),
        expiresAt: expiresAt.toISOString(),
        email,
        type,
    });
    logger_1.logger.info('Email verification challenge created', {
        userId,
        email,
        type,
        verificationId,
    });
    await (0, socket_service_1.sendNotification)({
        userId,
        type: 'SYSTEM',
        title: 'Verify Your Email',
        message: process.env.NODE_ENV === 'production'
            ? `We've sent a verification code to ${email}.`
            : `Development verification code for ${email}: ${code}`,
        link: `/dashboard/settings/verification?id=${verificationId}`,
    });
}
/**
 * Verify email code
 */
async function verifyEmailCode(verificationId, code) {
    const loaded = await loadEmailVerificationChallenge(verificationId);
    if (!loaded) {
        return { success: false, message: 'Verification not found or expired' };
    }
    const { verification, challenge } = loaded;
    const challengeExpiresAt = new Date(challenge.expiresAt);
    if (new Date() > challengeExpiresAt) {
        await prisma_1.prisma.verificationBadge.update({
            where: { id: verificationId },
            data: {
                metadata: removeEmailVerificationChallenge(verification.metadata),
            },
        });
        return { success: false, message: 'Verification code has expired' };
    }
    if (challenge.codeHash !== (0, opaqueToken_1.hashOpaqueToken)(code.toUpperCase())) {
        return { success: false, message: 'Invalid verification code' };
    }
    // Mark as approved
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + (challenge.type === 'EMPLOYER' ? 1 : 4));
    await prisma_1.prisma.verificationBadge.update({
        where: { id: verificationId },
        data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            metadata: mergeVerificationMetadata(verification.metadata, { verificationExpiresAt: expiresAt.toISOString() }, ['emailVerification']),
        },
    });
    logger_1.logger.info('Email verification successful', { verificationId, type: challenge.type });
    return { success: true, message: 'Email verified successfully!' };
}
/**
 * Process creator verification (auto-verify based on metrics)
 */
async function processCreatorVerification(userId, verificationId) {
    const verification = await prisma_1.prisma.verificationBadge.findUnique({
        where: { id: verificationId },
        select: { metadata: true },
    });
    // Check creator metrics
    const [followerCount, postCount, accountAge] = await Promise.all([
        prisma_1.prisma.follow.count({ where: { followingId: userId } }),
        prisma_1.prisma.post.count({ where: { authorId: userId } }),
        prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { createdAt: true },
        }),
    ]);
    const daysSinceCreation = accountAge?.createdAt
        ? Math.floor((Date.now() - accountAge.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const requirements = {
        minFollowers: 10000,
        minPosts: 10,
        minAccountAgeDays: 90,
    };
    const meetsRequirements = followerCount >= requirements.minFollowers &&
        postCount >= requirements.minPosts &&
        daysSinceCreation >= requirements.minAccountAgeDays;
    if (meetsRequirements) {
        await prisma_1.prisma.verificationBadge.update({
            where: { id: verificationId },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                metadata: mergeVerificationMetadata(verification?.metadata, {
                    autoVerified: true,
                    metrics: { followerCount, postCount, daysSinceCreation },
                }),
            },
        });
        await (0, socket_service_1.sendNotification)({
            userId,
            type: 'ACHIEVEMENT',
            title: '🎉 Creator Verified!',
            message: 'Congratulations! You\'ve been verified as an ATHENA Creator.',
            link: '/dashboard/profile',
        });
    }
    else {
        // Not eligible yet, provide feedback
        await prisma_1.prisma.verificationBadge.update({
            where: { id: verificationId },
            data: {
                status: 'REJECTED',
                reason: `Creator verification requires: ${requirements.minFollowers.toLocaleString()} followers (you have ${followerCount.toLocaleString()}), ${requirements.minPosts} posts (you have ${postCount}), and ${requirements.minAccountAgeDays} days account age (you have ${daysSinceCreation}).`,
                reviewedAt: new Date(),
            },
        });
    }
}
/**
 * Admin: Review verification request
 */
async function reviewVerification(verificationId, reviewerId, decision, reason) {
    const verification = await prisma_1.prisma.verificationBadge.findUnique({
        where: { id: verificationId },
    });
    if (!verification) {
        throw new Error('Verification not found');
    }
    if (verification.status !== 'PENDING') {
        throw new Error('Verification has already been reviewed');
    }
    // Calculate expiry date
    let expiresAt;
    if (decision === 'APPROVED') {
        const requirements = VERIFICATION_REQUIREMENTS[verification.type];
        const years = parseInt(requirements.validityPeriod) || 1;
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + years);
    }
    const updated = await prisma_1.prisma.verificationBadge.update({
        where: { id: verificationId },
        data: {
            status: decision,
            reviewedAt: new Date(),
            reviewedById: reviewerId,
            reason: decision === 'REJECTED' ? reason ?? null : null,
            metadata: decision === 'APPROVED' && expiresAt
                ? mergeVerificationMetadata(verification.metadata, {
                    verificationExpiresAt: expiresAt.toISOString(),
                })
                : mergeVerificationMetadata(verification.metadata, {}, ['verificationExpiresAt']),
        },
    });
    // Log audit trail
    await prisma_1.prisma.auditLog.create({
        data: {
            actorUserId: reviewerId,
            targetUserId: verification.userId,
            action: decision === 'APPROVED' ? 'ADMIN_VERIFICATION_APPROVE' : 'ADMIN_VERIFICATION_REJECT',
            metadata: { verificationId, type: verification.type, reason },
        },
    });
    // Notify user
    await (0, socket_service_1.sendNotification)({
        userId: verification.userId,
        type: 'SYSTEM',
        title: decision === 'APPROVED' ? '✅ Verification Approved!' : '❌ Verification Update',
        message: decision === 'APPROVED'
            ? `Your ${verification.type} verification has been approved!`
            : `Your ${verification.type} verification was not approved: ${reason}`,
        link: '/dashboard/settings/verification',
    });
    logger_1.logger.info('Verification reviewed', {
        verificationId,
        decision,
        reviewerId,
    });
    return mapVerificationRequest({
        id: updated.id,
        userId: updated.userId,
        type: updated.type,
        status: updated.status,
        submittedAt: updated.submittedAt,
        reviewedAt: updated.reviewedAt,
        reviewedById: updated.reviewedById,
        metadata: updated.metadata,
        reason: updated.reason,
    });
}
/**
 * Submit appeal for rejected verification
 */
async function submitAppeal(userId, verificationId, reason, additionalDocuments) {
    const verification = await prisma_1.prisma.verificationBadge.findUnique({
        where: { id: verificationId },
    });
    if (!verification) {
        return { success: false, message: 'Verification not found' };
    }
    if (verification.userId !== userId) {
        return { success: false, message: 'Not authorized' };
    }
    if (verification.status !== 'REJECTED') {
        return { success: false, message: 'Only rejected verifications can be appealed' };
    }
    // Create appeal
    await prisma_1.prisma.appeal.create({
        data: {
            userId,
            type: 'VERIFICATION_DECISION',
            reason,
            metadata: {
                verificationId,
                verificationType: verification.type,
                additionalDocuments: additionalDocuments?.map(d => ({
                    id: (0, crypto_1.randomBytes)(8).toString('hex'),
                    ...d,
                    verified: false,
                })),
            },
        },
    });
    // Reset verification to pending for re-review
    await prisma_1.prisma.verificationBadge.update({
        where: { id: verificationId },
        data: {
            status: 'PENDING',
            reason: null,
            reviewedAt: null,
            reviewedById: null,
        },
    });
    await prisma_1.prisma.auditLog.create({
        data: {
            actorUserId: userId,
            targetUserId: userId,
            action: 'USER_APPEAL_SUBMIT',
            metadata: { verificationId, type: verification.type },
        },
    });
    logger_1.logger.info('Verification appeal submitted', { userId, verificationId });
    return { success: true, message: 'Your appeal has been submitted for review' };
}
/**
 * Check if verification is expiring soon
 */
async function checkExpiringVerifications() {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiring = await prisma_1.prisma.verificationBadge.findMany({
        where: {
            status: 'APPROVED',
        },
        include: {
            user: { select: { id: true, displayName: true } },
        },
    });
    const expiringSoon = expiring.filter((verification) => {
        const expiresAt = getVerificationExpiresAt(verification.metadata);
        return !!expiresAt && expiresAt <= thirtyDaysFromNow && expiresAt > now;
    });
    for (const verification of expiringSoon) {
        const expiresAt = getVerificationExpiresAt(verification.metadata);
        if (!expiresAt) {
            continue;
        }
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        await (0, socket_service_1.sendNotification)({
            userId: verification.userId,
            type: 'SYSTEM',
            title: '⚠️ Verification Expiring Soon',
            message: `Your ${verification.type} verification expires in ${daysUntilExpiry} days. Renew to keep your badge.`,
            link: '/dashboard/settings/verification',
        });
    }
    logger_1.logger.info('Checked expiring verifications', { count: expiringSoon.length });
}
/**
 * Get verification badge display info
 */
function getBadgeInfo(type) {
    const badges = {
        IDENTITY: {
            name: 'Verified Identity',
            icon: '✓',
            color: 'blue',
            description: 'Government ID verified',
        },
        EMPLOYER: {
            name: 'Verified Employer',
            icon: '🏢',
            color: 'green',
            description: 'Work email confirmed',
        },
        EDUCATOR: {
            name: 'Verified Educator',
            icon: '🎓',
            color: 'purple',
            description: 'Educational institution confirmed',
        },
        MENTOR: {
            name: 'Certified Mentor',
            icon: '⭐',
            color: 'gold',
            description: 'Background checked and certified',
        },
        CREATOR: {
            name: 'Verified Creator',
            icon: '✨',
            color: 'pink',
            description: '10k+ followers with 90-day history',
        },
    };
    return badges[type];
}
exports.default = {
    getVerificationRequirements,
    getUserVerifications,
    submitVerification,
    verifyEmailCode,
    reviewVerification,
    submitAppeal,
    checkExpiringVerifications,
    getBadgeInfo,
};
//# sourceMappingURL=verification.service.js.map