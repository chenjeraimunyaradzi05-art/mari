import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL } from '@/lib/runtime-config';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  const target = `${BACKEND_API_URL}${pathname}${search}`;

  const headers: Record<string, string> = {};
  const forward = ['authorization', 'content-type', 'cookie', 'accept', 'x-request-id'];
  for (const key of forward) {
    const val = request.headers.get(key);
    if (val) headers[key] = val;
  }

  const init: RequestInit = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const res = new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
    });

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
    console.error(`[uploads proxy] ${request.method} ${pathname} →`, error);
    return NextResponse.json(
      { success: false, message: 'Upload asset unavailable' },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const HEAD = proxy;
