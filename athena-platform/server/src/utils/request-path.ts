import type { Request } from 'express';
import { scrubAddress } from './log-scrub';

/**
 * The path of a request as a log line or an error report may carry it.
 *
 * `req.path` is the real path, and some routes put a credential in it: a
 * health-record share link (`/share/<token>`), a referee's form, an export
 * download. Logged as it came, each of those was written to the request log
 * the moment it was opened. When the route that answered is known, its own
 * pattern is the answer (`/api/wellness/share/:token`), which says everything
 * useful and nothing that opens the link. Express forgets which router a
 * request was inside once an error has left it, so a request that failed, or
 * that no route answered, falls back to the raw path with its ids and opaque
 * segments replaced.
 */
export function loggablePath(req: Pick<Request, 'route' | 'baseUrl' | 'originalUrl' | 'url' | 'path'>): string {
  const pattern: unknown = req.route?.path;
  if (typeof pattern === 'string' && req.baseUrl) return `${req.baseUrl}${pattern}`;

  return scrubAddress(req.originalUrl || req.url || req.path || '');
}
