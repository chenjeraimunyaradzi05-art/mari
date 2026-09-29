import { NextRequest, NextResponse } from 'next/server';
import { proxyIdentityHeaders } from '../../api/proxy-identity';

export const dynamic = 'force-dynamic';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

/**
 * How long to wait for the API to start answering before telling the browser
 * so. It bounds the wait for the response headers only, not the transfer: a
 * reel is streamed through here and can take longer than this to arrive on a
 * slow connection, and a deadline on the whole exchange would cut it off
 * half-played. What it stops is the case that used to hold a function open
 * until the platform killed it, which is an API that accepted the connection
 * and never replied.
 */
const UPSTREAM_HEADERS_TIMEOUT_MS = 25_000;

/** Hop-by-hop headers, and the encoding fetch has already undone for us. */
const SKIPPED_RESPONSE_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);

/**
 * Proxies /uploads/* to the backend, which serves user media (avatars, post
 * images, resumes) from its own static mount.
 *
 * Why this exists: nothing carried /uploads/* in production. `next.config.js`
 * rewrites it in development but returns [] when NETLIFY is set, and the only
 * rule in public/_redirects pointed /uploads/* at itself rather than at the
 * backend. So every uploaded image 404'd once deployed while working locally.
 *
 * The backend address is the NEXT_PUBLIC_API_URL the site was built with. An
 * earlier version of this note said it was read "at request time"; it is not.
 * Next.js replaces every NEXT_PUBLIC_* reference with its build-time value in
 * server route handlers too, so a change in the Netlify dashboard takes effect
 * only after a new deploy.
 *
 * The response is streamed through rather than read into memory first. It
 * used to be `await upstream.arrayBuffer()`, which held a whole video in the
 * function's memory before sending the first byte, and a buffered function
 * response on Netlify has a payload cap of a few megabytes, so larger media
 * failed outright.
 */
async function proxy(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const target = `${BACKEND_URL}${pathname}${search}`;

  // The visitor's identity travels with the request (see api/proxy-identity).
  const headers: Record<string, string> = proxyIdentityHeaders(request.headers);
  // `range` matters for video seeking; the rest let the browser cache and
  // authenticate the same way it would against the backend directly.
  const forward = ['authorization', 'cookie', 'accept', 'range', 'if-none-match', 'if-modified-since'];
  for (const key of forward) {
    const value = request.headers.get(key);
    if (value) headers[key] = value;
  }

  // One controller for both ways the exchange can end early: the deadline for
  // the API's first answer, and the visitor leaving, in which case there is no
  // one left to stream to.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, UPSTREAM_HEADERS_TIMEOUT_MS);
  const onVisitorGone = () => controller.abort();
  request.signal?.addEventListener('abort', onVisitorGone, { once: true });

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, signal: controller.signal });
  } catch (error) {
    request.signal?.removeEventListener('abort', onVisitorGone);
    if (timedOut) {
      console.error(`[uploads proxy] ${request.method} ${pathname} → no answer within ${UPSTREAM_HEADERS_TIMEOUT_MS} ms`);
      return NextResponse.json(
        { success: false, message: 'The API took too long to answer' },
        { status: 504 }
      );
    }
    console.error(`[uploads proxy] ${request.method} ${pathname} →`, error);
    return NextResponse.json({ success: false, message: 'Media unavailable' }, { status: 502 });
  } finally {
    // The deadline was for the first answer. From here the body streams for as
    // long as it takes, and ends early only if the visitor goes.
    clearTimeout(timer);
  }

  // 304 and 204 carry no body, and constructing a Response with one throws.
  // HEAD has none either.
  const hasBody = upstream.status !== 304 && upstream.status !== 204 && request.method !== 'HEAD';
  const response = new NextResponse(hasBody ? upstream.body : null, {
    status: upstream.status,
    statusText: upstream.statusText,
  });

  // When the API compressed the body, fetch has already decompressed it, so
  // the upstream Content-Length describes bytes this response does not send.
  const decoded = upstream.headers.has('content-encoding');
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (SKIPPED_RESPONSE_HEADERS.has(name)) return;
    if (decoded && name === 'content-length') return;
    response.headers.set(key, value);
  });

  return response;
}

export const GET = proxy;
export const HEAD = proxy;
