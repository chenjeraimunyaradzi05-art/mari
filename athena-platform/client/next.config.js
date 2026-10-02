/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

// The Content-Security-Policy is set per request in src/proxy.ts, where a
// nonce can be minted for it; a static header here could only allow every
// inline script, which is no policy at all.
//
// This comment said src/middleware.ts after Next 16's rename had already moved
// the file to src/proxy.ts. Nothing caught it: check-doc-references.js only
// reads tracked .md files, so a path cited in a JavaScript comment can rot
// without CI noticing.
// The host member media is served from, so next/image will optimise it.
//
// next/image refuses any remote host it has not been told about, and the
// pictures on the feed and the job pages (avatars, company logos) come from
// wherever the API's CDN_URL points, which is the owner's own CloudFront
// domain or bucket and cannot be known here. Setting NEXT_PUBLIC_MEDIA_HOST
// (a host name such as cdn.example.org, or a URL; several may be separated by
// commas) at build time adds it, the same way NEXT_PUBLIC_API_URL is read.
// Without it production would answer /_next/image with a refusal for every
// avatar. Only https hosts, and only plain host names, are accepted.
function mediaHostPatterns() {
  return (process.env.NEXT_PUBLIC_MEDIA_HOST || '')
    .split(',')
    .map((entry) => entry.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase())
    .filter((host) => /^(\*\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host))
    .map((hostname) => ({ protocol: 'https', hostname }));
}

const nextConfig = {
  // Enable standalone output for Docker deployments only.
  // Netlify's @netlify/plugin-nextjs manages output automatically.
  ...(process.env.NETLIFY ? {} : { output: 'standalone' }),
  turbopack: {
    root: __dirname,
  },
  // The developer section was withdrawn. Its pages described an API that does
  // not exist (OAuth tokens, /v1 routes, client libraries, webhooks, request
  // limits), and nothing here issues keys, documents terms or supports outside
  // developers. Old links and bookmarks go to the partnership page, where a
  // real conversation can start. Temporary on purpose: when a public API is
  // built it is its own project, with its own hostname, authentication, docs,
  // limits, support and terms, and these paths are free to return then.
  async redirects() {
    return [
      {
        source: '/developers/:path*',
        destination: '/contact-sales?intent=partners',
        permanent: false,
      },
    ];
  },
  // Security headers tracked in ATHENA_MEGA_IMPLEMENTATION_PLAN.md.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // DENY, to match `frame-ancestors 'none'` in src/proxy.ts,
          // public/_headers and the sibling netlify.toml.
          //
          // This header is not what stops a modern browser framing the page.
          // CSP Level 2 requires a browser to ignore X-Frame-Options entirely
          // on any response that also carries a frame-ancestors directive, and
          // every HTML response goes through src/proxy.ts, which always sends
          // one. So the value here was never the thing being enforced, and an
          // earlier attempt to settle the SAMEORIGIN/DENY disagreement by
          // editing only this line and public/_headers would have changed
          // nothing a browser does. It is kept in step anyway, for browsers too
          // old to understand frame-ancestors and for the paths the proxy's
          // matcher skips.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // The old auditor is gone from current browsers and its blocking mode
          // leaked page content where it survived; 0 is what OWASP advises.
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // One string, the same in public/_headers and the sibling
          // netlify.toml. A browser given several Permissions-Policy headers
          // enforces every one of them, so the strictest layer wins and a
          // feature any layer refuses is refused everywhere. microphone=()
          // here and in the other two was what made every voice note
          // (components/chat/VoiceRecorder.tsx) and every interview-coach
          // recording fail with a permission error while the buttons stayed
          // on screen. Only this origin may use the microphone. Nothing under
          // src/ asks for the camera, location or screen capture, so those
          // stay off; payment is delegated to Stripe's frame so the wallet
          // buttons inside its PaymentElement can use the Payment Request
          // API. src/__tests__/permissions-policy.test.ts fails if the three
          // layers drift apart or the policy stops matching what src/ uses.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=(self "https://js.stripe.com"), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'athena-media.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'athena-media.s3.ap-southeast-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
      },
      ...mediaHostPatterns(),
    ],
  },
  async rewrites() {
    // Local development only. On Netlify these rewrites are skipped and the
    // route handlers serve the same paths instead — app/api/[...path] for
    // /api/*, app/uploads/[...path] for /uploads/*. public/_redirects does NOT
    // proxy them; a rule there cannot read NEXT_PUBLIC_API_URL.
    if (process.env.NETLIFY) return [];

    // Auth routes (/api/auth/*) MUST be handled by Next.js API route handlers
    // in app/api/auth/* so they can forward Set-Cookie headers (refresh token).
    // All other /api/* and /uploads/* requests proxy directly to the backend.
    //
    // The localhost default is for `next dev` only. A production build that
    // reaches this line is one being self-hosted (Docker, a VPS) rather than
    // built on Netlify, and baking localhost into its rewrite table would send
    // every /api request to a port nothing is listening on, in a way that only
    // shows up as a connection refused in the browser. It stops here instead,
    // for the same reason src/lib/runtime-config.ts does.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    if (!backendUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'NEXT_PUBLIC_API_URL is not set. A self-hosted production build has ' +
            'to be told the origin of the deployed ATHENA API (for example ' +
            'https://athena-api.onrender.com, no trailing slash) so that /api ' +
            'and /uploads can be proxied to it. See DEPLOYMENT_GUIDE.md.'
        );
      }
      return rewritesTo('http://localhost:5000');
    }

    return rewritesTo(backendUrl);
  },
};

// The three rewrite groups, in one place, so the development default and the
// configured origin cannot drift apart.
function rewritesTo(backendUrl) {
  return {
    beforeFiles: [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ],
    afterFiles: [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ],
    fallback: [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ],
  };
}

// Sentry configuration for production error tracking
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps in production
  dryRun: process.env.NODE_ENV !== 'production',
};

// Export with Sentry wrapper if DSN is configured
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
