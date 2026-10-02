import * as Sentry from '@sentry/node';
import { logger } from './logger';
import { clipUserAgent, redactSensitive, scrubAddress, scrubText } from './log-scrub';

let skipLogged = false;

/**
 * What an error report may say about the request it came from: that it was a
 * request, from what kind of client, to which route. Never who sent it or what
 * it carried.
 *
 * Sentry's HTTP integration attaches the incoming request to every event: the
 * body (up to 10 kB by default), the query string, the cookies and the
 * headers. On this platform a request body is a safe-chat message and the PIN
 * that opens the chat, a health note, a booking reason or a password, and any
 * failure of ours on those routes would have shipped it to a third party. So
 * nothing is attached at the source (see initSentry), and this removes whatever
 * still arrives, which is the second wall: an SDK upgrade that changes a
 * default must not be what decides whether a member's words leave.
 */
const KEPT_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-length',
  'content-type',
  'host',
  'user-agent',
  'x-request-id',
]);

/**
 * Attributes (of a breadcrumb, a trace or a span) that hold a query string or a
 * body, and the ones that hold a URL, which may contain a query string and,
 * for the routes that carry a credential in the path (a health-record share
 * link, a referee's form, an export download), the credential itself: see
 * scrubAddress. A breadcrumb for an outgoing request keeps its URL under `url`.
 */
const DROPPED_ATTRIBUTES = ['url.query', 'http.query', 'http.request.body.data'];
const URL_ATTRIBUTES = ['url', 'url.full', 'http.url', 'http.target'];

function scrubAttributes(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const attributes = data as Record<string, unknown>;
  for (const key of DROPPED_ATTRIBUTES) delete attributes[key];
  for (const key of URL_ATTRIBUTES) {
    const value = attributes[key];
    if (typeof value === 'string') attributes[key] = scrubAddress(value);
  }
}

/**
 * Removes what must never leave: the request body, cookies and query string,
 * every header outside a short allow-list, the query string and any credential
 * in the path of every URL the event mentions, and anything about the person
 * beyond her id. Also the text:
 * an error's message, the breadcrumbs and anything attached by hand are
 * cleaned of email addresses, tokens, phone numbers and the arguments a
 * database error echoes back (utils/log-scrub.ts), because a message such as
 * "Unique constraint failed ... her@example.org" is the commonest way a
 * member's details reach an error report without ever being in a request.
 * Changes and returns the event it is given; used for errors and for
 * transactions.
 */
export function scrubEvent<T extends Sentry.Event>(event: T): T {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    if (request.headers) {
      const kept: Record<string, string> = {};
      for (const [name, value] of Object.entries(request.headers)) {
        const lower = name.toLowerCase();
        if (!KEPT_REQUEST_HEADERS.has(lower)) continue;
        // A user agent is kept, but short (the same limit the logger holds to).
        kept[name] = lower === 'user-agent' ? (clipUserAgent(value) ?? value) : value;
      }
      request.headers = kept;
    }
    if (typeof request.url === 'string') request.url = scrubAddress(request.url);
  }

  if (event.user) {
    const { id } = event.user;
    event.user = id === undefined ? undefined : { id };
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (typeof breadcrumb.message === 'string') breadcrumb.message = scrubText(breadcrumb.message);
    scrubAttributes(breadcrumb.data);
    if (breadcrumb.data) breadcrumb.data = redactSensitive(breadcrumb.data) as typeof breadcrumb.data;
  }
  scrubAttributes(event.contexts?.trace?.data);
  for (const span of event.spans ?? []) scrubAttributes(span.data);

  if (typeof event.message === 'string') event.message = scrubText(event.message);
  // The name of a transaction is the route that answered, but for a request no
  // route answered it is the path as it came.
  if (typeof event.transaction === 'string') event.transaction = scrubAddress(event.transaction);
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === 'string') exception.value = scrubText(exception.value);
    // Local variables of a stack frame, should an integration ever attach them.
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }
  if (event.extra) event.extra = redactSensitive(event.extra) as typeof event.extra;

  return event;
}

/**
 * What Sentry is started with. Its own function so that a test can start the
 * real SDK with exactly these options and a transport of its own (see
 * utils/__tests__/sentry.test.ts), instead of asserting on a copy of them.
 */
export function sentryOptions(dsn: string): Sentry.NodeOptions {
  return {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.npm_package_version || '1.0.0',

    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions

    // Set sampling rate for profiling
    profilesSampleRate: 0.1,

    // There used to be a captureConsoleIntegration here. The server logs
    // through winston, which writes to the stream and not through console,
    // so it heard nothing it was meant to; the one thing it would have picked
    // up is a stray console.warn, and a warning line can carry a member's
    // details to a third party. Failures reach Sentry from errorHandler and
    // the process-level handlers instead.

    // The SDK attaches the incoming request body to every event by default
    // ('medium': up to 10 kB). Here that is a safe-chat message and its PIN, a
    // health note or a password, sent to a third party on any failure of ours.
    // 'none' stops it being captured at all; scrubEvent removes what is left,
    // and a test (utils/__tests__/sentry.test.ts) holds both to it.
    integrations: [Sentry.httpIntegration({ maxIncomingRequestBodySize: 'none' })],

    // Filter out sensitive data
    beforeSend(event) {
      // Don't send events in development
      if (process.env.NODE_ENV !== 'production') {
        return null;
      }

      return scrubEvent(event);
    },

    // A transaction carries the same request, and its spans the same URLs.
    beforeSendTransaction(event) {
      return scrubEvent(event);
    },

    // Ignore common non-error exceptions
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'cancelled',
    ],
  };
}

/**
 * Initialize Sentry error tracking for production. Returns whether Sentry is
 * running once it has been called.
 *
 * Called twice on a normal boot, and safe to call again. start.ts calls it
 * before it loads index.ts, because Sentry's tracing attaches to express and
 * http as they are first required, and index.ts requires both on its first
 * line: initialised from startServer, as it used to be, errors were reported
 * (errorHandler sends them) but no request was ever traced. startServer calls
 * it again after the secrets manager has been read ('after-secrets'), for a
 * deployment whose DSN only arrives from there; that late start still reports
 * errors, and says that tracing will not attach.
 */
export function initSentry(phase: 'before-app' | 'after-secrets' = 'before-app'): boolean {
  if (Sentry.getClient()) return true;

  const dsn = process.env.SENTRY_DSN;

  if (!dsn || process.env.NODE_ENV !== 'production') {
    if (!skipLogged) {
      skipLogged = true;
      logger.info('Sentry: Skipping initialization (not in production or DSN not set)');
    }
    return false;
  }

  Sentry.init(sentryOptions(dsn));

  if (phase === 'after-secrets') {
    logger.warn(
      'Sentry: started after the app was loaded, because its DSN came from the secrets manager. Errors are reported; requests are not traced. Set SENTRY_DSN in the environment to trace them.'
    );
  } else {
    logger.info('Sentry: Initialized successfully');
  }
  return true;
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

/**
 * A crash the mobile app reported about itself (see client-crash-report.ts).
 * Built as an Error carrying the phone's own stack, so Sentry groups repeats
 * of one crash together, and tagged so it never reads as a server fault.
 */
export function captureClientCrash(report: {
  kind: string;
  message: string;
  stack?: string;
  componentStack?: string;
  platform?: string;
  appVersion?: string;
}): void {
  if (process.env.NODE_ENV !== 'production' || !process.env.SENTRY_DSN) return;
  const error = new Error(report.message);
  error.name = `MobileCrash(${report.kind})`;
  if (report.stack) error.stack = `${error.name}: ${report.message}\n${report.stack}`;
  Sentry.captureException(error, {
    tags: { source: 'mobile', kind: report.kind, platform: report.platform ?? 'unknown', appVersion: report.appVersion ?? 'unknown' },
    extra: report.componentStack ? { componentStack: report.componentStack } : undefined,
  });
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; role?: string }): void {
  // Her id and nothing else: an error report has no use for her address, and
  // scrubEvent would remove it before it left anyway.
  Sentry.setUser({ id: user.id });
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };
