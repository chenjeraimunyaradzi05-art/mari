import { NextRequest, NextResponse } from 'next/server';
import {
  buildBackendProxyHeaders,
  forwardSetCookieHeaders,
  rejectUntrustedSameOriginRequest,
} from '../proxy-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const originError = rejectUntrustedSameOriginRequest(request);
    if (originError) {
      return originError;
    }

    const body = await request.json();

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: buildBackendProxyHeaders(request),
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { success: false, message: response.statusText || 'Backend error' };
    }

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
