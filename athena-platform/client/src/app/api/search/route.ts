import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all';
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  try {
    const response = await fetch(
      `${API_URL}/api/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}&limit=${limit}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.get('authorization') && {
            Authorization: request.headers.get('authorization')!,
          }),
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search service unavailable' },
      { status: 503 }
    );
  }
}
