import { NextResponse } from 'next/server';

// Dummy model for onboarding completion
let completed = false;

export async function POST() {
  completed = true;
  return NextResponse.json({ completed });
}

export async function GET() {
  return NextResponse.json({ completed });
}
