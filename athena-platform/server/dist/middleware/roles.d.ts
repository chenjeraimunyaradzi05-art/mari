/**
 * Role-based Authorization Middleware
 * Provides role checking functionality for protected routes
 */
import { Request, Response, NextFunction } from 'express';
export type UserRole = 'USER' | 'CREATOR' | 'MENTOR' | 'ADMIN' | 'SUPER_ADMIN';
/**
 * Middleware to require specific role(s)
 */
export declare function requireRole(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Middleware to require minimum role level
 */
export declare function requireMinRole(minRole: UserRole): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Check if user is the owner of a resource or has admin privileges
 */
export declare function requireOwnerOrAdmin(getUserId: (req: Request) => string): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
declare const _default: {
    requireRole: typeof requireRole;
    requireMinRole: typeof requireMinRole;
    requireOwnerOrAdmin: typeof requireOwnerOrAdmin;
};
export default _default;
//# sourceMappingURL=roles.d.ts.map