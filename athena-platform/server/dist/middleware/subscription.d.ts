/**
 * Subscription Enforcement Middleware
 * Dynamic middleware that checks user.subscriptionTier against route permissions
 * Phase 2: Backend Logic & Integrations
 */
import { Request, Response, NextFunction } from 'express';
import { SubscriptionTier } from '@prisma/client';
interface PermissionCheck {
    hasPermission: boolean;
    limit?: number;
    used?: number;
    upgradeRequired?: SubscriptionTier;
}
/**
 * Check if a tier has a specific permission
 */
declare function tierHasPermission(tier: SubscriptionTier, permission: string): PermissionCheck;
/**
 * Subscription enforcement middleware factory
 */
export declare function requireSubscription(requiredPermission: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Auto-detect required permission from route
 */
export declare function enforceSubscription(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get subscription features for a tier (for UI display)
 */
export declare function getTierFeatures(tier: SubscriptionTier): string[];
/**
 * Compare two tiers
 */
export declare function compareTiers(tier1: SubscriptionTier, tier2: SubscriptionTier): -1 | 0 | 1;
export declare const subscriptionMiddleware: {
    requireSubscription: typeof requireSubscription;
    enforceSubscription: typeof enforceSubscription;
    getTierFeatures: typeof getTierFeatures;
    compareTiers: typeof compareTiers;
    tierHasPermission: typeof tierHasPermission;
};
export {};
//# sourceMappingURL=subscription.d.ts.map