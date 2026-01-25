import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';
    const specialty = searchParams.get('specialty');
    const industry = searchParams.get('industry');

    let url = `${API_URL}/api/mentors?page=${page}&limit=${limit}`;
    if (specialty) url += `&specialty=${encodeURIComponent(specialty)}`;
    if (industry) url += `&industry=${encodeURIComponent(industry)}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Mentors API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch mentors' },
      { status: 500 }
    );
  }
}
