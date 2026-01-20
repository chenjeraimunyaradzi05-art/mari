/**
 * Redis Cache Utility
 * Provides caching layer for performance optimization
 */
import Redis from 'ioredis';
export declare function getRedisClient(): Redis | null;
export declare function cacheGet<T>(key: string): Promise<T | null>;
export declare function cacheSet(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
export declare function cacheDel(key: string): Promise<boolean>;
export declare function cacheDelPattern(pattern: string): Promise<boolean>;
export declare function cacheGetOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
export declare const CacheKeys: {
    user: (id: string) => string;
    userProfile: (id: string) => string;
    job: (id: string) => string;
    jobList: (page: number, filters: string) => string;
    jobSearch: (query: string) => string;
    org: (id: string) => string;
    orgBySlug: (slug: string) => string;
    course: (id: string) => string;
    courseList: (page: number, filters: string) => string;
    feed: (userId: string, page: number) => string;
    feedTrending: (hours: number, limit: number) => string;
    platformStats: () => string;
    userStats: (id: string) => string;
    analytics: (key: string) => string;
    referralLeaderboard: () => string;
    leaderboard: (scope: string) => string;
    search: (query: string) => string;
};
export declare function invalidateUserCache(userId: string): Promise<void>;
export declare function invalidateJobCache(jobId: string): Promise<void>;
export declare function invalidateOrgCache(orgId: string, slug?: string): Promise<void>;
export declare function invalidateFeedCache(userId: string): Promise<void>;
export declare function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
}>;
export declare function getRateLimitStatus(key: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
}>;
//# sourceMappingURL=cache.d.ts.map