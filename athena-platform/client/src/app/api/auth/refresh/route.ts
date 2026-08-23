import { NextRequest, NextResponse } from 'next/server';
import {
  backendFailureResponse,
  buildBackendProxyHeaders,
  forwardSetCookieHeaders,
  rejectUntrustedSameOriginRequest,
} from '../proxy-utils';
import { BACKEND_API_URL as API_URL } from '@/lib/runtime-config';

export async function POST(request: NextRequest) {
  try {
    const originError = rejectUntrustedSameOriginRequest(request);
    if (originError) {
      return originError;
    }

    // The client sends an empty body with HttpOnly cookie for refresh.
    // request.json() throws on empty body, so we guard it.
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is expected — refresh relies on the cookie, not a body payload.
    }

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
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

    // Forward Set-Cookie from backend so the browser receives the rotated refresh token
    const res = NextResponse.json(data, { status: response.status });
    forwardSetCookieHeaders(response, res);
    return res;
  } catch (error) {
    return backendFailureResponse('Refresh token API error', error);
  }
}
