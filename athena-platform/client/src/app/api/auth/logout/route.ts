import { NextRequest, NextResponse } from 'next/server';
import {
  buildBackendProxyHeaders,
  forwardSetCookieHeaders,
  rejectUntrustedSameOriginRequest,
} from '../proxy-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  // Always clear the refresh cookie on the Next.js side, even if the backend call fails.
  // This ensures the user is fully logged out client-side regardless of backend availability.
  try {
    const originError = rejectUntrustedSameOriginRequest(request);
    if (originError) {
      return originError;
    }

    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: buildBackendProxyHeaders(request),
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
    res.cookies.set({
      name: 'refreshToken',
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error('Logout API error:', error);
    // Even on error, clear the cookie so the user is logged out
    const res = NextResponse.json(
      { success: true, message: 'Logged out' },
      { status: 200 }
    );
    res.cookies.set({
      name: 'refreshToken',
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return res;
  }
}
