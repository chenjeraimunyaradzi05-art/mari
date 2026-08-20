import { NextRequest, NextResponse } from 'next/server';

export function forwardSetCookieHeaders(from: Response, to: NextResponse) {
  const headersWithGetSetCookie = from.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    const cookies = headersWithGetSetCookie.getSetCookie();
    for (const cookie of cookies) {
      to.headers.append('Set-Cookie', cookie);
    }
    if (cookies.length > 0) {
      return;
    }
  }

  const fallbackCookie = from.headers.get('set-cookie');
  if (fallbackCookie) {
    to.headers.append('Set-Cookie', fallbackCookie);
  }
}

function getRequestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (origin) {
    return origin;
  }

  const referer = request.headers.get('referer');
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function rejectUntrustedSameOriginRequest(request: NextRequest): NextResponse | null {
  const requestOrigin = getRequestOrigin(request);
  if (requestOrigin && requestOrigin === request.nextUrl.origin) {
    return null;
  }

  return NextResponse.json(
    { success: false, message: 'Cross-site auth requests are not allowed' },
    { status: 403 }
  );
}

export function buildBackendProxyHeaders(
  request: NextRequest,
  extras: Record<string, string> = {}
): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extras,
  };

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const originHeader = request.headers.get('origin');
  if (originHeader) {
    headers.Origin = originHeader;
  }

  const refererHeader = request.headers.get('referer');
  if (refererHeader) {
    headers.Referer = refererHeader;
  }

  return headers;
}
