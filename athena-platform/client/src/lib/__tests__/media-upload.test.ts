/**
 * Uploads leave the browser for the API itself.
 *
 * The same-origin /api proxy on Netlify is a function that buffers the whole
 * request and refuses a body over about 6 MB, so a reel (500 MB), a post
 * picture (20 MB), a cover or a résumé (10 MB) could never be uploaded from the
 * web through it. Only the upload calls move; everything else stays on the
 * proxy, where the session cookie is handled.
 */

type FakeClient = {
  defaults: { baseURL?: string; withCredentials?: boolean };
  post: jest.Mock;
  get: jest.Mock;
  delete: jest.Mock;
  interceptors: { request: { use: jest.Mock }; response: { use: jest.Mock } };
};

// The import of ../api below is hoisted above this module's own statements, and
// it is what creates the clients, so they are collected on globalThis, which
// exists when it runs.
type Registry = { __uploadTestClients?: FakeClient[] };
const clients = () => (globalThis as unknown as Registry).__uploadTestClients ?? [];

jest.mock('axios', () => {
  const create = jest.fn((config: { baseURL?: string; withCredentials?: boolean }) => {
    const client: FakeClient = {
      defaults: config,
      post: jest.fn(async () => ({ data: { success: true, data: { url: 'https://cdn.example/x' } } })),
      get: jest.fn(),
      delete: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    };
    const registry = globalThis as unknown as Registry;
    (registry.__uploadTestClients ??= []).push(client);
    return client;
  });
  return { __esModule: true, default: { create, post: jest.fn() } };
});

import { API_ORIGIN, mediaApi } from '../api';

const proxyClient = () => clients().find((client) => client.defaults.baseURL === '/api')!;
const uploadClient = () => clients().find((client) => client.defaults.baseURL === `${API_ORIGIN}/api`)!;

describe('mediaApi uploads', () => {
  beforeEach(() => {
    proxyClient().post.mockClear();
    uploadClient().post.mockClear();
  });

  it('has a client for the API origin that sends no cookie, and keeps the proxy client for everything else', () => {
    expect(uploadClient()).toBeDefined();
    expect(uploadClient().defaults.withCredentials).toBe(false);
    expect(proxyClient().defaults.withCredentials).toBe(true);
  });

  it('sends a file to the API, not through the proxy', async () => {
    const file = new File(['x'], 'reel.mp4', { type: 'video/mp4' });

    await mediaApi.upload('video', file);

    expect(uploadClient().post).toHaveBeenCalledTimes(1);
    expect(uploadClient().post.mock.calls[0][0]).toBe('/media/upload/video');
    expect((uploadClient().post.mock.calls[0][1] as FormData).get('file')).toBe(file);
    expect(proxyClient().post).not.toHaveBeenCalled();
  });

  it('does the same for a résumé and for post pictures', async () => {
    const cv = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    const pictures = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];

    await mediaApi.uploadResume(cv);
    await mediaApi.uploadPostImages(pictures);

    expect(uploadClient().post.mock.calls.map((call) => call[0])).toEqual(['/media/resume', '/media/post-images']);
    expect((uploadClient().post.mock.calls[1][1] as FormData).getAll('images')).toHaveLength(2);
    expect(proxyClient().post).not.toHaveBeenCalled();
  });

  it('leaves small calls on the proxy, where the session cookie lives', async () => {
    await mediaApi.downloadUrl('resumes/u1/cv.pdf');

    expect(proxyClient().post).toHaveBeenCalledWith('/media/download-url', { key: 'resumes/u1/cv.pdf' });
    expect(uploadClient().post).not.toHaveBeenCalled();
  });

  it('puts the access token on an upload', () => {
    // Registered once on creation: the interceptor is what carries the Bearer token.
    expect(uploadClient().interceptors.request.use).toHaveBeenCalledTimes(1);
    expect(uploadClient().interceptors.response.use).toHaveBeenCalledTimes(1);
  });
});
