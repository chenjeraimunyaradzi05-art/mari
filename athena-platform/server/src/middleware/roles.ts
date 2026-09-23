/**
 * Role-based Authorization Middleware
 * Provides role checking functionality for protected routes
 *
 * The other two gates an account has to clear — the women-only check and the
 * minimum age — are `requireWomanVerified`, `requireWomanMember` and
 * `requireAdultAccount` in ./account-gates. They live in their own file
 * because they read the database, and this one is imported by a unit suite
 * that does not mock Prisma.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// User roles in order of increasing privilege
export type UserRole = 'USER' | 'CREATOR' | 'MENTOR' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 0,
  CREATOR: 1,
  MENTOR: 1,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/** The roles that reach other members' records, the moderation queue or money. */
const STAFF_ROLES: ReadonlySet<UserRole> = new Set(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);

/**
 * A staff account has to carry a second factor before any of its powers
 * work. Production always insists; elsewhere it can be switched off with
 * STAFF_TWO_FACTOR_REQUIRED=false, and the test suite (whose mocked
 * principals have no factor) runs without it unless told otherwise.
 */
export function staffTwoFactorRequired(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const raw = process.env.STAFF_TWO_FACTOR_REQUIRED;
  if (raw !== undefined) return raw !== 'false';
  return process.env.NODE_ENV !== 'test';
}

type Principal = { id: string; role?: string; twoFactorEnabled?: boolean };

/**
 * Null when the principal may proceed; otherwise the body of the refusal
 * that sends a staff member to enrol a second factor. The client reads the
 * `code` and opens the security settings. Both role middlewares (this file
 * and the one in auth.ts) go through here.
 */
export function staffTwoFactorRefusal(user: Principal): { error: string; code: 'TWO_FACTOR_REQUIRED'; setup: string } | null {
  const role = (user.role || 'USER') as UserRole;
  if (!STAFF_ROLES.has(role) || !staffTwoFactorRequired() || user.twoFactorEnabled === true) return null;
  logger.warn('Staff account without two-factor refused', { userId: user.id, userRole: role });
  return {
    error: 'Two-factor authentication is required for staff accounts',
    code: 'TWO_FACTOR_REQUIRED',
    setup: '/dashboard/settings/security',
  };
}

function twoFactorGate(user: Principal, res: Response): Response | null {
  const refusal = staffTwoFactorRefusal(user);
  return refusal ? res.status(403).json(refusal) : null;
}

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
      return twoFactorGate(user, res) ?? next();
    }

    // Check if user has one of the allowed roles
    if (allowedRoles.includes(userRole)) {
      return twoFactorGate(user, res) ?? next();
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
      return twoFactorGate(user, res) ?? next();
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

    // Admins always have access, once their second factor is enrolled
    if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.ADMIN) {
      return twoFactorGate(user, res) ?? next();
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
