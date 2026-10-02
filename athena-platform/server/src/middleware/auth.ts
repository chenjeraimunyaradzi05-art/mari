import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { ForbiddenError, UnauthorizedError } from './errorHandler';
import { verifyToken } from '../utils/jwt';
import { sessionService } from '../services/session.service';
import { staffTwoFactorRefusal } from './roles';
import { accountStandingRefusal } from './account-standing';
import { logger } from '../utils/logger';
import { hasLiveEntitlement, isSubscriptionLive } from '../utils/subscription-entitlement';

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
 *
 * It used to end "Contact support if you believe this is a mistake", which
 * pointed at a support route a suspended member cannot reach: the help desk
 * sits behind the same sign-in that has just refused her. The sign-in page is
 * where the working appeal is (POST /api/auth/suspension-appeal), on the web
 * and in the app. Keep the word "suspended": both sign-in screens look for it
 * to open the appeal.
 */
export const SUSPENDED_ACCOUNT_MESSAGE =
  'This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.';

/**
 * Said to a member whose account she has locked herself (POST /auth/lock, or
 * the "this was not me" link in a new-device sign-in email), on every surface
 * that refuses it. It is deliberately not the suspended wording: nobody on
 * staff did this, there is nothing to appeal, and the way back is the link in
 * the email she was sent. Keep the word "locked": both sign-in screens look for
 * it to offer a new unlock email.
 */
export const ACCOUNT_LOCKED_MESSAGE =
  'This account is locked. You locked it to keep it safe, and the email we sent you has the link to unlock it. If you cannot find it, ask for a new one from the sign-in page.';

/**
 * Said at sign-in, and to a session that outlived the address's confirmation,
 * when the address has not been proved to be hers. Both sign-in screens match
 * on "verify your email" to offer a new link, and auth-recovery.test.ts pins
 * the sentence.
 */
export const EMAIL_NOT_VERIFIED_MESSAGE = 'Please verify your email before signing in.';

/**
 * What a staff member without a second factor may still reach: enrolling one,
 * reading who she is, and keeping or ending her session. Every other authenticated route is
 * refused until the factor is enrolled, whether it checks the role through
 * the role middleware or inline. The client reads the refusal's code and
 * opens the security settings.
 *
 * This used to be every path under /api/auth/, which waved an unenrolled
 * staff account through all of the auth router — changing the password,
 * listing and revoking sessions, resending verification — and would have
 * waved it through anything added under that prefix later. It is an exact
 * list of method and path now, so a new route is refused until someone
 * decides it belongs here.
 */
const TWO_FACTOR_ENROLMENT_ROUTES: ReadonlySet<string> = new Set([
  // The security page reads where she is, starts enrolment and confirms it.
  'GET /api/auth/2fa/status',
  'POST /api/auth/2fa/setup',
  'POST /api/auth/2fa/enable',
  // Who she is, so the app can draw the page that asks her to enrol.
  'GET /api/auth/me',
  // Keeping the session alive while she enrols, and ending it.
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  'POST /api/auth/logout-all',
  // Locking her own account only ever shuts a door, and an unenrolled staff
  // account is the one most likely to be told, mid-enrolment, that somebody
  // else is in it.
  'POST /api/auth/lock',
]);

/**
 * `path` is the request path without its query string. A trailing slash is
 * not a different route to Express, so it is not a different entry here.
 */
export function isTwoFactorEnrolmentPath(method: string, path: string): boolean {
  const normalised = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return TWO_FACTOR_ENROLMENT_ROUTES.has(`${method.toUpperCase()} ${normalised}`);
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
      bannedAt: true,
      // Her own lock and the address's confirmation, read on every request
      // so that neither depends on the sessions having been revoked: a sign-in
      // that was part-way through when she locked the account would otherwise
      // hold a live token for a locked account, and an address an admin
      // un-confirms would keep every session it already had.
      lockedAt: true,
      emailVerified: true,
      twoFactorEnabled: true,
      // Read for the account-standing refusal in authenticate, so a member a
      // reviewer has refused, or whose date of birth is under the minimum,
      // does not keep every write on the platform. The row is read on every
      // request already; these cost no extra query.
      womanVerificationStatus: true,
      dateOfBirth: true,
    },
  });

  if (!user) {
    throw UnauthorizedError('User not found');
  }

  // A ban is recorded in its own column now (bannedAt, with who and why), and
  // nothing says every path that bans will also set isSuspended. Either one
  // closes the account here, so a ban never depends on a second write having
  // happened. The wording stays the suspended one: the account's state is not
  // for the refusal to tell.
  const { bannedAt, lockedAt, emailVerified, ...principal } = user;
  return {
    user: {
      ...principal,
      isSuspended: user.isSuspended || Boolean(bannedAt),
      isLocked: Boolean(lockedAt),
      // Only an explicit false: a row that does not say is not read as one.
      emailUnverified: emailVerified === false,
    },
    sessionId: session.id,
  };
}

/** The refusal an account that may not hold a session gets, or null when it may. */
function closedPrincipalRefusal(user: { isSuspended: boolean; isLocked: boolean; emailUnverified: boolean }) {
  if (user.isSuspended) return ForbiddenError(SUSPENDED_ACCOUNT_MESSAGE);
  if (user.isLocked) return ForbiddenError(ACCOUNT_LOCKED_MESSAGE);
  if (user.emailUnverified) return ForbiddenError(EMAIL_NOT_VERIFIED_MESSAGE);
  return null;
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
  const closed = closedPrincipalRefusal(user);
  if (closed) {
    throw closed;
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

    const closed = closedPrincipalRefusal(user);
    if (closed) {
      throw closed;
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
    if (refusal && !isTwoFactorEnrolmentPath(req.method, req.originalUrl.split('?')[0])) {
      return res.status(403).json(refusal);
    }

    // The women-only and minimum-age promises, enforced once for every write
    // rather than route by route. See account-standing.ts for what stays open.
    const standingRefusal = accountStandingRefusal(user, req.method, req.originalUrl.split('?')[0]);
    if (standingRefusal) {
      logger.warn('Account in bad standing refused a write', {
        userId: user.id,
        code: standingRefusal.code,
        method: req.method,
        path: req.originalUrl.split('?')[0],
      });
      return res.status(403).json(standingRefusal);
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

        // A suspended or locked account reads public surfaces as a stranger
        // would rather than failing the request outright.
        if (user && !closedPrincipalRefusal(user)) {
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

/**
 * A signed-in member refused for her plan.
 *
 * Both plan gates below used to refuse with 401 through UnauthorizedError. A
 * 401 is what the web app's axios interceptor reads as an expired session, so
 * every paywall refusal rotated her refresh token and retried before it gave
 * up and showed the error. Being on the wrong plan is a 403, and it carries a
 * code the client can recognise without parsing the sentence, the same one
 * the AI router's own gate answers with.
 */
function refuseForPlan(res: Response, message: string) {
  return res.status(403).json({ success: false, code: 'PREMIUM_REQUIRED', message });
}

/**
 * A paid tier on a subscription that is live: ACTIVE, TRIALING, or past due and
 * still inside the grace after a failed renewal (utils/subscription-entitlement,
 * the one rule every plan gate shares). The AI router applies the same rule
 * through its own requireAiPremium, which also tells a lapsed member which state
 * her subscription is in.
 */
export const requirePremium = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw UnauthorizedError('Authentication required');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
      select: { tier: true, status: true, currentPeriodStart: true },
    });

    if (!subscription || subscription.tier === 'FREE') {
      return refuseForPlan(res, 'Premium subscription required');
    }

    if (!hasLiveEntitlement(subscription)) {
      return refuseForPlan(res, 'Active subscription required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireSubscriptionTier = (...tiers: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw UnauthorizedError('Authentication required');
      }

      if (req.user.role === 'ADMIN') {
        return next();
      }

      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user.id },
        select: { tier: true, status: true, currentPeriodStart: true },
      });

      if (!subscription || !isSubscriptionLive(subscription)) {
        return refuseForPlan(res, 'Active subscription required');
      }

      if (tiers.length > 0 && !tiers.includes(subscription.tier)) {
        return refuseForPlan(res, 'Subscription tier upgrade required');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
