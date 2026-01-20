"use strict";
/**
 * Engagement Service
 * Gamification, achievements, streaks, and engagement features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACHIEVEMENTS = void 0;
exports.calculateLevel = calculateLevel;
exports.updateStreak = updateStreak;
exports.getStreaks = getStreaks;
exports.awardAchievement = awardAchievement;
exports.getUserAchievements = getUserAchievements;
exports.addXP = addXP;
exports.getUserXP = getUserXP;
exports.getXPHistory = getXPHistory;
exports.getLeaderboard = getLeaderboard;
exports.checkContentAchievements = checkContentAchievements;
exports.checkSocialAchievements = checkSocialAchievements;
const prisma_1 = require("../utils/prisma");
const cache_1 = require("../utils/cache");
// ==========================================
// ACHIEVEMENT DEFINITIONS
// ==========================================
exports.ACHIEVEMENTS = {
    // Posting achievements
    FIRST_POST: {
        id: 'first_post',
        name: 'First Steps',
        description: 'Published your first post',
        icon: '✏️',
        xp: 50,
        category: 'content',
    },
    POST_STREAK_7: {
        id: 'post_streak_7',
        name: 'Week Warrior',
        description: 'Posted for 7 days in a row',
        icon: '🔥',
        xp: 200,
        category: 'content',
    },
    POST_STREAK_30: {
        id: 'post_streak_30',
        name: 'Consistency King',
        description: 'Posted for 30 days in a row',
        icon: '👑',
        xp: 1000,
        category: 'content',
    },
    VIRAL_POST: {
        id: 'viral_post',
        name: 'Gone Viral',
        description: 'A post reached 1000+ views',
        icon: '🚀',
        xp: 500,
        category: 'content',
    },
    VIDEO_CREATOR: {
        id: 'video_creator',
        name: 'Video Star',
        description: 'Posted 10 videos',
        icon: '🎬',
        xp: 300,
        category: 'content',
    },
    // Social achievements
    FIRST_FOLLOWER: {
        id: 'first_follower',
        name: 'First Fan',
        description: 'Gained your first follower',
        icon: '🌟',
        xp: 50,
        category: 'social',
    },
    HUNDRED_FOLLOWERS: {
        id: 'hundred_followers',
        name: 'Rising Star',
        description: 'Reached 100 followers',
        icon: '💯',
        xp: 500,
        category: 'social',
    },
    THOUSAND_FOLLOWERS: {
        id: 'thousand_followers',
        name: 'Influencer',
        description: 'Reached 1000 followers',
        icon: '🌟',
        xp: 2000,
        category: 'social',
    },
    HELPFUL_COMMENTER: {
        id: 'helpful_commenter',
        name: 'Helpful Soul',
        description: 'Received 50 likes on comments',
        icon: '💬',
        xp: 300,
        category: 'social',
    },
    // Learning achievements
    COURSE_COMPLETE: {
        id: 'course_complete',
        name: 'Scholar',
        description: 'Completed your first course',
        icon: '🎓',
        xp: 200,
        category: 'learning',
    },
    COURSE_STREAK: {
        id: 'course_streak',
        name: 'Dedicated Learner',
        description: 'Completed 5 courses',
        icon: '📚',
        xp: 1000,
        category: 'learning',
    },
    // Career achievements
    PROFILE_COMPLETE: {
        id: 'profile_complete',
        name: 'Ready to Go',
        description: 'Completed your profile 100%',
        icon: '✅',
        xp: 100,
        category: 'profile',
    },
    FIRST_APPLICATION: {
        id: 'first_application',
        name: 'Taking Action',
        description: 'Applied for your first job',
        icon: '📝',
        xp: 100,
        category: 'career',
    },
    INTERVIEW_READY: {
        id: 'interview_ready',
        name: 'Interview Ready',
        description: 'Reached interview stage',
        icon: '🤝',
        xp: 300,
        category: 'career',
    },
    // Community achievements
    MENTOR_FIRST: {
        id: 'mentor_first',
        name: 'Giving Back',
        description: 'Completed your first mentoring session',
        icon: '🧑‍🏫',
        xp: 500,
        category: 'community',
    },
    COMMUNITY_BUILDER: {
        id: 'community_builder',
        name: 'Community Builder',
        description: 'Invited 5 friends to join',
        icon: '🏗️',
        xp: 300,
        category: 'community',
    },
};
// ==========================================
// XP AND LEVEL SYSTEM
// ==========================================
const LEVEL_THRESHOLDS = [
    0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
    5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
    21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500,
];
function calculateLevel(xp) {
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            level = i + 1;
        }
        else {
            break;
        }
    }
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 1.5;
    const currentXp = xp - currentThreshold;
    const nextLevelXp = nextThreshold - currentThreshold;
    const progress = Math.min(100, (currentXp / nextLevelXp) * 100);
    return { level, currentXp, nextLevelXp: nextThreshold, progress };
}
// ==========================================
// STREAK TRACKING
// ==========================================
async function updateStreak(userId, activity) {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = cache_1.CacheKeys.user(`${userId}:streak:${activity}`);
    // Get or create streak record
    let streak = await prisma_1.prisma.userStreak.findFirst({
        where: { userId, type: activity },
    });
    if (!streak) {
        streak = await prisma_1.prisma.userStreak.create({
            data: {
                userId,
                type: activity,
                currentStreak: 1,
                longestStreak: 1,
                lastActivityDate: new Date(),
            },
        });
        return { currentStreak: 1, longestStreak: 1, isNewRecord: true };
    }
    const lastDate = streak.lastActivityDate.toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let newCurrentStreak = streak.currentStreak;
    let isNewRecord = false;
    if (lastDate === today) {
        // Already recorded today
        return {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            isNewRecord: false,
        };
    }
    else if (lastDate === yesterday) {
        // Consecutive day
        newCurrentStreak = streak.currentStreak + 1;
    }
    else {
        // Streak broken
        newCurrentStreak = 1;
    }
    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);
    isNewRecord = newLongestStreak > streak.longestStreak;
    await prisma_1.prisma.userStreak.update({
        where: { id: streak.id },
        data: {
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
            lastActivityDate: new Date(),
        },
    });
    // Clear cache
    (0, cache_1.cacheDel)(cacheKey);
    // Check streak achievements
    if (activity === 'post') {
        if (newCurrentStreak === 7) {
            await awardAchievement(userId, 'POST_STREAK_7');
        }
        if (newCurrentStreak === 30) {
            await awardAchievement(userId, 'POST_STREAK_30');
        }
    }
    return {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        isNewRecord,
    };
}
async function getStreaks(userId) {
    const streaks = await prisma_1.prisma.userStreak.findMany({
        where: { userId },
    });
    return streaks.reduce((acc, streak) => {
        acc[streak.type] = {
            current: streak.currentStreak,
            longest: streak.longestStreak,
            lastActivity: streak.lastActivityDate,
        };
        return acc;
    }, {});
}
// ==========================================
// ACHIEVEMENT SYSTEM
// ==========================================
async function awardAchievement(userId, achievementId) {
    const achievement = exports.ACHIEVEMENTS[achievementId];
    // Check if already earned
    const existing = await prisma_1.prisma.userAchievement.findFirst({
        where: { userId, achievementId: achievement.id },
    });
    if (existing)
        return false;
    // Award achievement
    await prisma_1.prisma.userAchievement.create({
        data: {
            userId,
            achievementId: achievement.id,
            earnedAt: new Date(),
        },
    });
    // Award XP
    await addXP(userId, achievement.xp, `Achievement: ${achievement.name}`);
    // Create notification
    await prisma_1.prisma.notification.create({
        data: {
            userId,
            type: 'ACHIEVEMENT',
            title: `Achievement Unlocked: ${achievement.name}`,
            message: `${achievement.icon} ${achievement.description}. You earned ${achievement.xp} XP!`,
            data: { achievementId: achievement.id, xp: achievement.xp },
        },
    });
    return true;
}
async function getUserAchievements(userId) {
    const earned = await prisma_1.prisma.userAchievement.findMany({
        where: { userId },
        orderBy: { earnedAt: 'desc' },
    });
    const earnedIds = new Set(earned.map((e) => e.achievementId));
    const allAchievements = Object.entries(exports.ACHIEVEMENTS).map(([key, achievement]) => ({
        ...achievement,
        earned: earnedIds.has(achievement.id),
        earnedAt: earned.find((e) => e.achievementId === achievement.id)?.earnedAt,
    }));
    const earnedCount = earned.length;
    const totalCount = Object.keys(exports.ACHIEVEMENTS).length;
    const totalXpEarned = earned.reduce((sum, e) => {
        const ach = Object.values(exports.ACHIEVEMENTS).find((a) => a.id === e.achievementId);
        return sum + (ach?.xp || 0);
    }, 0);
    return {
        achievements: allAchievements,
        stats: {
            earned: earnedCount,
            total: totalCount,
            progress: (earnedCount / totalCount) * 100,
            totalXpEarned,
        },
    };
}
// ==========================================
// XP SYSTEM
// ==========================================
async function addXP(userId, amount, reason) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true },
    });
    const oldXp = user?.xp || 0;
    const newXp = oldXp + amount;
    const oldLevel = calculateLevel(oldXp).level;
    const { level: newLevel } = calculateLevel(newXp);
    const levelUp = newLevel > oldLevel;
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { xp: newXp },
    });
    // Log XP transaction
    await prisma_1.prisma.xpTransaction.create({
        data: {
            userId,
            amount,
            reason,
            balance: newXp,
        },
    });
    // Notify on level up
    if (levelUp) {
        await prisma_1.prisma.notification.create({
            data: {
                userId,
                type: 'LEVEL_UP',
                title: `Level Up! You're now level ${newLevel}`,
                message: `Congratulations! You've reached level ${newLevel}. Keep going!`,
                data: { level: newLevel },
            },
        });
    }
    // Clear cache
    (0, cache_1.cacheDel)(cache_1.CacheKeys.user(`${userId}:xp`));
    return { newXp, levelUp, newLevel };
}
async function getUserXP(userId) {
    const cacheKey = cache_1.CacheKeys.user(`${userId}:xp`);
    return (0, cache_1.cacheGetOrSet)(cacheKey, async () => {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { xp: true },
        });
        const xp = user?.xp || 0;
        return calculateLevel(xp);
    }, 300);
}
async function getXPHistory(userId, limit = 20) {
    return prisma_1.prisma.xpTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
// ==========================================
// LEADERBOARDS
// ==========================================
async function getLeaderboard(type, period = 'weekly', limit = 10) {
    const cacheKey = cache_1.CacheKeys.leaderboard(`${type}:${period}`);
    return (0, cache_1.cacheGetOrSet)(cacheKey, async () => {
        let startDate;
        const now = new Date();
        switch (period) {
            case 'daily':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'monthly':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'alltime':
                startDate = undefined;
                break;
        }
        switch (type) {
            case 'xp':
                return prisma_1.prisma.user.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        displayName: true,
                        avatar: true,
                        xp: true,
                    },
                    orderBy: { xp: 'desc' },
                    take: limit,
                });
            case 'followers':
                return prisma_1.prisma.user.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        displayName: true,
                        avatar: true,
                        _count: { select: { followers: true } },
                    },
                    orderBy: { followers: { _count: 'desc' } },
                    take: limit,
                });
            case 'posts':
                const postCounts = await prisma_1.prisma.post.groupBy({
                    by: ['authorId'],
                    _count: true,
                    where: startDate ? { createdAt: { gte: startDate } } : {},
                    orderBy: { _count: { authorId: 'desc' } },
                    take: limit,
                });
                const userIds = postCounts.map((p) => p.authorId);
                const users = await prisma_1.prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, displayName: true, avatar: true },
                });
                return postCounts.map((p) => {
                    const user = users.find((u) => u.id === p.authorId);
                    return {
                        ...user,
                        postCount: p._count,
                    };
                });
            case 'streak':
                return prisma_1.prisma.userStreak.findMany({
                    where: { type: 'post' },
                    include: {
                        user: { select: { id: true, displayName: true, avatar: true } },
                    },
                    orderBy: { currentStreak: 'desc' },
                    take: limit,
                });
            default:
                return [];
        }
    }, 300 // Cache for 5 minutes
    );
}
// ==========================================
// ACHIEVEMENT TRIGGERS
// ==========================================
async function checkContentAchievements(userId) {
    const [postCount, videoCount, viralPost] = await Promise.all([
        prisma_1.prisma.post.count({ where: { authorId: userId } }),
        prisma_1.prisma.post.count({ where: { authorId: userId, type: 'VIDEO' } }),
        prisma_1.prisma.post.findFirst({
            where: { authorId: userId, viewCount: { gte: 1000 } },
        }),
    ]);
    if (postCount === 1) {
        await awardAchievement(userId, 'FIRST_POST');
    }
    if (videoCount >= 10) {
        await awardAchievement(userId, 'VIDEO_CREATOR');
    }
    if (viralPost) {
        await awardAchievement(userId, 'VIRAL_POST');
    }
}
async function checkSocialAchievements(userId) {
    const followerCount = await prisma_1.prisma.follow.count({
        where: { followingId: userId },
    });
    if (followerCount === 1) {
        await awardAchievement(userId, 'FIRST_FOLLOWER');
    }
    if (followerCount >= 100) {
        await awardAchievement(userId, 'HUNDRED_FOLLOWERS');
    }
    if (followerCount >= 1000) {
        await awardAchievement(userId, 'THOUSAND_FOLLOWERS');
    }
}
//# sourceMappingURL=engagement.service.js.map