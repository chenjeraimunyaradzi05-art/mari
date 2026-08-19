"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const uuid_1 = require("uuid");
/**
 * Middleware that attaches a unique request ID to each incoming request.
 * Uses the `X-Request-Id` header if provided (e.g., from an upstream proxy),
 * otherwise generates a new UUID.
 *
 * The ID is also returned in the response headers for client-side correlation.
 */
function requestIdMiddleware(req, res, next) {
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && incomingId ? incomingId : (0, uuid_1.v4)();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}
//# sourceMappingURL=requestId.js.map