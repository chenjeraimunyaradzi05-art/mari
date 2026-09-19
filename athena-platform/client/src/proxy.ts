import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const registry = require('../i18n.registry.js');

// Backend URL for API proxying.
// On Netlify the env var is set in the dashboard; locally it defaults to localhost.
const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

// Routes that require authentication. /admin is here so the purely static
// admin pages need a session too; the API's requireRole('ADMIN') still guards
// every piece of data they show.
const protectedRoutes = [
  '/dashboard',
  '/onboarding',
  '/settings',
  '/admin',
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
];

const isProduction = process.env.NODE_ENV === 'production';

/**
 * The content security policy, minted per request with a nonce. Only the
 * scripts Next.js renders with this nonce run, and the scripts they load
 * (Stripe.js, Google sign-in, PostHog) are trusted through 'strict-dynamic';
 * an inline script injected into the page has no nonce and does not run.
 * The 'unsafe-inline' and https: at the end are ignored by any browser that
 * understands nonces and only keep very old ones working.
 */
function buildContentSecurityPolicy(nonce: string): string {
  const scriptSrc = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`, isProduction ? '' : `'unsafe-eval'`, `'unsafe-inline'`, 'https:']
    .filter(Boolean)
    .join(' ');
  const connectSrc = ['\'self\'', 'https:', 'wss:', isProduction ? '' : 'http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*']
    .filter(Boolean)
    .join(' ');
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // 'none', not 'self'. This directive is the one a browser actually
    // enforces against clickjacking: CSP Level 2 requires X-Frame-Options to be
    // ignored on any response that also carries frame-ancestors, and every HTML
    // response carries this policy. While it said 'self', the DENY in
    // client/netlify.toml was doing nothing and ATHENA could frame itself.
    // Nothing needs that: every iframe in the client embeds a third party,
    // which is frame-src's business below, and both markdown sanitisers strip
    // iframes out of member content.
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    isProduction ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

// Next 16 renamed this root file convention from middleware.ts to proxy.ts,
// and the export has to be renamed with it. The generated entry picks the
// handler as `(isProxy ? mod.proxy : mod.middleware) || mod.default`
// (next/dist/build/templates/middleware.js), so a file named proxy.ts still
// exporting `middleware` supplies nothing for it to call.
//
// That failure is loud, not silent — an earlier version of this comment
// claimed the build would say nothing, which is not true. `next build` throws
// E903 from validateMiddlewareProxyExports in
// next/dist/build/analysis/get-page-static-info.js, and its message names the
// middleware-to-proxy migration by name; the generated entry then throws E394
// at module evaluation. Only `next dev` downgrades both to a logged error.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A fresh nonce for this response. It travels on the request too, so the
  // app router can put it on the scripts it renders.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  const withPolicy = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
    return response;
  };

  // ── API Proxy ────────────────────────────────────────────────────
  // Rewrite /api/* and /uploads/* to the API host at NEXT_PUBLIC_API_URL.
  // Doing it here rather than in a route handler is what puts it ahead of the
  // redirect rules and the handlers for a matched path.
  //
  // On Netlify this file is still deployed as an Edge Function, even though
  // Next builds it for the Node.js runtime. Those are two different questions
  // and an earlier version of this comment ran them together, "correcting" the
  // original "Edge Function on Netlify" wording as false. It was not false.
  //
  // Next's compile target did move with the rename: runDependingOnPageType in
  // next/dist/build/entries.js sends isProxyFile straight to the Node server
  // compiler, whereas middleware.ts with no `runtime` set went to the edge
  // compiler, and declaring a runtime here is now error E1031, "Proxy always
  // runs on Node.js runtime". What Next does with that is record
  // `/_middleware` with runtime "nodejs" in functions-config-manifest.json
  // (next/dist/build/index.js).
  //
  // Netlify then picks that entry up and wraps it as a Deno edge function
  // regardless: createEdgeHandlers in @netlify/plugin-nextjs (5.15.11 per
  // package-lock.json) routes a "nodejs" definition through
  // copyHandlerDependenciesForNodeMiddleware, which emits the handler into
  // .netlify/edge-functions/ on top of edge-runtime/shim/node.js — a shim that
  // polyfills process and Buffer and stubs Deno.cwd. So "Edge Function on
  // Netlify" describes the deployment surface correctly; only a claim about
  // Next's own compile target would be wrong.
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
    return withPolicy(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
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
      const response = withPolicy(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
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

  return withPolicy(NextResponse.next({ request: { headers: requestHeaders } }));
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
