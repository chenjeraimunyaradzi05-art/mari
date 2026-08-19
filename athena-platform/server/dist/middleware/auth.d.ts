import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        persona: string;
    };
}
export declare const authenticate: (req: AuthRequest, _res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAuth: (req: AuthRequest, _res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (...roles: string[]) => (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const requirePremium: (req: AuthRequest, _res: Response, next: NextFunction) => Promise<void>;
export declare const requireSubscriptionTier: (...tiers: string[]) => (req: AuthRequest, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map