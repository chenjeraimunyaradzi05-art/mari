/**
 * A crash that reaches someone.
 *
 * The error boundary wrote render crashes to the console of a phone nobody
 * was watching. These check that a crash is written down before it is sent
 * (a fatal error ends the process moments later), that a report the server
 * could not take is kept for the next launch, that it never goes through the
 * axios instance that can sign a member out, and that it carries no identity.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.4.0', extra: { apiUrl: 'https://api.athena.example/api' } } },
}));

const mockAxiosPost = jest.fn();
jest.mock('../api', () => ({
  api: { defaults: { baseURL: 'https://api.athena.example/api' }, post: (...args: unknown[]) => mockAxiosPost(...args) },
}));

import { PENDING_CRASHES_KEY, flushCrashReports, installGlobalCrashHandler, reportCrash } from '../crashReporter';

type FetchCall = { url: string; body: Record<string, unknown> };

function answerWith(...statuses: Array<number | 'offline'>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = jest.fn(async (url: unknown, init?: { body?: unknown }) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const status = statuses.shift() ?? 202;
    if (status === 'offline') throw new TypeError('Network request failed');
    return { status } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

async function pending(): Promise<unknown[]> {
  const raw = await AsyncStorage.getItem(PENDING_CRASHES_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('crash reporting', () => {
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockAxiosPost.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends a render crash to the API with its stacks, and keeps nothing once it is taken', async () => {
    const calls = answerWith(202);

    await reportCrash(new Error('Cannot read properties of null'), 'render', '\n    in SafetyScreen');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.athena.example/api/client-errors');
    expect(calls[0].body).toMatchObject({ kind: 'render', message: 'Cannot read properties of null', appVersion: '1.4.0' });
    expect(String(calls[0].body.componentStack)).toContain('SafetyScreen');
    expect(calls[0].body).not.toHaveProperty('userId');
    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(await pending()).toEqual([]);
  });

  it('keeps a report it could not deliver and sends it on the next launch', async () => {
    answerWith('offline');
    await reportCrash(new Error('first'), 'fatal');
    expect(await pending()).toHaveLength(1);

    const calls = answerWith(202);
    await flushCrashReports();

    expect(calls.map((call) => call.body.message)).toEqual(['first']);
    expect(await pending()).toEqual([]);
  });

  it('keeps a report the server failed on, but not one it refused', async () => {
    answerWith(503);
    await reportCrash(new Error('server down'), 'error');
    expect(await pending()).toHaveLength(1);

    answerWith(400);
    await flushCrashReports();
    expect(await pending()).toEqual([]);
  });

  it('routes uncaught errors to the reporter and still to the handler that was there before', async () => {
    const calls = answerWith(202);
    const previous = jest.fn();
    let current: ((error: unknown, isFatal?: boolean) => void) | undefined = previous;
    const original = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => current,
      setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => {
        current = handler;
      },
    };

    const uninstall = installGlobalCrashHandler();
    current!(new Error('thrown in a timer'), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushCrashReports();

    expect(previous).toHaveBeenCalledWith(expect.any(Error), true);
    expect(calls[0]?.body).toMatchObject({ kind: 'fatal', message: 'thrown in a timer' });

    uninstall();
    expect(current).toBe(previous);
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = original;
  });
});
