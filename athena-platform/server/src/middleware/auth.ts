import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { ForbiddenError, UnauthorizedError } from './errorHandler';
import { verifyToken } from '../utils/jwt';
import { sessionService } from '../services/session.service';
import { staffTwoFactorRefusal } from './roles';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    persona: string;
    /** Whether a second factor is enrolled; the role middleware insists on it for staff. */
    twoFactorEnabled?: boolean;
    /** The session behind this request, so a revocation can name it. */
    sessionId?: string;
  };
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  persona: string;
}

/**
 * Said to a suspended or banned principal on every surface, so the account
 * state is never inferable from the wording and moderation detail never leaks.
 */
export const SUSPENDED_ACCOUNT_MESSAGE =
  'This account has been suspended. Contact support if you believe this is a mistake.';

/**
 * What a staff member without a second factor may still reach: the routes
 * that enrol one, and the ones that read or end their own session. Every
 * other authenticated route is refused until the factor is enrolled, whether
 * it checks the role through the role middleware or inline. The client reads
 * the refusal's code and opens the security settings.
 */
const TWO_FACTOR_ENROLMENT_PREFIX = '/api/auth/';

export function isTwoFactorEnrolmentPath(path: string): boolean {
  return path.startsWith(TWO_FACTOR_ENROLMENT_PREFIX);
}

async function resolveAuthenticatedUser(token: string) {
  const decoded = verifyToken(token, 'access') as JwtPayload;
  const session = await sessionService.findActiveSessionByAccessToken(token);

  if (!session || session.userId !== decoded.userId) {
    throw UnauthorizedError('Session expired or revoked');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      role: true,
      persona: true,
      isSuspended: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    throw UnauthorizedError('User not found');
  }

  return { user, sessionId: session.id };
}

/**
 * The same rules the HTTP middleware applies, for a Socket.IO handshake: the
 * token must verify, its session must still be live (not logged out, not
 * revoked, not expired) and the account must not be suspended. Before this
 * the socket trusted any well-formed token, so logging out or being revoked
 * ended the HTTP session but left the live connection open.
 */
export type AuthenticatedPrincipal = NonNullable<AuthRequest['user']>;

export async function authenticateSocketToken(token: string): Promise<AuthenticatedPrincipal> {
  const { user, sessionId } = await resolveAuthenticatedUser(token);
  if (user.isSuspended) {
    throw ForbiddenError(SUSPENDED_ACCOUNT_MESSAGE);
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    persona: user.persona,
    twoFactorEnabled: user.twoFactorEnabled,
    sessionId,
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
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

    const { user, sessionId } = await resolveAuthenticatedUser(token);

    if (user.isSuspended) {
      throw ForbiddenError(SUSPENDED_ACCOUNT_MESSAGE);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      persona: user.persona,
      twoFactorEnabled: user.twoFactorEnabled,
      sessionId,
    };

    // A staff account is only as safe as its second factor. The role
    // middlewares refuse without one, but forty-odd routes check the role
    // inline, so the refusal has to happen here, before any handler runs.
    const refusal = staffTwoFactorRefusal(req.user);
    if (refusal && !isTwoFactorEnrolmentPath(req.originalUrl.split('?')[0])) {
      return res.status(403).json(refusal);
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(UnauthorizedError('Invalid token'));
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
        const { user, sessionId } = await resolveAuthenticatedUser(token);

        // A suspended account reads public surfaces as a stranger would rather
        // than failing the request outright.
        if (user && !user.isSuspended) {
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            persona: user.persona,
            twoFactorEnabled: user.twoFactorEnabled,
            sessionId,
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
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ForbiddenError('Insufficient permissions'));
    }

    // A staff role is only as safe as its second factor.
    const refusal = staffTwoFactorRefusal(req.user);
    if (refusal) {
      return res.status(403).json(refusal);
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
