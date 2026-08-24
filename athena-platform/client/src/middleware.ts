import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const registry = require('../i18n.registry.js');

// Backend URL for API proxying.
// On Netlify the env var is set in the dashboard; locally it defaults to localhost.
const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/onboarding',
  '/settings',
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── API Proxy ────────────────────────────────────────────────────
  // Rewrite /api/* and /uploads/* to the Railway backend.
  // Running in middleware (Edge Function on Netlify) ensures this
  // executes before any redirect rules or serverless functions.
  //
  // EXCEPTION: /api/auth/* routes are NOT rewritten here.
  // Auth routes set HttpOnly cookies (refreshToken) and
  // NextResponse.rewrite() to external URLs on Netlify Edge may not
  // reliably forward Set-Cookie headers. Instead, auth requests fall
  // through to the Next.js API route handlers in app/api/auth/ which
  // explicitly forward cookies via response.headers.getSetCookie().
  //
  // On Netlify this rewrite is skipped and the request is served by the route
  // handlers instead: app/api/[...path] for /api/*, app/uploads/[...path] for
  // /uploads/*. Nothing in public/_redirects or netlify.toml proxies those
  // paths — a rule there cannot read NEXT_PUBLIC_API_URL, so the backend host
  // would have to be hardcoded. See public/_redirects for the reasoning.
  if (!process.env.NETLIFY) {
    const isAuthRoute = pathname.startsWith('/api/auth');
    if (!isAuthRoute && (pathname.startsWith('/api') || pathname.startsWith('/uploads'))) {
      const destination = new URL(`${BACKEND_URL}${pathname}`);
      request.nextUrl.searchParams.forEach((value, key) => {
        destination.searchParams.set(key, value);
      });
      return NextResponse.rewrite(destination);
    }
  }

  const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
  if (maintenanceMode && !pathname.startsWith('/maintenance')) {
    const url = request.nextUrl.clone();
    url.pathname = '/maintenance';
    return NextResponse.rewrite(url);
  }

  const locales = registry?.locales || [];
  const defaultLocale = registry?.defaultLocale || 'en-AU';
  if (locales.length) {
    const escaped = locales.map((locale: string) => locale.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const localePattern = new RegExp(`^/(${escaped.join('|')})(/|$)`, 'i');
    const match = pathname.match(localePattern);

    if (match) {
      const locale = match[1];
      const rest = pathname.slice(locale.length + 1) || '/';
      if (locale.toLowerCase() !== String(defaultLocale).toLowerCase()) {
        const url = request.nextUrl.clone();
        url.pathname = `/${defaultLocale}${rest === '' ? '' : rest}`;
        return NextResponse.redirect(url);
      }

      const url = request.nextUrl.clone();
      url.pathname = rest === '' ? '/' : rest.startsWith('/') ? rest : `/${rest}`;
      const response = NextResponse.rewrite(url);
      response.headers.set('x-athena-locale', locale);
      return response;
    }
  }
  
  // Check if user has a session — the backend sets refreshToken as an HttpOnly cookie.
  // Access tokens are in-memory only, so we check for the refresh cookie instead.
  const token = request.cookies.get('refreshToken')?.value;
  const isAuthenticated = !!token;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the route is an auth page (login, register, etc.)
  const isAuthPage = authRoutes.some((route) => pathname.startsWith(route));

  // If accessing protected route without auth, redirect to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing auth page while authenticated, redirect to dashboard
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
