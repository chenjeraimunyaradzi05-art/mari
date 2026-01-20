import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            /** Unique request correlation ID */
            requestId: string;
        }
    }
}
/**
 * Middleware that attaches a unique request ID to each incoming request.
 * Uses the `X-Request-Id` header if provided (e.g., from an upstream proxy),
 * otherwise generates a new UUID.
 *
 * The ID is also returned in the response headers for client-side correlation.
 */
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=requestId.d.ts.map