import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../utils/metrics';
import { logger } from '../utils/logger';

/**
 * Middleware that records request duration and increments counters for Prometheus.
 * Also logs response time per request for observability.
 */
export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationNs = Number(end - start);
    const durationMs = durationNs / 1e6;
    const durationS = durationNs / 1e9;

    // Use originalUrl so we keep the mounted router prefix (e.g. /api/users/...)
    // even though req.path can become router-relative after routing.
    const rawPath = (req.originalUrl || req.url || req.path).split('?')[0];

    // Normalize path to avoid high-cardinality labels (replace UUIDs, IDs)
    const normalizedPath = normalizePath(rawPath);

    const labels = {
      method: req.method,
      path: normalizedPath,
      status: String(res.statusCode),
    };

    // Prometheus metrics
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationS);

    // Log response time with correlation ID
    logger.info('request completed', {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}

/**
 * Replace dynamic path segments (UUIDs, numeric IDs) with placeholders
 * to reduce Prometheus label cardinality.
 */
function normalizePath(path: string): string {
  return path
    // UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+/g, '/:id');
}
