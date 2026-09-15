import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
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
  const message = i18nKey
    ? i18nService.tSync(i18nKey, err.i18nParams as Record<string, string | number> | undefined, locale)
    : (operational && statusCode < 500)
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

  const hasDebugAccess = debugHeaderMatches(req.headers['x-debug-auth'], process.env.DEBUG_SECRET);

  const showDebug =
    process.env.NODE_ENV !== 'production' || hasDebugAccess;

  res.status(statusCode).json({
    success: false,
    message,
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
