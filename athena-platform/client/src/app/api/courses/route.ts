import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';
  const category = searchParams.get('category') || '';

  try {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...(category && { category }),
    });

    const response = await fetch(
      `${API_URL}/api/courses?${queryParams.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Courses API error:', error);
    return NextResponse.json(
      { error: 'Courses service unavailable', courses: [] },
      { status: 503 }
    );
  }
}
