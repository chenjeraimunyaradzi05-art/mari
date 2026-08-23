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

    const body = await request.json();
    
    const response = await fetch(`${API_URL}/api/auth/register`, {
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

    const res = NextResponse.json(data, { status: response.status });
    forwardSetCookieHeaders(response, res);
    return res;
  } catch (error) {
    return backendFailureResponse('Register API error', error);
  }
}
