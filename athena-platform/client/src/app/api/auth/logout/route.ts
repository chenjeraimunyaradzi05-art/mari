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
  // Always clear the refresh cookie on the Next.js side, even if the backend call fails.
  // This ensures the user is fully logged out client-side regardless of backend availability.
  const isProduction = process.env.NODE_ENV === 'production';
  const clearCookie =
    `refreshToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`;

  try {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { success: false, message: response.statusText || 'Backend error' };
    }

    const res = NextResponse.json(data, { status: response.status });
    // Forward any Set-Cookie from backend
    forwardSetCookieHeaders(response, res);
    // Also explicitly clear the cookie on the Next.js domain
    res.headers.append('Set-Cookie', clearCookie);
    return res;
  } catch (error) {
    console.error('Logout API error:', error);
    // Even on error, clear the cookie so the user is logged out
    const res = NextResponse.json(
      { success: true, message: 'Logged out' },
      { status: 200 }
    );
    res.headers.append('Set-Cookie', clearCookie);
    return res;
  }
}
