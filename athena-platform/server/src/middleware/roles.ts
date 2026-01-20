/**
 * Role-based Authorization Middleware
 * Provides role checking functionality for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// User roles in order of increasing privilege
export type UserRole = 'USER' | 'CREATOR' | 'MENTOR' | 'ADMIN' | 'SUPER_ADMIN';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 0,
  CREATOR: 1,
  MENTOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/**
 * Middleware to require specific role(s)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = (user.role || 'USER') as UserRole;

    // Super admin always has access
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Check if user has one of the allowed roles
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    logger.warn('Access denied: insufficient role', {
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
export function requireMinRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = (user.role || 'USER') as UserRole;
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel >= requiredLevel) {
      return next();
    }

    logger.warn('Access denied: role level too low', {
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
export function requireOwnerOrAdmin(getUserId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = (user.role || 'USER') as UserRole;
    const resourceUserId = getUserId(req);

    // Admins always have access
    if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.ADMIN) {
      return next();
    }

    // Check ownership
    if (user.id === resourceUserId) {
      return next();
    }

    logger.warn('Access denied: not owner or admin', {
      userId: user.id,
      resourceUserId,
    });

    return res.status(403).json({ error: 'Access denied' });
  };
}

export default {
  requireRole,
  requireMinRole,
  requireOwnerOrAdmin,
};
