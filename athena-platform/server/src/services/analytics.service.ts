/**
 * Analytics Service
 * Platform-wide and user-specific analytics
 */

import { prisma } from '../utils/prisma';
import { cacheGetOrSet, CacheKeys } from '../utils/cache';

// ==========================================
// TYPES
// ==========================================

export interface PlatformStats {
  users: {
    total: number;
    new24h: number;
    new7d: number;
    new30d: number;
    byPersona: Record<string, number>;
    byRole: Record<string, number>;
  };
  content: {
    totalPosts: number;
    posts24h: number;
    totalVideos: number;
    videos24h: number;
    totalComments: number;
    totalLikes: number;
  };
  jobs: {
    totalActive: number;
    posted24h: number;
    applications24h: number;
    totalApplications: number;
  };
  creators: {
    total: number;
    totalEarnings: number;
    giftsToday: number;
    topCreators: Array<{ id: string; displayName: string; earnings: number }>;
  };
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    avgSessionTime: number;
    postsPerUser: number;
  };
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface EngagementMetrics {
  views: TimeSeriesData[];
  likes: TimeSeriesData[];
  comments: TimeSeriesData[];
  shares: TimeSeriesData[];
  newUsers: TimeSeriesData[];
}

// ==========================================
// PLATFORM ANALYTICS
// ==========================================

export async function getPlatformStats(): Promise<PlatformStats> {
  const cacheKey = CacheKeys.analytics('platform:stats');

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const now = new Date();
      const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // User stats
      const [
        totalUsers,
        newUsers24h,
        newUsers7d,
        newUsers30d,
        usersByPersona,
        usersByRole,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: day } } }),
        prisma.user.count({ where: { createdAt: { gte: week } } }),
        prisma.user.count({ where: { createdAt: { gte: month } } }),
        prisma.user.groupBy({
          by: ['persona'],
          _count: true,
        }),
        prisma.user.groupBy({
          by: ['role'],
          _count: true,
        }),
      ]);

      // Content stats
      const [
        totalPosts,
        posts24h,
        totalVideos,
        videos24h,
        totalComments,
        totalLikes,
      ] = await Promise.all([
        prisma.post.count(),
        prisma.post.count({ where: { createdAt: { gte: day } } }),
        prisma.post.count({ where: { type: 'VIDEO' } }),
        prisma.post.count({ where: { type: 'VIDEO', createdAt: { gte: day } } }),
        prisma.comment.count(),
        prisma.like.count(),
      ]);

      // Job stats
      const [totalActiveJobs, jobsPosted24h, applications24h, totalApplications] =
        await Promise.all([
          prisma.job.count({ where: { status: 'ACTIVE' } }),
          prisma.job.count({ where: { createdAt: { gte: day } } }),
          prisma.jobApplication.count({ where: { appliedAt: { gte: day } } }),
          prisma.jobApplication.count(),
        ]);

      // Creator stats
      const [totalCreators, creatorEarnings, giftsToday, topCreators] = await Promise.all([
        prisma.creatorProfile.count({ where: { isMonetized: true } }),
        prisma.creatorProfile.aggregate({ _sum: { totalEarnings: true } }),
        prisma.giftTransaction.count({ where: { createdAt: { gte: day } } }),
        prisma.creatorProfile.findMany({
          where: { isMonetized: true },
          include: {
            user: { select: { id: true, displayName: true } },
          },
          orderBy: { totalEarnings: 'desc' },
          take: 5,
        }),
      ]);

      // Engagement - DAU/WAU/MAU approximation
      const [dau, wau, mau] = await Promise.all([
        prisma.session.findMany({
          where: { createdAt: { gte: day } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.session.findMany({
          where: { createdAt: { gte: week } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.session.findMany({
          where: { createdAt: { gte: month } },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

      return {
        users: {
          total: totalUsers,
          new24h: newUsers24h,
          new7d: newUsers7d,
          new30d: newUsers30d,
          byPersona: Object.fromEntries(
            usersByPersona.map((p) => [p.persona, p._count])
          ),
          byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count])),
        },
        content: {
          totalPosts,
          posts24h,
          totalVideos,
          videos24h,
          totalComments,
          totalLikes,
        },
        jobs: {
          totalActive: totalActiveJobs,
          posted24h: jobsPosted24h,
          applications24h,
          totalApplications,
        },
        creators: {
          total: totalCreators,
          totalEarnings: (creatorEarnings._sum.totalEarnings || 0) * 0.01,
          giftsToday,
          topCreators: topCreators.map((c) => ({
            id: c.user.id,
            displayName: c.user.displayName || '',
            earnings: c.totalEarnings * 0.01,
          })),
        },
        engagement: {
          dau: dau.length,
          wau: wau.length,
          mau: mau.length,
          avgSessionTime: 0, // Would need session tracking
          postsPerUser: totalUsers > 0 ? totalPosts / totalUsers : 0,
        },
      };
    },
    300 // Cache for 5 minutes
  );
}

// ==========================================
// TIME SERIES DATA
// ==========================================

export async function getEngagementTimeSeries(days = 30): Promise<EngagementMetrics> {
  const cacheKey = CacheKeys.analytics(`engagement:${days}`);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get daily aggregates
      const [posts, likes, comments, users] = await Promise.all([
        prisma.post.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true, viewCount: true, likeCount: true, commentCount: true, shareCount: true },
        }),
        prisma.like.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true },
        }),
        prisma.comment.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true },
        }),
        prisma.user.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true },
        }),
      ]);

      // Group by day
      const dailyViews: Record<string, number> = {};
      const dailyLikes: Record<string, number> = {};
      const dailyComments: Record<string, number> = {};
      const dailyShares: Record<string, number> = {};
      const dailyNewUsers: Record<string, number> = {};

      // Initialize all days
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const key = date.toISOString().split('T')[0];
        dailyViews[key] = 0;
        dailyLikes[key] = 0;
        dailyComments[key] = 0;
        dailyShares[key] = 0;
        dailyNewUsers[key] = 0;
      }

      // Aggregate posts
      posts.forEach((post) => {
        const key = post.createdAt.toISOString().split('T')[0];
        if (dailyViews[key] !== undefined) {
          dailyViews[key] += post.viewCount;
          dailyShares[key] += post.shareCount;
        }
      });

      // Aggregate likes
      likes.forEach((like) => {
        const key = like.createdAt.toISOString().split('T')[0];
        if (dailyLikes[key] !== undefined) {
          dailyLikes[key]++;
        }
      });

      // Aggregate comments
      comments.forEach((comment) => {
        const key = comment.createdAt.toISOString().split('T')[0];
        if (dailyComments[key] !== undefined) {
          dailyComments[key]++;
        }
      });

      // Aggregate new users
      users.forEach((user) => {
        const key = user.createdAt.toISOString().split('T')[0];
        if (dailyNewUsers[key] !== undefined) {
          dailyNewUsers[key]++;
        }
      });

      // Convert to arrays
      const toTimeSeriesArray = (data: Record<string, number>): TimeSeriesData[] =>
        Object.entries(data)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));

      return {
        views: toTimeSeriesArray(dailyViews),
        likes: toTimeSeriesArray(dailyLikes),
        comments: toTimeSeriesArray(dailyComments),
        shares: toTimeSeriesArray(dailyShares),
        newUsers: toTimeSeriesArray(dailyNewUsers),
      };
    },
    600 // Cache for 10 minutes
  );
}

// ==========================================
// CONTENT PERFORMANCE
// ==========================================

export async function getTopContent(
  period: 'day' | 'week' | 'month' = 'week',
  limit = 10
) {
  const periods = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  const startDate = new Date(Date.now() - periods[period]);

  const [topPosts, topVideos, topCreators] = await Promise.all([
    // Top posts by engagement
    prisma.post.findMany({
      where: { createdAt: { gte: startDate }, isHidden: false },
      include: {
        author: { select: { id: true, displayName: true, avatar: true } },
      },
      orderBy: [{ likeCount: 'desc' }, { commentCount: 'desc' }],
      take: limit,
    }),
    // Top videos specifically
    prisma.post.findMany({
      where: { type: 'VIDEO', createdAt: { gte: startDate }, isHidden: false },
      include: {
        author: { select: { id: true, displayName: true, avatar: true } },
      },
      orderBy: [{ viewCount: 'desc' }, { likeCount: 'desc' }],
      take: limit,
    }),
    // Top creators by engagement
    prisma.user.findMany({
      where: {
        role: 'CREATOR',
        posts: { some: { createdAt: { gte: startDate } } },
      },
      include: {
        posts: {
          where: { createdAt: { gte: startDate } },
          select: { viewCount: true, likeCount: true, commentCount: true },
        },
        _count: { select: { followers: true } },
      },
      take: 50,
    }),
  ]);

  // Calculate creator scores
  const rankedCreators = topCreators
    .map((creator) => {
      const totalViews = creator.posts.reduce((sum, p) => sum + p.viewCount, 0);
      const totalLikes = creator.posts.reduce((sum, p) => sum + p.likeCount, 0);
      const totalComments = creator.posts.reduce((sum, p) => sum + p.commentCount, 0);
      const engagement = totalViews + totalLikes * 5 + totalComments * 10;

      return {
        id: creator.id,
        displayName: creator.displayName,
        avatar: creator.avatar,
        followers: creator._count.followers,
        totalViews,
        totalLikes,
        totalComments,
        engagement,
      };
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit);

  return {
    topPosts: topPosts.map((p) => ({
      id: p.id,
      type: p.type,
      content: p.content.substring(0, 100),
      author: p.author,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      viewCount: p.viewCount,
    })),
    topVideos: topVideos.map((v) => ({
      id: v.id,
      content: v.content.substring(0, 100),
      author: v.author,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
    })),
    topCreators: rankedCreators,
  };
}

// ==========================================
// GROWTH METRICS
// ==========================================

export async function getGrowthMetrics(days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

  const [currentUsers, previousUsers, currentPosts, previousPosts] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: startDate } } }),
    prisma.user.count({
      where: { createdAt: { gte: previousStart, lt: startDate } },
    }),
    prisma.post.count({ where: { createdAt: { gte: startDate } } }),
    prisma.post.count({
      where: { createdAt: { gte: previousStart, lt: startDate } },
    }),
  ]);

  const userGrowth =
    previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0;
  const postGrowth =
    previousPosts > 0 ? ((currentPosts - previousPosts) / previousPosts) * 100 : 0;

  return {
    period: `${days} days`,
    users: {
      current: currentUsers,
      previous: previousUsers,
      growthPercent: Math.round(userGrowth * 10) / 10,
    },
    posts: {
      current: currentPosts,
      previous: previousPosts,
      growthPercent: Math.round(postGrowth * 10) / 10,
    },
  };
}

// ==========================================
// USER ANALYTICS
// ==========================================

export async function getUserAnalytics(userId: string, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [posts, followers, following, likes, profile] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: startDate } },
      select: {
        id: true,
        type: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        createdAt: true,
      },
    }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.like.count({
      where: { post: { authorId: userId }, createdAt: { gte: startDate } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, role: true },
    }),
  ]);

  // Calculate metrics
  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);
  const totalShares = posts.reduce((sum, p) => sum + p.shareCount, 0);

  const engagementRate =
    totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

  // Group by day
  const dailyStats = new Map<string, { views: number; likes: number; posts: number }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split('T')[0];
    dailyStats.set(key, { views: 0, likes: 0, posts: 0 });
  }

  posts.forEach((post) => {
    const key = post.createdAt.toISOString().split('T')[0];
    const stats = dailyStats.get(key);
    if (stats) {
      stats.views += post.viewCount;
      stats.likes += post.likeCount;
      stats.posts++;
    }
  });

  return {
    summary: {
      totalPosts: posts.length,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      followers,
      following,
      engagementRate: Math.round(engagementRate * 100) / 100,
    },
    dailyStats: Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    })),
    topPosts: [...posts]
      .sort((a, b) => b.viewCount + b.likeCount * 5 - (a.viewCount + a.likeCount * 5))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        type: p.type,
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
      })),
  };
}
