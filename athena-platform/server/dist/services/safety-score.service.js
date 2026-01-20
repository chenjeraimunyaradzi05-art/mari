"use strict";
/**
 * Safety Score Service
 * Calculates and updates user safety scores based on reports, blocks, and behavior
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safetyScoreService = void 0;
exports.calculateSafetyScore = calculateSafetyScore;
exports.updateSafetyScore = updateSafetyScore;
exports.recordSafetyIncident = recordSafetyIncident;
exports.handleUserReport = handleUserReport;
exports.handleUserBlock = handleUserBlock;
exports.handleContentRemoval = handleContentRemoval;
exports.verifyReport = verifyReport;
exports.getSafetyStatus = getSafetyStatus;
const prisma_1 = require("../utils/prisma");
const logger_1 = require("../utils/logger");
const notification_service_1 = require("./notification.service");
const notificationService = new notification_service_1.NotificationService();
// Safety score weights
const WEIGHTS = {
    // Negative factors (reduce score)
    REPORT_RECEIVED: -10,
    REPORT_VERIFIED: -25,
    BLOCK_RECEIVED: -5,
    CONTENT_REMOVED: -15,
    SUSPENSION: -50,
    // Positive factors (increase score)
    ACCOUNT_AGE_DAY: 0.1, // Per day, max 365 days
    VERIFIED_IDENTITY: 20,
    VERIFIED_EMPLOYER: 15,
    COMPLETED_PROFILE: 10,
    POSITIVE_INTERACTION: 1, // Likes, helpful comments
    MENTOR_SESSION_COMPLETED: 5,
    COURSE_COMPLETED: 3,
    // Decay - old incidents matter less
    INCIDENT_DECAY_DAYS: 90, // Incidents older than this have 50% weight
    // Bounds
    MIN_SCORE: 0,
    MAX_SCORE: 100,
    DEFAULT_SCORE: 75,
};
/**
 * Calculate time decay factor for old incidents
 */
function calculateDecay(incidentDate) {
    const daysSince = (Date.now() - incidentDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= WEIGHTS.INCIDENT_DECAY_DAYS) {
        return 1;
    }
    // Exponential decay after threshold
    const decayFactor = Math.pow(0.5, (daysSince - WEIGHTS.INCIDENT_DECAY_DAYS) / WEIGHTS.INCIDENT_DECAY_DAYS);
    return Math.max(decayFactor, 0.1); // Minimum 10% weight
}
/**
 * Calculate safety score for a user
 */
async function calculateSafetyScore(userId) {
    const factors = [];
    let score = WEIGHTS.DEFAULT_SCORE;
    // Get user data
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            profile: true,
            verificationBadges: true,
            _count: {
                select: {
                    posts: true,
                    comments: true,
                    likes: true,
                },
            },
        },
    });
    if (!user) {
        return {
            score: 0,
            factors: [{ category: 'error', impact: 0, details: 'User not found' }],
            riskLevel: 'CRITICAL',
            restrictions: ['account_suspended'],
            lastUpdated: new Date(),
        };
    }
    // 1. Account age bonus
    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const ageBonus = Math.min(accountAgeDays * WEIGHTS.ACCOUNT_AGE_DAY, 36.5); // Max ~1 year
    score += ageBonus;
    factors.push({
        category: 'account_age',
        impact: ageBonus,
        details: `Account is ${accountAgeDays} days old`,
    });
    // 2. Verification badges
    const verifications = user.verificationBadges || [];
    if (verifications.some((v) => v.type === 'IDENTITY' && v.isActive)) {
        score += WEIGHTS.VERIFIED_IDENTITY;
        factors.push({
            category: 'verification',
            impact: WEIGHTS.VERIFIED_IDENTITY,
            details: 'Identity verified',
        });
    }
    if (verifications.some((v) => v.type === 'EMPLOYER' && v.isActive)) {
        score += WEIGHTS.VERIFIED_EMPLOYER;
        factors.push({
            category: 'verification',
            impact: WEIGHTS.VERIFIED_EMPLOYER,
            details: 'Employer verified',
        });
    }
    // 3. Profile completeness
    const profile = user.profile;
    const profileFields = profile
        ? [profile.bio, profile.location, profile.website].filter(Boolean).length
        : 0;
    if (profileFields >= 2) {
        score += WEIGHTS.COMPLETED_PROFILE;
        factors.push({
            category: 'profile',
            impact: WEIGHTS.COMPLETED_PROFILE,
            details: 'Profile substantially completed',
        });
    }
    // 4. Get safety incidents
    const incidents = await prisma_1.prisma.safetyIncident.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
    for (const incident of incidents) {
        const decay = calculateDecay(incident.createdAt);
        let impact = 0;
        switch (incident.type) {
            case 'REPORT':
                impact = incident.verified
                    ? WEIGHTS.REPORT_VERIFIED * decay
                    : WEIGHTS.REPORT_RECEIVED * decay;
                break;
            case 'BLOCK':
                impact = WEIGHTS.BLOCK_RECEIVED * decay;
                break;
            case 'CONTENT_REMOVAL':
                impact = WEIGHTS.CONTENT_REMOVED * decay;
                break;
            case 'SUSPENSION':
                impact = WEIGHTS.SUSPENSION * decay;
                break;
        }
        score += impact;
        factors.push({
            category: 'incident',
            impact,
            details: `${incident.type} - ${incident.reason} (${decay < 1 ? 'decayed' : 'recent'})`,
        });
    }
    // 5. Positive interactions
    const positiveCount = user._count.likes + Math.floor(user._count.comments / 2);
    const positiveBonus = Math.min(positiveCount * WEIGHTS.POSITIVE_INTERACTION, 20);
    if (positiveBonus > 0) {
        score += positiveBonus;
        factors.push({
            category: 'engagement',
            impact: positiveBonus,
            details: `${positiveCount} positive interactions`,
        });
    }
    // 6. Mentor sessions completed
    const mentorSessions = await prisma_1.prisma.mentorSession.count({
        where: {
            OR: [
                { menteeId: userId, status: 'COMPLETED' },
                { mentorProfile: { userId }, status: 'COMPLETED' },
            ],
        },
    });
    if (mentorSessions > 0) {
        const sessionBonus = Math.min(mentorSessions * WEIGHTS.MENTOR_SESSION_COMPLETED, 25);
        score += sessionBonus;
        factors.push({
            category: 'mentorship',
            impact: sessionBonus,
            details: `${mentorSessions} mentor sessions completed`,
        });
    }
    // Clamp score to bounds
    score = Math.max(WEIGHTS.MIN_SCORE, Math.min(WEIGHTS.MAX_SCORE, Math.round(score)));
    // Determine risk level
    let riskLevel;
    if (score >= 70)
        riskLevel = 'LOW';
    else if (score >= 50)
        riskLevel = 'MEDIUM';
    else if (score >= 25)
        riskLevel = 'HIGH';
    else
        riskLevel = 'CRITICAL';
    // Determine restrictions based on risk level
    const restrictions = [];
    if (riskLevel === 'CRITICAL') {
        restrictions.push('cannot_message', 'cannot_post', 'cannot_comment', 'review_required');
    }
    else if (riskLevel === 'HIGH') {
        restrictions.push('limited_messaging', 'posts_require_review');
    }
    else if (riskLevel === 'MEDIUM') {
        restrictions.push('rate_limited');
    }
    return {
        score,
        factors,
        riskLevel,
        restrictions,
        lastUpdated: new Date(),
    };
}
/**
 * Update safety score in database
 */
async function updateSafetyScore(userId) {
    const breakdown = await calculateSafetyScore(userId);
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            safetyScore: breakdown.score,
            safetyScoreUpdatedAt: new Date(),
        },
    });
    logger_1.logger.info('Safety score updated', { userId, score: breakdown.score, riskLevel: breakdown.riskLevel });
    return breakdown.score;
}
/**
 * Record a safety incident and trigger score recalculation
 */
async function recordSafetyIncident(incident) {
    // Create incident record
    await prisma_1.prisma.safetyIncident.create({
        data: {
            userId: incident.userId,
            type: incident.type,
            severity: incident.severity,
            reason: incident.reason,
            reporterId: incident.reporterId,
            contentId: incident.contentId,
            contentType: incident.contentType,
            verified: incident.verified,
        },
    });
    // Recalculate safety score
    const newScore = await updateSafetyScore(incident.userId);
    // Check if score dropped significantly and notify
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: incident.userId },
        select: { safetyScore: true },
    });
    const oldScore = user?.safetyScore || WEIGHTS.DEFAULT_SCORE;
    if (oldScore - newScore >= 15) {
        // Score dropped significantly - notify user
        await notificationService.notify({
            userId: incident.userId,
            type: 'SYSTEM',
            title: 'Account Standing Update',
            message: 'Your account standing has changed. Please review our community guidelines.',
            link: '/settings/safety',
            channels: ['in-app', 'email'],
            priority: 'high',
        });
    }
    // Check if critical threshold reached
    if (newScore < 25 && oldScore >= 25) {
        // User crossed into critical territory - flag for review
        await prisma_1.prisma.adminFlag.create({
            data: {
                userId: incident.userId,
                type: 'SAFETY_CRITICAL',
                reason: `Safety score dropped to ${newScore}`,
                priority: 'HIGH',
            },
        });
        logger_1.logger.warn('User safety score critical', { userId: incident.userId, newScore });
    }
}
/**
 * Handle user report event
 */
async function handleUserReport(reportedUserId, reporterId, reason, contentId, contentType) {
    await recordSafetyIncident({
        userId: reportedUserId,
        type: 'REPORT',
        severity: 'MEDIUM',
        reason,
        reporterId,
        contentId,
        contentType,
        verified: false, // Will be verified by moderation
    });
}
/**
 * Handle user block event
 */
async function handleUserBlock(blockedUserId, blockerId) {
    // Get recent block count for this user
    const recentBlocks = await prisma_1.prisma.safetyIncident.count({
        where: {
            userId: blockedUserId,
            type: 'BLOCK',
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        },
    });
    // Determine severity based on recent blocks
    const severity = recentBlocks >= 5 ? 'HIGH' : recentBlocks >= 2 ? 'MEDIUM' : 'LOW';
    await recordSafetyIncident({
        userId: blockedUserId,
        type: 'BLOCK',
        severity,
        reason: 'Blocked by another user',
        reporterId: blockerId,
        verified: true, // Blocks are automatically verified
    });
}
/**
 * Handle content removal event
 */
async function handleContentRemoval(userId, contentId, contentType, reason, moderatorId) {
    await recordSafetyIncident({
        userId,
        type: 'CONTENT_REMOVAL',
        severity: 'MEDIUM',
        reason,
        reporterId: moderatorId,
        contentId,
        contentType,
        verified: true,
    });
}
/**
 * Verify a pending report (by moderator)
 */
async function verifyReport(incidentId, verified, moderatorId) {
    const incident = await prisma_1.prisma.safetyIncident.findUnique({
        where: { id: incidentId },
    });
    if (!incident) {
        throw new Error('Incident not found');
    }
    await prisma_1.prisma.safetyIncident.update({
        where: { id: incidentId },
        data: {
            verified,
            resolvedAt: new Date(),
            resolvedById: moderatorId,
        },
    });
    // Recalculate score with verified status
    await updateSafetyScore(incident.userId);
}
/**
 * Get user's safety status for profile display
 */
async function getSafetyStatus(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        include: { verificationBadges: true },
    });
    const score = user?.safetyScore ?? WEIGHTS.DEFAULT_SCORE;
    let level;
    if (score >= 85)
        level = 'TRUSTED';
    else if (score >= 60)
        level = 'GOOD';
    else if (score >= 35)
        level = 'CAUTION';
    else
        level = 'RESTRICTED';
    const badges = (user?.verificationBadges || [])
        .filter((b) => b.isActive)
        .map((b) => b.type);
    return { score, level, badges };
}
exports.safetyScoreService = {
    calculateSafetyScore,
    updateSafetyScore,
    recordSafetyIncident,
    handleUserReport,
    handleUserBlock,
    handleContentRemoval,
    verifyReport,
    getSafetyStatus,
};
//# sourceMappingURL=safety-score.service.js.map