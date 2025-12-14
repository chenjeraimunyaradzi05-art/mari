import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { ensureCorrelationId } from '@/lib/metrics';

const PUBLIC_PATHS = [
  '/',
  '/home',
  '/impact',
  '/education',
  '/search',
  '/feed',
  '/org-pages',
  '/social',
  '/wellness',
  '/login',
  '/identity',
  '/api/auth',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/public',
];

const SUPPORTED_LOCALES = ['en-US', 'es-ES', 'fr-FR', 'hi-IN'];
const DEFAULT_LOCALE = 'en-US';

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function getLocale(request: NextRequest) {
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) return DEFAULT_LOCALE;
  
  // Simple matching for now
  const preferred = acceptLanguage.split(',')[0];
  if (SUPPORTED_LOCALES.some(l => l.startsWith(preferred))) {
    return SUPPORTED_LOCALES.find(l => l.startsWith(preferred)) || DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const correlationId = ensureCorrelationId(request.headers.get('x-correlation-id'));

  // 1. Locale Handling (i18n)
  // Check if pathname is missing locale
  const pathnameIsMissingLocale = SUPPORTED_LOCALES.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Redirect if missing locale (unless it's an API or public asset)
  // Note: For this implementation, we are NOT forcing the redirect yet to avoid breaking existing routes
  // but we are detecting it.
  const locale = getLocale(request);
  
  // 2. Data Residency Check (Simulated)
  // In a real edge deployment, we would check the user's region cookie here
  // and route to the correct regional origin.
  const regionCookie = request.cookies.get('data_region');
  if (regionCookie) {
    // request.headers.set('x-data-region', regionCookie.value);
  }

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set('x-correlation-id', correlationId);
    response.headers.set('x-locale', locale);
    return response;
  }

  const token = await getToken({ req: request });
  if (!token) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('from', pathname);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }
  const identityFlagStatus = (token as { identityFlagStatus?: string | null } | null)?.identityFlagStatus;
  const flagged = identityFlagStatus && identityFlagStatus.toUpperCase() !== 'VERIFIED';

  if (flagged) {
    const redirectUrl = new URL('/identity', request.url);
    redirectUrl.searchParams.set('from', pathname);
    redirectUrl.searchParams.set('reason', 'identity_flagged');
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('x-correlation-id', correlationId);
  return response;
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
