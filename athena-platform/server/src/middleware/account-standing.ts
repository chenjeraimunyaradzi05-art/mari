/**
 * Whether an account in bad standing may still change anything.
 *
 * The women-only check and the minimum age were enforced on a handful of
 * routes (direct messages, stories, group chat, housing inquiries). A member a
 * reviewer had refused, or whose recorded date of birth is under the platform
 * minimum, could still post, comment, join groups and channels, upload video
 * and go live, because each of those routes would have had to remember to ask.
 * Asking once, where every authenticated request already passes, means a new
 * route is covered the day it is written.
 *
 * Only writes are refused. Reading stays open, so the member can still see her
 * own settings, the reason she was told and where to appeal; what she cannot do
 * is act on other members, or in rooms, as a member in good standing.
 *
 * What she must always be able to reach is a short list, below, and it is
 * deliberately a list rather than "everything under /api/users": a route added
 * tomorrow is refused until someone decides it belongs here, the same shape as
 * the staff second-factor exemptions in auth.ts.
 *
 * A date of birth that is missing is refused too, and this is how the accounts
 * that predate the column are brought in line. ATHENA is for adults and asks
 * for a date of birth at sign-up (email, Google and Facebook all refuse an
 * account without one), so an account with none is a legacy account whose age
 * was never asked. It keeps everything it can read, and the first time it tries
 * to write anywhere the refusal says DATE_OF_BIRTH_REQUIRED and names the page
 * that collects it; she answers once (POST /users/me/date-of-birth, which is
 * exempt below) and carries on. Only `null` counts as missing: a caller that
 * never read the column passes `undefined`, which is "not asked", not "empty".
 *
 * What this does not do is verify the date. It is the member's own word, which
 * is why the Terms say ATHENA asks for it and does not claim to verify it, and
 * why the document check (Stripe Identity), which stamps ageVerifiedAt, stays
 * the stronger route. See docs/runbooks/UNDER-AGE-ACCOUNT.md.
 */

import {
  AGE_GATE_MISSING_MESSAGE,
  AGE_GATE_SETUP,
  AGE_GATE_UNDERAGE_MESSAGE,
  WOMAN_GATE_REJECTED_MESSAGE,
  WOMAN_GATE_SETUP,
  meetsMinimumAge,
} from './account-gates';

/** The facts the decision is made from, all of which the authenticate middleware already reads. */
export type AccountStanding = {
  womanVerificationStatus?: string | null;
  dateOfBirth?: Date | string | null;
};

export type AccountStandingRefusal =
  | { error: string; code: 'WOMAN_VERIFICATION_REJECTED'; status: 'REJECTED'; setup: string }
  | { error: string; code: 'DATE_OF_BIRTH_REQUIRED'; setup: string }
  | { error: string; code: 'MINIMUM_AGE_NOT_MET' };

const READ_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Whole sections that are hers by construction, matched by prefix: her own
 * sign-in and sessions (which is also how she signs out and how a password is
 * changed), her privacy rights, the safety centre and domestic violence
 * support, her notifications, the compliance routes that take a report or
 * record an agreement, and the staff console, which has its own role checks.
 * A refused member in danger must be able to reach safety help, and one who is
 * being billed must be able to stop it.
 */
const EXEMPT_PREFIXES: readonly string[] = [
  '/api/auth/',
  '/api/gdpr/',
  '/api/safety/',
  '/api/notifications/',
  '/api/compliance/',
  '/api/admin/',
];

/**
 * The single routes she needs outside those sections, as method and path. An
 * appeal is how a refusal is reversed, her settings are hers to read and
 * correct, and deleting the account is a right she keeps whatever her
 * standing; the two billing routes only ever end or inspect what she pays.
 * Her safety plan lives under /api/impact, not /api/safety, so it is named
 * here: it is her own private record, the one a woman in danger most needs to
 * be able to write down and to wipe, and it must not wait on a date of birth
 * (which every account that predates the column lacks) or be shut to an account
 * that is under the minimum age and may be the one at risk.
 */
const EXEMPT_ROUTES: ReadonlySet<string> = new Set([
  'POST /api/impact/safety-plan',
  'DELETE /api/impact/safety-plan',
  'POST /api/appeals',
  'POST /api/feedback',
  'POST /api/subscriptions/cancel',
  'POST /api/subscriptions/portal',
  'PATCH /api/users/me',
  'DELETE /api/users/me',
  'PATCH /api/users/me/preferences',
  'PATCH /api/users/me/consents',
  'POST /api/users/me/woman-verification',
  'POST /api/users/me/woman-verification/complete',
  'POST /api/users/me/date-of-birth',
]);

/**
 * `path` is the request path without its query string. Express matches paths
 * without regard to case or a trailing slash, so both are folded here, and a
 * path that climbs with `..` is never treated as exempt.
 */
export function isStandingExemptPath(method: string, path: string): boolean {
  const folded = path.toLowerCase();
  if (folded.includes('..') || folded.includes('%2e')) return false;

  const normalised = folded.length > 1 ? folded.replace(/\/+$/, '') : folded;
  if (EXEMPT_ROUTES.has(`${method.toUpperCase()} ${normalised}`)) return true;
  return EXEMPT_PREFIXES.some((prefix) => `${normalised}/`.startsWith(prefix));
}

/**
 * Null when the request may go ahead; otherwise the body of the refusal. The
 * bodies are the ones the per-route gates already send, so the web and mobile
 * apps read both the same way.
 */
export function accountStandingRefusal(
  account: AccountStanding,
  method: string,
  path: string
): AccountStandingRefusal | null {
  if (READ_METHODS.has(method.toUpperCase())) return null;

  const rejected = account.womanVerificationStatus === 'REJECTED';
  const missingBirthDate = account.dateOfBirth === null;
  const underage = Boolean(account.dateOfBirth) && !meetsMinimumAge(account.dateOfBirth as Date | string);
  if (!rejected && !missingBirthDate && !underage) return null;

  if (isStandingExemptPath(method, path)) return null;

  if (rejected) {
    return {
      error: WOMAN_GATE_REJECTED_MESSAGE,
      code: 'WOMAN_VERIFICATION_REJECTED',
      status: 'REJECTED',
      setup: WOMAN_GATE_SETUP,
    };
  }
  // Under 18 outranks "no date": a recorded age under the minimum is the more
  // final of the two answers, and has no page to fix it from.
  if (underage) {
    return { error: AGE_GATE_UNDERAGE_MESSAGE, code: 'MINIMUM_AGE_NOT_MET' };
  }
  return { error: AGE_GATE_MISSING_MESSAGE, code: 'DATE_OF_BIRTH_REQUIRED', setup: AGE_GATE_SETUP };
}
