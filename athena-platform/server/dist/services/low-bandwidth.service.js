"use strict";
/**
 * Low Bandwidth Mode Service
 * Optimizations for users with limited connectivity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lowBandwidthService = exports.BANDWIDTH_PROFILES = void 0;
const logger_1 = require("../utils/logger");
// ==========================================
// BANDWIDTH PROFILES
// ==========================================
exports.BANDWIDTH_PROFILES = [
    {
        id: 'ultra-low',
        name: 'Ultra Low Bandwidth (2G)',
        maxBandwidthKbps: 50,
        imageQuality: 'low',
        videoQuality: '144p',
        autoplayEnabled: false,
        prefetchEnabled: false,
        webpEnabled: true,
        lazyLoadingAggressive: true,
        reducedAnimations: true,
        compressedFonts: true,
        offlineMode: true,
    },
    {
        id: 'low',
        name: 'Low Bandwidth (3G)',
        maxBandwidthKbps: 200,
        imageQuality: 'low',
        videoQuality: '240p',
        autoplayEnabled: false,
        prefetchEnabled: false,
        webpEnabled: true,
        lazyLoadingAggressive: true,
        reducedAnimations: true,
        compressedFonts: true,
        offlineMode: false,
    },
    {
        id: 'medium',
        name: 'Medium Bandwidth (4G)',
        maxBandwidthKbps: 1000,
        imageQuality: 'medium',
        videoQuality: '480p',
        autoplayEnabled: true,
        prefetchEnabled: true,
        webpEnabled: true,
        lazyLoadingAggressive: false,
        reducedAnimations: false,
        compressedFonts: false,
        offlineMode: false,
    },
    {
        id: 'high',
        name: 'High Bandwidth (WiFi/5G)',
        maxBandwidthKbps: 10000,
        imageQuality: 'high',
        videoQuality: '1080p',
        autoplayEnabled: true,
        prefetchEnabled: true,
        webpEnabled: false,
        lazyLoadingAggressive: false,
        reducedAnimations: false,
        compressedFonts: false,
        offlineMode: false,
    },
];
// In-memory cache storage
const contentCache = new Map();
const userProfiles = new Map(); // userId -> profileId
// ==========================================
// SERVICE
// ==========================================
exports.lowBandwidthService = {
    /**
     * Detect connection quality and recommend profile
     */
    detectConnectionProfile(metrics) {
        if (metrics.saveData) {
            return exports.BANDWIDTH_PROFILES.find(p => p.id === 'low');
        }
        if (metrics.effectiveType === '2g' || metrics.downlink < 0.1) {
            return exports.BANDWIDTH_PROFILES.find(p => p.id === 'ultra-low');
        }
        if (metrics.effectiveType === '3g' || metrics.downlink < 1) {
            return exports.BANDWIDTH_PROFILES.find(p => p.id === 'low');
        }
        if (metrics.effectiveType === '4g' || metrics.downlink < 5) {
            return exports.BANDWIDTH_PROFILES.find(p => p.id === 'medium');
        }
        return exports.BANDWIDTH_PROFILES.find(p => p.id === 'high');
    },
    /**
     * Set user bandwidth profile
     */
    setUserProfile(userId, profileId) {
        const profile = exports.BANDWIDTH_PROFILES.find(p => p.id === profileId);
        if (!profile)
            throw new Error('Invalid bandwidth profile');
        userProfiles.set(userId, profileId);
        logger_1.logger.info('Bandwidth profile set', { userId, profileId });
        return profile;
    },
    /**
     * Get user bandwidth profile
     */
    getUserProfile(userId) {
        const profileId = userProfiles.get(userId) || 'medium';
        return exports.BANDWIDTH_PROFILES.find(p => p.id === profileId) || exports.BANDWIDTH_PROFILES[2];
    },
    /**
     * Optimize image URL based on profile
     */
    optimizeImageUrl(originalUrl, profile) {
        const qualityParams = {
            low: { width: 320, quality: 60 },
            medium: { width: 640, quality: 75 },
            high: { width: 1280, quality: 85 },
            original: { width: 0, quality: 100 },
        };
        const params = qualityParams[profile.imageQuality];
        const format = profile.webpEnabled ? 'webp' : 'jpeg';
        // Build optimized URL (would use real image CDN in production)
        const optimizedUrl = `${originalUrl}?w=${params.width}&q=${params.quality}&fm=${format}`;
        return {
            originalUrl,
            optimizedUrl,
            originalSize: 500000, // Placeholder
            optimizedSize: Math.floor(500000 * (params.quality / 100) * (params.width / 1920)),
            savings: Math.round((1 - (params.quality / 100) * (params.width / 1920)) * 100),
            format,
            quality: profile.imageQuality,
        };
    },
    /**
     * Get optimized video quality URL
     */
    optimizeVideoUrl(originalUrl, profile) {
        const qualityMap = {
            '144p': 'sq',
            '240p': 'lq',
            '360p': 'mq',
            '480p': 'hq',
            '720p': 'hd',
            '1080p': 'fhd',
        };
        const qualitySuffix = qualityMap[profile.videoQuality] || 'mq';
        return originalUrl.replace(/\.(mp4|webm)/, `_${qualitySuffix}.$1`);
    },
    /**
     * Cache content for offline access
     */
    async cacheContent(userId, contentType, data) {
        const cached = {
            id: `cache_${Date.now()}`,
            userId,
            contentType,
            data,
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            size: JSON.stringify(data).length,
        };
        const cacheKey = `${userId}:${contentType}`;
        contentCache.set(cacheKey, cached);
        logger_1.logger.info('Content cached', { userId, contentType, size: cached.size });
        return cached;
    },
    /**
     * Get cached content
     */
    getCachedContent(userId, contentType) {
        const cacheKey = `${userId}:${contentType}`;
        const cached = contentCache.get(cacheKey);
        if (!cached)
            return null;
        if (cached.expiresAt < new Date()) {
            contentCache.delete(cacheKey);
            return null;
        }
        return cached;
    },
    /**
     * Get lite version of feed data
     */
    getLiteFeed(feed, profile) {
        // Strip non-essential data based on bandwidth profile
        return feed.map((item) => ({
            id: item.id,
            authorId: item.authorId,
            authorName: item.authorName,
            content: item.content?.substring(0, 280), // Truncate to tweet-length
            thumbnail: profile.imageQuality === 'low'
                ? this.optimizeImageUrl(item.thumbnail, profile).optimizedUrl
                : item.thumbnail,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            createdAt: item.createdAt,
            // Exclude heavy fields: full images, videos, attachments
        }));
    },
    /**
     * Calculate estimated data usage
     */
    estimateDataUsage(contentType, count, profile) {
        const baseUsageKb = {
            image: { low: 50, medium: 150, high: 500, original: 1000 }[profile.imageQuality] || 150,
            video: { '144p': 500, '240p': 1000, '360p': 2000, '480p': 5000, '720p': 10000, '1080p': 25000 }[profile.videoQuality] || 2000,
            text: 2,
            feed: { low: 30, medium: 100, high: 300, original: 500 }[profile.imageQuality] || 100,
        };
        const estimatedKb = baseUsageKb[contentType] * count;
        const estimatedTimeSeconds = (estimatedKb * 8) / profile.maxBandwidthKbps;
        return { estimatedKb, estimatedTimeSeconds };
    },
    /**
     * Get progressive loading config
     */
    getProgressiveLoadingConfig(profile) {
        if (profile.id === 'ultra-low') {
            return { initialItems: 3, batchSize: 3, preloadDistance: 1, imageLoadDelay: 500 };
        }
        if (profile.id === 'low') {
            return { initialItems: 5, batchSize: 5, preloadDistance: 2, imageLoadDelay: 200 };
        }
        if (profile.id === 'medium') {
            return { initialItems: 10, batchSize: 10, preloadDistance: 3, imageLoadDelay: 0 };
        }
        return { initialItems: 20, batchSize: 20, preloadDistance: 5, imageLoadDelay: 0 };
    },
};
//# sourceMappingURL=low-bandwidth.service.js.map