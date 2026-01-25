import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';
  const filter = searchParams.get('filter') || 'all';

  try {
    const authHeader = request.headers.get('authorization');
    
    const response = await fetch(
      `${API_URL}/api/feed?page=${page}&limit=${limit}&filter=${filter}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { Authorization: authHeader }),
        },
        next: { revalidate: 60 },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json(
      { error: 'Feed service unavailable', posts: [] },
      { status: 503 }
    );
  }
}
