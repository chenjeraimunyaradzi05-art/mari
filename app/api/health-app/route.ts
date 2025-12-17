import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', source: 'app-health-app' }, { status: 200 });
}
