/**
 * Low Bandwidth Mode Service
 * Optimizations for users with limited connectivity
 */
export interface BandwidthProfile {
    id: string;
    name: string;
    maxBandwidthKbps: number;
    imageQuality: 'low' | 'medium' | 'high' | 'original';
    videoQuality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p';
    autoplayEnabled: boolean;
    prefetchEnabled: boolean;
    webpEnabled: boolean;
    lazyLoadingAggressive: boolean;
    reducedAnimations: boolean;
    compressedFonts: boolean;
    offlineMode: boolean;
}
export interface ConnectionMetrics {
    effectiveType: '2g' | '3g' | '4g' | '5g' | 'wifi' | 'unknown';
    downlink: number;
    rtt: number;
    saveData: boolean;
}
export interface ContentOptimization {
    originalUrl: string;
    optimizedUrl: string;
    originalSize: number;
    optimizedSize: number;
    savings: number;
    format: string;
    quality: string;
}
export interface CachedContent {
    id: string;
    userId: string;
    contentType: 'feed' | 'messages' | 'profile' | 'courses';
    data: unknown;
    cachedAt: Date;
    expiresAt: Date;
    size: number;
}
export declare const BANDWIDTH_PROFILES: BandwidthProfile[];
export declare const lowBandwidthService: {
    /**
     * Detect connection quality and recommend profile
     */
    detectConnectionProfile(metrics: ConnectionMetrics): BandwidthProfile;
    /**
     * Set user bandwidth profile
     */
    setUserProfile(userId: string, profileId: string): BandwidthProfile;
    /**
     * Get user bandwidth profile
     */
    getUserProfile(userId: string): BandwidthProfile;
    /**
     * Optimize image URL based on profile
     */
    optimizeImageUrl(originalUrl: string, profile: BandwidthProfile): ContentOptimization;
    /**
     * Get optimized video quality URL
     */
    optimizeVideoUrl(originalUrl: string, profile: BandwidthProfile): string;
    /**
     * Cache content for offline access
     */
    cacheContent(userId: string, contentType: CachedContent["contentType"], data: unknown): Promise<CachedContent>;
    /**
     * Get cached content
     */
    getCachedContent(userId: string, contentType: CachedContent["contentType"]): CachedContent | null;
    /**
     * Get lite version of feed data
     */
    getLiteFeed(feed: unknown[], profile: BandwidthProfile): unknown[];
    /**
     * Calculate estimated data usage
     */
    estimateDataUsage(contentType: "image" | "video" | "text" | "feed", count: number, profile: BandwidthProfile): {
        estimatedKb: number;
        estimatedTimeSeconds: number;
    };
    /**
     * Get progressive loading config
     */
    getProgressiveLoadingConfig(profile: BandwidthProfile): {
        initialItems: number;
        batchSize: number;
        preloadDistance: number;
        imageLoadDelay: number;
    };
};
//# sourceMappingURL=low-bandwidth.service.d.ts.map