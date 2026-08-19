"use strict";
/**
 * Low-Bandwidth / Lite Mode Service
 * Adaptive media delivery, offline caching, data saver profiles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdaptiveProfile = getAdaptiveProfile;
exports.getRegionalRecommendation = getRegionalRecommendation;
exports.getOptimizedMediaUrl = getOptimizedMediaUrl;
exports.generateSrcSet = generateSrcSet;
exports.getOfflineCacheConfig = getOfflineCacheConfig;
exports.estimateDataUsage = estimateDataUsage;
exports.getPreloadHints = getPreloadHints;
exports.getAvailableProfiles = getAvailableProfiles;
exports.getServiceWorkerConfig = getServiceWorkerConfig;
exports.getCompressionConfig = getCompressionConfig;
exports.detectConnectionFromHeaders = detectConnectionFromHeaders;
exports.createBandwidthMiddleware = createBandwidthMiddleware;
const logger_1 = require("../utils/logger");
// Bandwidth profiles for different network conditions
const BANDWIDTH_PROFILES = {
    ultra_low: {
        name: 'Ultra Low Data',
        maxImageWidth: 320,
        imageQuality: 30,
        videoEnabled: false,
        videoMaxResolution: '240p',
        videoPreloadEnabled: false,
        animationsEnabled: false,
        autoPlayMedia: false,
        lazyLoadThreshold: 100,
        prefetchEnabled: false,
        estimatedDataUsagePerHour: '~2 MB',
    },
    low: {
        name: 'Low Data',
        maxImageWidth: 480,
        imageQuality: 50,
        videoEnabled: true,
        videoMaxResolution: '360p',
        videoPreloadEnabled: false,
        animationsEnabled: false,
        autoPlayMedia: false,
        lazyLoadThreshold: 200,
        prefetchEnabled: false,
        estimatedDataUsagePerHour: '~10 MB',
    },
    medium: {
        name: 'Balanced',
        maxImageWidth: 720,
        imageQuality: 70,
        videoEnabled: true,
        videoMaxResolution: '480p',
        videoPreloadEnabled: true,
        animationsEnabled: true,
        autoPlayMedia: false,
        lazyLoadThreshold: 400,
        prefetchEnabled: true,
        estimatedDataUsagePerHour: '~30 MB',
    },
    high: {
        name: 'High Quality',
        maxImageWidth: 1080,
        imageQuality: 85,
        videoEnabled: true,
        videoMaxResolution: '720p',
        videoPreloadEnabled: true,
        animationsEnabled: true,
        autoPlayMedia: true,
        lazyLoadThreshold: 600,
        prefetchEnabled: true,
        estimatedDataUsagePerHour: '~80 MB',
    },
    unlimited: {
        name: 'Maximum Quality',
        maxImageWidth: 2048,
        imageQuality: 95,
        videoEnabled: true,
        videoMaxResolution: '1080p',
        videoPreloadEnabled: true,
        animationsEnabled: true,
        autoPlayMedia: true,
        lazyLoadThreshold: 800,
        prefetchEnabled: true,
        estimatedDataUsagePerHour: '~200 MB',
    },
};
// Regional data cost considerations (for low-data mode recommendations)
const REGIONAL_DATA_COSTS = {
    IN: { costPerGB: 10, currency: 'INR', recommendation: 'low' },
    PH: { costPerGB: 50, currency: 'PHP', recommendation: 'low' },
    ID: { costPerGB: 10000, currency: 'IDR', recommendation: 'low' },
    BR: { costPerGB: 15, currency: 'BRL', recommendation: 'medium' },
    KE: { costPerGB: 150, currency: 'KES', recommendation: 'ultra_low' },
    NG: { costPerGB: 500, currency: 'NGN', recommendation: 'ultra_low' },
    US: { costPerGB: 10, currency: 'USD', recommendation: 'unlimited' },
    GB: { costPerGB: 8, currency: 'GBP', recommendation: 'high' },
    AU: { costPerGB: 15, currency: 'AUD', recommendation: 'high' },
    SG: { costPerGB: 12, currency: 'SGD', recommendation: 'high' },
};
/**
 * Get bandwidth profile based on connection info
 */
function getAdaptiveProfile(connectionInfo) {
    // User requested save data
    if (connectionInfo.saveData) {
        return BANDWIDTH_PROFILES.low;
    }
    // Determine based on effective connection type
    switch (connectionInfo.effectiveType) {
        case '2g':
            return BANDWIDTH_PROFILES.ultra_low;
        case '3g':
            return connectionInfo.downlink < 1 ? BANDWIDTH_PROFILES.low : BANDWIDTH_PROFILES.medium;
        case '4g':
            return connectionInfo.downlink < 5 ? BANDWIDTH_PROFILES.medium : BANDWIDTH_PROFILES.high;
        case 'wifi':
            return connectionInfo.downlink >= 10 ? BANDWIDTH_PROFILES.unlimited : BANDWIDTH_PROFILES.high;
        default:
            return BANDWIDTH_PROFILES.medium;
    }
}
/**
 * Get region-recommended profile
 */
function getRegionalRecommendation(countryCode) {
    const regional = REGIONAL_DATA_COSTS[countryCode];
    if (regional) {
        return BANDWIDTH_PROFILES[regional.recommendation];
    }
    return BANDWIDTH_PROFILES.medium;
}
/**
 * Transform media URL for bandwidth optimization
 */
function getOptimizedMediaUrl(options) {
    const { originalUrl, type, width, height, connectionInfo, profileOverride } = options;
    // Determine profile
    let profile = profileOverride;
    if (!profile && connectionInfo) {
        profile = getAdaptiveProfile(connectionInfo);
    }
    if (!profile) {
        profile = BANDWIDTH_PROFILES.medium;
    }
    // Parse original URL
    let url;
    try {
        url = new URL(originalUrl);
    }
    catch {
        return originalUrl;
    }
    // Add CDN optimization parameters
    const params = new URLSearchParams();
    if (type === 'image' || type === 'avatar') {
        const targetWidth = Math.min(width || profile.maxImageWidth, profile.maxImageWidth);
        params.set('w', targetWidth.toString());
        params.set('q', profile.imageQuality.toString());
        params.set('f', 'webp'); // Modern format
        if (type === 'avatar') {
            params.set('fit', 'crop');
            params.set('ar', '1:1');
        }
    }
    else if (type === 'video') {
        if (!profile.videoEnabled) {
            // Return poster image instead
            params.set('format', 'poster');
            params.set('w', profile.maxImageWidth.toString());
        }
        else {
            params.set('res', profile.videoMaxResolution);
            if (!profile.videoPreloadEnabled) {
                params.set('preload', 'none');
            }
        }
    }
    // Build optimized URL (would use actual CDN in production)
    const optimizedUrl = `${url.origin}${url.pathname}?${params.toString()}`;
    return optimizedUrl;
}
/**
 * Generate srcset for responsive images
 */
function generateSrcSet(originalUrl, profile) {
    const breakpoints = [320, 480, 720, 1080, 1440];
    const maxWidth = profile.maxImageWidth;
    const validBreakpoints = breakpoints.filter(bp => bp <= maxWidth);
    const srcset = validBreakpoints
        .map(bp => {
        const optimizedUrl = getOptimizedMediaUrl({
            originalUrl,
            type: 'image',
            width: bp,
            profileOverride: profile,
        });
        return `${optimizedUrl} ${bp}w`;
    })
        .join(', ');
    const sizes = `(max-width: ${maxWidth}px) 100vw, ${maxWidth}px`;
    return { srcset, sizes };
}
/**
 * Get offline cache configuration for user
 */
function getOfflineCacheConfig(storageQuotaMB, profile) {
    // Adjust cache size based on profile
    const sizeFactor = profile.name === 'Ultra Low Data' ? 0.3 :
        profile.name === 'Low Data' ? 0.5 : 1;
    return {
        maxSizeMB: Math.min(storageQuotaMB * sizeFactor, 500),
        priorityContent: [
            'user-profile',
            'saved-jobs',
            'active-courses',
            'messages-recent',
            'mentor-sessions',
        ],
        ttlHours: 24 * 7, // 1 week
        syncOnWifi: true,
    };
}
/**
 * Estimate data usage for content
 */
function estimateDataUsage(content) {
    const { images, videos, text, profile } = content;
    // Average sizes based on profile
    const avgImageKB = {
        ultra_low: 15,
        low: 30,
        medium: 80,
        high: 150,
        unlimited: 300,
    };
    const avgVideoMB = {
        ultra_low: 0, // Videos disabled
        low: 2,
        medium: 5,
        high: 15,
        unlimited: 40,
    };
    const profileKey = Object.keys(BANDWIDTH_PROFILES).find(k => BANDWIDTH_PROFILES[k].name === profile.name) || 'medium';
    const imageData = images * (avgImageKB[profileKey] || 80);
    const videoData = videos * (avgVideoMB[profileKey] || 5) * 1024;
    const textData = text;
    const totalKB = imageData + videoData + textData;
    return {
        totalMB: Math.round(totalKB / 1024 * 100) / 100,
        breakdown: {
            images: Math.round(imageData / 1024 * 100) / 100,
            videos: Math.round(videoData / 1024 * 100) / 100,
            text: Math.round(textData / 1024 * 100) / 100,
        },
    };
}
/**
 * Get preload hints based on profile
 */
function getPreloadHints(profile, currentPage) {
    if (!profile.prefetchEnabled) {
        return { preload: [], prefetch: [], dns: [] };
    }
    // Base hints
    const hints = {
        preload: [],
        prefetch: [],
        dns: ['cdn.athena.app', 'api.athena.app'],
    };
    // Add page-specific prefetch
    switch (currentPage) {
        case 'feed':
            hints.prefetch = ['/api/feed?limit=5', '/api/notifications/unread'];
            break;
        case 'jobs':
            hints.prefetch = ['/api/jobs/recommended?limit=10'];
            break;
        case 'messages':
            hints.prefetch = ['/api/conversations?limit=10'];
            break;
        case 'learn':
            hints.prefetch = ['/api/courses/enrolled'];
            break;
    }
    return hints;
}
/**
 * Get all available profiles
 */
function getAvailableProfiles() {
    return Object.values(BANDWIDTH_PROFILES);
}
/**
 * Client-side service worker configuration
 */
function getServiceWorkerConfig(profile) {
    return {
        cacheStrategies: {
            api: profile.prefetchEnabled ? 'stale-while-revalidate' : 'network-first',
            images: 'cache-first',
            static: 'cache-first',
        },
        maxCacheAge: {
            api: 5 * 60 * 1000, // 5 minutes
            images: 7 * 24 * 60 * 60 * 1000, // 1 week
            static: 30 * 24 * 60 * 60 * 1000, // 30 days
        },
        maxCacheSize: profile.name === 'Ultra Low Data' ? 20 : 100, // MB
        backgroundSync: profile.prefetchEnabled,
        pushNotifications: true,
    };
}
/**
 * API response compression settings
 */
function getCompressionConfig(profile) {
    if (profile.name === 'Ultra Low Data' || profile.name === 'Low Data') {
        return {
            gzip: true,
            brotli: true,
            minifyJson: true,
            excludeFields: ['metadata', 'analytics', 'debug', 'expandedContent'],
        };
    }
    return {
        gzip: true,
        brotli: true,
        minifyJson: false,
        excludeFields: [],
    };
}
/**
 * Detect connection quality from request headers
 */
function detectConnectionFromHeaders(headers) {
    // Parse Network Information API hints
    const saveData = headers['save-data'] === 'on';
    const ect = headers['ect'] || '4g';
    const downlink = parseFloat(headers['downlink']) || 10;
    const rtt = parseInt(headers['rtt']) || 50;
    return {
        effectiveType: ect,
        downlink,
        rtt,
        saveData,
    };
}
/**
 * Middleware to apply low-bandwidth optimizations
 */
function createBandwidthMiddleware() {
    return (req, res, next) => {
        // Detect connection
        const connectionInfo = detectConnectionFromHeaders(req.headers);
        const profile = getAdaptiveProfile(connectionInfo);
        // Attach to request
        req.bandwidthProfile = profile;
        req.connectionInfo = connectionInfo;
        // Set response headers for client hints
        res.setHeader('Accept-CH', 'ECT, Save-Data, Downlink, RTT');
        res.setHeader('Vary', 'ECT, Save-Data');
        // Apply compression settings
        const compression = getCompressionConfig(profile);
        req.compressionConfig = compression;
        logger_1.logger.debug('Bandwidth profile applied', {
            profile: profile.name,
            connectionType: connectionInfo.effectiveType,
            saveData: connectionInfo.saveData,
        });
        next();
    };
}
exports.default = {
    BANDWIDTH_PROFILES,
    getAdaptiveProfile,
    getRegionalRecommendation,
    getOptimizedMediaUrl,
    generateSrcSet,
    getOfflineCacheConfig,
    estimateDataUsage,
    getPreloadHints,
    getAvailableProfiles,
    getServiceWorkerConfig,
    getCompressionConfig,
    detectConnectionFromHeaders,
    createBandwidthMiddleware,
};
//# sourceMappingURL=bandwidth.service.js.map