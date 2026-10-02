/**
 * One obvious call for "may this caller touch this one thing?", so a new route
 * does not have to re-derive ownership by hand.
 *
 * Until now every handler that takes an id wrote its own find-then-check. Most
 * did it right (a message is read through loadOwnMessage, a holding through
 * ownHolding, an applicant list through canManageJobApplicants), and the
 * convention that someone else's thing reads as 404 held in most of them; but
 * the convention lived in people's heads, and the ones that forgot it said 403
 * and so told a stranger the id was real. A policy gives that rule one home:
 *
 *   router.patch('/:id/read', authenticate,
 *     requireResourceAccess({
 *       load: (req) => prisma.notification.findUnique({ where: { id: req.params.id } }),
 *       allow: ownedBy('userId'),
 *     }),
 *     handler);
 *
 * and the handler reads what was loaded with `loadedResource<Notification>(req)`
 * instead of fetching it a second time.
 *
 * Deny by default, in every direction it can go wrong:
 *   - no session: 401, and the policy is never asked;
 *   - a resource that is not there, and a resource the policy refuses, are both
 *     404 with the same words, so neither tells a probe which ids exist;
 *   - a policy that throws is an error, never a yes;
 *   - a staff role is a pass only for a staff account that has enrolled a
 *     second factor, exactly as in the role middleware (see hasRole), so a
 *     staff pass in a policy is never wider than a staff pass anywhere else.
 *     It does not get in the way of staff reaching their own things: an
 *     administrator without a second factor still reads her own notification.
 *
 * The policies below are the checks the codebase already makes by hand,
 * written once: owner, conversation participant, accepted organisation member,
 * hiring staff of a job. `anyOf` joins them.
 */

import { Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from './auth';
import { ApiError } from './errorHandler';
import { staffTwoFactorRefusal } from './roles';
import { assertOrgMembership } from '../utils/org-scope';
import { canManageJobApplicants } from '../services/hiring-access.service';

export type Principal = NonNullable<AuthRequest['user']>;

/** What a policy decides with: the loaded resource, the caller, and the request for anything else it needs. */
export type AccessCheck<R> = (resource: R, principal: Principal, req: AuthRequest) => boolean | Promise<boolean>;

export interface ResourcePolicy<R> {
  /** Fetch the thing the request names, or return null when it is not there. */
  load: (req: AuthRequest) => Promise<R | null | undefined> | R | null | undefined;
  /** True only when this caller may touch it. Anything else, including a throw, is a refusal. */
  allow: AccessCheck<R>;
}

/** The refusal for a missing and a refused resource alike. */
const NOT_FOUND_MESSAGE = 'Not found';

const LOADED = Symbol('athena.loadedResource');
const STAFF_REFUSAL = Symbol('athena.staffRefusal');

type WithLoaded<R> = AuthRequest & {
  [LOADED]?: R;
  [STAFF_REFUSAL]?: NonNullable<ReturnType<typeof staffTwoFactorRefusal>>;
};

/** The resource requireResourceAccess loaded for this request. Throws if the guard did not run. */
export function loadedResource<R>(req: AuthRequest): R {
  const resource = (req as WithLoaded<R>)[LOADED];
  if (resource === undefined) {
    throw new Error('loadedResource called on a request requireResourceAccess did not clear');
  }
  return resource;
}

export function requireResourceAccess<R>(policy: ResourcePolicy<R>): RequestHandler {
  return async (req, res: Response, next: NextFunction) => {
    const authed = req as AuthRequest;
    try {
      const principal = authed.user;
      if (!principal) {
        throw new ApiError(401, 'Authentication required');
      }

      const resource = await policy.load(authed);
      if (resource === null || resource === undefined) {
        throw new ApiError(404, NOT_FOUND_MESSAGE);
      }

      // `=== true`, not truthiness: a policy that returns a row, a count or a
      // string by mistake is a refusal, not a grant.
      const allowed = await policy.allow(resource, principal, authed);
      if (allowed !== true) {
        // The one refusal that is not a 404: a staff account whose only way in
        // was its role, and which has no second factor yet. It is told what to
        // do about it, as the role middleware tells it, and it already knows
        // the resource is there because staff were about to be let in.
        const staffRefusal = (authed as WithLoaded<R>)[STAFF_REFUSAL];
        if (staffRefusal) {
          res.status(403).json(staffRefusal);
          return;
        }
        throw new ApiError(404, NOT_FOUND_MESSAGE);
      }

      (authed as WithLoaded<R>)[LOADED] = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// ---------------------------------------------------------------- policies

/** The caller is the one named in `field` (`userId`, `ownerId`, `authorId`...). */
export function ownedBy<R extends object>(field: keyof R & string): AccessCheck<R> {
  return (resource, principal) => (resource as Record<string, unknown>)[field] === principal.id;
}

/** The caller is one of the people in the conversation, group chat or thread the resource belongs to. */
export function participant<R>(participantIds: (resource: R) => readonly string[]): AccessCheck<R> {
  return (resource, principal) => participantIds(resource).includes(principal.id);
}

/**
 * The caller is an accepted member of the organisation the resource belongs to.
 * An invitation nobody has answered is not membership (see utils/org-scope).
 */
export function orgMember<R>(organizationId: (resource: R) => string | null | undefined): AccessCheck<R> {
  return async (resource, principal) => {
    const id = organizationId(resource);
    if (!id) return false;
    try {
      await assertOrgMembership(id, principal.id);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 403) return false;
      throw error;
    }
  };
}

/**
 * The caller may see and move this job's applicants: the poster of a job that
 * belongs to nobody, or hiring staff of the organisation that owns it.
 */
export function hiringStaffOf<R>(
  job: (resource: R) => { organizationId: string | null; postedById: string }
): AccessCheck<R> {
  return (resource, principal) => canManageJobApplicants(job(resource), principal.id);
}

/**
 * The caller holds one of these platform roles. A staff role only counts once
 * the account has a second factor, as it does for requireRole; without one the
 * check says no and the guard answers with the setup refusal instead of a 404.
 */
export function hasRole<R>(...roles: string[]): AccessCheck<R> {
  return (_resource, principal, req) => {
    if (!roles.includes(principal.role)) return false;
    const refusal = staffTwoFactorRefusal(principal);
    if (refusal) {
      (req as WithLoaded<R>)[STAFF_REFUSAL] = refusal;
      return false;
    }
    return true;
  };
}

/** Any one of the checks is enough. They run in order and stop at the first yes. */
export function anyOf<R>(...checks: AccessCheck<R>[]): AccessCheck<R> {
  return async (resource, principal, req) => {
    for (const check of checks) {
      if ((await check(resource, principal, req)) === true) return true;
    }
    return false;
  };
}
