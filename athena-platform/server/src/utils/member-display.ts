/**
 * What other members are shown of a member's name.
 *
 * ATHENA tells Australian members they can use a pseudonym on the platform
 * (region.config.ts, the anonymity right in the privacy centre). For a woman
 * hiding from a violent ex-partner it is not a nicety: her legal name, on a post
 * or in a message thread, is what he searches for. Until now the promise was only
 * half plumbed. A display name could be set (`displayName`, which registration
 * fills with the legal full name), but no screen let her change it, and every
 * social response carried `firstName` and `lastName` beside it, so a client that
 * preferred them, or fell back to them, put the legal name on screen anyway.
 *
 * The rule, kept in this one file:
 *
 * - A member is called by her public name: the display name she chose, else her
 *   first name alone. Never both legal names.
 * - On a social surface her legal first and last name are not sent at all. The
 *   keys the older clients read (`firstName`, `lastName`) are kept so none of them
 *   breaks, and carry the public name and an empty string.
 * - She sees her own record untouched, and legal names stay where a payment, an
 *   identity check, a hiring decision she took part in or the law needs them:
 *   those routes do not go through this file.
 *
 * It is enforced on the server, not asked of the apps: maskLegalNames runs over
 * the answer of every social router, so a column added to a select tomorrow stays
 * out of the response until somebody decides otherwise.
 */

import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';

export interface NameParts {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

/**
 * The columns a social surface needs to name and show a member. No `lastName`:
 * the legal surname is never read for display, so it is never loaded. `firstName`
 * is here only so there is something to call a member who has not chosen a public
 * name; maskLegalNames takes it out of the answer.
 */
export const PUBLIC_AUTHOR_SELECT = {
  id: true,
  firstName: true,
  displayName: true,
  avatar: true,
  headline: true,
} as const;

/** What a member is called to other members: her chosen public name, else her first name alone. */
export function publicName(user: NameParts | null | undefined, fallback = 'Member'): string {
  const chosen = user?.displayName?.trim();
  if (chosen) return chosen;
  const first = user?.firstName?.trim();
  return first || fallback;
}

// ------------------------------------------------------------ answering with it

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * A person: an object that carries a first name and either a last name or a
 * display name. That is every member record a select produces; an organisation,
 * a post or a message has neither.
 */
function isMemberRecord(value: Record<string, unknown>): boolean {
  if (!('firstName' in value)) return false;
  if (typeof value.firstName !== 'string' && value.firstName !== null) return false;
  return 'lastName' in value || 'displayName' in value;
}

const MAX_DEPTH = 24;

function walk(value: unknown, viewerId: string | undefined, depth: number): unknown {
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => walk(item, viewerId, depth + 1));
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) out[key] = walk(inner, viewerId, depth + 1);

  if (isMemberRecord(value) && !(viewerId && (value.id === viewerId || value.userId === viewerId))) {
    const name = publicName(value as NameParts);
    out.displayName = name;
    out.firstName = name;
    out.lastName = '';
  }
  return out;
}

/**
 * The body as another member may see it: every member record in it, other than
 * the viewer's own, loses her legal names. Pure, and returns a copy.
 */
export function maskLegalNames<T>(body: T, viewerId?: string): T {
  return walk(body, viewerId, 0) as T;
}

/**
 * Express middleware: answer through maskLegalNames. Put it on a router, or on a
 * route, whose answers go to other members; not on one that returns the
 * member's own record or a record kept for payment or hiring.
 *
 * It wraps res.json, so it reads `req.user` at the moment of the answer, after
 * `authenticate` has set it.
 */
export function maskLegalNamesInResponses(req: AuthRequest, res: Response, next: NextFunction): void {
  const send = res.json.bind(res);
  res.json = ((body?: unknown) => send(maskLegalNames(body, req.user?.id))) as typeof res.json;
  next();
}

// -------------------------------------------------------------- choosing a name

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;

// Characters that make one name look like another or hide in a page: control
// characters, zero-width and joiner marks, and the bidirectional overrides.
function hasHiddenCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (
      code <= 0x1f || // C0 controls
      (code >= 0x7f && code <= 0x9f) || // delete and C1 controls
      code === 0xad || // soft hyphen
      (code >= 0x200b && code <= 0x200f) || // zero-width space, joiners, directional marks
      (code >= 0x202a && code <= 0x202e) || // bidirectional embeddings and overrides
      (code >= 0x2060 && code <= 0x206f) || // word joiner and invisible operators
      code === 0xfeff // byte order mark
    ) {
      return true;
    }
  }
  return false;
}

// Words that make a member look like staff. Whole words only, so a surname that
// happens to contain "mod" is not refused.
const STAFF_WORDS = new Set(['admin', 'administrator', 'moderator', 'mod', 'staff', 'official', 'verified', 'system', 'sysadmin']);

// Phrases checked with spaces and punctuation taken out, so "Athena  Team" and
// "athena.team" are the same thing.
const STAFF_PHRASES = ['athenateam', 'athenastaff', 'athenasupport', 'athenasafety', 'athenahelp', 'athenaadmin', 'trustandsafety', 'trustsafety', 'safetyteam', 'customersupport', 'helpdesk', 'officialathena'];

export type DisplayNameResult = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * Check a public name a member has typed, and clean it: whitespace collapsed,
 * the same name in the same form every time.
 *
 * An empty name is allowed and means "no public name": she is then called by her
 * first name alone. Anything else must read as a name. It may not be an email
 * address, a phone number or a web address (a name is shown to strangers, and
 * those are how a stranger reaches her), and it may not claim to be staff.
 * Nothing here can stop one member choosing another's name; that is what the
 * report button is for.
 */
export function parseDisplayName(raw: unknown): DisplayNameResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, message: 'Your public name must be text' };

  const value = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (value === '') return { ok: true, value: null };

  if (hasHiddenCharacter(value)) return { ok: false, message: 'Your public name can only hold letters, numbers and ordinary punctuation' };
  if ([...value].length < DISPLAY_NAME_MIN) return { ok: false, message: `Your public name needs at least ${DISPLAY_NAME_MIN} characters` };
  if ([...value].length > DISPLAY_NAME_MAX) return { ok: false, message: `Your public name can be up to ${DISPLAY_NAME_MAX} characters` };
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length >= 6) return { ok: false, message: 'Leave phone numbers out of your public name; everyone can see it' };
  if (!/\p{L}/u.test(value)) return { ok: false, message: 'Your public name needs at least one letter' };

  if (/@/.test(value)) return { ok: false, message: 'Leave email addresses and handles out of your public name; everyone can see it' };
  if (/\b(?:https?:|www\.)/i.test(value) || /\b[a-z0-9-]+\.(?:com|net|org|edu|gov|io|co|me|app|au|uk|nz)\b/i.test(value)) {
    return { ok: false, message: 'Leave web addresses out of your public name; everyone can see it' };
  }
  const words = value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const compact = words.join('');
  if (words.some((word) => STAFF_WORDS.has(word)) || STAFF_PHRASES.some((phrase) => compact.includes(phrase))) {
    return { ok: false, message: 'That name reads as if it belongs to ATHENA staff. Choose another' };
  }

  return { ok: true, value };
}
