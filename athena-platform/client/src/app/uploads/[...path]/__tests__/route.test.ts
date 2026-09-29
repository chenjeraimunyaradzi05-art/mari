/**
 * @jest-environment node
 */

/**
 * The /uploads proxy: members' photographs, résumés and reels on their way
 * from the API to the browser.
 *
 * Two faults are pinned here. It read every file whole (`arrayBuffer()`)
 * before sending a byte, so a reel sat in the function's memory and anything
 * past Netlify's buffered-response cap failed outright. And it waited on the
 * API with no deadline, so an API that accepted the connection and never
 * answered held the function open until the platform killed it. The body now
 * streams through, and the deadline covers the wait for the first answer only,
 * so a long reel is not cut off half-played.
 */

import { NextRequest } from 'next/server';
import { GET, HEAD } from '../route';

const fetchMock = jest.spyOn(global, 'fetch');

function uploadsRequest(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? 'GET', headers: init.headers });
}

/** A response whose body can be read only as a stream; reading it whole fails the test. */
function streamOnlyResponse(body: string, init: ResponseInit): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, 'arrayBuffer', {
    value: () => {
      throw new Error('The proxy read the whole body into memory');
    },
  });
  return response;
}

afterEach(() => {
  fetchMock.mockReset();
  jest.useRealTimers();
});

afterAll(() => {
  fetchMock.mockRestore();
});

describe('GET /uploads/[...path]', () => {
  it('streams the file through without reading it into memory first', async () => {
    fetchMock.mockResolvedValue(
      streamOnlyResponse('reel-bytes', { status: 200, headers: { 'content-type': 'video/mp4', 'cache-control': 'public, max-age=60' } })
    );

    const response = await GET(uploadsRequest('/uploads/reels/a.mp4'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await response.text()).toBe('reel-bytes');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5000/uploads/reels/a.mp4', expect.objectContaining({ method: 'GET' }));
  });

  it('forwards Range, so a video can be sought, and hands back the partial answer', async () => {
    fetchMock.mockResolvedValue(
      streamOnlyResponse('bytes', { status: 206, headers: { 'content-range': 'bytes 0-4/100', 'content-type': 'video/mp4' } })
    );

    const response = await GET(uploadsRequest('/uploads/reels/a.mp4', { headers: { range: 'bytes=0-4' } }));

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-4/100');
    const sent = fetchMock.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(sent.headers.range).toBe('bytes=0-4');
  });

  it('drops the length the API sent for a body fetch has already decompressed', async () => {
    fetchMock.mockResolvedValue(
      new Response('decoded', { status: 200, headers: { 'content-encoding': 'gzip', 'content-length': '3', 'content-type': 'image/svg+xml' } })
    );

    const response = await GET(uploadsRequest('/uploads/avatars/a.svg'));

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.text()).toBe('decoded');
  });

  it('answers a 304 with no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 304, headers: { etag: '"abc"' } }));

    const response = await GET(uploadsRequest('/uploads/avatars/a.png', { headers: { 'if-none-match': '"abc"' } }));

    expect(response.status).toBe(304);
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.body).toBeNull();
  });

  it('says the API took too long when it never answers, rather than waiting until the platform kills it', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')));
        })
    );

    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const pending = GET(uploadsRequest('/uploads/reels/a.mp4'));
    jest.advanceTimersByTime(25_000);
    const response = await pending;

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ success: false, message: 'The API took too long to answer' });
    // The operator's side of it: which file, and that it was the deadline.
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('no answer within 25000 ms'));
    logged.mockRestore();
  });

  it('lifts the deadline once the API has answered, so a long transfer is not cut off', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation(async (_input, init) => {
      signal = init?.signal ?? undefined;
      return new Response('reel-bytes', { status: 200 });
    });

    const response = await GET(uploadsRequest('/uploads/reels/a.mp4'));
    jest.advanceTimersByTime(10 * 60 * 1000);

    expect(signal?.aborted).toBe(false);
    expect(await response.text()).toBe('reel-bytes');
  });

  it('reports an unreachable API as a failure, not as an empty file', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await GET(uploadsRequest('/uploads/avatars/a.png'));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ success: false, message: 'Media unavailable' });
    quiet.mockRestore();
  });
});

describe('HEAD /uploads/[...path]', () => {
  it('returns the headers and no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { 'content-type': 'image/png', 'content-length': '2048' } }));

    const response = await HEAD(uploadsRequest('/uploads/avatars/a.png', { method: 'HEAD' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('2048');
    expect(response.body).toBeNull();
  });
});
