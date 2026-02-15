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
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Forward Set-Cookie from backend so the browser receives the refresh token cookie
    const res = NextResponse.json(data, { status: response.status });
    forwardSetCookieHeaders(response, res);
    return res;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
