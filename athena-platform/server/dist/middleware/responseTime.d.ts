import { Request, Response, NextFunction } from 'express';
/**
 * Middleware that records request duration and increments counters for Prometheus.
 * Also logs response time per request for observability.
 */
export declare function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=responseTime.d.ts.map