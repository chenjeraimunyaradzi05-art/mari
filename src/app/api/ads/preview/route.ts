import { NextResponse } from 'next/server';
import { getFrontendPreviewAds } from '@/lib/advertising';

export async function GET() {
  const ads = await getFrontendPreviewAds();
  return NextResponse.json({ ads });
}
