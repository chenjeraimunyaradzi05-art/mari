/**
 * The phone's side of refreshing a session.
 *
 * The server never put a refresh token in a sign-in response (a browser keeps
 * it in an HttpOnly cookie, which this app has no jar for), and /auth/refresh in
 * production reads the cookie only. So the app read `refreshToken` off the
 * login body, got undefined, and every expired access token ended in "No
 * refresh token" and a sign-out. A client that sends X-Athena-Client: mobile is
 * now handed the token in the body and sends it back in the body. These pin the
 * app's half of that:
 *
 *  - the header is on sign-in and on the refresh call;
 *  - a 401 refreshes once however many requests failed together, replays the
 *    request with the new access token, and keeps rotating with the new
 *    refresh token (the old one is dead on the server the moment it is used);
 *  - the rotated pair is handed to the app to be saved before the request is
 *    replayed, or a cold start would restore a retired token;
 *  - a refusal ends the session, but a phone that is merely offline is not
 *    signed out.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.ourdomain.org/api' } } },
}));

import { api, onSessionExpired, onTokensRefreshed, setAuthTokens } from '../api';

type Seen = { url: string; authorization: string | undefined; client: string | undefined };

/** The server's side of one endpoint: 401 for any token but the current one. */
function serverAccepting(currentAccess: () => string, seen: Seen[]) {
  return async (config: any) => {
    const authorization = config.headers?.get?.('Authorization') ?? config.headers?.Authorization;
    const client = config.headers?.get?.('X-Athena-Client') ?? config.headers?.['X-Athena-Client'];
    seen.push({ url: String(config.url), authorization, client });
    if (authorization === `Bearer ${currentAccess()}`) {
      return { data: { success: true, data: { ok: true } }, status: 200, statusText: 'OK', headers: {}, config };
    }
    const error: any = new Error('Request failed with status code 401');
    error.isAxiosError = true;
    error.config = config;
    error.response = { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' };
    throw error;
  };
}

function refused(status: number) {
  const error: any = new Error(`Request failed with status code ${status}`);
  error.isAxiosError = true;
  error.response = { status, data: {}, headers: {}, statusText: 'x' };
  return error;
}

describe('refreshing from the phone app', () => {
  const originalAdapter = api.defaults.adapter;
  let current = 'access-2';
  let seen: Seen[] = [];
  let refreshCalls: Array<{ url: string; body: any; headers: any }> = [];
  let refreshAnswer: () => Promise<unknown>;
  let post: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    current = 'access-2';
    seen = [];
    refreshCalls = [];
    refreshAnswer = async () => ({
      data: { success: true, data: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.defaults.adapter = serverAccepting(() => current, seen) as any;
    post = jest.spyOn(axios, 'post').mockImplementation((async (url: string, body: unknown, config: any) => {
      refreshCalls.push({ url, body, headers: config?.headers });
      return refreshAnswer();
    }) as any);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    setAuthTokens(null, null);
    jest.restoreAllMocks();
  });

  it('says it is the phone app on every call, sign-in included', async () => {
    setAuthTokens('access-2', 'refresh-1');
    await api.get('/auth/me');
    expect(seen[0].client).toBe('mobile');
  });

  it('refreshes on a 401 with the refresh token in the body, and replays the request with the new access token', async () => {
    setAuthTokens('access-1', 'refresh-1');

    const response = await api.get('/auth/me');

    expect(response.data.data.ok).toBe(true);
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0].url).toBe('https://api.ourdomain.org/api/auth/refresh');
    expect(refreshCalls[0].body).toEqual({ refreshToken: 'refresh-1' });
    expect(refreshCalls[0].headers).toMatchObject({ 'X-Athena-Client': 'mobile' });
    expect(seen.map((call) => call.authorization)).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('refreshes once when several requests fail together, and shares the answer', async () => {
    setAuthTokens('access-1', 'refresh-1');

    const results = await Promise.all([api.get('/auth/me'), api.get('/notifications'), api.get('/messages/conversations')]);

    expect(results.every((result) => result.data.data.ok)).toBe(true);
    expect(refreshCalls).toHaveLength(1);
  });

  it('hands the rotated pair to the app before it replays the request', async () => {
    setAuthTokens('access-1', 'refresh-1');
    const order: string[] = [];
    const unsubscribe = onTokensRefreshed(async (tokens) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`saved:${tokens.accessToken}:${tokens.refreshToken}`);
    });
    // The replay is the first request that carries the new token.
    const adapter = api.defaults.adapter as (config: any) => Promise<unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.defaults.adapter = (async (config: any) => {
      const authorization = config.headers?.get?.('Authorization') ?? config.headers?.Authorization;
      if (authorization === 'Bearer access-2') order.push('replayed');
      return adapter(config);
    }) as any;

    await api.get('/auth/me');

    expect(order).toEqual(['saved:access-2:refresh-2', 'replayed']);
    unsubscribe();
  });

  it('presents the rotated refresh token next time, not the one that was retired', async () => {
    setAuthTokens('access-1', 'refresh-1');
    await api.get('/auth/me');

    // The access token expires again.
    current = 'access-3';
    refreshAnswer = async () => ({
      data: { success: true, data: { accessToken: 'access-3', refreshToken: 'refresh-3', expiresIn: 900 } },
    });
    await api.get('/auth/me');

    expect(refreshCalls.map((call) => call.body.refreshToken)).toEqual(['refresh-1', 'refresh-2']);
  });

  it('keeps the refresh token it has when the answer carries only an access token', async () => {
    setAuthTokens('access-1', 'refresh-1');
    refreshAnswer = async () => ({ data: { success: true, data: { accessToken: 'access-2', expiresIn: 900 } } });
    await api.get('/auth/me');

    current = 'access-3';
    refreshAnswer = async () => ({ data: { success: true, data: { accessToken: 'access-3', refreshToken: 'refresh-3' } } });
    await api.get('/auth/me');

    expect(refreshCalls[1].body.refreshToken).toBe('refresh-1');
  });

  it('signs her out when the server refuses the refresh, whichever way it refuses', async () => {
    for (const status of [400, 401, 403, 409]) {
      setAuthTokens('access-1', 'refresh-1');
      refreshAnswer = async () => {
        throw refused(status);
      };
      const heard: string[] = [];
      const unsubscribe = onSessionExpired(() => heard.push('expired'));

      await expect(api.get('/auth/me')).rejects.toBeTruthy();

      expect(heard).toEqual(['expired']);
      unsubscribe();
    }
  });

  it('does not retry the retired token after a 409, which would only burn her other sessions', async () => {
    setAuthTokens('access-1', 'refresh-1');
    refreshAnswer = async () => {
      throw refused(409);
    };

    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(refreshCalls).toHaveLength(1);
  });

  it('does not sign her out for a dropped signal, a timeout, a 429 or a server error', async () => {
    const failures: any[] = [
      Object.assign(new Error('Network Error'), { isAxiosError: true }),
      Object.assign(new Error('timeout of 10000ms exceeded'), { isAxiosError: true, code: 'ECONNABORTED' }),
      refused(429),
      refused(503),
    ];

    for (const failure of failures) {
      setAuthTokens('access-1', 'refresh-1');
      refreshAnswer = async () => {
        throw failure;
      };
      const heard: string[] = [];
      const unsubscribe = onSessionExpired(() => heard.push('expired'));
      const saved: unknown[] = [];
      const stopSaving = onTokensRefreshed((tokens) => {
        saved.push(tokens);
      });

      await expect(api.get('/auth/me')).rejects.toBeTruthy();

      expect(heard).toEqual([]);
      expect(saved).toEqual([]);
      // Her tokens are still there for the next try.
      refreshAnswer = async () => ({ data: { success: true, data: { accessToken: 'access-2', refreshToken: 'refresh-2' } } });
      await expect(api.get('/auth/me')).resolves.toBeTruthy();
      expect(refreshCalls[refreshCalls.length - 1].body.refreshToken).toBe('refresh-1');

      unsubscribe();
      stopSaving();
      current = 'access-2';
    }
    expect(post).toHaveBeenCalled();
  });

  it('still announces the end of the session when there is no refresh token to try', async () => {
    setAuthTokens('access-1', null);
    const heard: string[] = [];
    const unsubscribe = onSessionExpired(() => heard.push('expired'));

    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(heard).toEqual(['expired']);
    expect(refreshCalls).toHaveLength(0);
    unsubscribe();
  });

  it('never tries to refresh the sign-in call itself', async () => {
    setAuthTokens(null, 'refresh-1');

    await expect(api.post('/auth/login', { email: 'a@b.co', password: 'wrong' })).rejects.toBeTruthy();

    expect(refreshCalls).toHaveLength(0);
  });
});
