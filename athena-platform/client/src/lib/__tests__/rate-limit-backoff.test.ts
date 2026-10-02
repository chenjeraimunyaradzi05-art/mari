import {
  CALM_RATE_LIMIT_MESSAGE,
  MAX_AUTOMATIC_WAIT_SECONDS,
  automaticRetryDelayMs,
  isRepeatableMethod,
  retryAfterSeconds,
  softenRateLimitMessage,
} from '../rate-limit-backoff';

describe('retryAfterSeconds', () => {
  it('reads whole seconds, from a plain header bag or from axios headers', () => {
    expect(retryAfterSeconds({ 'retry-after': '7' })).toBe(7);
    expect(retryAfterSeconds({ 'Retry-After': '12' })).toBe(12);
    expect(retryAfterSeconds({ get: (name: string) => (name === 'retry-after' ? '3' : undefined) })).toBe(3);
  });

  it('reads an HTTP date as the seconds until it', () => {
    const now = Date.parse('2026-10-02T00:00:00Z');
    expect(retryAfterSeconds({ 'retry-after': 'Fri, 02 Oct 2026 00:00:30 GMT' }, now)).toBe(30);
    expect(retryAfterSeconds({ 'retry-after': 'Thu, 01 Oct 2026 23:00:00 GMT' }, now)).toBe(0);
  });

  it('is null when there is nothing to trust', () => {
    expect(retryAfterSeconds(undefined)).toBeNull();
    expect(retryAfterSeconds({})).toBeNull();
    expect(retryAfterSeconds({ 'retry-after': 'soon' })).toBeNull();
  });
});

describe('automaticRetryDelayMs', () => {
  const headers = { 'retry-after': '5' };

  it('waits what the server said, plus a little jitter, for a read', () => {
    expect(automaticRetryDelayMs({ method: 'get' }, headers, 100)).toBe(5100);
    expect(automaticRetryDelayMs({ method: 'GET' }, headers, 0)).toBe(5000);
    expect(automaticRetryDelayMs({}, headers, 0)).toBe(5000);
  });

  it('never repeats a write by itself, because she pressed a button for it', () => {
    for (const method of ['post', 'put', 'patch', 'delete']) {
      expect(automaticRetryDelayMs({ method }, headers, 0)).toBeNull();
    }
    expect(isRepeatableMethod('delete')).toBe(false);
    expect(isRepeatableMethod('head')).toBe(true);
  });

  it('repeats once, not for ever', () => {
    expect(automaticRetryDelayMs({ method: 'get', _rateLimitRetried: true }, headers, 0)).toBeNull();
  });

  it('does not hide a long wait: the full window of a spent budget is told to her instead', () => {
    expect(automaticRetryDelayMs({ method: 'get' }, { 'retry-after': String(MAX_AUTOMATIC_WAIT_SECONDS) }, 0)).toBe(
      MAX_AUTOMATIC_WAIT_SECONDS * 1000
    );
    expect(automaticRetryDelayMs({ method: 'get' }, { 'retry-after': String(MAX_AUTOMATIC_WAIT_SECONDS + 1) }, 0)).toBeNull();
    expect(automaticRetryDelayMs({ method: 'get' }, { 'retry-after': '840' }, 0)).toBeNull();
  });

  it('does nothing without a Retry-After, or without a request', () => {
    expect(automaticRetryDelayMs({ method: 'get' }, {}, 0)).toBeNull();
    expect(automaticRetryDelayMs(undefined, headers, 0)).toBeNull();
  });
});

describe('softenRateLimitMessage', () => {
  it('replaces the server’s generic sentence, on both fields screens read', () => {
    const error = { response: { data: { success: false, message: 'Too many requests, please try again later.', error: 'Too many requests, please try again later.' } } };

    softenRateLimitMessage(error);

    expect(error.response.data).toMatchObject({ message: CALM_RATE_LIMIT_MESSAGE, error: CALM_RATE_LIMIT_MESSAGE });
  });

  it('keeps a refusal that says something specific', () => {
    const specific = 'You have asked to follow this member several times in the last hour. Please wait a while before trying again.';
    const error = { response: { data: { message: specific } } };

    softenRateLimitMessage(error);

    expect(error.response.data.message).toBe(specific);
  });

  it('gives an answer with no readable body a sentence at all', () => {
    const error: { response: { data?: unknown } } = { response: { data: '<html>Bad gateway</html>' } };

    softenRateLimitMessage(error);

    expect(error.response.data).toEqual({ success: false, message: CALM_RATE_LIMIT_MESSAGE });
  });
});
