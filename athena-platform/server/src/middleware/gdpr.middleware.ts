/**
 * GDPR Compliance Middleware
 * Adds GDPR headers and validates consent
 * Phase 4: UK/EU Market Launch
 */

import { Request, Response, NextFunction } from 'express';
import { AuditAction, ConsentType } from '@prisma/client';
import { logAudit } from '../utils/audit';
import { consentService } from '../services/consent.service';
import { logger } from '../utils/logger';

// EU/EEA country codes
const GDPR_REGIONS = [
  'GB', 'UK', // United Kingdom
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', // EU
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU
  'IS', 'LI', 'NO', // EEA
  'CH', // Switzerland (FADP)
];

interface GDPRRequest extends Request {
  gdpr?: {
    isGDPRRegion: boolean;
    isUKRegion: boolean;
    region: string | null;
    consent: Record<string, boolean>;
  };
}

/**
 * Middleware to detect user's region and set GDPR context
 */
export function gdprRegionMiddleware(req: GDPRRequest, res: Response, next: NextFunction) {
  try {
    // Try to detect region from headers
    let region: string | null = null;

    // Check CF-IPCountry header (Cloudflare)
    const cfCountry = req.headers['cf-ipcountry'] as string;
    if (cfCountry) {
      region = cfCountry.toUpperCase();
    }

    // Check X-Country header (custom load balancer)
    const xCountry = req.headers['x-country'] as string;
    if (!region && xCountry) {
      region = xCountry.toUpperCase();
    }

    // Check Accept-Language as fallback
    const acceptLang = req.headers['accept-language'] as string;
    if (!region && acceptLang) {
      const match = acceptLang.match(/-([A-Z]{2})/i);
      if (match) {
        region = match[1].toUpperCase();
      }
    }

    // Set GDPR context
    const isGDPRRegion = region ? GDPR_REGIONS.includes(region) : false;
    const isUKRegion = region === 'GB' || region === 'UK';

    req.gdpr = {
      isGDPRRegion,
      isUKRegion,
      region,
      consent: {},
    };

    // Set response headers
    if (isGDPRRegion) {
      res.setHeader('X-GDPR-Region', region || 'unknown');
      res.setHeader('X-Data-Protection', isUKRegion ? 'UK-GDPR' : 'EU-GDPR');
    }

    // Always set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    next();
  } catch (error) {
    // Don't block request on GDPR middleware error
    logger.error('GDPR middleware error', { error });
    next();
  }
}

/**
 * Middleware to require explicit consent for specific endpoints
 */
export function requireConsent(consentType: ConsentType) {
  return async (req: GDPRRequest, res: Response, next: NextFunction) => {
    // Outside the GDPR/EEA/UK footprint consent is not the basis this
    // processing runs on, so there is nothing for the gate to enforce.
    if (!req.gdpr?.isGDPRRegion) {
      return next();
    }

    // Check if user has given consent
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    try {
      // consentService.hasConsent is the one reader: it applies the record's own
      // expiry and any Article 18 restriction standing over it, so this gate and
      // the rest of the platform can never disagree about what was agreed to.
      if (await consentService.hasConsent(userId, consentType)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: `Consent required for ${consentType}`,
        code: 'CONSENT_REQUIRED',
        consentType,
      });
    } catch (error) {
      // A gate that opens when its own lookup fails is not a gate. Processing we
      // cannot show was agreed to does not happen.
      logger.error('Consent check error', { error, consentType });
      return res.status(503).json({
        success: false,
        error: 'Unable to verify consent right now. Please try again.',
        code: 'CONSENT_CHECK_UNAVAILABLE',
      });
    }
  };
}

/**
 * Middleware to add GDPR-compliant response headers
 */
export function gdprResponseHeaders(req: Request, res: Response, next: NextFunction) {
  // Data processing notice
  res.setHeader('X-Data-Processing', 'See /privacy for details');
  
  // Right to access
  res.setHeader('X-Data-Access', '/api/gdpr/dsar/export');
  
  // Right to deletion
  res.setHeader('X-Data-Deletion', '/api/gdpr/dsar/delete');
  
  // Cookie policy
  res.setHeader('X-Cookie-Policy', '/cookies');

  next();
}

/**
 * Middleware to log data access for audit trail
 */
export function auditDataAccess(dataCategory: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;

    // Log after response is sent
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // The audit row is evidence, not part of the answer, so a failure to
        // write it must never reach the caller who has already been served.
        logAudit({
          actorUserId: userId || null,
          targetUserId: userId || null,
          action: AuditAction.DATA_ACCESS,
          // Truncated by anonymizeIP inside the GDPR footprint; the raw address
          // elsewhere. An accountability record does not need a full address to
          // place a request.
          ipAddress: auditIpAddress(req),
          userAgent: req.headers['user-agent'] || null,
          metadata: {
            resourceType: dataCategory,
            resourceId: req.params.id || req.params.requestId || 'list',
            method: req.method,
            // req.path is relative to the router's mount point, so on its own it
            // would not say which endpoint was read.
            path: `${req.baseUrl}${req.path}`,
            timestamp: new Date().toISOString(),
          },
        }).catch((error) => logger.error('Audit log error', { error }));
      }
    });

    next();
  };
}

/**
 * The address to file against an audit row: the truncated one where
 * `anonymizeIP` produced it, otherwise whatever Express reports.
 */
export function auditIpAddress(req: Request): string | null {
  return (req as any).anonymizedIP || req.ip || null;
}

/**
 * Middleware to enforce data minimization
 * Removes fields that aren't necessary for the response
 */
export function dataMinimization(allowedFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function(data: any) {
      if (data && typeof data === 'object') {
        // If it's a paginated response
        if (data.data && Array.isArray(data.data)) {
          data.data = data.data.map((item: any) => filterFields(item, allowedFields));
        } else if (Array.isArray(data)) {
          data = data.map((item: any) => filterFields(item, allowedFields));
        } else if (data.data && typeof data.data === 'object') {
          data.data = filterFields(data.data, allowedFields);
        }
      }
      return originalJson(data);
    };

    next();
  };
}

function filterFields(obj: any, allowedFields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj;

  const filtered: any = {};
  for (const field of allowedFields) {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  }
  return filtered;
}

/**
 * Middleware to anonymize IP addresses for GDPR compliance
 */
export function anonymizeIP(req: Request, res: Response, next: NextFunction) {
  const gdprReq = req as GDPRRequest;
  
  if (gdprReq.gdpr?.isGDPRRegion && req.ip) {
    // Anonymize by removing last octet for IPv4 or last 80 bits for IPv6
    const ip = req.ip;
    if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      if (parts.length >= 4) {
        parts.splice(4);
        (req as any).anonymizedIP = parts.join(':') + '::';
      }
    } else {
      // IPv4
      const parts = ip.split('.');
      if (parts.length === 4) {
        parts[3] = '0';
        (req as any).anonymizedIP = parts.join('.');
      }
    }
  }

  next();
}

/**
 * Rate limiter for DSAR requests (prevent abuse)
 */
const dsarRateLimits = new Map<string, { count: number; resetAt: number }>();

export function dsarRateLimit(
  maxRequests: number = 5,
  windowMs: number = 3600000,
  // Article 12(5) lets us refuse a manifestly excessive request, not a different
  // right the same member happens to exercise afterwards. Separate buckets keep
  // somebody correcting a typo in their surname from locking themselves out of
  // downloading their data.
  bucket: string = 'dsar'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const key = `${bucket}:${userId}`;
    const now = Date.now();
    const userLimit = dsarRateLimits.get(key);

    if (userLimit && now < userLimit.resetAt) {
      if (userLimit.count >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Too many data requests. Please try again later.',
          retryAfter: Math.ceil((userLimit.resetAt - now) / 1000),
        });
      }
      userLimit.count++;
    } else {
      dsarRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      for (const [entryKey, value] of dsarRateLimits.entries()) {
        if (now > value.resetAt) {
          dsarRateLimits.delete(entryKey);
        }
      }
    }

    next();
  };
}

export default {
  gdprRegionMiddleware,
  requireConsent,
  gdprResponseHeaders,
  auditDataAccess,
  auditIpAddress,
  dataMinimization,
  anonymizeIP,
  dsarRateLimit,
};
