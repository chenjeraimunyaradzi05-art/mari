import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ERROR_KEYS, i18nService, SupportedLocale } from '../services/i18n.service';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  i18nKey?: string;
  i18nParams?: Record<string, unknown>;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const locale = ((req as any).locale as SupportedLocale) || 'en';
  const rawMessage = err.message || 'Internal Server Error';
  const inferredKey = rawMessage.startsWith('errors.') ? rawMessage : undefined;
  const i18nKey = err.i18nKey || inferredKey || ERROR_KEYS.SERVER_INTERNAL_ERROR;
  const message = i18nService.tSync(i18nKey, err.i18nParams as Record<string, string | number> | undefined, locale);
  const requestId = (req as any).requestId as string | undefined;

  logger.error(message, {
    requestId,
    statusCode,
    method: req.method,
    path: req.path,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message,
    i18nKey,
    ...(err.i18nParams && { i18nParams: err.i18nParams }),
    ...(requestId && { requestId }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      debugMessage: rawMessage,
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
