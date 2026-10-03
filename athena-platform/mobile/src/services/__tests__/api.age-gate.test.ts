/**
 * The phone's side of the minimum age. The server refuses every write from an
 * account with no date of birth, or one under the minimum; the phone had no
 * handling for either, so the member saw whichever button she pressed fail and
 * nothing about why. The API layer now announces the refusal to whoever is
 * listening (the prompt mounted at the root), and still fails the request for
 * its caller.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.ourdomain.org/api' } } },
}));

import { api, onAgeGateRefusal } from '../api';
import type { AgeGateRefusal } from '../../utils/ageGate';

function refuse(status: number, data: Record<string, unknown>) {
  return async (config: any) => {
    const error: any = new Error(`Request failed with status code ${status}`);
    error.isAxiosError = true;
    error.config = config;
    error.response = { status, data, headers: {}, config, statusText: 'x' };
    throw error;
  };
}

describe('the API layer and an age refusal', () => {
  const originalAdapter = api.defaults.adapter;
  let heard: AgeGateRefusal[];
  let stop: () => void;

  beforeEach(() => {
    heard = [];
    stop = onAgeGateRefusal((refusal) => heard.push(refusal));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stop();
    api.defaults.adapter = originalAdapter;
    jest.restoreAllMocks();
  });

  it('announces a missing date of birth, and still fails the request for its caller', async () => {
    api.defaults.adapter = refuse(403, { code: 'DATE_OF_BIRTH_REQUIRED', error: 'Please add your date of birth before using this part of ATHENA.' }) as any;

    await expect(api.post('/posts', { content: 'hello' })).rejects.toMatchObject({ response: { status: 403 } });

    expect(heard).toEqual([{ code: 'DATE_OF_BIRTH_REQUIRED', message: 'Please add your date of birth before using this part of ATHENA.' }]);
  });

  it('announces an under-age account', async () => {
    api.defaults.adapter = refuse(403, { code: 'MINIMUM_AGE_NOT_MET', error: 'ATHENA accounts are for adults.' }) as any;

    await expect(api.post('/posts', { content: 'hello' })).rejects.toBeTruthy();

    expect(heard).toEqual([{ code: 'MINIMUM_AGE_NOT_MET', message: 'ATHENA accounts are for adults.' }]);
  });

  it('says nothing for an ordinary refusal', async () => {
    api.defaults.adapter = refuse(403, { message: 'Forbidden' }) as any;

    await expect(api.post('/posts', { content: 'hello' })).rejects.toBeTruthy();

    expect(heard).toEqual([]);
  });

  it('stops telling a listener that has been removed', async () => {
    api.defaults.adapter = refuse(403, { code: 'DATE_OF_BIRTH_REQUIRED' }) as any;
    stop();

    await expect(api.post('/posts', { content: 'hello' })).rejects.toBeTruthy();

    expect(heard).toEqual([]);
  });

  it('is not stopped by a listener that throws: the others still hear it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const stopThrowing = onAgeGateRefusal(() => {
      throw new Error('boom');
    });
    api.defaults.adapter = refuse(403, { code: 'DATE_OF_BIRTH_REQUIRED' }) as any;

    await expect(api.post('/posts', { content: 'hello' })).rejects.toBeTruthy();
    stopThrowing();

    expect(heard).toHaveLength(1);
  });
});
