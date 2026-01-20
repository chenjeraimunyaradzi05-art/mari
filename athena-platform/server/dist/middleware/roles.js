"use strict";
/**
 * Role-based Authorization Middleware
 * Provides role checking functionality for protected routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
exports.requireMinRole = requireMinRole;
exports.requireOwnerOrAdmin = requireOwnerOrAdmin;
const logger_1 = require("../utils/logger");
const ROLE_HIERARCHY = {
    USER: 0,
    CREATOR: 1,
    MENTOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
};
/**
 * Middleware to require specific role(s)
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userRole = (user.role || 'USER');
        // Super admin always has access
        if (userRole === 'SUPER_ADMIN') {
            return next();
        }
        // Check if user has one of the allowed roles
        if (allowedRoles.includes(userRole)) {
            return next();
        }
        logger_1.logger.warn('Access denied: insufficient role', {
            userId: user.id,
            userRole,
            requiredRoles: allowedRoles,
        });
        return res.status(403).json({
            error: 'Access denied: insufficient privileges',
            required: allowedRoles,
        });
    };
}
/**
 * Middleware to require minimum role level
 */
function requireMinRole(minRole) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userRole = (user.role || 'USER');
        const userLevel = ROLE_HIERARCHY[userRole] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
        if (userLevel >= requiredLevel) {
            return next();
        }
        logger_1.logger.warn('Access denied: role level too low', {
            userId: user.id,
            userRole,
            requiredRole: minRole,
        });
        return res.status(403).json({
            error: 'Access denied: insufficient privileges',
            required: minRole,
        });
    };
}
/**
 * Check if user is the owner of a resource or has admin privileges
 */
function requireOwnerOrAdmin(getUserId) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const userRole = (user.role || 'USER');
        const resourceUserId = getUserId(req);
        // Admins always have access
        if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.ADMIN) {
            return next();
        }
        // Check ownership
        if (user.id === resourceUserId) {
            return next();
        }
        logger_1.logger.warn('Access denied: not owner or admin', {
            userId: user.id,
            resourceUserId,
        });
        return res.status(403).json({ error: 'Access denied' });
    };
}
exports.default = {
    requireRole,
    requireMinRole,
    requireOwnerOrAdmin,
};
//# sourceMappingURL=roles.js.map