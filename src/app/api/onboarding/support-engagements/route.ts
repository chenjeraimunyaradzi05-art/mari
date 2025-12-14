import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Dummy model for support engagement
const engagements: unknown[] = [];

export async function POST(req: NextRequest) {
  const body = await req.json();
  engagements.push(body);
  return NextResponse.json({ status: 'ok', engagements });
}

export async function GET() {
  return NextResponse.json(engagements);
}
