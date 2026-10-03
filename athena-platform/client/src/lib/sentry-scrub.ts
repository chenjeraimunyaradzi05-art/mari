/**
 * What is removed from an error report before it leaves for Sentry.
 *
 * Next.js hands the server's error hook (`onRequestError`) the request the
 * error happened in, and Sentry attaches that request's headers to the report.
 * Among them are the member's session cookie and, on calls that carry one, her
 * bearer token. Neither belongs in a third party's database because an error
 * happened to occur while she was signed in, so both are dropped here, by
 * name and whatever the capitalisation, along with a parsed cookie map.
 *
 * The browser init (instrumentation-client.ts) does the same for what it sees.
 */

// The part of a report this reads and writes. The function takes any object, because
// a report carries far more than this and Sentry's own event type has no index
// signature to satisfy a stricter one.
type WithRequest = { request?: { headers?: unknown; cookies?: unknown } };

const CREDENTIAL_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization']);

export function withoutCredentials<E extends object>(event: E): E {
  const request = (event as WithRequest).request;
  if (!request) return event;

  const headers = request.headers;
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
    for (const name of Object.keys(headers)) {
      if (CREDENTIAL_HEADERS.has(name.toLowerCase())) {
        delete (headers as Record<string, unknown>)[name];
      }
    }
  }
  delete request.cookies;

  return event;
}

// ---------------------------------------------------------------------------
// The words and the addresses of a report
// ---------------------------------------------------------------------------
//
// withoutCredentials above removes what is attached to a report. This removes
// what is written in it. A page's address carries the one-time token of an
// emailed link (/verify-email?token=..., /reset-password?token=...) and the
// terms of a search, an error's own message can hold a member's email address,
// and a breadcrumb for a request or a navigation holds the address it went to.
// Each of those reaches a third party's database because an error happened on
// the page, so the query string and fragment of every address are cut and the
// text is cleaned of what has a recognisable shape.
//
// The API's own reports are cleaned by the same rules (server/src/utils/
// log-scrub.ts, applied in scrubEvent in server/src/utils/sentry.ts). They are
// kept in step by hand: the two packages do not share code.
//
// An address loses more than its query string. Some of the API's routes, and
// the web host's proxy in front of them, carry a credential in the path (a
// health-record share link, a referee's form, an export download), and the
// error hook below attaches the path of the request it came from.

// Bounded for the reason the API's copy is (server/src/utils/log-scrub.ts): an
// unbounded local part is quadratic on a long run of address-like characters.
const EMAIL_ADDRESS = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const JSON_WEB_TOKEN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const BEARER_CREDENTIAL = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const SECRET_PARAMETER =
  /((?:^|[?&;\s])(?:token|access_token|refresh_token|id_token|secret|password|sig|signature|auth|api_key|apikey)=)[^&\s"'<>]+/gi;
const LONG_HEX = /\b[a-f0-9]{48,}\b/gi;
const PHONE_NUMBER = /(?<![\w.])(?:(?:\+?61[\s-]?|0)4(?:[\s-]?\d){8}|\+\d{1,3}(?:[\s-]?\d){7,12})(?!\d)/g;
const MAX_SCANNED_LENGTH = 20_000;

/** Removes email addresses, bearer credentials and web tokens, secrets in links, long hex tokens and phone numbers from a piece of text. */
export function scrubReportText(text: string): string {
  let out = text.length > MAX_SCANNED_LENGTH ? `${text.slice(0, MAX_SCANNED_LENGTH)}…[cut]` : text;
  out = out
    .replace(JSON_WEB_TOKEN, '[token]')
    .replace(BEARER_CREDENTIAL, 'Bearer [redacted]')
    .replace(SECRET_PARAMETER, '$1[redacted]')
    .replace(LONG_HEX, '[token]');
  if (out.includes('@')) out = out.replace(EMAIL_ADDRESS, '[email]');
  return out.replace(PHONE_NUMBER, '[phone]');
}

/** An address without its query string or fragment, which carry tokens and search terms. */
export function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// A path segment that is one long unbroken run of token characters is a
// credential, not a word: no page or route of this product is named that way.
const OPAQUE_SEGMENT = /\/[A-Za-z0-9_-]{20,}(?=\/|$)/g;

/**
 * An address as a report may carry it: no query string or fragment, no id and
 * no path segment that looks like a credential, and the text scrubbed.
 */
export function scrubAddress(address: string): string {
  return scrubReportText(withoutQuery(address)).replace(UUID, ':id').replace(OPAQUE_SEGMENT, '/:token');
}

// The only request headers a report keeps. Next.js hands the error hook every
// header of the request it was handling, and the browser SDK adds the Referer:
// among them are the visitor's address (x-forwarded-for and the host's own
// client-address headers), the page she came from with its query string, and
// whatever the proxy in front of the site adds. None is of use in finding a
// bug, so the list is of what is, as the API's own reports do (scrubEvent in
// server/src/utils/sentry.ts), and not of what is known to be harmful.
const KEPT_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-length',
  'content-type',
  'host',
  'user-agent',
  'x-request-id',
]);
const USER_AGENT_MAX_LENGTH = 120;

type Loose = Record<string, unknown>;

// The attributes of a breadcrumb or a span that hold an address, and the ones that hold a body.
const ADDRESS_KEYS = ['url', 'url.full', 'http.url', 'http.target', 'from', 'to'];
// Where Next.js's error hook records the request's path (with its query string) and the route that answered.
const NEXTJS_ADDRESS_KEYS = ['request_path', 'router_path'];
const DROPPED_KEYS = ['url.query', 'http.query', 'http.request.body.data', 'body', 'request_body_size'];

function cleanAttributes(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const attributes = data as Loose;
  for (const key of DROPPED_KEYS) delete attributes[key];
  for (const key of ADDRESS_KEYS) {
    const value = attributes[key];
    if (typeof value === 'string') attributes[key] = scrubAddress(value);
  }
}

type Report = {
  message?: unknown;
  transaction?: unknown;
  request?: Loose;
  exception?: { values?: Array<{ value?: unknown }> };
  breadcrumbs?: Array<{ message?: unknown; data?: unknown }>;
  spans?: Array<{ data?: unknown }>;
  contexts?: { trace?: { data?: unknown }; nextjs?: unknown };
  extra?: unknown;
};

/**
 * Everything in withoutCredentials, and the report's words and addresses
 * cleaned as described above. Changes and returns the event it is given; the
 * `beforeSend` and `beforeSendTransaction` of every Sentry init in the web app.
 */
export function scrubReport<E extends object>(event: E): E {
  withoutCredentials(event);
  const report = event as Report;

  const request = report.request;
  if (request) {
    delete request.data;
    delete request.query_string;
    if (typeof request.url === 'string') request.url = scrubAddress(request.url);
    const headers = request.headers;
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      const kept: Loose = {};
      for (const [name, value] of Object.entries(headers as Loose)) {
        const lower = name.toLowerCase();
        if (!KEPT_REQUEST_HEADERS.has(lower)) continue;
        kept[name] =
          lower === 'user-agent' && typeof value === 'string'
            ? scrubReportText(value).slice(0, USER_AGENT_MAX_LENGTH)
            : value;
      }
      request.headers = kept;
    }
  }

  if (typeof report.message === 'string') report.message = scrubReportText(report.message);
  if (typeof report.transaction === 'string') report.transaction = scrubAddress(report.transaction);
  for (const exception of report.exception?.values ?? []) {
    if (typeof exception.value === 'string') exception.value = scrubReportText(exception.value);
  }
  for (const breadcrumb of report.breadcrumbs ?? []) {
    if (typeof breadcrumb.message === 'string') breadcrumb.message = scrubReportText(breadcrumb.message);
    cleanAttributes(breadcrumb.data);
  }
  cleanAttributes(report.contexts?.trace?.data);
  const nextjs = report.contexts?.nextjs;
  if (nextjs && typeof nextjs === 'object') {
    const context = nextjs as Loose;
    for (const key of NEXTJS_ADDRESS_KEYS) {
      if (typeof context[key] === 'string') context[key] = scrubAddress(context[key] as string);
    }
  }
  for (const span of report.spans ?? []) cleanAttributes(span.data);
  // Anything attached by hand: not used by the web app today, so dropped rather than guessed at.
  delete report.extra;

  return event;
}
