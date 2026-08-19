"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const i18n_service_1 = require("../services/i18n.service");
const errorHandler = (err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const locale = req.locale || 'en';
    const rawMessage = err.message || 'Internal Server Error';
    const inferredKey = rawMessage.startsWith('errors.') ? rawMessage : undefined;
    const i18nKey = err.i18nKey || inferredKey;
    // For operational errors (4xx) without an i18n key, use the original message
    // so validation messages like "Invalid or expired invite code" reach the client.
    // Only use the generic "An unexpected error occurred" for 5xx / unknown errors.
    const message = i18nKey
        ? i18n_service_1.i18nService.tSync(i18nKey, err.i18nParams, locale)
        : (err.isOperational && statusCode < 500)
            ? rawMessage
            : i18n_service_1.i18nService.tSync(i18n_service_1.ERROR_KEYS.SERVER_INTERNAL_ERROR, undefined, locale);
    const requestId = req.requestId;
    logger_1.logger.error(message, {
        requestId,
        statusCode,
        method: req.method,
        path: req.path,
        stack: err.stack,
    });
    const hasDebugAccess = !!process.env.DEBUG_SECRET &&
        req.headers['x-debug-auth'] === process.env.DEBUG_SECRET;
    const showDebug = process.env.NODE_ENV !== 'production' || hasDebugAccess;
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
exports.errorHandler = errorHandler;
class ApiError extends Error {
    statusCode;
    isOperational;
    details;
    i18nKey;
    i18nParams;
    constructor(statusCode, message, details, i18nKey, i18nParams) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.details = details;
        this.i18nKey = i18nKey;
        this.i18nParams = i18nParams;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
// Common error types
const BadRequestError = (message = 'Bad Request') => new ApiError(400, message);
exports.BadRequestError = BadRequestError;
const UnauthorizedError = (message = 'Unauthorized') => new ApiError(401, message);
exports.UnauthorizedError = UnauthorizedError;
const ForbiddenError = (message = 'Forbidden') => new ApiError(403, message);
exports.ForbiddenError = ForbiddenError;
const NotFoundError = (message = 'Not Found') => new ApiError(404, message);
exports.NotFoundError = NotFoundError;
const ConflictError = (message = 'Conflict') => new ApiError(409, message);
exports.ConflictError = ConflictError;
const InternalServerError = (message = 'Internal Server Error') => new ApiError(500, message);
exports.InternalServerError = InternalServerError;
//# sourceMappingURL=errorHandler.js.map