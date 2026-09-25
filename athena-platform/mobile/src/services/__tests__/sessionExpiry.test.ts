/**
 * What happens when the access token can no longer be refreshed.
 *
 * The interceptor cleared its own copy of the tokens and told nobody, so
 * AuthContext went on holding a `user` and the app went on rendering the
 * signed-in navigator over an account it could not reach: every screen empty,
 * every action failing, and no sign-in form to get back through until the
 * member force-quit. These assert the announcement the sign-out now depends
 * on, and that it is not made for the requests where it would be wrong.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.athena.com/api' } } },
}));

import { api, onSessionExpired, setAuthTokens } from '../api';

function unauthorizedAdapter() {
  return async (config: unknown) => {
    const error = new Error('Request failed with status code 401') as Error & {
      config: unknown;
      response: unknown;
      isAxiosError: boolean;
    };
    error.isAxiosError = true;
    error.config = config;
    error.response = { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' };
    throw error;
  };
}

describe('a session that cannot be refreshed', () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    setAuthTokens(null, null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.defaults.adapter = unauthorizedAdapter() as any;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    setAuthTokens(null, null);
  });

  it('announces the end of the session so the app can sign her out', async () => {
    const heard: string[] = [];
    const unsubscribe = onSessionExpired(() => heard.push('expired'));
    setAuthTokens('an-access-token-that-no-longer-works', null);

    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(heard).toEqual(['expired']);
    unsubscribe();
  });

  it('announces it once, not on every failing request that follows', async () => {
    const heard: string[] = [];
    const unsubscribe = onSessionExpired(() => heard.push('expired'));
    setAuthTokens('an-access-token-that-no-longer-works', null);

    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    await expect(api.get('/notifications')).rejects.toBeTruthy();
    await expect(api.get('/messages/conversations')).rejects.toBeTruthy();

    expect(heard).toEqual(['expired']);
    unsubscribe();
  });

  it('says nothing when a signed-out visitor gets a 401 from the sign-in form', async () => {
    const heard: string[] = [];
    const unsubscribe = onSessionExpired(() => heard.push('expired'));

    await expect(api.post('/auth/login', { email: 'a@b.com', password: 'wrong' })).rejects.toBeTruthy();

    expect(heard).toEqual([]);
    unsubscribe();
  });

  it('does not keep calling a listener that has unsubscribed', async () => {
    const heard: string[] = [];
    const unsubscribe = onSessionExpired(() => heard.push('expired'));
    unsubscribe();
    setAuthTokens('an-access-token-that-no-longer-works', null);

    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(heard).toEqual([]);
  });

  it('lets the remaining listeners hear it when one of them throws', async () => {
    const heard: string[] = [];
    const first = onSessionExpired(() => {
      throw new Error('this listener is broken');
    });
    const second = onSessionExpired(() => heard.push('expired'));
    setAuthTokens('an-access-token-that-no-longer-works', null);

    await expect(api.get('/auth/me')).rejects.toBeTruthy();

    expect(heard).toEqual(['expired']);
    first();
    second();
  });
});
