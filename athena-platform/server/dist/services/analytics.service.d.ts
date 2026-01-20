/**
 * Analytics Service
 * Platform-wide and user-specific analytics
 */
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
        topCreators: Array<{
            id: string;
            displayName: string;
            earnings: number;
        }>;
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
export declare function getPlatformStats(): Promise<PlatformStats>;
export declare function getEngagementTimeSeries(days?: number): Promise<EngagementMetrics>;
export declare function getTopContent(period?: 'day' | 'week' | 'month', limit?: number): Promise<{
    topPosts: {
        id: string;
        type: import(".prisma/client").$Enums.PostType;
        content: string;
        author: {
            id: string;
            displayName: string | null;
            avatar: string | null;
        };
        likeCount: number;
        commentCount: number;
        viewCount: number;
    }[];
    topVideos: {
        id: string;
        content: string;
        author: {
            id: string;
            displayName: string | null;
            avatar: string | null;
        };
        viewCount: number;
        likeCount: number;
    }[];
    topCreators: {
        id: string;
        displayName: string | null;
        avatar: string | null;
        followers: number;
        totalViews: number;
        totalLikes: number;
        totalComments: number;
        engagement: number;
    }[];
}>;
export declare function getGrowthMetrics(days?: number): Promise<{
    period: string;
    users: {
        current: number;
        previous: number;
        growthPercent: number;
    };
    posts: {
        current: number;
        previous: number;
        growthPercent: number;
    };
}>;
export declare function getUserAnalytics(userId: string, days?: number): Promise<{
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
    dailyStats: {
        views: number;
        likes: number;
        posts: number;
        date: string;
    }[];
    topPosts: {
        id: string;
        type: import(".prisma/client").$Enums.PostType;
        viewCount: number;
        likeCount: number;
        commentCount: number;
    }[];
}>;
//# sourceMappingURL=analytics.service.d.ts.map