/**
 * The session, from the phone's side.
 *
 * AuthContext holds the tokens that are the member's account on this phone,
 * and until now it was only ever exercised from the api.ts end. These pin
 * down what it does with them: where they are kept, that a sign-out takes
 * this phone off her push notifications before the session ends, that a
 * session the server has ended puts the sign-in screen back and clears the
 * stored tokens, and that an account still waiting for email verification is
 * not treated as signed in.
 */
import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const mockGet = jest.fn<(url: string) => Promise<unknown>>();
const mockPost = jest.fn<(url: string, body?: unknown) => Promise<unknown>>();
const mockSetAuthTokens = jest.fn();
const mockExpiryListeners: Array<() => void> = [];
jest.mock('../../services/api', () => ({
  api: {
    get: (url: string) => mockGet(url),
    post: (url: string, body?: unknown) => mockPost(url, body),
  },
  setAuthTokens: (...args: unknown[]) => mockSetAuthTokens(...args),
  onSessionExpired: (listener: () => void) => {
    mockExpiryListeners.push(listener);
    return () => {
      const index = mockExpiryListeners.indexOf(listener);
      if (index >= 0) mockExpiryListeners.splice(index, 1);
    };
  },
  unwrapApiData: (payload: any) => payload?.data ?? payload,
}));

const mockCalls: string[] = [];
jest.mock('../../services/pushNotifications', () => ({
  syncPushToken: jest.fn(async () => {
    mockCalls.push('push:sync');
  }),
  unsyncPushToken: jest.fn(async () => {
    mockCalls.push('push:unsync');
  }),
}));
jest.mock('../../services/socket', () => ({
  socketService: {
    connect: jest.fn(() => mockCalls.push('socket:connect')),
    disconnect: jest.fn(() => mockCalls.push('socket:disconnect')),
  },
}));
jest.mock('../../utils/preferences', () => ({
  resolvePreferences: jest.fn(async () => ({})),
  setLocalPreferences: jest.fn(async () => undefined),
}));

import { AuthProvider, useAuth } from '../AuthContext';

type Auth = ReturnType<typeof useAuth>;

const USER = { id: 'u1', email: 'mara@example.com', firstName: 'Mara', lastName: 'Nguyen', persona: 'EARLY_CAREER' };

async function mountProvider(): Promise<{ current: () => Auth; unmount: () => void }> {
  let latest!: Auth;
  function Probe() {
    latest = useAuth();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { current: () => latest, unmount: () => act(() => renderer.unmount()) };
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockCalls.length = 0;
    mockExpiryListeners.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the tokens in the secure store on sign-in, and registers this phone once', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' } } });
    const auth = await mountProvider();

    await act(async () => {
      await auth.current().login('mara@example.com', 'Correct-Horse-9', '123456');
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'mara@example.com', password: 'Correct-Horse-9', twoFactorCode: '123456' });
    expect(mockStore.get('athena_access_token')).toBe('access-1');
    expect(mockStore.get('athena_refresh_token')).toBe('refresh-1');
    expect(mockSetAuthTokens).toHaveBeenLastCalledWith('access-1', 'refresh-1');
    expect(auth.current().isAuthenticated).toBe(true);
    expect(mockCalls.filter((call) => call === 'push:sync')).toHaveLength(1);
    auth.unmount();
  });

  it('restores a stored session at launch, and registers this phone once for it', async () => {
    mockStore.set('athena_access_token', 'access-1');
    mockStore.set('athena_refresh_token', 'refresh-1');
    mockGet.mockResolvedValueOnce({ data: { success: true, data: USER } });

    const auth = await mountProvider();

    expect(mockSetAuthTokens).toHaveBeenCalledWith('access-1', 'refresh-1');
    expect(auth.current().user?.id).toBe('u1');
    expect(mockCalls).toEqual(expect.arrayContaining(['socket:connect', 'push:sync']));
    expect(mockCalls.filter((call) => call === 'push:sync')).toHaveLength(1);
    auth.unmount();
  });

  it('throws away stored tokens the server no longer accepts, and stays signed out', async () => {
    mockStore.set('athena_access_token', 'stale');
    mockGet.mockRejectedValueOnce({ response: { status: 401 } });

    const auth = await mountProvider();

    expect(auth.current().isAuthenticated).toBe(false);
    expect(auth.current().isLoading).toBe(false);
    expect(mockStore.has('athena_access_token')).toBe(false);
    expect(mockCalls).not.toContain('push:sync');
    auth.unmount();
  });

  it('takes this phone off her notifications before it ends the session on sign-out', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' } } });
    mockPost.mockImplementation(async (url: string) => {
      mockCalls.push(`post:${url}`);
      return { data: { success: true } };
    });
    const auth = await mountProvider();
    await act(async () => {
      await auth.current().login('mara@example.com', 'Correct-Horse-9');
    });
    mockCalls.length = 0;

    await act(async () => {
      await auth.current().logout();
    });

    // The socket first, then the push handover while the session still
    // works, then the server's own sign-out.
    expect(mockCalls).toEqual(['socket:disconnect', 'push:unsync', 'post:/auth/logout']);
    expect(mockStore.size).toBe(0);
    expect(mockSetAuthTokens).toHaveBeenLastCalledWith(null, null);
    expect(auth.current().isAuthenticated).toBe(false);
    auth.unmount();
  });

  it('puts the sign-in screen back when the server ends the session, and clears the stored tokens', async () => {
    mockStore.set('athena_access_token', 'access-1');
    mockStore.set('athena_refresh_token', 'refresh-1');
    mockGet.mockResolvedValueOnce({ data: { success: true, data: USER } });
    const auth = await mountProvider();
    expect(auth.current().isAuthenticated).toBe(true);

    await act(async () => {
      mockExpiryListeners.forEach((listener) => listener());
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(auth.current().isAuthenticated).toBe(false);
    expect(mockCalls).toContain('socket:disconnect');
    expect(mockStore.size).toBe(0);
    auth.unmount();
  });

  it('does not sign in an account that is still waiting for email verification', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { user: USER, verificationRequired: true } } });
    const auth = await mountProvider();

    let result!: { verificationRequired: boolean };
    await act(async () => {
      result = await auth.current().register({
        email: 'mara@example.com',
        password: 'Correct-Horse-9',
        firstName: 'Mara',
        lastName: 'Nguyen',
        persona: 'EARLY_CAREER',
        womanSelfAttested: true,
        dateOfBirth: '1990-01-01',
      });
    });

    expect(result).toEqual({ verificationRequired: true });
    expect(mockStore.size).toBe(0);
    expect(auth.current().isAuthenticated).toBe(false);
    expect(mockCalls).not.toContain('push:sync');
    auth.unmount();
  });
});
