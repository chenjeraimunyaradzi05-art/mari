/**
 * Feed Algorithm Service
 * Video-first, engagement-optimized feed ranking
 */
export interface FeedPost {
    id: string;
    authorId: string;
    type: string;
    content: string;
    mediaUrls: any;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    viewCount: number;
    createdAt: Date;
    author: {
        id: string;
        displayName: string;
        avatar: string | null;
        headline: string | null;
    };
    isLiked?: boolean;
    engagementScore: number;
    decayedScore: number;
}
export interface FeedOptions {
    userId?: string;
    page?: number;
    limit?: number;
    type?: 'all' | 'video' | 'image' | 'text';
    algorithm?: 'chronological' | 'engagement' | 'personalized';
}
export declare function generateFeed(options: FeedOptions): Promise<{
    posts: FeedPost[];
    hasMore: boolean;
    total: number;
}>;
export declare function getTrendingPosts(hours?: number, limit?: number): Promise<FeedPost[]>;
export declare function getVideoFeed(userId?: string, cursor?: string, limit?: number): Promise<{
    videos: FeedPost[];
    nextCursor: string | null;
}>;
export declare function getForYouFeed(userId: string, page?: number, limit?: number): Promise<{
    posts: FeedPost[];
    hasMore: boolean;
}>;
export declare function recordPostView(postId: string, userId?: string, options?: {
    silent?: boolean;
}): Promise<void>;
//# sourceMappingURL=feed.service.d.ts.map