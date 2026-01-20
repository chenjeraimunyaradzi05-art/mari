"use strict";
/**
 * GDPR Compliance Middleware
 * Adds GDPR headers and validates consent
 * Phase 4: UK/EU Market Launch
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.gdprRegionMiddleware = gdprRegionMiddleware;
exports.requireConsent = requireConsent;
exports.gdprResponseHeaders = gdprResponseHeaders;
exports.auditDataAccess = auditDataAccess;
exports.dataMinimization = dataMinimization;
exports.anonymizeIP = anonymizeIP;
exports.dsarRateLimit = dsarRateLimit;
// EU/EEA country codes
const GDPR_REGIONS = [
    'GB', 'UK', // United Kingdom
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', // EU
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU
    'IS', 'LI', 'NO', // EEA
    'CH', // Switzerland (FADP)
];
/**
 * Middleware to detect user's region and set GDPR context
 */
function gdprRegionMiddleware(req, res, next) {
    try {
        // Try to detect region from headers
        let region = null;
        // Check CF-IPCountry header (Cloudflare)
        const cfCountry = req.headers['cf-ipcountry'];
        if (cfCountry) {
            region = cfCountry.toUpperCase();
        }
        // Check X-Country header (custom load balancer)
        const xCountry = req.headers['x-country'];
        if (!region && xCountry) {
            region = xCountry.toUpperCase();
        }
        // Check Accept-Language as fallback
        const acceptLang = req.headers['accept-language'];
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
    }
    catch (error) {
        // Don't block request on GDPR middleware error
        console.error('GDPR middleware error:', error);
        next();
    }
}
/**
 * Middleware to require explicit consent for specific endpoints
 */
function requireConsent(consentType) {
    return async (req, res, next) => {
        // Skip consent check for non-GDPR regions
        if (!req.gdpr?.isGDPRRegion) {
            return next();
        }
        // Check if user has given consent
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        try {
            const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
            const prisma = new PrismaClient();
            const consent = await prisma.consentRecord.findFirst({
                where: {
                    userId,
                    consentType: consentType,
                    status: 'GRANTED',
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                },
            });
            await prisma.$disconnect();
            if (!consent) {
                return res.status(403).json({
                    success: false,
                    error: `Consent required for ${consentType}`,
                    code: 'CONSENT_REQUIRED',
                    consentType,
                });
            }
            next();
        }
        catch (error) {
            console.error('Consent check error:', error);
            // Allow request to proceed on error (fail open for better UX)
            next();
        }
    };
}
/**
 * Middleware to add GDPR-compliant response headers
 */
function gdprResponseHeaders(req, res, next) {
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
function auditDataAccess(dataCategory) {
    return async (req, res, next) => {
        const userId = req.user?.id;
        // Log after response is sent
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
                    const prisma = new PrismaClient();
                    await prisma.auditLog.create({
                        data: {
                            actorUserId: userId || null,
                            action: 'DATA_ACCESS',
                            ipAddress: req.ip,
                            userAgent: req.headers['user-agent'],
                            metadata: {
                                resourceType: dataCategory,
                                resourceId: req.params.id || 'list',
                                method: req.method,
                                path: req.path,
                                timestamp: new Date().toISOString(),
                            },
                        },
                    });
                    await prisma.$disconnect();
                }
                catch (error) {
                    console.error('Audit log error:', error);
                }
            }
        });
        next();
    };
}
/**
 * Middleware to enforce data minimization
 * Removes fields that aren't necessary for the response
 */
function dataMinimization(allowedFields) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            if (data && typeof data === 'object') {
                // If it's a paginated response
                if (data.data && Array.isArray(data.data)) {
                    data.data = data.data.map((item) => filterFields(item, allowedFields));
                }
                else if (Array.isArray(data)) {
                    data = data.map((item) => filterFields(item, allowedFields));
                }
                else if (data.data && typeof data.data === 'object') {
                    data.data = filterFields(data.data, allowedFields);
                }
            }
            return originalJson(data);
        };
        next();
    };
}
function filterFields(obj, allowedFields) {
    if (!obj || typeof obj !== 'object')
        return obj;
    const filtered = {};
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
function anonymizeIP(req, res, next) {
    const gdprReq = req;
    if (gdprReq.gdpr?.isGDPRRegion && req.ip) {
        // Anonymize by removing last octet for IPv4 or last 80 bits for IPv6
        const ip = req.ip;
        if (ip.includes(':')) {
            // IPv6
            const parts = ip.split(':');
            if (parts.length >= 4) {
                parts.splice(4);
                req.anonymizedIP = parts.join(':') + '::';
            }
        }
        else {
            // IPv4
            const parts = ip.split('.');
            if (parts.length === 4) {
                parts[3] = '0';
                req.anonymizedIP = parts.join('.');
            }
        }
    }
    next();
}
/**
 * Rate limiter for DSAR requests (prevent abuse)
 */
const dsarRateLimits = new Map();
function dsarRateLimit(maxRequests = 5, windowMs = 3600000) {
    return (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        const now = Date.now();
        const userLimit = dsarRateLimits.get(userId);
        if (userLimit && now < userLimit.resetAt) {
            if (userLimit.count >= maxRequests) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many data requests. Please try again later.',
                    retryAfter: Math.ceil((userLimit.resetAt - now) / 1000),
                });
            }
            userLimit.count++;
        }
        else {
            dsarRateLimits.set(userId, { count: 1, resetAt: now + windowMs });
        }
        // Clean up old entries periodically
        if (Math.random() < 0.01) {
            for (const [key, value] of dsarRateLimits.entries()) {
                if (now > value.resetAt) {
                    dsarRateLimits.delete(key);
                }
            }
        }
        next();
    };
}
exports.default = {
    gdprRegionMiddleware,
    requireConsent,
    gdprResponseHeaders,
    auditDataAccess,
    dataMinimization,
    anonymizeIP,
    dsarRateLimit,
};
//# sourceMappingURL=gdpr.middleware.js.map