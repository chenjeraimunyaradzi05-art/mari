/**
 * The completed women-only check, asked for where config/woman-gate-policy.ts
 * says it is needed.
 *
 * The floor (a reviewer has not refused her) is not here: `authenticate` applies
 * it to every write. This is the second level, for the few surfaces that
 * promise something to other members. A surface that is not switched on lets
 * every account through that the floor lets through, so deciding is a matter of
 * setting WOMAN_VERIFIED_REQUIRED_FOR and not of editing routes.
 *
 * The refusal is the one requireWomanVerified sends, so the web and mobile
 * apps read all of them the same way: a member who has not completed the check
 * is sent to where she can, and one a reviewer refused is told how to appeal.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import {
  WOMAN_GATE_REJECTED_MESSAGE,
  WOMAN_GATE_SETUP,
  WOMAN_GATE_UNVERIFIED_MESSAGE,
  isWomanVerified,
  womanGateState,
} from './account-gates';
import {
  WOMAN_VERIFIED_REQUIRED_ENV,
  configuredSurfaces,
  verifiedRequiredFor,
  type WomanGateSurface,
} from '../config/woman-gate-policy';
import { logger } from '../utils/logger';

// A name that matches no surface would leave that surface open while whoever set
// it believed it closed, so it is said once at start rather than ignored.
const misnamed = configuredSurfaces(process.env[WOMAN_VERIFIED_REQUIRED_ENV]).unknown;
if (misnamed.length > 0) {
  logger.warn(`${WOMAN_VERIFIED_REQUIRED_ENV} names surfaces that do not exist and so protects nothing`, { misnamed });
}

export interface WomanVerifiedRefusal {
  error: string;
  code: 'WOMAN_VERIFICATION_REQUIRED' | 'WOMAN_VERIFICATION_REJECTED';
  status: string;
  setup: string;
  surface: WomanGateSurface;
}

/**
 * Null when she may go ahead: the surface does not ask for a completed check,
 * or hers is complete. Otherwise the body of the 403. A failure to read her
 * standing is thrown, never read as "allowed".
 */
export async function womanVerifiedRefusal(
  userId: string,
  surface: WomanGateSurface
): Promise<WomanVerifiedRefusal | null> {
  if (!verifiedRequiredFor(surface)) return null;

  const state = await womanGateState(userId);
  if (isWomanVerified(state)) return null;

  const rejected = state.status === 'REJECTED';
  logger.warn('A completed women-only check was required and she has not got one', {
    userId,
    surface,
    status: state.status,
  });
  return {
    error: rejected ? WOMAN_GATE_REJECTED_MESSAGE : WOMAN_GATE_UNVERIFIED_MESSAGE,
    code: rejected ? 'WOMAN_VERIFICATION_REJECTED' : 'WOMAN_VERIFICATION_REQUIRED',
    status: state.status,
    setup: WOMAN_GATE_SETUP,
    surface,
  };
}

/**
 * What an admin is told when the member being let into a room has not
 * completed the check the room asks for. It is said to the person doing the
 * admitting, about somebody else, so it is not the refusal the member would get
 * for herself (that one sends her to the page where the check is finished) and
 * it carries no code the apps would show to the wrong person.
 */
export const ADMISSION_REFUSED_MESSAGE =
  'This member has not completed the women-only check, which this group asks of everyone in it. They can finish it from their settings, and then they can be added.';

/**
 * Whether a member may be let into a room by somebody else (an admin approving
 * a request, adding the member, or another member suggesting them into a room
 * that approves).
 *
 * The self-service door asks the member (womanVerifiedRefusal), but a room has
 * other doors that put somebody in it, and a promise about who is in the room
 * that only the front door keeps is not one: a request filed on someone's
 * behalf, or an admin who adds them, would otherwise bring in exactly the
 * account the surface exists to keep out. True while the surface is not
 * switched on, and then nothing is read.
 */
export async function mayBeAdmittedTo(userId: string, surface: WomanGateSurface): Promise<boolean> {
  return (await womanVerifiedRefusal(userId, surface)) === null;
}

/** The same question as route middleware, for a surface that is a whole route. */
export function requireWomanVerifiedFor(surface: WomanGateSurface) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const refusal = await womanVerifiedRefusal(req.user.id, surface);
      if (refusal) return res.status(403).json(refusal);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
