/**
 * Low-Bandwidth / Lite Mode Service
 * Adaptive media delivery, offline caching, data saver profiles
 */
export interface BandwidthProfile {
    name: string;
    maxImageWidth: number;
    imageQuality: number;
    videoEnabled: boolean;
    videoMaxResolution: '240p' | '360p' | '480p' | '720p' | '1080p';
    videoPreloadEnabled: boolean;
    animationsEnabled: boolean;
    autoPlayMedia: boolean;
    lazyLoadThreshold: number;
    prefetchEnabled: boolean;
    estimatedDataUsagePerHour: string;
}
export interface ConnectionInfo {
    effectiveType: '2g' | '3g' | '4g' | 'wifi';
    downlink: number;
    rtt: number;
    saveData: boolean;
}
export interface AdaptiveMediaOptions {
    originalUrl: string;
    type: 'image' | 'video' | 'avatar';
    width?: number;
    height?: number;
    connectionInfo?: ConnectionInfo;
    profileOverride?: BandwidthProfile;
}
export interface OfflineCacheConfig {
    maxSizeMB: number;
    priorityContent: string[];
    ttlHours: number;
    syncOnWifi: boolean;
}
/**
 * Get bandwidth profile based on connection info
 */
export declare function getAdaptiveProfile(connectionInfo: ConnectionInfo): BandwidthProfile;
/**
 * Get region-recommended profile
 */
export declare function getRegionalRecommendation(countryCode: string): BandwidthProfile;
/**
 * Transform media URL for bandwidth optimization
 */
export declare function getOptimizedMediaUrl(options: AdaptiveMediaOptions): string;
/**
 * Generate srcset for responsive images
 */
export declare function generateSrcSet(originalUrl: string, profile: BandwidthProfile): {
    srcset: string;
    sizes: string;
};
/**
 * Get offline cache configuration for user
 */
export declare function getOfflineCacheConfig(storageQuotaMB: number, profile: BandwidthProfile): OfflineCacheConfig;
/**
 * Estimate data usage for content
 */
export declare function estimateDataUsage(content: {
    images: number;
    videos: number;
    text: number;
    profile: BandwidthProfile;
}): {
    totalMB: number;
    breakdown: Record<string, number>;
};
/**
 * Get preload hints based on profile
 */
export declare function getPreloadHints(profile: BandwidthProfile, currentPage: string): {
    preload: string[];
    prefetch: string[];
    dns: string[];
};
/**
 * Get all available profiles
 */
export declare function getAvailableProfiles(): BandwidthProfile[];
/**
 * Client-side service worker configuration
 */
export declare function getServiceWorkerConfig(profile: BandwidthProfile): Record<string, any>;
/**
 * API response compression settings
 */
export declare function getCompressionConfig(profile: BandwidthProfile): {
    gzip: boolean;
    brotli: boolean;
    minifyJson: boolean;
    excludeFields: string[];
};
/**
 * Detect connection quality from request headers
 */
export declare function detectConnectionFromHeaders(headers: Record<string, string>): ConnectionInfo;
/**
 * Middleware to apply low-bandwidth optimizations
 */
export declare function createBandwidthMiddleware(): (req: any, res: any, next: any) => void;
declare const _default: {
    BANDWIDTH_PROFILES: Record<string, BandwidthProfile>;
    getAdaptiveProfile: typeof getAdaptiveProfile;
    getRegionalRecommendation: typeof getRegionalRecommendation;
    getOptimizedMediaUrl: typeof getOptimizedMediaUrl;
    generateSrcSet: typeof generateSrcSet;
    getOfflineCacheConfig: typeof getOfflineCacheConfig;
    estimateDataUsage: typeof estimateDataUsage;
    getPreloadHints: typeof getPreloadHints;
    getAvailableProfiles: typeof getAvailableProfiles;
    getServiceWorkerConfig: typeof getServiceWorkerConfig;
    getCompressionConfig: typeof getCompressionConfig;
    detectConnectionFromHeaders: typeof detectConnectionFromHeaders;
    createBandwidthMiddleware: typeof createBandwidthMiddleware;
};
export default _default;
//# sourceMappingURL=bandwidth.service.d.ts.map