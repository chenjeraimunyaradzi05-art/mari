import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    const data = await response.json();
    
    // Forward any cookies from the backend
    const setCookie = response.headers.get('set-cookie');
    const res = NextResponse.json(data, { status: response.status });
    
    if (setCookie) {
      res.headers.set('set-cookie', setCookie);
    }
    
    return res;
  } catch (error) {
    console.error('Auth login error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to login' },
      { status: 500 }
    );
  }
}
