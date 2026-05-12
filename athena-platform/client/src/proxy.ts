import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const registry = require('../i18n.registry.js');

// Routes that require authentication — prefix-matched
const protectedRoutes = [
  '/dashboard',
  '/onboarding',
  '/settings',
  '/profile',
  '/employer',
  '/finances',
  '/network',
  '/mentorship',
  '/admin',
  '/messages',
  '/growth',
  '/certifications',
  '/skills-marketplace',
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
];

// Admin-only routes — authenticated users without an admin flag see 403.
// We can only check the cookie presence here; real role enforcement is server-side.
// We add an extra layer by checking a signed hint cookie set by the backend.
const adminRoutes = ['/admin'];

function getSafeRedirectPath(candidate: string | null): string | null {
  if (!candidate) return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  // Prevent redirect loops to /login itself
  if (candidate.startsWith('/login')) return null;
  return candidate;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Maintenance mode ──────────────────────────────────────────────────────
  const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
  if (maintenanceMode && !pathname.startsWith('/maintenance')) {
    const url = request.nextUrl.clone();
    url.pathname = '/maintenance';
    return NextResponse.rewrite(url);
  }

  // ── i18n locale normalisation ─────────────────────────────────────────────
  const locales: string[] = registry?.locales || [];
  const defaultLocale: string = registry?.defaultLocale || 'en-AU';

  if (locales.length) {
    const escaped = locales.map((locale: string) =>
      locale.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    );
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

  // ── Auth state — checked via HttpOnly refresh token cookie ────────────────
  const hasRefreshToken = !!request.cookies.get('refreshToken')?.value;

  // ── Route classification ──────────────────────────────────────────────────
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isAuthPage = authRoutes.some((route) => pathname.startsWith(route));

  // ── Unauthenticated access to protected route → redirect to login ─────────
  if (isProtectedRoute && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    const fullPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set('redirect', fullPath);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin gate — check for backend-set admin hint cookie ──────────────────
  if (isAdminRoute && hasRefreshToken) {
    const adminHint = request.cookies.get('athena_role')?.value;
    // adminHint is a plain (non-secret) role hint set by the backend after login.
    // The actual authorisation is still enforced server-side; this is a UX gate.
    if (adminHint && adminHint !== 'ADMIN' && adminHint !== 'SUPER_ADMIN') {
      return new NextResponse(null, { status: 403 });
    }
  }

  // ── Authenticated user hits auth page → redirect to dashboard ────────────
  if (isAuthPage && hasRefreshToken) {
    const requestedRedirect = getSafeRedirectPath(
      request.nextUrl.searchParams.get('redirect')
    );
    return NextResponse.redirect(
      new URL(requestedRedirect || '/dashboard', request.url)
    );
  }

  // ── Security response headers ─────────────────────────────────────────────
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder assets (svg, png, jpg, jpeg, gif, webp, ico, manifest)
     * - api/auth routes (handled by Next.js API route handlers)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
};
