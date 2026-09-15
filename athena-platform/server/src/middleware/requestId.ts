import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    /** Unique request correlation ID */
    requestId: string;
  }
}

/**
 * Middleware that attaches a unique request ID to each incoming request.
 * Uses the `X-Request-Id` header if provided (e.g., from an upstream proxy),
 * otherwise generates a new UUID.
 *
 * The ID is also returned in the response headers for client-side correlation.
 */
// What an upstream id may look like: an opaque token, not a payload. Anything
// else is replaced rather than echoed into every log line and response.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function acceptableRequestId(incoming: unknown): string | null {
  return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : null;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = acceptableRequestId(req.headers['x-request-id']) ?? uuidv4();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
