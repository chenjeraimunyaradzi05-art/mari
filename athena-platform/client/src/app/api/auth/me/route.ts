import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL as API_URL } from '@/lib/runtime-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { success: false, message: response.statusText || 'Backend error' };
    }
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Auth me API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
