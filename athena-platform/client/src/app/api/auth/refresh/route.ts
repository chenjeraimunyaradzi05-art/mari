import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    const res = NextResponse.json(data, { status: response.status });
    
    if (response.ok && data.data?.accessToken) {
      res.cookies.set('accessToken', data.data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15,
      });
      
      if (data.data.refreshToken) {
        res.cookies.set('refreshToken', data.data.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
        });
      }
    }
    
    return res;
  } catch (error) {
    console.error('Refresh API error:', error);
    return NextResponse.json(
      { error: 'Token refresh service unavailable' },
      { status: 503 }
    );
  }
}
