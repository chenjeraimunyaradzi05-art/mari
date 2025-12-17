import { NextResponse } from 'next/server';
export { applySecurityHeaders } from '../src/lib/securityHeaders';

export const runtime = 'nodejs';

export async function proxy(request: any) {
  try {
    // Ensure correlation id (best effort)
    try {
      const { ensureCorrelationId } = await import('../src/lib/metrics');
      const existing = request.headers.get('x-correlation-id');
      const id = ensureCorrelationId(existing);
      (request as any).__correlationId = id;
    } catch (err) {
      console.warn('metrics.ensureCorrelationId not available', err);
    }

    // Path-based rate limiting
    const pathname = (() => {
      try { return request.nextUrl?.pathname || new URL(request.url).pathname; } catch { return '' }
    })();

    try {
      const { rateLimit } = await import('../src/lib/ratelimit');
      if (pathname.startsWith('/api/auth')) {
        const rl = await rateLimit(request, { limit: 1, windowMs: 60000 }, { perEndpoint: true });
        if (!rl.success) return (rl as any).response;
      } else if (pathname.startsWith('/api/metrics')) {
        const rl = await rateLimit(request, { limit: 1000, windowMs: 60000 }, { perEndpoint: true });
        if (!rl.success) return (rl as any).response;
      } else if (pathname.startsWith('/api')) {
        const rl = await rateLimit(request, { limit: 100, windowMs: 60000 }, { perEndpoint: true });
        if (!rl.success) return (rl as any).response;
      }
    } catch (err) {
      console.warn('rateLimit not available, proceeding without rate limiting', err);
    }

    // Auth gating for admin area (best-effort)
    try {
      if (pathname.startsWith('/admin') || pathname.startsWith('/app/admin')) {
        const { getToken } = await import('next-auth/jwt');
        const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
        if (!token) {
          return NextResponse.redirect(new URL('/api/auth/signin', request.url));
        }
      }
    } catch (err) {
      console.warn('Auth token check skipped (next-auth not available or failed)', err);
    }

    const response = NextResponse.next();

    // Set correlation id
    if ((request as any).__correlationId) response.headers.set('x-correlation-id', (request as any).__correlationId);

    // Apply security headers
    try {
      const { applySecurityHeaders } = await import('../src/lib/securityHeaders');
      applySecurityHeaders(response as any);
    } catch (err) {
      console.warn('applySecurityHeaders failed', err);
    }

    return response;
  } catch (err) {
    console.error('Proxy error (fallback to next):', err);
    try { return NextResponse.next(); } catch { return new Response(null); }
  }
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
