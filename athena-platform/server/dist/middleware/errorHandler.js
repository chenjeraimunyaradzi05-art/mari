"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    const requestId = req.requestId;
    logger_1.logger.error(message, {
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
exports.errorHandler = errorHandler;
class ApiError extends Error {
    statusCode;
    isOperational;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
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