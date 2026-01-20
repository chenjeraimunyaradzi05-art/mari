import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

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
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId ? incomingId : uuidv4();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
