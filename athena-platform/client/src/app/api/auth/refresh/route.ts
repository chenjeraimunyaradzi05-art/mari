import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function forwardSetCookieHeaders(from: Response, to: NextResponse) {
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

export async function POST(request: NextRequest) {
  try {
    // The client sends an empty body with HttpOnly cookie for refresh.
    // request.json() throws on empty body, so we guard it.
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is expected — refresh relies on the cookie, not a body payload.
    }

    const cookieHeader = request.headers.get('cookie');

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { success: false, message: response.statusText || 'Backend error' };
    }

    // Forward Set-Cookie from backend so the browser receives the rotated refresh token
    const res = NextResponse.json(data, { status: response.status });
    forwardSetCookieHeaders(response, res);
    return res;
  } catch (error) {
    console.error('Refresh token API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
