/**
 * GDPR Compliance Middleware
 * Adds GDPR headers and validates consent
 * Phase 4: UK/EU Market Launch
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function gdprRegionMiddleware(req: GDPRRequest, res: Response, next: NextFunction): void;
/**
 * Middleware to require explicit consent for specific endpoints
 */
export declare function requireConsent(consentType: string): (req: GDPRRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Middleware to add GDPR-compliant response headers
 */
export declare function gdprResponseHeaders(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to log data access for audit trail
 */
export declare function auditDataAccess(dataCategory: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to enforce data minimization
 * Removes fields that aren't necessary for the response
 */
export declare function dataMinimization(allowedFields: string[]): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware to anonymize IP addresses for GDPR compliance
 */
export declare function anonymizeIP(req: Request, res: Response, next: NextFunction): void;
export declare function dsarRateLimit(maxRequests?: number, windowMs?: number): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
declare const _default: {
    gdprRegionMiddleware: typeof gdprRegionMiddleware;
    requireConsent: typeof requireConsent;
    gdprResponseHeaders: typeof gdprResponseHeaders;
    auditDataAccess: typeof auditDataAccess;
    dataMinimization: typeof dataMinimization;
    anonymizeIP: typeof anonymizeIP;
    dsarRateLimit: typeof dsarRateLimit;
};
export default _default;
//# sourceMappingURL=gdpr.middleware.d.ts.map