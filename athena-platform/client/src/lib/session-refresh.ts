import axios from 'axios';

/**
 * One refresh at a time, in this tab and across every tab of the browser.
 *
 * The refresh token is single-use: the server rotates it on every call and,
 * if it ever sees a token it has already rotated, treats that as a replay of
 * a stolen token. That is the right rule. It also means two refresh calls in
 * flight at once are dangerous: the second one presents the token the first
 * just rotated.
 *
 * Within a tab that happened on every full page load in development. React
 * mounts effects twice under Strict Mode, so the session bootstrap in
 * providers.tsx fired two refreshes back to back. The 401 interceptor in
 * api.ts has the same exposure whenever several requests fail together. Every
 * caller in the tab goes through one promise; concurrent callers share it and
 * the next call after it settles starts a fresh one.
 *
 * Across tabs the cookie is shared but the promise is not. Two tabs whose
 * access tokens expire together (a laptop waking from sleep does exactly that)
 * each refreshed with the same cookie. The server now reads a second request
 * that arrives moments after the first from the same browser as a second tab
 * and answers it with 409 instead of revoking anything, but the member should
 * not depend on that: tabs take a Web Lock, so one refreshes at a time, and the
 * tab that waited is handed the result of the refresh that just ran instead of
 * rotating the session a second time. Where Web Locks or BroadcastChannel do
 * not exist the tab falls back to the 409 retry below, which is also what
 * covers a refresh racing one from outside the page.
 */

export interface RefreshedSession {
  accessToken: string | null;
  user: Record<string, unknown> | null;
}

const LOCK_NAME = 'athena-session-refresh';
const CHANNEL_NAME = 'athena-session-refresh';

/** How long a refresh that another tab has just finished is still the answer. */
const HANDOFF_FRESH_MS = 8_000;

/** The server's word for "another request just rotated this session; ask again". */
const REFRESH_IN_PROGRESS_STATUS = 409;
/** After a 409 the cookie has already been replaced; one or two short waits are plenty. */
const RETRY_WAITS_MS = [250, 750];

/** A refresh that hangs must not hold the lock for every other tab. */
const REQUEST_TIMEOUT_MS = 20_000;

let inFlight: Promise<RefreshedSession> | null = null;

// ---------------------------------------------------------------------------
// Hand-off between tabs

interface HandOff {
  /** When the refresh finished, on this machine's clock. */
  at: number;
  session: RefreshedSession;
}

let channel: BroadcastChannel | null | undefined;
let lastHandOff: HandOff | null = null;

function isHandOff(value: unknown): value is HandOff {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HandOff>;
  return (
    typeof candidate.at === 'number' &&
    !!candidate.session &&
    typeof candidate.session === 'object' &&
    (typeof candidate.session.accessToken === 'string' || candidate.session.accessToken === null)
  );
}

/** Opened on first use, and only where the browser has one. */
function handOffChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent) => {
        if (isHandOff(event.data)) lastHandOff = event.data;
      };
    }
  } catch {
    channel = null;
  }
  return channel;
}

function announceRefreshed(session: RefreshedSession): void {
  try {
    const message: HandOff = { at: Date.now(), session };
    handOffChannel()?.postMessage(message);
  } catch {
    // A tab that cannot be told refreshes for itself; nothing is lost.
  }
}

// ---------------------------------------------------------------------------
// The request

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRefreshInProgress(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === REFRESH_IN_PROGRESS_STATUS;
}

/**
 * Whether a failed refresh means the session is over, so the page should drop
 * its token and send the member to sign in. Only the server saying so does: a
 * refusal (400, 401, 403) or an answer that carried no token. A connection that
 * dropped, a request that timed out, a 429, a 5xx while the API redeploys, and a
 * 409 that outlasted the retries above all say nothing about the session: the
 * cookie is still good, and bouncing the member to the sign-in page for them
 * signs out a session that is fine. For those the failed request simply fails
 * and the next one refreshes again.
 */
export function refreshEndedTheSession(error: unknown): boolean {
  const failure = error as { isAxiosError?: boolean; response?: { status?: number } } | null;
  // Not an HTTP failure at all: the refresh answered without a usable token.
  if (!failure?.isAxiosError && failure?.response === undefined) return true;
  const status = failure?.response?.status;
  return status === 400 || status === 401 || status === 403;
}

async function requestRefresh(): Promise<RefreshedSession> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await axios.post(
        '/api/auth/refresh',
        {},
        { withCredentials: true, timeout: REQUEST_TIMEOUT_MS }
      );
      return {
        accessToken: (response.data?.data?.accessToken as string | undefined) ?? null,
        user: (response.data?.data?.user as Record<string, unknown> | undefined) ?? null,
      };
    } catch (error) {
      // Another request of this browser rotated the session a moment ago. The
      // member is still signed in and the cookie is already the new one, so ask
      // again rather than signing her out. Any other failure is real.
      const pause = RETRY_WAITS_MS[attempt];
      if (isRefreshInProgress(error) && pause !== undefined) {
        await wait(pause);
        continue;
      }
      throw error;
    }
  }
}

async function refreshAcrossTabs(): Promise<RefreshedSession> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') {
    return requestRefresh();
  }

  const waitingSince = Date.now();
  // Listening has to start before the lock is asked for, or the hand-off from
  // the tab we are queued behind could arrive and be missed.
  handOffChannel();

  return locks.request(LOCK_NAME, async () => {
    // The tab ahead of us in the queue may have finished while we waited. Its
    // result is newer than the moment we started waiting, so it is a refresh
    // this tab would otherwise have made; use it rather than rotating again.
    if (lastHandOff && lastHandOff.at >= waitingSince && Date.now() - lastHandOff.at < HANDOFF_FRESH_MS) {
      return lastHandOff.session;
    }

    const session = await requestRefresh();
    announceRefreshed(session);
    return session;
  });
}

export function refreshSession(): Promise<RefreshedSession> {
  if (!inFlight) {
    inFlight = refreshAcrossTabs().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Forgets what other tabs handed over. For tests, which share one module between cases. */
export function resetSessionRefreshForTests(): void {
  inFlight = null;
  lastHandOff = null;
  if (channel) {
    try {
      channel.close();
    } catch {
      // Already closed.
    }
  }
  channel = undefined;
}
