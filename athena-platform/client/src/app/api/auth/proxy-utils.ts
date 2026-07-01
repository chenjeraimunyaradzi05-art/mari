import { NextRequest, NextResponse } from 'next/server';

type ParsedSetCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  maxAge?: number;
  expires?: Date;
};

function splitCombinedSetCookieHeader(headerValue: string): string[] {
  const cookies: string[] = [];
  let current = '';
  let inExpires = false;

  for (let i = 0; i < headerValue.length; i += 1) {
    const char = headerValue[i];
    const nextChars = headerValue.slice(i, i + 8).toLowerCase();

    if (!inExpires && nextChars === 'expires=') {
      inExpires = true;
    }

    if (char === ',' && !inExpires) {
      cookies.push(current.trim());
      current = '';
      continue;
    }

    current += char;

    if (inExpires && char === ';') {
      inExpires = false;
    }
  }

  if (current.trim()) {
    cookies.push(current.trim());
  }

  return cookies;
}

function parseSetCookie(cookieHeader: string): ParsedSetCookie | null {
  const parts = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const [nameValue, ...attributes] = parts;
  const separatorIndex = nameValue.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  const parsed: ParsedSetCookie = {
    name: nameValue.slice(0, separatorIndex),
    value: nameValue.slice(separatorIndex + 1),
  };

  for (const attribute of attributes) {
    const [rawKey, ...rawValueParts] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    const value = rawValueParts.join('=').trim();

    switch (key) {
      case 'domain':
        parsed.domain = value || undefined;
        break;
      case 'path':
        parsed.path = value || '/';
        break;
      case 'httponly':
        parsed.httpOnly = true;
        break;
      case 'secure':
        parsed.secure = true;
        break;
      case 'samesite': {
        const normalized = value.toLowerCase();
        if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
          parsed.sameSite = normalized;
        }
        break;
      }
      case 'max-age': {
        const maxAge = Number.parseInt(value, 10);
        if (Number.isFinite(maxAge)) {
          parsed.maxAge = maxAge;
        }
        break;
      }
      case 'expires': {
        const expires = new Date(value);
        if (!Number.isNaN(expires.getTime())) {
          parsed.expires = expires;
        }
        break;
      }
      default:
        break;
    }
  }

  return parsed;
}

function getSetCookieHeaders(from: Response): string[] {
  const headersWithGetSetCookie = from.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    const cookies = headersWithGetSetCookie.getSetCookie().filter(Boolean);
    if (cookies.length > 0) {
      return cookies;
    }
  }

  const fallbackCookie = from.headers.get('set-cookie');
  if (!fallbackCookie) {
    return [];
  }

  return splitCombinedSetCookieHeader(fallbackCookie).filter(Boolean);
}

export function forwardSetCookieHeaders(from: Response, to: NextResponse) {
  const cookieHeaders = getSetCookieHeaders(from);

  for (const cookieHeader of cookieHeaders) {
    const parsed = parseSetCookie(cookieHeader);

    if (parsed) {
      to.cookies.set({
        name: parsed.name,
        value: parsed.value,
        domain: parsed.domain,
        path: parsed.path || '/',
        httpOnly: parsed.httpOnly,
        secure: parsed.secure,
        sameSite: parsed.sameSite,
        ...(typeof parsed.maxAge === 'number' ? { maxAge: parsed.maxAge } : {}),
        ...(parsed.expires ? { expires: parsed.expires } : {}),
      });
      continue;
    }

    to.headers.append('Set-Cookie', cookieHeader);
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
