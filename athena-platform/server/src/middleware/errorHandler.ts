import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { captureException } from '../utils/sentry';
import { ERROR_KEYS, i18nService, SupportedLocale } from '../services/i18n.service';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  i18nKey?: string;
  i18nParams?: Record<string, unknown>;
}

/**
 * Whether the request carries the debug secret. Compared in constant time so
 * the response timing of a wrong guess says nothing about how much of it was
 * right.
 */
export function debugHeaderMatches(header: string | string[] | undefined, secret: string | undefined): boolean {
  if (!secret || typeof header !== 'string') return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Errors raised by the libraries in front of the handlers, given the status
 * and wording a member can act on. Without this a file over the size limit,
 * a body over the JSON limit, malformed JSON and a failed zod parse all
 * surfaced as 500 "An unexpected error occurred", and were logged as if the
 * server had broken.
 */
export function describeKnownError(err: AppError & { code?: string; type?: string; issues?: Array<{ message?: string; path?: Array<string | number> }> }): { statusCode: number; message: string } | null {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return { statusCode: 413, message: 'The file is larger than this upload allows' };
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return { statusCode: 400, message: 'Too many files, or a file in an unexpected field' };
    return { statusCode: 400, message: 'The upload could not be read' };
  }
  if (err.type === 'entity.too.large') return { statusCode: 413, message: 'The request body is too large' };
  if (err.type === 'entity.parse.failed') return { statusCode: 400, message: 'The request body is not valid JSON' };
  if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') return { statusCode: 415, message: 'The request body encoding is not supported' };
  if (err instanceof ZodError || (err.name === 'ZodError' && Array.isArray(err.issues))) {
    const first = err.issues?.[0];
    const where = first?.path?.length ? `${first.path.join('.')}: ` : '';
    return { statusCode: 400, message: `${where}${first?.message || 'Invalid request'}` };
  }
  return null;
}

/**
 * Whether a failure goes to Sentry as well as to the log.
 *
 * Every 5xx does, bar one kind. An operational 503 is this deployment saying
 * it cannot do something until an operator changes its configuration —
 * payments not configured, the moderation provider missing — and it is raised
 * on every request to that feature, by design, for as long as the gap lasts.
 * /health/launch-readiness already names each of those gaps; reporting them
 * here as well would spend the Sentry quota once per member request on a fact
 * the operator has a page for, and bury the crashes it exists to surface. A
 * 503 that was not raised on purpose is not operational and is still reported.
 */
export function reportsToSentry(statusCode: number, operational: boolean | undefined): boolean {
  if (statusCode < 500) return false;
  return !(operational && statusCode === 503);
}

/**
 * Gives an error body both of the names the client reads its reason from.
 *
 * The routes answer a refusal in two shapes. The ones that throw reach
 * errorHandler and answer `{ success: false, message }`; about a hundred more
 * answer inline with `res.status(4xx).json({ error: '...' })`. The client
 * guessed per screen which one it would get, and every wrong guess rendered a
 * generic "Something went wrong" in place of a reason written for the member.
 * Rewriting every inline answer is the long fix. This is the one that makes
 * the guess irrelevant in the meantime: on any response of 400 or above whose
 * body carries a string under one name and not the other, the same string is
 * copied across. Nothing is removed or reworded, a body with both names or
 * with neither is left exactly as it was, and success responses are never
 * touched.
 */
export function withBothErrorNames(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  const message = typeof record.message === 'string' && record.message ? record.message : undefined;
  const error = typeof record.error === 'string' && record.error ? record.error : undefined;
  if ((message && error) || (!message && !error)) return body;
  // A name already in use for something that is not a sentence (a list of
  // field errors, say) is kept exactly as it is: copying over it would
  // destroy it.
  if ((record.error !== undefined && !error) || (record.message !== undefined && !message)) return body;
  return {
    ...(record.success === undefined ? { success: false } : {}),
    ...record,
    message: message ?? error,
    error: error ?? message,
  };
}

/**
 * Express middleware that applies withBothErrorNames to every JSON error
 * response. It has to be mounted before the routers so that it wraps
 * `res.json` before a handler calls it.
 */
export function normalizeErrorBodies(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body?: unknown) => json(res.statusCode >= 400 ? withBothErrorNames(body) : body)) as Response['json'];
  next();
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Some library errors keep their message behind a getter, so the answer is
  // worked out beside the error rather than written onto it.
  const known = describeKnownError(err);
  const statusCode = known?.statusCode ?? err.statusCode ?? 500;
  const operational = known ? true : err.isOperational;
  const locale = ((req as any).locale as SupportedLocale) || 'en';
  const rawMessage = known?.message ?? (err.message || 'Internal Server Error');
  const inferredKey = rawMessage.startsWith('errors.') ? rawMessage : undefined;
  const i18nKey = err.i18nKey || inferredKey;

  // For operational errors (4xx) without an i18n key, use the original message
  // so validation messages like "Invalid or expired invite code" reach the client.
  // Only use the generic "An unexpected error occurred" for 5xx / unknown errors.
  //
  // 503 is the exception, and only when we raised it ourselves. An operational
  // 503 is not a failure to hide: it is this deployment saying it cannot do the
  // thing right now, and the thirteen places that raise one all write a sentence
  // for the member — payments not configured, livestream webhooks not
  // configured, the moderation provider missing. Every one of those reached her
  // as "An unexpected error occurred. Please try again", which invites her to
  // try again at something that cannot work until an operator changes the
  // deployment. An unexpected crash is not operational and still gets the
  // generic wording, so no internals leak by this route.
  const keepsItsWording = operational && (statusCode < 500 || statusCode === 503);
  const message = i18nKey
    ? i18nService.tSync(i18nKey, err.i18nParams as Record<string, string | number> | undefined, locale)
    : keepsItsWording
      ? rawMessage
      : i18nService.tSync(ERROR_KEYS.SERVER_INTERNAL_ERROR, undefined, locale);
  const requestId = (req as any).requestId as string | undefined;

  // A refused request is the member's to fix; only a failure of ours is an error.
  const log = statusCode >= 500 ? logger.error : logger.warn;
  log(message, {
    requestId,
    statusCode,
    method: req.method,
    path: req.path,
    ...(statusCode >= 500 ? { stack: err.stack } : {}),
  });

  // Sentry was configured and heard about almost nothing. A route that threw
  // arrived here, was written to the winston log and answered 500, and that was
  // the end of it: nothing on this path called Sentry, there is no
  // setupExpressErrorHandler in index.ts, and the captureConsoleIntegration in
  // utils/sentry.ts listens to a global console this codebase does not write
  // to. Only an uncaught exception or an unhandled rejection at the process
  // level was ever reported, so a route that 500ed on every request looked, in
  // Sentry, like a quiet night.
  //
  // Every failure of ours is reported from here now, with the request id that
  // ties it to the log line above. The body, the query string and the headers
  // are not attached: they can carry a member's messages, her address or her
  // safety plan, and Sentry is a third party.
  if (reportsToSentry(statusCode, operational)) {
    captureException(err, { requestId, statusCode, method: req.method, path: req.path });
  }

  const hasDebugAccess = debugHeaderMatches(req.headers['x-debug-auth'], process.env.DEBUG_SECRET);

  const showDebug =
    process.env.NODE_ENV !== 'production' || hasDebugAccess;

  res.status(statusCode).json({
    success: false,
    message,
    // The same sentence under the other name. About ninety client screens read
    // `response.data.error` and about a hundred and ninety read
    // `response.data.message`, because the routes answer in both shapes; a
    // screen that chose `error` showed its generic fallback for every reason
    // this handler gave, including the ones written for the member — the
    // insurance page's "you have already applied" was one. Answering under
    // both names means neither guess is wrong. See normalizeErrorBodies below
    // for the other direction.
    error: message,
    i18nKey,
    ...(err.i18nParams && { i18nParams: err.i18nParams }),
    ...(requestId && { requestId }),
    ...(showDebug && {
      debugMessage: rawMessage,
      debugStack: (err.stack || '').split('\n').slice(0, 5).join('\n'),
    }),
  });
};

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: Record<string, unknown>;
  i18nKey?: string;
  i18nParams?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
    i18nKey?: string,
    i18nParams?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    this.i18nKey = i18nKey;
    this.i18nParams = i18nParams;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export const BadRequestError = (message = 'Bad Request') => new ApiError(400, message);
export const UnauthorizedError = (message = 'Unauthorized') => new ApiError(401, message);
export const ForbiddenError = (message = 'Forbidden') => new ApiError(403, message);
export const NotFoundError = (message = 'Not Found') => new ApiError(404, message);
export const ConflictError = (message = 'Conflict') => new ApiError(409, message);
export const InternalServerError = (message = 'Internal Server Error') => new ApiError(500, message);
