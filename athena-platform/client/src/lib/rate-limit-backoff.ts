/**
 * What the web app does when the API says it is going too fast (429).
 *
 * It used to do nothing. A page that asked for something while the member's
 * budget was spent showed a failed list or a toast of the server's own words,
 * and the next poll tried again straight away and failed again. The server
 * says how long to wait (Retry-After, in seconds, on every 429), so a call that
 * is safe to repeat waits that long once and goes again, if the wait is short
 * enough that she would not notice it; and a refusal that stays shows a calm
 * sentence instead of the generic one.
 *
 * Only a read is repeated automatically. A 429 means the request was refused
 * before anything ran, so repeating a write would be safe too, but a write is
 * something she pressed a button for and a pause after pressing it is
 * something she should see rather than have hidden.
 */

/** A wait longer than this is not hidden from her: the call fails and she is told. */
export const MAX_AUTOMATIC_WAIT_SECONDS = 20;

/** Instead of the server's one generic sentence for a spent budget. Specific refusals are left as they are. */
export const CALM_RATE_LIMIT_MESSAGE =
  'ATHENA is getting a lot of requests from you at once. Give it a minute, then try again.';

const GENERIC_SERVER_MESSAGE = /^too many requests,? please try again later\.?$/i;

/** The Retry-After header as whole seconds, or null when there is none worth trusting. */
export function retryAfterSeconds(headers: unknown, now: number = Date.now()): number | null {
  const raw = readHeader(headers, 'retry-after');
  if (raw === null) return null;

  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 24 * 60 * 60);

  // The other form the header may take: an HTTP date.
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.ceil((when - now) / 1000));
}

function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null;
  const bag = headers as { get?: (key: string) => unknown } & Record<string, unknown>;
  const value = typeof bag.get === 'function' ? bag.get(name) : bag[name] ?? bag[name.replace(/(^|-)([a-z])/g, (_m, dash: string, ch: string) => dash + ch.toUpperCase())];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

/** Whether a request may be sent again without her pressing anything: a read. */
export function isRepeatableMethod(method: unknown): boolean {
  const verb = typeof method === 'string' ? method.toLowerCase() : 'get';
  return verb === 'get' || verb === 'head';
}

/**
 * How long to wait before repeating a refused request, in milliseconds, or
 * null when it should not be repeated by itself: not a read, already repeated
 * once, no Retry-After, or one too long to hide.
 */
export function automaticRetryDelayMs(
  request: { method?: unknown; _rateLimitRetried?: boolean } | undefined,
  headers: unknown,
  jitterMs: number = Math.floor(Math.random() * 400)
): number | null {
  if (!request || request._rateLimitRetried || !isRepeatableMethod(request.method)) return null;

  const seconds = retryAfterSeconds(headers);
  if (seconds === null || seconds > MAX_AUTOMATIC_WAIT_SECONDS) return null;

  return seconds * 1000 + jitterMs;
}

/**
 * Swaps the server's generic "Too many requests" sentence for the calm one,
 * on the error a caller is about to read. A route that says something specific
 * (follow this member again in an hour) keeps saying it.
 */
export function softenRateLimitMessage(error: { response?: { data?: unknown } }): void {
  const data = error.response?.data;
  if (!data || typeof data !== 'object') {
    if (error.response) error.response.data = { success: false, message: CALM_RATE_LIMIT_MESSAGE };
    return;
  }

  const body = data as { message?: unknown; error?: unknown };
  const current = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
  if (current === '' || GENERIC_SERVER_MESSAGE.test(current.trim())) {
    body.message = CALM_RATE_LIMIT_MESSAGE;
    body.error = CALM_RATE_LIMIT_MESSAGE;
  }
}
