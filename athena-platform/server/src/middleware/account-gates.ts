/**
 * The two promises the whole product rests on, in one place: that this is a
 * space for women, and that it is a space for adults.
 *
 * Both were advertised and neither was enforced. The women-only gate was a
 * boolean the caller supplied at registration and a status nothing read except
 * one helper in housing.routes.ts, so a REJECTED member — someone a reviewer
 * had looked at and refused — kept the whole platform. The age gate did not
 * exist at all: PLATFORM_MINIMUM_AGE was quoted in the Terms and read by
 * nothing, while `User.dateOfBirth` was never collected, so there was no
 * number to compare against even if something had wanted to.
 *
 * The rules are written once here so there is a single answer to "may she be
 * in this room", instead of the implicit one the platform had before, which
 * was "everyone, always".
 *
 * Why this is not in roles.ts, where the other authorisation middleware lives:
 * roles.ts is imported by middleware/auth.ts and by a unit suite that does not
 * mock Prisma, so importing the client there would build a real PrismaClient
 * at module load in a test that never touches the database.
 */

import { Response, NextFunction } from 'express';
import type { WomanVerificationStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { PLATFORM_MINIMUM_AGE } from '../config/region.config';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

/** Sent to a member whose account has not cleared the women-only gate. */
export const WOMAN_GATE_UNVERIFIED_MESSAGE =
  'This part of ATHENA is open to members who have completed the women-only check. It takes a few minutes and is free.';
/** Sent to a member a reviewer has already refused. Deliberately final, and says where to appeal. */
export const WOMAN_GATE_REJECTED_MESSAGE =
  'Your membership did not pass the women-only check. If you believe that is wrong, appeal from Settings and a person will look again.';
/** Sent to an account with no date of birth on file. */
export const AGE_GATE_MISSING_MESSAGE =
  'Please add your date of birth before using this part of ATHENA.';
/** Sent to an account whose recorded date of birth is under the platform minimum. */
export const AGE_GATE_UNDERAGE_MESSAGE =
  'ATHENA accounts are for adults, so this part of the platform is not available on your account.';
/**
 * What a form is told when the date of birth is missing, impossible, or under
 * the platform minimum — one sentence for all three.
 *
 * The three cases share a message on purpose. Naming the exact age back to
 * someone who has just been refused turns the form into a calculator: she
 * retries with a year two later and is through. The Terms state the age; the
 * refusal does not restate it at the moment it would be most useful to guess
 * against.
 */
export const DATE_OF_BIRTH_REFUSAL = 'Please enter your date of birth. ATHENA accounts are for adults.';

/** Where the member goes to satisfy each gate; the client reads these off the refusal. */
const WOMAN_GATE_SETUP = '/dashboard/settings/profile';
const AGE_GATE_SETUP = '/dashboard/settings/profile';

// ------------------------------------------------------------------- age

/**
 * Completed years between a date of birth and now, worked out on calendar
 * parts rather than by dividing milliseconds: a division by 365.25 days puts
 * a birthday on the wrong side of the line for anyone born on 29 February,
 * and for everybody else on the day itself.
 */
export function yearsSince(value: Date | string, now: Date = new Date()): number {
  const born = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(born.getTime())) return Number.NaN;

  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
    years -= 1;
  }
  return years;
}

/**
 * Whether a submitted date of birth is a date a living person could have.
 * A date in the future or one implying an age beyond any recorded lifespan is
 * a typo or a probe, and is refused before it reaches the age comparison.
 */
export function isPlausibleDateOfBirth(value: Date | string, now: Date = new Date()): boolean {
  const born = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(born.getTime())) return false;
  if (born.getTime() > now.getTime()) return false;
  return yearsSince(born, now) <= 120;
}

/** Whether this date of birth clears the one age the platform asks for (Terms 2.1). */
export function meetsMinimumAge(value: Date | string, now: Date = new Date()): boolean {
  if (!isPlausibleDateOfBirth(value, now)) return false;
  return yearsSince(value, now) >= PLATFORM_MINIMUM_AGE;
}

// ------------------------------------------------------------- women-gate

export type WomanGateState = {
  status: WomanVerificationStatus;
  /**
   * Safe Mode as the member last set it, read from both stores. The Safety
   * Centre writes `Profile.isSafeMode` and the DV safety screen writes
   * `DvSafetyProfile.isSafeMode`; until those two columns are reconciled, a
   * woman who turned the switch on in either place has turned it on.
   */
  safeMode: boolean;
};

/**
 * What marks a VerificationBadge as evidence for the women-only gate rather
 * than for the ordinary identity badge. Both run through the same Stripe
 * Identity integration and the same model, so the purpose is what tells the
 * webhook, the reviewer's queue and the member's own settings page apart.
 */
export const WOMAN_GATE_PURPOSE = 'WOMAN_GATE';

export type WomanGateEvidence = {
  provider: 'stripe_identity' | 'manual';
  sessionId: string | null;
  /** Set once Stripe has returned a passed document-and-selfie check. */
  documentCheckPassedAt: string | null;
  /** The legal name on the document, so the reviewer has something to compare. */
  documentName: string | null;
  documentType: string | null;
  /** The member's own account of why she is asking, on the manual path. */
  statement: string | null;
  evidenceUrl: string | null;
  submittedAt: string | null;
};

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Whether a badge's metadata says it belongs to the women-only gate. */
export function isWomanGateMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).purpose === WOMAN_GATE_PURPOSE;
}

/**
 * The reviewer's view of a women-gate submission. Returns null when the
 * metadata carries nothing a person could act on, so a queue can tell "she
 * applied and gave us something" from "the status was flipped and nobody
 * attached anything" — which is what every request looked like before.
 */
export function readWomanGateEvidence(metadata: unknown): WomanGateEvidence | null {
  if (!isWomanGateMetadata(metadata)) return null;
  const meta = metadata as Record<string, unknown>;
  const provider = meta.provider === 'stripe_identity' ? 'stripe_identity' : 'manual';
  const evidence: WomanGateEvidence = {
    provider,
    sessionId: str(meta.sessionId),
    documentCheckPassedAt: str(meta.documentCheckPassedAt),
    documentName: str(meta.documentName),
    documentType: str(meta.documentType),
    statement: str(meta.statement),
    evidenceUrl: str(meta.evidenceUrl),
    submittedAt: str(meta.submittedAt),
  };

  const hasSomethingToReview =
    Boolean(evidence.documentCheckPassedAt) || Boolean(evidence.statement) || Boolean(evidence.evidenceUrl);
  return hasSomethingToReview ? evidence : null;
}

/** The facts the two women-gate questions are answered from, read once. */
export async function womanGateState(userId: string): Promise<WomanGateState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      womanVerificationStatus: true,
      dvSafetyProfile: { select: { isSafeMode: true } },
      profile: { select: { isSafeMode: true } },
    },
  });

  return {
    status: (user?.womanVerificationStatus ?? 'UNVERIFIED') as WomanVerificationStatus,
    safeMode: Boolean(user?.dvSafetyProfile?.isSafeMode) || Boolean(user?.profile?.isSafeMode),
  };
}

/**
 * Whether this member may be in the women-only rooms at all.
 *
 * Everyone self-attests at registration, so the only thing this can refuse is
 * the account a reviewer has already looked at and refused — which until now
 * kept every surface on the platform, making the admin console's Reject button
 * a decision with no consequence.
 */
export const isWomanMember = (state: WomanGateState): boolean => state.status !== 'REJECTED';

/**
 * Whether this member may reach a surface that carries the women-only promise
 * to a stranger: a confidential DV-safe housing listing, a women-only room
 * whose members are told everyone in it has been checked.
 */
export const isWomanVerified = (state: WomanGateState): boolean => state.status === 'VERIFIED';

/**
 * Whether this member may see the confidential housing listings. Safe Mode
 * counts here and only here: a woman leaving violence needs emergency housing
 * tonight, not after a review, and the switch is free and one tap away. That
 * trade is deliberate and is made in this one line rather than in each route.
 */
export const mayEnterConfidentialSpace = (state: WomanGateState): boolean =>
  isWomanVerified(state) || state.safeMode;

/**
 * The women-only gate as route middleware.
 *
 * `MEMBER` is the floor every women-only surface should carry: it refuses an
 * account a reviewer has refused. `VERIFIED` is for the surfaces where the
 * promise is made to other members rather than by them, and it costs a
 * verification before entry.
 */
export function requireWomanGate(level: 'MEMBER' | 'VERIFIED') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const state = await womanGateState(req.user.id);
      const allowed = level === 'VERIFIED' ? isWomanVerified(state) : isWomanMember(state);
      if (allowed) return next();

      const rejected = state.status === 'REJECTED';
      logger.warn('Women-only gate refused a request', {
        userId: req.user.id,
        level,
        status: state.status,
        path: req.originalUrl.split('?')[0],
      });

      return res.status(403).json({
        error: rejected ? WOMAN_GATE_REJECTED_MESSAGE : WOMAN_GATE_UNVERIFIED_MESSAGE,
        code: rejected ? 'WOMAN_VERIFICATION_REJECTED' : 'WOMAN_VERIFICATION_REQUIRED',
        status: state.status,
        setup: WOMAN_GATE_SETUP,
      });
    } catch (error) {
      return next(error);
    }
  };
}

/** Refuses an account a reviewer has already refused. The floor for women-only surfaces. */
export const requireWomanMember = requireWomanGate('MEMBER');

/** Refuses anyone whose women-only check has not been completed and approved. */
export const requireWomanVerified = requireWomanGate('VERIFIED');

// --------------------------------------------------------------- age gate

/**
 * The age gate as route middleware.
 *
 * A null date of birth is refused, not waved through. Every account that
 * predates the column has one, which is the point: an account whose age was
 * never asked for cannot be treated as an adult's on a platform with a public
 * feed, stories and direct messages. The refusal names the page that collects
 * it, so the member can answer once and carry on.
 */
export const requireAdultAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { dateOfBirth: true },
    });

    if (!user?.dateOfBirth) {
      return res.status(403).json({
        error: AGE_GATE_MISSING_MESSAGE,
        code: 'DATE_OF_BIRTH_REQUIRED',
        setup: AGE_GATE_SETUP,
      });
    }

    if (!meetsMinimumAge(user.dateOfBirth)) {
      logger.warn('Under-age account refused', {
        userId: req.user.id,
        path: req.originalUrl.split('?')[0],
      });
      return res.status(403).json({
        error: AGE_GATE_UNDERAGE_MESSAGE,
        code: 'MINIMUM_AGE_NOT_MET',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * The same two gates, shaped for a socket rather than a request.
 *
 * The websocket is a second door into someone's inbox, and `messages:send`
 * already mirrors the REST route's throttle, block check, message-permission
 * check and content moderation. It has to mirror these two as well, or the
 * gates are a front door lock on a house with the back door open — and the
 * mobile app sends its direct messages down this path.
 *
 * Returns the refusal a caller should emit, or null when the account may send.
 */
export async function directMessageGateRefusal(
  userId: string
): Promise<{ message: string; code: string } | null> {
  const [state, user] = await Promise.all([
    womanGateState(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } }),
  ]);

  if (!isWomanMember(state)) {
    logger.warn('Women-only gate refused a socket message', { userId, status: state.status });
    return { message: WOMAN_GATE_REJECTED_MESSAGE, code: 'WOMAN_VERIFICATION_REJECTED' };
  }

  if (!user?.dateOfBirth) {
    return { message: AGE_GATE_MISSING_MESSAGE, code: 'DATE_OF_BIRTH_REQUIRED' };
  }

  if (!meetsMinimumAge(user.dateOfBirth)) {
    logger.warn('Under-age account refused a socket message', { userId });
    return { message: AGE_GATE_UNDERAGE_MESSAGE, code: 'MINIMUM_AGE_NOT_MET' };
  }

  return null;
}
