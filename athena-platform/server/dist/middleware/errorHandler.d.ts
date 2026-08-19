import { Request, Response, NextFunction } from 'express';
export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
    i18nKey?: string;
    i18nParams?: Record<string, unknown>;
}
export declare const errorHandler: (err: AppError, req: Request, res: Response, _next: NextFunction) => void;
export declare class ApiError extends Error {
    statusCode: number;
    isOperational: boolean;
    details?: Record<string, unknown>;
    i18nKey?: string;
    i18nParams?: Record<string, unknown>;
    constructor(statusCode: number, message: string, details?: Record<string, unknown>, i18nKey?: string, i18nParams?: Record<string, unknown>);
}
export declare const BadRequestError: (message?: string) => ApiError;
export declare const UnauthorizedError: (message?: string) => ApiError;
export declare const ForbiddenError: (message?: string) => ApiError;
export declare const NotFoundError: (message?: string) => ApiError;
export declare const ConflictError: (message?: string) => ApiError;
export declare const InternalServerError: (message?: string) => ApiError;
//# sourceMappingURL=errorHandler.d.ts.map