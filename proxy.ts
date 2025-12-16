import { NextResponse } from 'next/server';
import { proxy as appProxy } from './app/proxy';
export { applySecurityHeaders } from './src/lib/securityHeaders';

// Forward to the in-app proxy implementation. This preserves behavior while
// moving to the new file convention that Next.js 16 expects.
export async function proxy(request: any) {
  try {
    if (typeof appProxy === 'function') return await appProxy(request as any);
  } catch (err) {
    console.warn('app/proxy not available, falling back to NextResponse.next()', err);
  }
  return NextResponse.next();
}

