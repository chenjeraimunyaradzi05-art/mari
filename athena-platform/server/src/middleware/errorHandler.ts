import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
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
    ...(requestId && { requestId }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: Record<string, unknown>;

  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
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
