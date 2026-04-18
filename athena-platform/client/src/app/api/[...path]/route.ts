import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL } from '@/lib/runtime-config';

export const dynamic = 'force-dynamic';

/**
 * Catch-all API proxy – forwards any /api/* request that does NOT have
 * a more-specific Next.js route handler to the Railway backend.
 *
 * Specific handlers (e.g. app/api/auth/login/route.ts) always take
 * priority over this catch-all in Next.js App Router routing.
 */
async function proxy(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const target = `${BACKEND_API_URL}${pathname}${search}`;

  // Forward essential request headers
  const headers: Record<string, string> = {};
  const forward = ['authorization', 'content-type', 'cookie', 'accept', 'x-request-id'];
  for (const key of forward) {
    const val = request.headers.get(key);
    if (val) headers[key] = val;
  }

  const init: RequestInit = { method: request.method, headers };

  // Forward body for methods that have one
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);

    // Stream the response body through
    const body = await upstream.arrayBuffer();
    const res = new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
    });

    // Forward response headers (skip hop-by-hop)
    const skip = new Set([
      'transfer-encoding',
      'connection',
      'keep-alive',
      'content-encoding',
    ]);
    upstream.headers.forEach((value, key) => {
      if (!skip.has(key.toLowerCase())) {
        res.headers.set(key, value);
      }
    });

    return res;
  } catch (error) {
    console.error(`[catch-all proxy] ${request.method} ${pathname} →`, error);
    return NextResponse.json(
      { success: false, message: 'Backend unavailable' },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
