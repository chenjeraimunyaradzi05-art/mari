import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { UnauthorizedError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    persona: string;
  };
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  persona: string;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as JwtPayload;

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, persona: true },
    });

    if (!user) {
      throw UnauthorizedError('User not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      persona: user.persona,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'fallback-secret'
        ) as JwtPayload;

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, role: true, persona: true },
        });

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
  } catch {
    // Ignore errors for optional auth
    next();
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(UnauthorizedError('Insufficient permissions'));
    }

    next();
  };
};

export const requirePremium = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw UnauthorizedError('Authentication required');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!subscription || subscription.tier === 'FREE') {
      throw UnauthorizedError('Premium subscription required');
    }

    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
      throw UnauthorizedError('Active subscription required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireSubscriptionTier = (...tiers: string[]) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw UnauthorizedError('Authentication required');
      }

      if (req.user.role === 'ADMIN') {
        return next();
      }

      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user.id },
      });

      if (!subscription) {
        throw UnauthorizedError('Active subscription required');
      }

      if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
        throw UnauthorizedError('Active subscription required');
      }

      if (tiers.length > 0 && !tiers.includes(subscription.tier)) {
        throw UnauthorizedError('Subscription tier upgrade required');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
