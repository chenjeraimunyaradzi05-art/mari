import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  
  // Clear auth cookies
  res.cookies.delete('accessToken');
  res.cookies.delete('refreshToken');
  
  return res;
}
