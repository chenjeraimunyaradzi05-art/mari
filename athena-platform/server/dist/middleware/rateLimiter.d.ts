/**
 * Rate Limiting Middleware
 * ========================
 * Advanced rate limiting using Redis with sliding window algorithm.
 */
import { Request, Response, NextFunction } from 'express';
interface RateLimitConfig {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
    handler?: (req: Request, res: Response) => void;
}
declare const RATE_LIMITS: {
    anonymous: {
        windowMs: number;
        max: number;
    };
    free: {
        windowMs: number;
        max: number;
    };
    premium: {
        windowMs: number;
        max: number;
    };
    enterprise: {
        windowMs: number;
        max: number;
    };
    auth: {
        windowMs: number;
        max: number;
    };
    search: {
        windowMs: number;
        max: number;
    };
    upload: {
        windowMs: number;
        max: number;
    };
    ai: {
        windowMs: number;
        max: number;
    };
};
export declare function createRateLimiter(config?: Partial<RateLimitConfig>): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Standard API rate limiter - adjusts based on user tier
 */
export declare const apiLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Strict limiter for authentication endpoints
 */
export declare const authLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Search endpoint limiter
 */
export declare const searchLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Upload endpoint limiter
 */
export declare const uploadLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * AI/ML endpoint limiter
 */
export declare const aiLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export { RATE_LIMITS };
//# sourceMappingURL=rateLimiter.d.ts.map