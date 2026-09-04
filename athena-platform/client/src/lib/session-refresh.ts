import axios from 'axios';

/**
 * One refresh at a time.
 *
 * The refresh token is single-use: the server rotates it on every call and,
 * if it ever sees a token it has already rotated, treats that as a replay of
 * a stolen token and revokes every session the member has. That is the right
 * rule. It also means two refresh calls in flight at once are fatal: the
 * second one presents the token the first just rotated, and the member is
 * signed out everywhere for no reason.
 *
 * That happened on every full page load in development. React mounts effects
 * twice under Strict Mode, so the session bootstrap in providers.tsx fired
 * two refreshes back to back; the second one came back 401, the server burned
 * the session, and the next authenticated request (a comment, a like) was
 * answered 401 and bounced the member to /login. The 401 interceptor in
 * api.ts has the same exposure whenever several requests fail together.
 *
 * Every caller goes through this one promise. Concurrent callers share it;
 * the next call after it settles starts a fresh one.
 */

export interface RefreshedSession {
  accessToken: string | null;
  user: Record<string, unknown> | null;
}

let inFlight: Promise<RefreshedSession> | null = null;

export function refreshSession(): Promise<RefreshedSession> {
  if (!inFlight) {
    inFlight = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then((response) => ({
        accessToken: (response.data?.data?.accessToken as string | undefined) ?? null,
        user: (response.data?.data?.user as Record<string, unknown> | undefined) ?? null,
      }))
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
