import { NextResponse } from 'next/server';

// Dummy model for personas
let personas = [
  'student',
  'jobseeker',
  'parent',
];

export async function GET() {
  return NextResponse.json(personas);
}

import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  personas = body.personas || personas;
  return NextResponse.json(personas);
}
