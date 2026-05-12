import { NextRequest, NextResponse } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';

const SUPPORTED_LOCALES = ['en', 'ar', 'fr', 'sw', 'zu', 'xh', 'yo', 'ig'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'en';

/** Routes that require an authenticated session (refreshToken cookie). */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/settings',
  '/profile',
  '/employer',
  '/finances',
  '/network',
  '/mentorship',
  '/messages',
  '/growth',
  '/certifications',
  '/skills-marketplace',
  '/admin',
];

/** Admin-only routes — also need the athena_role cookie to equal ADMIN. */
const ADMIN_PREFIXES = ['/admin'];

/** Routes that authenticated users should be bounced away from. */
const AUTH_ONLY_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

/** Paths that are always public — never gated or redirected. */
const PUBLIC_PATHS = [
  '/maintenance',
  '/offline',
  '/api',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/robots.txt',
  '/sitemap.xml',
  '/uploads',
  '/icons',
  '/fonts',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function getSafeRedirectPath(redirect: string | null | undefined, fallback: string): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('..')) {
    return redirect;
  }
  return fallback;
}

function getLocaleFromPath(pathname: string): Locale | null {
  const seg = pathname.split('/')[1] as Locale;
  return SUPPORTED_LOCALES.includes(seg) ? seg : null;
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always skip truly static / API paths — no overhead
  if (isPublicPath(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  // 2. Maintenance mode — bounce everything except the maintenance page itself
  if (MAINTENANCE_MODE && pathname !== '/maintenance') {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  // 3. i18n — strip known locale prefix and redirect to bare path
  //    e.g. /en/dashboard → /dashboard
  const locale = getLocaleFromPath(pathname);
  if (locale && locale !== DEFAULT_LOCALE) {
    const stripped = pathname.slice(locale.length + 1) || '/';
    const target = new URL(stripped + request.nextUrl.search, request.url);
    const res = NextResponse.redirect(target, 308);
    return applySecurityHeaders(res);
  }
  if (locale === DEFAULT_LOCALE) {
    // /en/** → /** (canonical strip)
    const stripped = pathname.slice(DEFAULT_LOCALE.length + 1) || '/';
    const target = new URL(stripped + request.nextUrl.search, request.url);
    const res = NextResponse.redirect(target, 308);
    return applySecurityHeaders(res);
  }

  const refreshToken = request.cookies.get('refreshToken')?.value;
  const isAuthenticated = Boolean(refreshToken);

  // 4. Protected routes — require refreshToken cookie
  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(loginUrl);
      return applySecurityHeaders(res);
    }

    // Admin sub-check
    if (isAdminPath(pathname)) {
      const role = request.cookies.get('athena_role')?.value;
      if (role !== 'ADMIN') {
        const res = NextResponse.redirect(new URL('/dashboard', request.url));
        return applySecurityHeaders(res);
      }
    }
  }

  // 5. Bounce authenticated users away from auth pages
  if (isAuthenticated && isAuthOnlyPath(pathname)) {
    const redirect = request.nextUrl.searchParams.get('redirect');
    const destination = getSafeRedirectPath(redirect, '/dashboard');
    const res = NextResponse.redirect(new URL(destination, request.url));
    return applySecurityHeaders(res);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     * - public root files (robots.txt, manifest.json, sw.js)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|robots\\.txt|sitemap\\.xml).*)',
  ],
};
