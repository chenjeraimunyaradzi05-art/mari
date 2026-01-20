import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const registry = require('../i18n.registry.js');

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

// Routes that are always public
const publicRoutes = [
  '/',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  
  // Check if user has auth token (stored in cookies for SSR)
  const token = request.cookies.get('accessToken')?.value;
  const isAuthenticated = !!token;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the route is an auth route (login, register, etc.)
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If accessing protected route without auth, redirect to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing auth route while authenticated, redirect to dashboard
  if (isAuthRoute && isAuthenticated) {
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
     * - API routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
