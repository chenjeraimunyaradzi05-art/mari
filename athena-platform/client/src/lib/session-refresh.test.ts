import { refreshEndedTheSession, refreshSession, resetSessionRefreshForTests } from './session-refresh';

const mockPost = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

const post = mockPost;

describe('refreshSession', () => {
  beforeEach(() => {
    post.mockReset();
    resetSessionRefreshForTests();
  });

  it('collapses concurrent callers onto one request', async () => {
    let resolve!: (value: unknown) => void;
    post.mockReturnValue(new Promise((r) => { resolve = r; }));

    const first = refreshSession();
    const second = refreshSession();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('/api/auth/refresh');

    resolve({ data: { data: { accessToken: 'tok', user: { id: 'u1' } } } });

    await expect(first).resolves.toEqual({ accessToken: 'tok', user: { id: 'u1' } });
    await expect(second).resolves.toEqual({ accessToken: 'tok', user: { id: 'u1' } });
  });

  it('starts a fresh request once the previous one has settled', async () => {
    post.mockResolvedValueOnce({ data: { data: { accessToken: 'a' } } });
    await refreshSession();

    post.mockResolvedValueOnce({ data: { data: { accessToken: 'b' } } });
    const again = await refreshSession();

    expect(post).toHaveBeenCalledTimes(2);
    expect(again).toEqual({ accessToken: 'b', user: null });
  });

  it('lets the next caller retry after a failure', async () => {
    post.mockRejectedValueOnce(new Error('401'));
    await expect(refreshSession()).rejects.toThrow('401');

    post.mockResolvedValueOnce({ data: { data: { accessToken: 'c' } } });
    await expect(refreshSession()).resolves.toEqual({ accessToken: 'c', user: null });
  });

  it('sends the cookie, and gives up on a request that never answers', async () => {
    post.mockResolvedValueOnce({ data: { data: { accessToken: 'a' } } });
    await refreshSession();

    const [, , config] = post.mock.calls[0];
    expect(config.withCredentials).toBe(true);
    expect(config.timeout).toBeGreaterThan(0);
  });
});

/**
 * The server answers 409 to a refresh that arrives just after another one from
 * the same browser rotated the session. She is still signed in and the cookie
 * is already the new one, so the right response is to ask again; treating it as
 * a failure signs her out of a session that is perfectly good.
 */
describe('a refresh that races another one', () => {
  const conflict = () => Object.assign(new Error('Request failed with status code 409'), { response: { status: 409 } });

  beforeEach(() => {
    jest.useFakeTimers();
    post.mockReset();
    resetSessionRefreshForTests();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('asks again after a 409 and returns the session the second answer carries', async () => {
    post.mockRejectedValueOnce(conflict());
    post.mockResolvedValueOnce({ data: { data: { accessToken: 'fresh', user: { id: 'u1' } } } });

    const pending = refreshSession();
    await jest.advanceTimersByTimeAsync(300);

    await expect(pending).resolves.toEqual({ accessToken: 'fresh', user: { id: 'u1' } });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('gives up after a few tries rather than looping, and reports the failure', async () => {
    post.mockRejectedValue(conflict());

    const pending = refreshSession();
    const settled = pending.then(
      () => 'resolved',
      (error: { response?: { status?: number } }) => error.response?.status
    );
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(settled).resolves.toBe(409);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('does not retry a refusal that is real', async () => {
    post.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }));

    const pending = refreshSession();
    const settled = pending.then(
      () => 'resolved',
      (error: { response?: { status?: number } }) => error.response?.status
    );
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(settled).resolves.toBe(401);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

/**
 * Two tabs whose access tokens expire together. The cookie is shared and the
 * promise above is not, so each tab refreshed with the same cookie. A tab now
 * takes a Web Lock, and the one that waited is handed the other's result
 * instead of rotating the session a second time.
 *
 * jsdom has neither Web Locks nor BroadcastChannel, so both are stood in for
 * with the behaviour that matters: one holder at a time, and a message reaches
 * every other tab but not the sender. The second tab is a second copy of the
 * module, which is what a second tab is.
 */
describe('refreshing from two tabs', () => {
  class FakeLocks {
    private tail: Promise<unknown> = Promise.resolve();
    request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
      const run = this.tail.then(() => callback());
      this.tail = run.catch(() => undefined);
      return run;
    }
  }

  class FakeBroadcastChannel {
    static open = new Set<FakeBroadcastChannel>();
    onmessage: ((event: { data: unknown }) => void) | null = null;
    constructor(readonly name: string) {
      FakeBroadcastChannel.open.add(this);
    }
    postMessage(data: unknown) {
      for (const other of FakeBroadcastChannel.open) {
        if (other !== this && other.name === this.name) {
          queueMicrotask(() => other.onmessage?.({ data: JSON.parse(JSON.stringify(data)) }));
        }
      }
    }
    close() {
      FakeBroadcastChannel.open.delete(this);
    }
  }

  let otherTab: typeof import('./session-refresh');
  const realLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const globals = globalThis as unknown as { BroadcastChannel?: unknown };
  const realChannel = globals.BroadcastChannel;

  beforeEach(() => {
    post.mockReset();
    Object.defineProperty(navigator, 'locks', { value: new FakeLocks(), configurable: true });
    globals.BroadcastChannel = FakeBroadcastChannel;
    resetSessionRefreshForTests();
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      otherTab = require('./session-refresh');
    });
  });

  afterEach(() => {
    otherTab.resetSessionRefreshForTests();
    resetSessionRefreshForTests();
    FakeBroadcastChannel.open.clear();
    if (realLocks) Object.defineProperty(navigator, 'locks', realLocks);
    else delete (navigator as unknown as { locks?: unknown }).locks;
    globals.BroadcastChannel = realChannel;
  });

  it('rotates once: the tab that waited takes the result of the refresh that just ran', async () => {
    let finish!: (value: unknown) => void;
    post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));

    const first = refreshSession();
    // Let the first tab take the lock and start its request.
    await Promise.resolve();
    await Promise.resolve();
    const second = otherTab.refreshSession();
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);

    finish({ data: { data: { accessToken: 'one-rotation', user: { id: 'u1' } } } });

    await expect(first).resolves.toEqual({ accessToken: 'one-rotation', user: { id: 'u1' } });
    await expect(second).resolves.toEqual({ accessToken: 'one-rotation', user: { id: 'u1' } });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not borrow a result from before it started waiting', async () => {
    post.mockResolvedValueOnce({ data: { data: { accessToken: 'earlier', user: null } } });
    await refreshSession();
    // Let the message reach the other tab.
    await Promise.resolve();
    await Promise.resolve();

    // Its own token expires later, and it needs a refresh of its own.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    post.mockResolvedValueOnce({ data: { data: { accessToken: 'later', user: null } } });

    await expect(otherTab.refreshSession()).resolves.toEqual({ accessToken: 'later', user: null });
    expect(post).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });

  it('takes the lock in turn when the first refresh failed, and tries for itself', async () => {
    let fail!: (reason: unknown) => void;
    post.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    post.mockResolvedValueOnce({ data: { data: { accessToken: 'second-try', user: null } } });

    const first = refreshSession();
    const firstOutcome = first.then(() => 'ok', () => 'failed');
    await Promise.resolve();
    await Promise.resolve();
    const second = otherTab.refreshSession();
    await Promise.resolve();

    fail(new Error('network'));

    await expect(firstOutcome).resolves.toBe('failed');
    await expect(second).resolves.toEqual({ accessToken: 'second-try', user: null });
    expect(post).toHaveBeenCalledTimes(2);
  });
});

/**
 * What a failed refresh says about the session. The page signs the member out
 * and sends to the sign-in screen only when the server turned the refresh
 * down; every other way of failing leaves a cookie that is still good.
 */
describe('refreshEndedTheSession', () => {
  const answered = (status: number) => ({ isAxiosError: true, response: { status } });

  it.each([400, 401, 403])('is true when the server answers %s', (status) => {
    expect(refreshEndedTheSession(answered(status))).toBe(true);
  });

  it('is true when the refresh answered but carried no token, which is an error of ours and not a network one', () => {
    expect(refreshEndedTheSession(new Error('Session refresh returned no access token'))).toBe(true);
  });

  it.each([
    ['the connection dropped, so there was no answer', { isAxiosError: true, message: 'Network Error' }],
    ['the request timed out', { isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 20000ms exceeded' }],
    ['the proxy could not reach the API during a deploy (503)', answered(503)],
    ['the API failed (500)', answered(500)],
    ['the API is slowing the member down (429)', answered(429)],
    ['another refresh kept winning the race (409)', answered(409)],
  ])('is false when %s', (_label, failure) => {
    expect(refreshEndedTheSession(failure)).toBe(false);
  });

  it('is true for an empty failure rather than keeping a session nobody can vouch for', () => {
    expect(refreshEndedTheSession(null)).toBe(true);
    expect(refreshEndedTheSession(undefined)).toBe(true);
  });
});
