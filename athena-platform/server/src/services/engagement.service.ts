/**
 * Engagement Service
 * Gamification, achievements, streaks, and engagement features
 */

import { prisma } from '../utils/prisma';
import { cacheGetOrSet, cacheDel, CacheKeys } from '../utils/cache';

// ==========================================
// ACHIEVEMENT DEFINITIONS
// ==========================================

export const ACHIEVEMENTS = {
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

  // Wellness achievements
  FIRST_CHECKIN: { id: 'first_checkin', name: 'Checked In', description: 'Logged your first wellness check-in', icon: '🌱', xp: 50, category: 'wellness' },
  CHECKIN_STREAK_7: { id: 'checkin_streak_7', name: 'A Week of Noticing', description: 'Checked in seven days in a row', icon: '🌿', xp: 150, category: 'wellness' },
  CHECKIN_STREAK_30: { id: 'checkin_streak_30', name: 'A Month of Noticing', description: 'Checked in thirty days in a row', icon: '🌳', xp: 500, category: 'wellness' },
  HABIT_STREAK_7: { id: 'habit_streak_7', name: 'Seven Straight', description: 'Kept a habit for seven days in a row', icon: '✅', xp: 150, category: 'wellness' },
  HABIT_STREAK_30: { id: 'habit_streak_30', name: 'Thirty Straight', description: 'Kept a habit for thirty days in a row', icon: '🏅', xp: 500, category: 'wellness' },
  HABIT_STREAK_100: { id: 'habit_streak_100', name: 'One Hundred Days', description: 'Kept a habit for one hundred days in a row', icon: '💎', xp: 1500, category: 'wellness' },
  CIRCLE_JOINED: { id: 'circle_joined', name: 'In the Circle', description: 'Joined a wellness support circle', icon: '🫶', xp: 100, category: 'wellness' },
  GOAL_MONTH: { id: 'goal_month', name: 'Four Good Weeks', description: 'Met a wellness goal four weeks running', icon: '🎯', xp: 400, category: 'wellness' },
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;

// ==========================================
// XP AND LEVEL SYSTEM
// ==========================================

const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
  5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
  21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500,
];

export function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
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

/**
 * Records today's activity against a streak.
 *
 * `recordedToday` is the part callers have to read. It is true only when this
 * call is the one that moved the streak on, and false when the day had
 * already been recorded — by an earlier call, or by another request that got
 * there first. The check-in route used to decide whether to award XP from
 * `currentStreak > 0`, which is true on every call of the day, so a member
 * could hold the button and earn fifty XP a request, all day, straight onto
 * the public leaderboard. Anything that pays out for a streak advancing has
 * to ask whether it advanced.
 */
export async function updateStreak(userId: string, activity: 'post' | 'login' | 'learn'): Promise<{
  currentStreak: number;
  longestStreak: number;
  isNewRecord: boolean;
  recordedToday: boolean;
}> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  // Days are counted in UTC, the same basis the string comparison below uses.
  const startOfToday = new Date(`${today}T00:00:00.000Z`);
  const cacheKey = CacheKeys.user(`${userId}:streak:${activity}`);

  // Get or create streak record
  let streak = await prisma.userStreak.findUnique({
    where: { userId_type: { userId, type: activity } },
  });

  if (!streak) {
    try {
      await prisma.userStreak.create({
        data: {
          userId,
          type: activity,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: now,
        },
      });
      return { currentStreak: 1, longestStreak: 1, isNewRecord: true, recordedToday: true };
    } catch {
      // Two first-ever check-ins in the same instant: the unique on
      // (userId, type) refuses the second, and the row the first one wrote is
      // the answer. Falling through to re-read it also means the loser of the
      // race does not get counted as a second day.
      streak = await prisma.userStreak.findUnique({
        where: { userId_type: { userId, type: activity } },
      });
      if (!streak) throw new Error('Streak row disappeared during creation');
    }
  }

  const lastDate = streak.lastActivityDate.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let newCurrentStreak = streak.currentStreak;

  if (lastDate === today) {
    // Already recorded today
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      isNewRecord: false,
      recordedToday: false,
    };
  } else if (lastDate === yesterday) {
    // Consecutive day
    newCurrentStreak = streak.currentStreak + 1;
  } else {
    // Streak broken
    newCurrentStreak = 1;
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);
  const isNewRecord = newLongestStreak > streak.longestStreak;

  // Conditional on the stored date still being before today, so the write is
  // the thing that decides the day rather than the read above. Two check-ins
  // racing at midnight both computed the same new streak and both wrote it;
  // now the second one's update matches nothing and it is told the day was
  // already recorded.
  const { count } = await prisma.userStreak.updateMany({
    where: { id: streak.id, lastActivityDate: { lt: startOfToday } },
    data: {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: now,
    },
  });

  if (count === 0) {
    const current = await prisma.userStreak.findUnique({ where: { id: streak.id } });
    return {
      currentStreak: current?.currentStreak ?? streak.currentStreak,
      longestStreak: current?.longestStreak ?? streak.longestStreak,
      isNewRecord: false,
      recordedToday: false,
    };
  }

  // Clear cache
  cacheDel(cacheKey);

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
    recordedToday: true,
  };
}

export async function getStreaks(userId: string) {
  const streaks = await prisma.userStreak.findMany({
    where: { userId },
  });

  return streaks.reduce((acc, streak) => {
    acc[streak.type] = {
      current: streak.currentStreak,
      longest: streak.longestStreak,
      lastActivity: streak.lastActivityDate,
    };
    return acc;
  }, {} as Record<string, { current: number; longest: number; lastActivity: Date }>);
}

// ==========================================
// ACHIEVEMENT SYSTEM
// ==========================================

export async function awardAchievement(userId: string, achievementId: AchievementId): Promise<boolean> {
  const achievement = ACHIEVEMENTS[achievementId];

  // Check if already earned
  const existing = await prisma.userAchievement.findFirst({
    where: { userId, achievementId: achievement.id },
  });

  if (existing) return false;

  // Award achievement
  await prisma.userAchievement.create({
    data: {
      userId,
      achievementId: achievement.id,
      earnedAt: new Date(),
    },
  });

  // Award XP
  await addXP(userId, achievement.xp, `Achievement: ${achievement.name}`);

  // Create notification
  await prisma.notification.create({
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

export async function getUserAchievements(userId: string) {
  const earned = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });

  const earnedIds = new Set(earned.map((e) => e.achievementId));

  const allAchievements = Object.entries(ACHIEVEMENTS).map(([, achievement]) => ({
    ...achievement,
    earned: earnedIds.has(achievement.id),
    earnedAt: earned.find((e) => e.achievementId === achievement.id)?.earnedAt,
  }));

  const earnedCount = earned.length;
  const totalCount = Object.keys(ACHIEVEMENTS).length;
  const totalXpEarned = earned.reduce((sum, e) => {
    const ach = Object.values(ACHIEVEMENTS).find((a) => a.id === e.achievementId);
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

export async function addXP(userId: string, amount: number, reason: string): Promise<{
  newXp: number;
  levelUp: boolean;
  newLevel: number;
}> {
  // Incremented rather than read-then-written. The old form loaded xp, added
  // to it in memory and wrote the sum back, so two awards landing together —
  // an achievement and the check-in that unlocked it, say — left only the
  // larger of the two, and the XP transaction log then disagreed with the
  // balance it claimed to be recording. The database does the addition, and
  // the row it returns is what the balance actually became.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
    select: { xp: true },
  });

  const newXp = updated.xp;
  const oldXp = newXp - amount;

  const oldLevel = calculateLevel(oldXp).level;
  const { level: newLevel } = calculateLevel(newXp);
  const levelUp = newLevel > oldLevel;

  // Log XP transaction
  await prisma.xpTransaction.create({
    data: {
      userId,
      amount,
      reason,
      balance: newXp,
    },
  });

  // Notify on level up
  if (levelUp) {
    await prisma.notification.create({
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
  cacheDel(CacheKeys.user(`${userId}:xp`));

  return { newXp, levelUp, newLevel };
}

export async function getUserXP(userId: string) {
  const cacheKey = CacheKeys.user(`${userId}:xp`);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true },
      });

      const xp = user?.xp || 0;
      return calculateLevel(xp);
    },
    300
  );
}

export async function getXPHistory(userId: string, limit = 20) {
  return prisma.xpTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ==========================================
// LEADERBOARDS
// ==========================================

export async function getLeaderboard(
  type: 'xp' | 'followers' | 'posts' | 'streak',
  period: 'daily' | 'weekly' | 'monthly' | 'alltime' = 'weekly',
  limit = 10
) {
  const cacheKey = CacheKeys.leaderboard(`${type}:${period}`);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      let startDate: Date | undefined;
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
          return prisma.user.findMany({
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
          return prisma.user.findMany({
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

        case 'posts': {
          const postCounts = await prisma.post.groupBy({
            by: ['authorId'],
            _count: true,
            where: startDate ? { createdAt: { gte: startDate } } : {},
            orderBy: { _count: { authorId: 'desc' } },
            take: limit,
          });

          const userIds = postCounts.map((p) => p.authorId);
          const users = await prisma.user.findMany({
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
        }

        case 'streak':
          return prisma.userStreak.findMany({
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
    },
    300 // Cache for 5 minutes
  );
}

// ==========================================
// ACHIEVEMENT TRIGGERS
// ==========================================

/** A post reached this many views, and "Gone Viral" is earned. */
const VIRAL_VIEW_THRESHOLD = 1000;

/**
 * Awards whatever the member's posting has earned. Counts rather than deltas,
 * so it is safe to call after anything that might have moved one and it never
 * double-awards — awardAchievement returns false for one already held.
 *
 * Reels are counted alongside posts. Creator Studio publishes Video rows, not
 * Post rows with type VIDEO, so a member whose whole output is reels was
 * counted as having posted nothing: "Video Star — posted 10 videos" could not
 * be earned by posting ten videos.
 */
export async function checkContentAchievements(userId: string): Promise<void> {
  const [postCount, videoPostCount, reelCount, viralPost, viralReel] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.post.count({ where: { authorId: userId, type: 'VIDEO' } }),
    prisma.video.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
    prisma.post.findFirst({
      where: { authorId: userId, viewCount: { gte: VIRAL_VIEW_THRESHOLD } },
      select: { id: true },
    }),
    prisma.video.findFirst({
      where: { authorId: userId, viewCount: { gte: VIRAL_VIEW_THRESHOLD } },
      select: { id: true },
    }),
  ]);

  if (postCount + reelCount >= 1) {
    await awardAchievement(userId, 'FIRST_POST');
  }
  if (videoPostCount + reelCount >= 10) {
    await awardAchievement(userId, 'VIDEO_CREATOR');
  }
  if (viralPost || viralReel) {
    await awardAchievement(userId, 'VIRAL_POST');
  }
}

/**
 * Awards whatever the member's following has earned. Like the content check
 * this reads totals rather than deltas, so calling it late — or twice, or on
 * a member who passed the threshold before anything was watching — still
 * lands the right badges and no duplicates.
 *
 * "First Fan" used to test `followerCount === 1`, which meant a member whose
 * second follower arrived before anyone ran the check could never earn it.
 */
export async function checkSocialAchievements(userId: string): Promise<void> {
  const followerCount = await prisma.follow.count({
    where: { followingId: userId },
  });

  if (followerCount >= 1) {
    await awardAchievement(userId, 'FIRST_FOLLOWER');
  }
  if (followerCount >= 100) {
    await awardAchievement(userId, 'HUNDRED_FOLLOWERS');
  }
  if (followerCount >= 1000) {
    await awardAchievement(userId, 'THOUSAND_FOLLOWERS');
  }
}
