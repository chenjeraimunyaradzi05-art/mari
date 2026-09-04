import axios from 'axios';
import { refreshSession } from './session-refresh';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const post = axios.post as jest.Mock;

describe('refreshSession', () => {
  beforeEach(() => {
    post.mockReset();
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
});
