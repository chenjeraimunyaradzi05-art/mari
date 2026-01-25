import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';
  const location = searchParams.get('location') || '';
  const type = searchParams.get('type') || '';
  const salary_min = searchParams.get('salary_min') || '';
  const remote = searchParams.get('remote') || '';

  try {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...(location && { location }),
      ...(type && { type }),
      ...(salary_min && { salary_min }),
      ...(remote && { remote }),
    });

    const response = await fetch(
      `${API_URL}/api/jobs?${queryParams.toString()}`,
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
    console.error('Jobs API error:', error);
    return NextResponse.json(
      { error: 'Jobs service unavailable', jobs: [] },
      { status: 503 }
    );
  }
}
