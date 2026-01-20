/**
 * Low-Bandwidth / Lite Mode Service
 * Adaptive media delivery, offline caching, data saver profiles
 */

import { logger } from '../utils/logger';

export interface BandwidthProfile {
  name: string;
  maxImageWidth: number;
  imageQuality: number;
  videoEnabled: boolean;
  videoMaxResolution: '240p' | '360p' | '480p' | '720p' | '1080p';
  videoPreloadEnabled: boolean;
  animationsEnabled: boolean;
  autoPlayMedia: boolean;
  lazyLoadThreshold: number; // pixels before viewport
  prefetchEnabled: boolean;
  estimatedDataUsagePerHour: string;
}

export interface ConnectionInfo {
  effectiveType: '2g' | '3g' | '4g' | 'wifi';
  downlink: number; // Mbps
  rtt: number; // Round-trip time in ms
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

// Bandwidth profiles for different network conditions
const BANDWIDTH_PROFILES: Record<string, BandwidthProfile> = {
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
const REGIONAL_DATA_COSTS: Record<string, { costPerGB: number; currency: string; recommendation: string }> = {
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
export function getAdaptiveProfile(connectionInfo: ConnectionInfo): BandwidthProfile {
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
export function getRegionalRecommendation(countryCode: string): BandwidthProfile {
  const regional = REGIONAL_DATA_COSTS[countryCode];
  if (regional) {
    return BANDWIDTH_PROFILES[regional.recommendation];
  }
  return BANDWIDTH_PROFILES.medium;
}

/**
 * Transform media URL for bandwidth optimization
 */
export function getOptimizedMediaUrl(options: AdaptiveMediaOptions): string {
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
  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
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
  } else if (type === 'video') {
    if (!profile.videoEnabled) {
      // Return poster image instead
      params.set('format', 'poster');
      params.set('w', profile.maxImageWidth.toString());
    } else {
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
export function generateSrcSet(
  originalUrl: string,
  profile: BandwidthProfile
): { srcset: string; sizes: string } {
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
export function getOfflineCacheConfig(
  storageQuotaMB: number,
  profile: BandwidthProfile
): OfflineCacheConfig {
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
export function estimateDataUsage(content: {
  images: number;
  videos: number;
  text: number; // in KB
  profile: BandwidthProfile;
}): { totalMB: number; breakdown: Record<string, number> } {
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

  const profileKey = Object.keys(BANDWIDTH_PROFILES).find(
    k => BANDWIDTH_PROFILES[k].name === profile.name
  ) || 'medium';

  const imageData = images * (avgImageKB[profileKey as keyof typeof avgImageKB] || 80);
  const videoData = videos * (avgVideoMB[profileKey as keyof typeof avgVideoMB] || 5) * 1024;
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
export function getPreloadHints(
  profile: BandwidthProfile,
  currentPage: string
): { preload: string[]; prefetch: string[]; dns: string[] } {
  if (!profile.prefetchEnabled) {
    return { preload: [], prefetch: [], dns: [] };
  }

  // Base hints
  const hints = {
    preload: [] as string[],
    prefetch: [] as string[],
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
export function getAvailableProfiles(): BandwidthProfile[] {
  return Object.values(BANDWIDTH_PROFILES);
}

/**
 * Client-side service worker configuration
 */
export function getServiceWorkerConfig(profile: BandwidthProfile): Record<string, any> {
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
export function getCompressionConfig(profile: BandwidthProfile): {
  gzip: boolean;
  brotli: boolean;
  minifyJson: boolean;
  excludeFields: string[];
} {
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
export function detectConnectionFromHeaders(headers: Record<string, string>): ConnectionInfo {
  // Parse Network Information API hints
  const saveData = headers['save-data'] === 'on';
  const ect = headers['ect'] as ConnectionInfo['effectiveType'] || '4g';
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
export function createBandwidthMiddleware() {
  return (req: any, res: any, next: any) => {
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

    logger.debug('Bandwidth profile applied', {
      profile: profile.name,
      connectionType: connectionInfo.effectiveType,
      saveData: connectionInfo.saveData,
    });

    next();
  };
}

export default {
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
