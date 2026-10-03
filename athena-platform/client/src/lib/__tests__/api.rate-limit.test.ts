import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

/**
 * The API client on a 429: a read waits what Retry-After says and goes again
 * once; a write does not repeat by itself; a refusal that stays says something
 * calm. Run through the real client with an adapter standing in for the
 * network.
 */

import { api } from '../api';
import { CALM_RATE_LIMIT_MESSAGE } from '../rate-limit-backoff';

function refused(config: InternalAxiosRequestConfig, retryAfter: string, message = 'Too many requests, please try again later.') {
  return new AxiosError('Request failed with status code 429', 'ERR_BAD_REQUEST', config, null, {
    status: 429,
    statusText: 'Too Many Requests',
    headers: { 'retry-after': retryAfter },
    config,
    data: { success: false, message },
  });
}

describe('the API client on a 429', () => {
  const originalAdapter = api.defaults.adapter;
  let calls: string[];

  beforeEach(() => {
    jest.useFakeTimers();
    calls = [];
  });
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    jest.useRealTimers();
  });

  /** An adapter that refuses `refusals` times, then answers 200. */
  function adapterRefusing(refusals: number, retryAfter = '2'): AxiosAdapter {
    let seen = 0;
    return async (config) => {
      calls.push(`${config.method} ${config.url}`);
      seen += 1;
      if (seen <= refusals) throw refused(config, retryAfter);
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
  }

  it('waits for Retry-After and repeats a read once, and the caller never sees the 429', async () => {
    api.defaults.adapter = adapterRefusing(1, '2');

    const pending = api.get('/notifications');
    await jest.advanceTimersByTimeAsync(1_000);
    expect(calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toMatchObject({ status: 200, data: { ok: true } });
    expect(calls).toEqual(['get /notifications', 'get /notifications']);
  });

  it('does not keep trying: a second 429 is the answer, with the calm sentence', async () => {
    api.defaults.adapter = adapterRefusing(5, '1');

    const pending = api.get('/notifications');
    const settled = pending.then(
      () => null,
      (error) => error
    );
    await jest.advanceTimersByTimeAsync(5_000);
    const error = await settled;

    expect(calls).toHaveLength(2);
    expect(error.response.status).toBe(429);
    expect(error.response.data.message).toBe(CALM_RATE_LIMIT_MESSAGE);
  });

  it('does not repeat a write by itself', async () => {
    api.defaults.adapter = adapterRefusing(1, '1');

    const settled = api.post('/posts', { content: 'hello' }).then(
      () => null,
      (error) => error
    );
    await jest.advanceTimersByTimeAsync(5_000);
    const error = await settled;

    expect(calls).toEqual(['post /posts']);
    expect(error.response.status).toBe(429);
  });

  it('does not hide a long wait: the window of a spent budget fails straight away, calmly', async () => {
    api.defaults.adapter = adapterRefusing(1, '840');

    const settled = api.get('/jobs').then(
      () => null,
      (error) => error
    );
    await jest.advanceTimersByTimeAsync(1_000);
    const error = await settled;

    expect(calls).toHaveLength(1);
    expect(error.response.data.message).toBe(CALM_RATE_LIMIT_MESSAGE);
  });

  it('keeps a specific refusal’s own words', async () => {
    api.defaults.adapter = async (config) => {
      throw refused(config, '3000', 'You have asked to follow this member several times in the last hour.');
    };

    // A path the contract check does not mistake for a call the app makes.
    const someRoute = ['', 'anything', 'specific'].join('/');
    const settled = api.post(someRoute).then(
      () => null,
      (error) => error
    );
    await jest.advanceTimersByTimeAsync(1_000);
    const error = await settled;

    expect(error.response.data.message).toBe('You have asked to follow this member several times in the last hour.');
  });
});
