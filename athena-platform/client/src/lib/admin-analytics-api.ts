/**
 * The staff-facing analytics under /api/analytics: growth against the
 * previous period, the top posts, videos and creators for a period, the
 * per-day engagement series, platform totals, and one member's last N days.
 * Every route is ADMIN-only on the server. /analytics/me and
 * /analytics/creator-dashboard are deliberately not here: they duplicate
 * /posts/me/insights and /creator/analytics, which the member pages use.
 */

import { api } from './api';

export type TimeSeriesPoint = { date: string; value: number };

export type GrowthMetrics = {
  period: string;
  users: { current: number; previous: number; growthPercent: number };
  posts: { current: number; previous: number; growthPercent: number };
};

export type TopContentPeriod = 'day' | 'week' | 'month';

export type TopContent = {
  topPosts: Array<{
    id: string;
    type: string;
    content: string;
    author: { id: string; displayName: string | null; avatar: string | null };
    likeCount: number;
    commentCount: number;
    viewCount: number;
  }>;
  topVideos: Array<{
    id: string;
    content: string;
    author: { id: string; displayName: string | null; avatar: string | null };
    viewCount: number;
    likeCount: number;
  }>;
  topCreators: Array<{
    id: string;
    displayName: string | null;
    avatar: string | null;
    followers: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    engagement: number;
  }>;
};

export type EngagementSeries = {
  views: TimeSeriesPoint[];
  likes: TimeSeriesPoint[];
  comments: TimeSeriesPoint[];
  shares: TimeSeriesPoint[];
  newUsers: TimeSeriesPoint[];
};

export type UserAnalytics = {
  summary: {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    followers: number;
    following: number;
    engagementRate: number;
  };
  dailyStats: Array<{ date: string; views: number; likes: number; posts: number }>;
  topPosts: Array<{ id: string; type: string; viewCount: number; likeCount: number; commentCount: number }>;
};

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  platform: () => api.get('/analytics/platform'),
  growth: (days: number) => api.get<GrowthMetrics>('/analytics/growth', { params: { days } }),
  topContent: (period: TopContentPeriod, limit = 10) =>
    api.get<TopContent>('/analytics/top-content', { params: { period, limit } }),
  engagement: (days: number) => api.get<EngagementSeries>('/analytics/engagement', { params: { days } }),
  user: (userId: string, days = 30) => api.get<UserAnalytics>(`/analytics/user/${userId}`, { params: { days } }),
};
