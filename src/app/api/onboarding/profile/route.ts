import { NextRequest, NextResponse } from 'next/server';

// Dummy model for onboarding profile
let profile = {
  name: 'Demo User',
  preferred_name: 'Demo',
  pronouns: 'they/them',
  timezone: 'UTC',
};

export async function GET() {
  return NextResponse.json(profile);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  profile = { ...profile, ...body };
  return NextResponse.json(profile);
}
