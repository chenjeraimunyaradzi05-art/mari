import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

/**
 * Proxies /uploads/* to the backend, which serves user media (avatars, post
 * images, resumes) from its own static mount.
 *
 * Why this exists: nothing carried /uploads/* in production. `next.config.js`
 * rewrites it in development but returns [] when NETLIFY is set, and the only
 * rule in public/_redirects pointed /uploads/* at itself rather than at the
 * backend. So every uploaded image 404'd once deployed while working locally.
 *
 * Reads the backend URL at request time from the same env var the rest of the
 * app uses, so this works wherever it is deployed without a hardcoded host.
 */
async function proxy(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const target = `${BACKEND_URL}${pathname}${search}`;

  const headers: Record<string, string> = {};
  // `range` matters for video seeking; the rest let the browser cache and
  // authenticate the same way it would against the backend directly.
  const forward = ['authorization', 'cookie', 'accept', 'range', 'if-none-match', 'if-modified-since'];
  for (const key of forward) {
    const value = request.headers.get(key);
    if (value) headers[key] = value;
  }

  try {
    const upstream = await fetch(target, { method: request.method, headers });

    // 304 and 204 carry no body, and constructing a Response with one throws.
    const body = upstream.status === 304 || upstream.status === 204
      ? null
      : await upstream.arrayBuffer();

    const response = new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
    });

    const skip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
    upstream.headers.forEach((value, key) => {
      if (!skip.has(key.toLowerCase())) response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error(`[uploads proxy] ${request.method} ${pathname} →`, error);
    return NextResponse.json({ success: false, message: 'Media unavailable' }, { status: 502 });
  }
}

export const GET = proxy;
export const HEAD = proxy;
