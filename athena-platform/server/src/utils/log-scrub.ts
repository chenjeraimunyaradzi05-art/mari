/**
 * What must never leave this process as text: in a log line, and in an error
 * report sent to a third party.
 *
 * Kept apart from utils/logger.ts, which most test files replace with a stand-in,
 * so that the Sentry hooks and the email sender can use it without the logger,
 * and so that it depends on nothing.
 *
 * It matches things by shape. A name or a sentence somebody wrote has no
 * shape, so it is the caller's job not to put one in a message and the logger's
 * to drop the keys that usually carry one (see SENSITIVE_KEY in logger.ts).
 */

/**
 * A user agent says which phone and which browser build someone uses, and an
 * unusual one picks her out of a crowd. It is kept, because it is what you
 * read when a client misbehaves, but short.
 */
export const USER_AGENT_MAX_LENGTH = 120;

/**
 * A string longer than this is cut before it is scanned. The scan is linear
 * for a normal line and quadratic for a very long run of address-like
 * characters, and a 5 MB string in a log line is a bug of its own.
 */
const MAX_SCANNED_LENGTH = 20_000;

export const REDACTED = '[redacted]';

/** Cuts a string to `max` characters, ending with an ellipsis when it was longer. */
export function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}

/**
 * What a Prisma error message says, without what it echoes back.
 *
 * A failed call is reported as "Invalid `prisma.user.create()` invocation",
 * then the call's own arguments (every email, hash and message the caller
 * passed in), then the reason on the last line. The reason is the diagnosis;
 * the arguments are somebody's data, and the key-based redaction cannot see
 * them because by then they are text. So the invocation line and the reason
 * are kept and everything between is dropped.
 */
function withoutPrismaArguments(text: string): string {
  const start = text.search(/Invalid `prisma\./);
  if (start === -1) return text;

  const headerEnd = text.indexOf('\n', start);
  if (headerEnd === -1) return text;
  const header = text.slice(start, headerEnd).replace(/ in$/, ':');

  const lastBreak = text.lastIndexOf('\n\n');
  const reason = lastBreak > headerEnd ? text.slice(lastBreak).trim() : '';
  return `${text.slice(0, start)}${header}${reason ? `\n${reason}` : ''}`;
}

// The local part is at most 64 characters (RFC 5321), and the bound is not only
// correctness: unbounded, a 20,000-character run of address-like characters with
// an @ somewhere after it is quadratic, about 0.9 s of the one thread the API
// has, and request paths and headers are text a stranger writes.
const EMAIL_ADDRESS = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const JSON_WEB_TOKEN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const BEARER_CREDENTIAL = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
// `token=...` and the like, in a link or in a line of text; `code=` and `key=`
// only as a link's query parameter, where "code=500" in a sentence is not one.
const SECRET_PARAMETER =
  /((?:^|[?&;\s])(?:token|access_token|refresh_token|id_token|secret|password|sig|signature|auth|api_key|apikey)=)[^&\s"'<>]+/gi;
const SECRET_QUERY_PARAMETER = /([?&](?:code|key)=)[^&\s"'<>]+/gi;
const PROVIDER_SECRET =
  /\b(?:(?:sk|rk|pk)_(?:live|test)_|whsec_)[A-Za-z0-9]{10,}|\bSG\.[\w-]{16,}\.[\w-]{16,}|\bAKIA[0-9A-Z]{16}\b/g;
const LONG_HEX = /\b[a-f0-9]{48,}\b/gi;
// A phone's push address, which Expo repeats back in its own error replies.
const PUSH_TOKEN = /\bExp(?:onent)?PushToken\[[^\]\s]{6,}\]/g;
// An Australian mobile (04xx xxx xxx, +61 4xx ...) or any number written with a country code.
const PHONE_NUMBER = /(?<![\w.])(?:(?:\+?61[\s-]?|0)4(?:[\s-]?\d){8}|\+\d{1,3}(?:[\s-]?\d){7,12})(?!\d)/g;

/**
 * Removes from a piece of text the things that must never be in a log
 * whatever the key they sat under: an email address, a bearer credential or web
 * token, a secret in a link's query string, a provider's secret key, a long
 * hex string (which is how this server's one-time tokens and their hashes
 * look), a phone number, and the arguments a database error echoes back.
 * Best-effort by nature: it catches what has a shape.
 */
export function scrubText(text: string): string {
  let out = text.length > MAX_SCANNED_LENGTH ? `${text.slice(0, MAX_SCANNED_LENGTH)}…[cut]` : text;
  if (out.includes('prisma.')) out = withoutPrismaArguments(out);
  out = out
    .replace(JSON_WEB_TOKEN, '[token]')
    .replace(BEARER_CREDENTIAL, 'Bearer [redacted]')
    .replace(SECRET_PARAMETER, `$1${REDACTED}`)
    .replace(SECRET_QUERY_PARAMETER, `$1${REDACTED}`)
    .replace(PROVIDER_SECRET, '[secret]')
    .replace(PUSH_TOKEN, '[push-token]')
    .replace(LONG_HEX, '[token]');
  if (out.includes('@')) out = out.replace(EMAIL_ADDRESS, '[email]');
  return out.replace(PHONE_NUMBER, '[phone]');
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// A path segment that is one long unbroken run of token characters is a
// credential, not a word: nothing in this API's routes is named that way.
const OPAQUE_SEGMENT = /\/[A-Za-z0-9_-]{20,}(?=\/|$)/g;

/**
 * An address (a full URL or only a path) as a log line or an error report may
 * carry it: no query string or fragment, which hold emailed-link tokens and
 * search terms; no id, and no path segment that looks like a credential, because
 * some routes put one in the path (`/api/wellness/share/<token>`, a referee's
 * form, an export download); and the text itself scrubbed like any other.
 */
export function scrubAddress(address: string): string {
  const cut = address.search(/[?#]/);
  const withoutQuery = cut === -1 ? address : address.slice(0, cut);
  return scrubText(withoutQuery).replace(UUID, ':id').replace(OPAQUE_SEGMENT, '/:token');
}

/** A user agent as it may be logged: scrubbed, then clipped to USER_AGENT_MAX_LENGTH. */
export function clipUserAgent(userAgent: unknown): string | undefined {
  return typeof userAgent === 'string' ? clip(scrubText(userAgent), USER_AGENT_MAX_LENGTH) : undefined;
}

/**
 * Keys whose values never belong in a log line, or in an error report. A log
 * is copied, shipped and searched by more people than the database is, so a
 * password or token that lands in one has left the building. Matched on the
 * key, whatever the depth, before any transport sees the record.
 *
 * Two kinds of key are here. Secrets (a password, a token, a key) are
 * obvious. The rest is personal: who a woman is (her address, her phone, her
 * name, where she connected from) and what she wrote (a message, a search, a
 * cover letter, a note). On a platform for women leaving unsafe situations,
 * "she searched for ..." and "she wrote ..." in a log that is kept for weeks
 * is exactly the record somebody else would want. Ids stay: a log line is
 * only useful if it can say which row it was about.
 */
export const SENSITIVE_KEY =
  /^(password|passwordHash|newPassword|currentPassword|confirmPassword|token|accessToken|refreshToken|idToken|credential|credentials|authorization|cookie|cookies|set-cookie|secret|clientSecret|client_secret|apiKey|api_key|twoFactorCode|twoFactorSecret|recoveryCode|recoveryCodes|otp|privateKey|private_key|jwt|sessionToken|resetToken|verificationToken|pin|safePin|email|emailAddress|email_address|refereeEmail|recipientEmail|phone|phoneNumber|phone_number|mobile|mobileNumber|ip|ipAddress|ip_address|remoteAddress|clientIp|firstName|lastName|fullName|legalName|dateOfBirth|dob|streetAddress|content|messageContent|messageBody|body|text|query|resumeText|coverLetter|bio|answers)$/i;

/** Kept, but short: see USER_AGENT_MAX_LENGTH. */
export const USER_AGENT_KEY = /^(user-?agent|ua)$/i;

const MAX_DEPTH = 8;

/**
 * An error as a plain object that survives JSON, with its message and stack
 * scrubbed.
 *
 * Two things were wrong with passing an Error through whole. JSON.stringify
 * writes an Error as {} (message and stack are not enumerable), so
 * `{ error }` in a meta object logged nothing about what broke; and where a
 * message did get out, it went out raw, and the message of a database or
 * provider error routinely contains the data of the call that failed.
 */
function plainError(error: Error, depth: number, seen: WeakSet<object>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: error.name,
    message: scrubText(error.message),
  };
  if (error.stack) out.stack = scrubText(error.stack);
  for (const [key, item] of Object.entries(error)) {
    if (key === 'name' || key === 'message' || key === 'stack') continue;
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(item, depth + 1, seen);
  }
  // `cause` is non-enumerable when it came through the constructor.
  if (error.cause !== undefined && !('cause' in out)) {
    out.cause = redactSensitive(error.cause, depth + 1, seen);
  }
  return out;
}

/**
 * A copy of anything that is about to be logged or reported, with every
 * sensitive key's value replaced, every string scrubbed (scrubText), every
 * Error turned into a plain object, and every user agent clipped. Cycles and
 * anything deeper than eight levels become a marker. The original is not
 * touched.
 */
export function redactSensitive(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH) return '[depth]';
  // Dates and buffers are kept whole: walking their keys would empty them.
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (value instanceof Error) return plainError(value, depth, seen);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = REDACTED;
    } else if (USER_AGENT_KEY.test(key) && typeof item === 'string') {
      out[key] = clipUserAgent(item);
    } else {
      out[key] = redactSensitive(item, depth + 1, seen);
    }
  }
  return out;
}
