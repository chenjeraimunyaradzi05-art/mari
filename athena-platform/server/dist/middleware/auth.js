"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSubscriptionTier = exports.requirePremium = exports.requireRole = exports.optionalAuth = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("./errorHandler");
const jwt_1 = require("../utils/jwt");
const session_service_1 = require("../services/session.service");
async function resolveAuthenticatedUser(token) {
    const decoded = (0, jwt_1.verifyToken)(token);
    const session = await session_service_1.sessionService.findActiveSessionByAccessToken(token);
    if (!session || session.userId !== decoded.userId) {
        throw (0, errorHandler_1.UnauthorizedError)('Session expired or revoked');
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, persona: true },
    });
    if (!user) {
        throw (0, errorHandler_1.UnauthorizedError)('User not found');
    }
    return user;
}
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw (0, errorHandler_1.UnauthorizedError)('No token provided');
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            throw (0, errorHandler_1.UnauthorizedError)('No token provided');
        }
        const user = await resolveAuthenticatedUser(token);
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            persona: user.persona,
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next((0, errorHandler_1.UnauthorizedError)('Invalid token'));
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next((0, errorHandler_1.UnauthorizedError)('Token expired'));
        }
        else {
            next(error);
        }
    }
};
exports.authenticate = authenticate;
const optionalAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const user = await resolveAuthenticatedUser(token);
                if (user) {
                    req.user = {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        persona: user.persona,
                    };
                }
            }
        }
        next();
    }
    catch {
        // Ignore errors for optional auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
const requireRole = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next((0, errorHandler_1.UnauthorizedError)('Authentication required'));
        }
        if (!roles.includes(req.user.role)) {
            return next((0, errorHandler_1.ForbiddenError)('Insufficient permissions'));
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePremium = async (req, _res, next) => {
    try {
        if (!req.user) {
            throw (0, errorHandler_1.UnauthorizedError)('Authentication required');
        }
        const subscription = await prisma_1.prisma.subscription.findUnique({
            where: { userId: req.user.id },
        });
        if (!subscription || subscription.tier === 'FREE') {
            throw (0, errorHandler_1.UnauthorizedError)('Premium subscription required');
        }
        if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
            throw (0, errorHandler_1.UnauthorizedError)('Active subscription required');
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requirePremium = requirePremium;
const requireSubscriptionTier = (...tiers) => {
    return async (req, _res, next) => {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.UnauthorizedError)('Authentication required');
            }
            if (req.user.role === 'ADMIN') {
                return next();
            }
            const subscription = await prisma_1.prisma.subscription.findUnique({
                where: { userId: req.user.id },
            });
            if (!subscription) {
                throw (0, errorHandler_1.UnauthorizedError)('Active subscription required');
            }
            if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
                throw (0, errorHandler_1.UnauthorizedError)('Active subscription required');
            }
            if (tiers.length > 0 && !tiers.includes(subscription.tier)) {
                throw (0, errorHandler_1.UnauthorizedError)('Subscription tier upgrade required');
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireSubscriptionTier = requireSubscriptionTier;
//# sourceMappingURL=auth.js.map