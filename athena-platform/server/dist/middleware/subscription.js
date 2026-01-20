"use strict";
/**
 * Subscription Enforcement Middleware
 * Dynamic middleware that checks user.subscriptionTier against route permissions
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionMiddleware = void 0;
exports.requireSubscription = requireSubscription;
exports.enforceSubscription = enforceSubscription;
exports.getTierFeatures = getTierFeatures;
exports.compareTiers = compareTiers;
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const feature_flags_service_1 = require("../services/feature-flags.service");
// Define feature permissions per subscription tier
const TIER_PERMISSIONS = {
    FREE: [
        'jobs:view',
        'jobs:apply:3', // Max 3 applications per month
        'feed:view',
        'feed:post:text',
        'messages:view',
        'messages:send:10', // Max 10 messages per day
        'profile:basic',
        'search:basic',
        'community:join:3', // Max 3 communities
    ],
    PREMIUM_CAREER: [
        'jobs:view',
        'jobs:apply:unlimited',
        'jobs:priority_visibility',
        'feed:view',
        'feed:post:all',
        'messages:view',
        'messages:send:unlimited',
        'profile:advanced',
        'profile:analytics',
        'search:advanced',
        'ai:career_compass',
        'ai:salary_equity',
        'community:join:unlimited',
        'courses:preview',
        'mentor:browse',
    ],
    PREMIUM_PROFESSIONAL: [
        'jobs:view',
        'jobs:apply:unlimited',
        'jobs:priority_visibility',
        'jobs:recruiter_access',
        'feed:view',
        'feed:post:all',
        'messages:view',
        'messages:send:unlimited',
        'messages:inmail',
        'profile:advanced',
        'profile:analytics',
        'profile:who_viewed',
        'search:advanced',
        'search:boolean',
        'ai:career_compass',
        'ai:salary_equity',
        'ai:mentor_match',
        'community:join:unlimited',
        'community:create',
        'courses:access',
        'mentor:browse',
        'mentor:book:3', // 3 sessions per month
    ],
    PREMIUM_ENTREPRENEUR: [
        'jobs:view',
        'jobs:post',
        'feed:view',
        'feed:post:all',
        'messages:view',
        'messages:send:unlimited',
        'profile:advanced',
        'profile:business',
        'search:advanced',
        'ai:career_compass',
        'ai:income_stream',
        'ai:opportunity_scan',
        'community:join:unlimited',
        'community:create',
        'formation:access',
        'formation:registration',
        'capital:browse',
        'mentor:browse',
        'mentor:book:unlimited',
    ],
    PREMIUM_CREATOR: [
        'jobs:view',
        'feed:view',
        'feed:post:all',
        'feed:video:upload',
        'feed:monetize',
        'messages:view',
        'messages:send:unlimited',
        'profile:advanced',
        'profile:creator',
        'profile:analytics:advanced',
        'search:advanced',
        'ai:all',
        'community:join:unlimited',
        'community:create',
        'creator:studio',
        'creator:monetization',
        'creator:analytics',
        'livestream:access',
        'mentor:become',
    ],
    ENTERPRISE: [
        '*', // All permissions
    ],
};
// Route to permission mapping
const ROUTE_PERMISSIONS = {
    // Jobs
    'POST /api/jobs': 'jobs:post',
    'POST /api/jobs/*/apply': 'jobs:apply',
    'GET /api/jobs/insights': 'jobs:recruiter_access',
    // Feed & Content
    'POST /api/posts/video': 'feed:video:upload',
    'POST /api/posts/monetize': 'feed:monetize',
    // Messaging
    'POST /api/messages/inmail': 'messages:inmail',
    // AI Features
    'POST /api/ai/career-compass': 'ai:career_compass',
    'POST /api/ai/salary-equity': 'ai:salary_equity',
    'POST /api/ai/mentor-match': 'ai:mentor_match',
    'POST /api/ai/opportunity-scan': 'ai:opportunity_scan',
    'POST /api/ai/income-stream': 'ai:income_stream',
    // Formation Studio
    'GET /api/formation': 'formation:access',
    'POST /api/formation/register': 'formation:registration',
    // Creator Studio
    'GET /api/creator/studio': 'creator:studio',
    'POST /api/creator/monetize': 'creator:monetization',
    // Communities
    'POST /api/groups': 'community:create',
    // Mentor
    'POST /api/mentor/sessions': 'mentor:book',
    'POST /api/mentor/profile': 'mentor:become',
    // Courses
    'GET /api/courses/*/content': 'courses:access',
    // Livestream
    'POST /api/livestream/start': 'livestream:access',
    // Capital
    'GET /api/capital': 'capital:browse',
};
/**
 * Check if a tier has a specific permission
 */
function tierHasPermission(tier, permission) {
    const permissions = TIER_PERMISSIONS[tier] || [];
    // Enterprise has all permissions
    if (permissions.includes('*')) {
        return { hasPermission: true };
    }
    // Direct permission match
    if (permissions.includes(permission)) {
        return { hasPermission: true };
    }
    // Check for limited permissions (e.g., jobs:apply:3)
    const limitedMatch = permissions.find(p => {
        const parts = p.split(':');
        const permParts = permission.split(':');
        return parts[0] === permParts[0] && parts[1] === permParts[1] && parts[2];
    });
    if (limitedMatch) {
        const limit = limitedMatch.split(':')[2];
        if (limit === 'unlimited') {
            return { hasPermission: true };
        }
        return { hasPermission: true, limit: parseInt(limit, 10) };
    }
    // Find which tier provides this permission for upgrade suggestion
    const tierOrder = [
        'FREE',
        'PREMIUM_CAREER',
        'PREMIUM_PROFESSIONAL',
        'PREMIUM_ENTREPRENEUR',
        'PREMIUM_CREATOR',
        'ENTERPRISE',
    ];
    for (const t of tierOrder) {
        const tPerms = TIER_PERMISSIONS[t];
        if (tPerms.includes('*') || tPerms.includes(permission) ||
            tPerms.some(p => p.startsWith(permission.split(':').slice(0, 2).join(':')))) {
            return { hasPermission: false, upgradeRequired: t };
        }
    }
    return { hasPermission: false };
}
/**
 * Get user's usage count for rate-limited features
 */
async function getUsageCount(userId, feature, period) {
    const now = new Date();
    let startDate;
    if (period === 'day') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const count = await prisma_1.prisma.usageLog.count({
        where: {
            userId,
            feature,
            createdAt: { gte: startDate },
        },
    });
    return count;
}
/**
 * Log feature usage for rate limiting
 */
async function logUsage(userId, feature) {
    await prisma_1.prisma.usageLog.create({
        data: {
            userId,
            feature,
        },
    });
}
/**
 * Subscription enforcement middleware factory
 */
function requireSubscription(requiredPermission) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandler_1.ApiError(401, 'Authentication required');
            }
            // Get user's subscription tier
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: { subscription: true },
            });
            if (!user) {
                throw new errorHandler_1.ApiError(401, 'User not found');
            }
            const tier = user.subscription?.tier || 'FREE';
            const status = user.subscription?.status;
            // Check if subscription is active (or trialing)
            if (tier !== 'FREE' && status !== 'ACTIVE' && status !== 'TRIALING') {
                throw new errorHandler_1.ApiError(402, 'Subscription expired or inactive', {
                    code: 'SUBSCRIPTION_INACTIVE',
                    tier,
                    status,
                });
            }
            // Check permission
            const check = tierHasPermission(tier, requiredPermission);
            if (!check.hasPermission) {
                throw new errorHandler_1.ApiError(403, 'Upgrade required for this feature', {
                    code: 'UPGRADE_REQUIRED',
                    currentTier: tier,
                    requiredTier: check.upgradeRequired,
                    feature: requiredPermission,
                });
            }
            // If there's a limit, check usage
            if (check.limit) {
                const period = requiredPermission.includes('messages') ? 'day' : 'month';
                const used = await getUsageCount(userId, requiredPermission, period);
                if (used >= check.limit) {
                    throw new errorHandler_1.ApiError(429, `${period === 'day' ? 'Daily' : 'Monthly'} limit reached`, {
                        code: 'LIMIT_REACHED',
                        limit: check.limit,
                        used,
                        period,
                        upgradeRequired: tierHasPermission(tier === 'FREE' ? 'PREMIUM_CAREER' : 'PREMIUM_PROFESSIONAL', requiredPermission).hasPermission
                            ? undefined
                            : 'PREMIUM_PROFESSIONAL',
                    });
                }
                // Log usage for this request (will be committed after successful response)
                res.on('finish', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        logUsage(userId, requiredPermission).catch(console.error);
                    }
                });
                // Attach usage info to request for handlers to access
                req.subscriptionUsage = { limit: check.limit, used, remaining: check.limit - used };
            }
            // Attach tier info to request
            req.subscriptionTier = tier;
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
/**
 * Auto-detect required permission from route
 */
function enforceSubscription() {
    return async (req, res, next) => {
        try {
            // Build route key
            const routeKey = `${req.method} ${req.baseUrl}${req.path}`;
            // Check for exact match first
            let permission = ROUTE_PERMISSIONS[routeKey];
            // Check for wildcard matches
            if (!permission) {
                for (const [pattern, perm] of Object.entries(ROUTE_PERMISSIONS)) {
                    const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '$');
                    if (regex.test(routeKey)) {
                        permission = perm;
                        break;
                    }
                }
            }
            // If no permission mapping, allow through (public route)
            if (!permission) {
                return next();
            }
            // Check if feature is behind a feature flag
            const flagKey = `subscription_${permission.replace(/[/:]/g, '_')}`;
            const flag = await (0, feature_flags_service_1.getFeatureFlagByKey)(flagKey);
            if (flag) {
                const userId = req.user?.id;
                const isEnabled = (0, feature_flags_service_1.evaluateFeatureFlag)(flag, userId);
                if (!isEnabled) {
                    throw new errorHandler_1.ApiError(403, 'Feature not available', {
                        code: 'FEATURE_DISABLED',
                        feature: permission,
                    });
                }
            }
            // Use the permission-specific middleware
            return requireSubscription(permission)(req, res, next);
        }
        catch (error) {
            next(error);
        }
    };
}
/**
 * Get subscription features for a tier (for UI display)
 */
function getTierFeatures(tier) {
    return TIER_PERMISSIONS[tier] || [];
}
/**
 * Compare two tiers
 */
function compareTiers(tier1, tier2) {
    const tierOrder = [
        'FREE',
        'PREMIUM_CAREER',
        'PREMIUM_PROFESSIONAL',
        'PREMIUM_ENTREPRENEUR',
        'PREMIUM_CREATOR',
        'ENTERPRISE',
    ];
    const idx1 = tierOrder.indexOf(tier1);
    const idx2 = tierOrder.indexOf(tier2);
    if (idx1 < idx2)
        return -1;
    if (idx1 > idx2)
        return 1;
    return 0;
}
exports.subscriptionMiddleware = {
    requireSubscription,
    enforceSubscription,
    getTierFeatures,
    compareTiers,
    tierHasPermission,
};
//# sourceMappingURL=subscription.js.map